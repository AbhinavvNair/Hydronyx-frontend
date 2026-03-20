'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { AppShell } from '@/app/components/AppShell';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

interface AlertItem {
  state: string;
  district?: string;
  severity: 'critical' | 'high' | 'medium' | string;
  message: string;
  gw_level: number;
  trend: string;
  threshold_exceeded: boolean;
  predicted_level?: number;
  trend_m_per_month?: number;
}

interface AlertsResponse {
  alerts: AlertItem[];
  count: number;
  timestamp: string;
  source?: string;
  last_updated?: string;
  critical_count?: number;
  top_critical?: AlertItem;
}

export default function Alerts() {
  return (
    <ProtectedRoute>
      <AlertsContent />
    </ProtectedRoute>
  );
}

function AlertsContent() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [criticalCount, setCriticalCount] = useState<number | null>(null);
  const [topCritical, setTopCritical] = useState<AlertItem | null>(null);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadAlerts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (filter) params.set('severity', filter);

      // Primary: fetch from the alerts API which uses real prediction data
      const res = await fetchWithAuth(`/api/alerts?${params.toString()}`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);

      const data: AlertsResponse = await res.json();
      setAlerts(data.alerts || []);
      setLastUpdated(new Date().toISOString());
      setCriticalCount(data.critical_count ?? null);
      setTopCritical(data.top_critical ?? null);
      setDismissedBanner(false);
    } catch (e) {
      // Fallback: derive alerts from forecast history if the alerts endpoint fails
      try {
        const histRes = await fetchWithAuth('/api/forecast/history?limit=50');
        if (!histRes.ok) throw new Error('Forecast history unavailable');
        const histData = await histRes.json();
        const forecasts = histData.forecasts || [];

        const derived: AlertItem[] = forecasts
          .filter((f: any) => f?.result?.predicted_level != null)
          .map((f: any) => {
            const level = f.result.predicted_level as number;
            const trend = f.result.trend_direction ?? (f.result.uncertainty > 3 ? 'declining' : 'stable');
            const trendPerMonth = f.result.trend_m_per_month ?? 0;

            let severity: AlertItem['severity'] = 'medium';
            let message = '';

            if (level > 50 || trend === 'declining' && trendPerMonth > 0.3) {
              severity = 'critical';
              message = `Predicted level ${level.toFixed(1)} m bgl — critically deep. Immediate attention needed.`;
            } else if (level > 30 || trend === 'declining') {
              severity = 'high';
              message = `Predicted level ${level.toFixed(1)} m bgl — declining trend detected.`;
            } else {
              message = `Predicted level ${level.toFixed(1)} m bgl — moderate stress, monitor closely.`;
            }

            return {
              state: f.params?.state ?? 'Unknown',
              district: f.params?.district,
              severity,
              message,
              gw_level: level,
              trend,
              threshold_exceeded: level > 40,
              predicted_level: level,
              trend_m_per_month: trendPerMonth,
            } as AlertItem;
          })
          .filter((a: AlertItem) => !filter || a.severity === filter);

        // Sort: critical → high → medium
        const order = { critical: 0, high: 1, medium: 2 };
        derived.sort((a, b) => (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3));

        setAlerts(derived);
        setLastUpdated(new Date().toISOString());

        const criticals = derived.filter(a => a.severity === 'critical');
        setCriticalCount(criticals.length);
        setTopCritical(criticals[0] ?? null);
        setDismissedBanner(false);
      } catch {
        setError('Could not load alerts. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getSeverityStyle = (s: string) => {
    if (s === 'critical') return 'border-red-500/50 bg-red-500/10';
    if (s === 'high') return 'border-amber-500/50 bg-amber-500/10';
    return 'border-yellow-500/50 bg-yellow-500/10';
  };

  const getSeverityTextColor = (s: string) => {
    if (s === 'critical') return 'text-red-400';
    if (s === 'high') return 'text-amber-400';
    return 'text-yellow-400';
  };

  const getSeverityIcon = (s: string) => {
    if (s === 'critical') return <AlertCircle className="w-5 h-5 shrink-0" />;
    if (s === 'high') return <AlertTriangle className="w-5 h-5 shrink-0" />;
    return <Info className="w-5 h-5 shrink-0" />;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-400" />;
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const severityCounts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
  };

  return (
    <AppShell title="Groundwater Stress Alerts">
      <div className="p-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400 shrink-0" size={20} />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center gap-4">
            <AlertCircle className="text-red-400 w-8 h-8 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Critical</p>
              <p className="text-2xl font-bold text-red-400">{severityCounts.critical}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-4">
            <AlertTriangle className="text-amber-400 w-8 h-8 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">High</p>
              <p className="text-2xl font-bold text-amber-400">{severityCounts.high}</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 flex items-center gap-4">
            <Info className="text-yellow-400 w-8 h-8 shrink-0" />
            <div>
              <p className="text-xs text-gray-400">Medium</p>
              <p className="text-2xl font-bold text-yellow-400">{severityCounts.medium}</p>
            </div>
          </div>
        </div>

        {/* Last updated + refresh */}
        {lastUpdated && (
          <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-cyan-400 text-sm">
                Last updated: {new Date(lastUpdated).toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => loadAlerts(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        )}

        {/* Filter buttons */}
        <div className="mb-6 flex gap-2">
          {[
            { value: '', label: 'All' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filter === value
                  ? value === 'critical' ? 'bg-red-500/30 text-red-400'
                    : value === 'high' ? 'bg-amber-500/30 text-amber-400'
                    : value === 'medium' ? 'bg-yellow-500/30 text-yellow-400'
                    : 'bg-cyan-500/30 text-cyan-400'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 bg-slate-800/50 rounded-xl border border-cyan-500/20 text-center text-gray-400">
            No alerts found{filter ? ` for severity: ${filter}` : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a, i) => (
              <div
                key={i}
                className={`p-5 rounded-xl border ${getSeverityStyle(a.severity)} flex items-start gap-4`}
              >
                <div className={getSeverityTextColor(a.severity)}>
                  {getSeverityIcon(a.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${getSeverityTextColor(a.severity)}`}>
                      {a.state}{a.district ? ` — ${a.district}` : ''}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityStyle(a.severity)} ${getSeverityTextColor(a.severity)}`}>
                      {a.severity.toUpperCase()}
                    </span>
                    {a.threshold_exceeded && (
                      <span className="text-xs px-2 py-0.5 rounded-full border border-red-500/40 bg-red-500/10 text-red-300">
                        Threshold exceeded
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-200 mt-1">{a.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>GW level: <span className="text-white font-medium">{a.gw_level.toFixed(1)} m bgl</span></span>
                    <span className="flex items-center gap-1">
                      Trend: {getTrendIcon(a.trend)}
                      <span className="text-white font-medium">{a.trend}</span>
                      {a.trend_m_per_month != null && (
                        <span className="ml-1">({a.trend_m_per_month > 0 ? '+' : ''}{a.trend_m_per_month.toFixed(3)} m/mo)</span>
                      )}
                    </span>
                    {a.predicted_level != null && (
                      <span>Predicted: <span className="text-cyan-300 font-medium">{a.predicted_level.toFixed(1)} m</span></span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Critical alert banner */}
      {!dismissedBanner && criticalCount && criticalCount > 0 && topCritical && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-50">
          <div className="bg-red-600/95 backdrop-blur-md border border-red-400/50 rounded-xl shadow-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-200 mt-0.5 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-red-100 font-semibold text-sm">
                  {criticalCount === 1 ? '1 Critical Alert' : `${criticalCount} Critical Alerts`}
                </p>
                <p className="text-red-200 text-xs mt-1">
                  {topCritical.state}{topCritical.district ? ` — ${topCritical.district}` : ''}: {topCritical.message}
                </p>
                <p className="text-red-300 text-xs mt-1">
                  GW: {topCritical.gw_level.toFixed(1)} m bgl · Trend: {topCritical.trend}
                </p>
              </div>
              <button
                onClick={() => setDismissedBanner(true)}
                className="text-red-200 hover:text-red-100 transition shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}