'use client';

import { ProtectedRoute } from "@/app/components/ProtectedRoute";
import { AppShell } from "@/app/components/AppShell";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, Map, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { fetchWithAuth } from '@/lib/api';

interface TimeseriesPoint {
  year_month: string;
  gw_level_m_bgl?: number;
}

interface ForecastHistoryItem {
  _id: string;
  params: { state: string; district: string; forecast_horizon: number };
  result: {
    predicted_level: number;
    confidence: number;
    uncertainty: number;
    physics_compliance: number;
    predictions_monthly?: Array<{ month: number; predicted_level: number; lower_bound: number; upper_bound: number }>;
  };
  timestamp: string;
}

function DashboardContent() {
  const [chartData, setChartData] = useState<Array<{ period: string; level: number; predicted?: number; lower?: number; upper?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [predictedLevel, setPredictedLevel] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [physicsCompliance, setPhysicsCompliance] = useState<number | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    setError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      if (!token) { setLoading(false); return; }

      const [historyRes, metricsRes, statesRes] = await Promise.all([
        fetchWithAuth('/api/forecast/history?limit=5'),
        fetchWithAuth('/api/validation/metrics'),
        fetchWithAuth('/api/states'),
      ]);

      const history = historyRes.ok ? await historyRes.json() : { forecasts: [] };
      const metrics = metricsRes.ok ? await metricsRes.json() : null;
      const states = statesRes.ok ? await statesRes.json() : [];

      const forecasts: ForecastHistoryItem[] = history.forecasts || [];
      const stateList: string[] = Array.isArray(states) ? states : [];

      if (metrics?.metrics) {
        setAccuracy(metrics.metrics.r_squared != null ? Math.round(metrics.metrics.r_squared * 1000) / 10 : null);
        setPhysicsCompliance(metrics.metrics.physics_compliance != null ? Math.round(metrics.metrics.physics_compliance * 100) : null);
      }

      const latestForecast = forecasts[0];
      if (latestForecast?.result) {
        setPredictedLevel(latestForecast.result.predicted_level);
        setCurrentLevel(latestForecast.params?.lag_gw ?? latestForecast.result.predicted_level);
      }

      const stateForTimeseries = latestForecast?.params?.state || stateList[0] || 'maharashtra';
      const tsRes = await fetchWithAuth(`/api/timeseries/state?state=${encodeURIComponent(stateForTimeseries)}`);

      if (tsRes.ok) {
        const ts: TimeseriesPoint[] = await tsRes.json();
        const points = (ts || []).map((p) => ({
          period: p.year_month,
          level: typeof p.gw_level_m_bgl === 'number' ? p.gw_level_m_bgl : 0,
        }));
        if (latestForecast?.result?.predictions_monthly?.length) {
          const base = points.length ? points[points.length - 1].level : latestForecast.result.predicted_level;
          latestForecast.result.predictions_monthly.forEach((m) => {
            points.push({ period: `+${m.month}`, level: base, predicted: m.predicted_level, lower: m.lower_bound, upper: m.upper_bound });
          });
        }
        setChartData(points);
      } else if (latestForecast?.result?.predictions_monthly?.length) {
        setChartData(
          latestForecast.result.predictions_monthly.map((m) => ({
            period: `Month ${m.month}`,
            level: m.predicted_level,
            predicted: m.predicted_level,
            lower: m.lower_bound,
            upper: m.upper_bound,
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Dashboard">
      <div className="p-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-200 text-sm">
            {error}
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="p-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Current Level</p>
                <p className="text-3xl font-bold text-cyan-400">
                  {currentLevel != null ? `${currentLevel.toFixed(1)} m` : '—'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-400 opacity-50" />
            </div>
          </div>

          <div className="p-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Predicted (ST-GNN)</p>
                <p className="text-3xl font-bold text-green-400">
                  {predictedLevel != null ? `${predictedLevel.toFixed(1)} m` : '—'}
                </p>
              </div>
              <Zap className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </div>

          <div className="p-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Model R²</p>
                <p className="text-3xl font-bold text-cyan-400">
                  {accuracy != null ? `${accuracy}%` : '—'}
                </p>
              </div>
              <Map className="w-8 h-8 text-cyan-400 opacity-50" />
            </div>
          </div>

          <div className="p-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Physics compliance</p>
                <p className="text-3xl font-bold text-purple-400">
                  {physicsCompliance != null ? `${physicsCompliance}%` : '—'}
                </p>
              </div>
              <Map className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </div>
        </div>

        {/* Chart + Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 p-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10">
            <h2 className="text-xl font-bold text-white mb-6">
              Groundwater level — real data & physics-informed forecast
            </h2>
            {loading ? (
              <div className="flex items-center justify-center h-80">
                <p className="text-gray-400">Loading data...</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-80 gap-2">
                <p className="text-gray-400">Generate a forecast to see chart</p>
                <Link href="/forecast" className="text-cyan-400 hover:underline">Go to Forecast</Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="period" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip contentStyle={{ backgroundColor: '#0a1428', border: '1px solid #00d4ff' }} />
                  <Legend />
                  {chartData.some((d) => d.upper != null) && (
                    <Area type="monotone" dataKey="upper" fill="#06b6d420" stroke="none" name="Upper bound" />
                  )}
                  {chartData.some((d) => d.lower != null) && (
                    <Area type="monotone" dataKey="lower" fill="#06b6d420" stroke="none" name="Lower bound" />
                  )}
                  <Line type="monotone" dataKey="level" stroke="#00d4ff" dot={false} strokeWidth={2} name="Level" />
                  {chartData.some((d) => d.predicted != null) && (
                    <Line type="monotone" dataKey="predicted" stroke="#22c55e" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Forecast" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Quick actions</h2>
            <Link href="/simulator" className="block p-4 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:border-cyan-400/60 transition">
              <p className="text-cyan-400 font-semibold">Policy simulator</p>
              <p className="text-gray-400 text-sm mt-2">Counterfactual analysis (SCM)</p>
            </Link>
            <Link href="/optimizer" className="block p-4 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:border-cyan-400/60 transition">
              <p className="text-cyan-400 font-semibold">Site optimizer</p>
              <p className="text-gray-400 text-sm mt-2">Recharge site optimization</p>
            </Link>
            <Link href="/forecast" className="block p-4 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:border-cyan-400/60 transition">
              <p className="text-cyan-400 font-semibold">Detailed forecast</p>
              <p className="text-gray-400 text-sm mt-2">ST-GNN & physics-informed</p>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}