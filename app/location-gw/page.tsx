'use client';

import { useMemo, useState } from 'react';
import { ProtectedRoute } from '@/app/components/ProtectedRoute';
import { AppShell } from '@/app/components/AppShell';
import {
  BarChart3,
  CheckCircle,
  Zap,
  Signal,
  AlertCircle,
  Download,
  Sprout,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { fetchWithAuth } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface LocationForecastPoint {
  month: number;
  predicted_level: number;
  lower_bound: number;
  upper_bound: number;
}

interface NearestStation {
  station_code: string;
  station_name: string;
  state: string;
  district: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  gw_latest: number;
  weight: number;
}

interface LocationInsightResponse {
  current_level_m_bgl: number;
  trend_m_per_month: number;
  trend: 'declining' | 'improving' | 'stable' | string;
  uncertainty_m: number;
  confidence: 'High' | 'Medium' | 'Low' | string;
  forecast: LocationForecastPoint[];
  nearest_stations: NearestStation[];
  meta: Record<string, any>;
}

export default function LocationGW() {
  return (
    <ProtectedRoute>
      <LocationGWContent />
    </ProtectedRoute>
  );
}

function confidenceHindiLabel(c: LocationInsightResponse['confidence']) {
  if (c === 'High') return 'Pakka';
  if (c === 'Medium') return 'Theek-Thak';
  return 'Andaza';
}

function confidencePercent(c: LocationInsightResponse['confidence']) {
  if (c === 'High') return 85;
  if (c === 'Medium') return 60;
  return 35;
}

function LocationGWContent() {
  const router = useRouter();
  const [latitude, setLatitude] = useState(26.9124);
  const [longitude, setLongitude] = useState(75.7873);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [k, setK] = useState(8);
  const [userMeasurement, setUserMeasurement] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<LocationInsightResponse | null>(null);

  const calibratedResult = useMemo(() => {
    if (!result) return null;
    if (userMeasurement === '' || Number.isNaN(Number(userMeasurement))) return result;

    const obs = Number(userMeasurement);
    const bias = obs - result.current_level_m_bgl;
    return {
      ...result,
      current_level_m_bgl: result.current_level_m_bgl + bias,
      forecast: (result.forecast || []).map((p) => ({
        ...p,
        predicted_level: p.predicted_level + bias,
        lower_bound: p.lower_bound + bias,
        upper_bound: p.upper_bound + bias,
      })),
      meta: {
        ...(result.meta || {}),
        _calibrated: true,
        _bias_m: bias,
      },
    };
  }, [result, userMeasurement]);

  const chartData = useMemo(() => {
    return (
      calibratedResult?.forecast?.map((p) => ({
        month: p.month,
        predicted: p.predicted_level,
        upper_bound: p.upper_bound,
        lower_bound: p.lower_bound,
      })) || []
    );
  }, [calibratedResult]);

  const handleGetInsight = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchWithAuth('/api/location/groundwater', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          months_ahead: monthsAhead,
          k,
          power: 2.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to get location insight (${response.status})`);
      }

      const data: LocationInsightResponse = await response.json();
      setResult(data);
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : 'Failed to get insight'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setError('');

    try {
      const response = await fetchWithAuth('/api/location/report.pdf', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          months_ahead: monthsAhead,
          k,
          power: 2.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to download report (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/pdf')) {
        const txt = await response.text();
        throw new Error(`Unexpected response (content-type=${contentType}): ${txt.slice(0, 300)}`);
      }

      const contentDisposition = response.headers.get('content-disposition') || '';
      const m = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
      const filename = m?.[1] || 'location_groundwater_report.pdf';

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : 'Failed to download report'}`);
    }
  };

  return (
    <AppShell title="Location Insight">
      <div className="p-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Input</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Latitude</label>
                <input
                  type="number"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded-lg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Aapke kua/bore ka current level (m bgl) — optional
                </label>
                <input
                  type="number"
                  value={userMeasurement}
                  onChange={(e) => setUserMeasurement(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded-lg focus:outline-none focus:border-cyan-400"
                  placeholder="e.g. 32"
                />
                <p className="text-xs text-gray-400 mt-2">
                  (Agar aap apna measurement dalte hain, hum forecast ko local bias se calibrate kar dete hain.)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Longitude</label>
                <input
                  type="number"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded-lg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Forecast Horizon: <span className="text-cyan-400">{monthsAhead} months</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="12"
                  value={monthsAhead}
                  onChange={(e) => setMonthsAhead(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nearest Stations (k): <span className="text-cyan-400">{k}</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="25"
                  value={k}
                  onChange={(e) => setK(Number(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <button
                onClick={handleGetInsight}
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Zap size={20} />
                {loading ? 'Loading...' : 'Get Groundwater Insight'}
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={!result}
                className="w-full px-6 py-3 bg-slate-800/60 hover:bg-slate-800 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-cyan-500/20"
              >
                <Download size={18} />
                Download PDF Report
              </button>
            </div>
          </div>

          <div className="col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">API Status</p>
                    <p className="text-2xl font-bold text-green-400">Online</p>
                  </div>
                  <Signal className="w-8 h-8 text-green-400 opacity-50" />
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Method</p>
                    <p className="text-2xl font-bold text-purple-400">IDW</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-purple-400 opacity-50" />
                </div>
              </div>

              <div className="p-6 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Confidence</p>
                    <p className="text-2xl font-bold text-cyan-400">
                      {calibratedResult ? confidenceHindiLabel(calibratedResult.confidence) : '--'}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-cyan-400 opacity-50" />
                </div>

                <div className="mt-3">
                  <div className="w-full h-2 rounded-full bg-slate-900/50 border border-cyan-500/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-cyan-500"
                      style={{ width: `${calibratedResult ? confidencePercent(calibratedResult.confidence) : 0}%` }}
                    />
                  </div>
                  {calibratedResult && (
                    <p className="text-xs text-gray-400 mt-2">
                      {calibratedResult.confidence === 'Low'
                        ? 'Aapke aas-paas monitoring wells kam hain, isliye yeh andaza utna pakka nahi hai.'
                        : 'Nearby monitoring wells ke basis par estimate banaya gaya hai.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {calibratedResult?.meta?._calibrated && (
              <div className="text-xs text-green-300 border border-green-500/30 bg-green-500/10 rounded-full px-3 py-2 w-fit">
                Calibrated with your data
              </div>
            )}

            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-cyan-500/20 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">We used these real nearby wells</h2>

              {!calibratedResult && <p className="text-gray-400">Run an insight to see the wells used.</p>}

              {calibratedResult && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {calibratedResult.nearest_stations.map((s) => (
                    <div
                      key={s.station_code}
                      className="p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20 hover:border-cyan-400/50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {s.station_name} ({s.station_code})
                          </p>
                          <p className="text-xs text-gray-400">
                            {s.district}, {s.state} • {s.distance_km.toFixed(1)} km
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-cyan-400">{s.gw_latest.toFixed(2)} m</p>
                          <p className="text-xs text-gray-400">weight {s.weight.toFixed(3)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-6">Groundwater Forecast</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Current Level</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    {calibratedResult ? calibratedResult.current_level_m_bgl.toFixed(2) : '--'}
                    <span className="text-sm text-gray-400 ml-2">m bgl</span>
                  </p>
                </div>
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Trend</p>
                  <p className="text-2xl font-bold text-white">{calibratedResult ? calibratedResult.trend : '--'}</p>
                  <p className="text-xs text-gray-400">
                    {calibratedResult ? `${calibratedResult.trend_m_per_month.toFixed(3)} m/month` : ''}
                  </p>
                </div>
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Uncertainty</p>
                  <p className="text-2xl font-bold text-white">
                    {calibratedResult ? `±${calibratedResult.uncertainty_m.toFixed(2)} m` : '--'}
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis
                    dataKey="month"
                    stroke="#888"
                    label={{ value: 'Months Ahead', position: 'insideBottomRight', offset: -5 }}
                  />
                  <YAxis stroke="#888" label={{ value: 'Level (m)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0a1428', border: '1px solid #00d4ff' }} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#00d4ff"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Upper Bound"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#00d4ff"
                    strokeWidth={3}
                    name="Predicted GW Level"
                    dot={{ fill: '#00d4ff', r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#00d4ff"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    name="Lower Bound"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="text-xs text-gray-400">
              This estimate uses inverse-distance weighted interpolation from nearby monitoring stations.
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating My Farm Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => router.push('/my-farm')}
          className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 group"
          title="Go to My Farm"
        >
          <Sprout className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </AppShell>
  );
}
