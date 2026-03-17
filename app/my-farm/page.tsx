'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AppShell } from '@/app/components/AppShell';
import { fetchWithAuth } from '@/lib/api';
import { AlertCircle, Download, MapPin, Zap } from 'lucide-react';

import type { PlotGridPoint, RecommendedPoint } from './MyFarmMap';

type PumpingLevel = 'low' | 'medium' | 'high';

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

type PlotInsightResponse = {
  plot_stats: {
    n_samples: number;
    current_level_mean_m_bgl: number;
    current_level_min_m_bgl: number;
    current_level_max_m_bgl: number;
    trend_mean_m_per_month: number;
    risk_score_mean: number;
    zone_counts: { Green: number; Yellow: number; Red: number };
  };
  grid: PlotGridPoint[];
  recommended_point: RecommendedPoint & {
    risk_score: number;
    current_level_m_bgl: number;
    trend_m_per_month: number;
    uncertainty_m: number;
    confidence: string;
    reasons: string[];
    nearest_stations?: any[];
  };
  generated_at: string;
};

const MyFarmMap = dynamic(() => import('./MyFarmMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/60 text-gray-400">
      Loading map...
    </div>
  ),
});

function confidenceLabelHindi(conf: LocationInsightResponse['confidence']) {
  if (conf === 'High') return 'Pakka';
  if (conf === 'Medium') return 'Theek-Thak';
  return 'Andaza';
}

function pumpingHindi(p: PumpingLevel) {
  if (p === 'low') return 'Kam';
  if (p === 'high') return 'Zyada';
  return 'Madhyam';
}

function pumpingMultiplier(p: PumpingLevel) {
  if (p === 'low') return 0.7;
  if (p === 'high') return 1.3;
  return 1.0;
}

function suitabilityFromInsight(insight: LocationInsightResponse | null, pumping: PumpingLevel) {
  if (!insight) {
    return {
      color: 'slate',
      label: '—',
      riskTitle: 'Select your farm location',
      reasons: ['Pin drop karke apni location select karein.'],
    };
  }

  const mult = pumpingMultiplier(pumping);
  const months = insight.forecast || [];
  const first = months[0]?.predicted_level ?? insight.current_level_m_bgl;
  const last = months[Math.max(0, months.length - 1)]?.predicted_level ?? first;
  const delta = (last - first) * mult;

  const declining = insight.trend === 'declining' || insight.trend_m_per_month * mult > 0.05;
  const deep = insight.current_level_m_bgl > 40;
  const uncertain = insight.confidence === 'Low' || insight.uncertainty_m > 4;

  let score = 0;
  if (declining) score += 2;
  if (deep) score += 2;
  if (uncertain) score += 1;
  if (delta > 6) score += 2;
  if (delta > 10) score += 1;

  const reasons: string[] = [];
  if (deep) reasons.push(`Abhi paani lagbhag ${insight.current_level_m_bgl.toFixed(1)} m bgl par hai.`);
  if (declining) reasons.push('Trend neeche ja raha hai (paani aur gehra ho sakta hai).');
  if (delta > 6) reasons.push('Agle kuch saalon mein paani aur neeche jaane ka andaza hai.');
  if (uncertain) reasons.push('Aapke aas-paas monitoring wells kam hain / data mismatch ho sakta hai.');

  if (score >= 6) {
    return {
      color: 'red',
      label: 'Red',
      riskTitle: 'High risk: borewell 3–5 saal mein fail ho sakta hai',
      reasons,
    };
  }
  if (score >= 3) {
    return {
      color: 'yellow',
      label: 'Yellow',
      riskTitle: 'Medium risk: borewell ke liye savdhaani rakhein',
      reasons,
    };
  }
  return {
    color: 'green',
    label: 'Green',
    riskTitle: 'Lower risk: yahan borewell ki possibility theek hai',
    reasons,
  };
}

function buildPumpingForecast(insight: LocationInsightResponse | null, pumping: PumpingLevel) {
  if (!insight) return [] as { year: number; level: number; upper?: number; lower?: number }[];

  const mult = pumpingMultiplier(pumping);
  const trendPerMonth = insight.trend_m_per_month * mult;
  const current = insight.current_level_m_bgl;

  const points: { year: number; level: number; upper?: number; lower?: number }[] = [];
  for (let y = 0; y <= 5; y += 1) {
    const months = y * 12;
    const level = current + trendPerMonth * months;
    points.push({
      year: y,
      level,
      upper: level + insight.uncertainty_m,
      lower: level - insight.uncertainty_m,
    });
  }
  return points;
}

function hindiSummary(insight: LocationInsightResponse | null, pumping: PumpingLevel) {
  if (!insight) return '';

  const mult = pumpingMultiplier(pumping);
  const drop3y = insight.trend_m_per_month * mult * 36;
  const abs = Math.abs(drop3y);

  if (drop3y > 0.25) {
    return `Agar aap ${pumpingHindi(pumping)} pumping jaari rakhte hain, paani 3 saal mein lagbhag ${abs.toFixed(0)} m aur neeche chala jayega.`;
  }
  if (drop3y < -0.25) {
    return `Agar aap ${pumpingHindi(pumping)} pumping rakhen, paani 3 saal mein lagbhag ${abs.toFixed(0)} m behtar ho sakta hai.`;
  }
  return `Agar aap ${pumpingHindi(pumping)} pumping rakhen, aane wale 3 saal mein paani lagbhag stable reh sakta hai.`;
}

export default function MyFarm() {
  const [latitude, setLatitude] = useState(26.9124);
  const [longitude, setLongitude] = useState(75.7873);
  const [k, setK] = useState(8);

  const [pumping, setPumping] = useState<PumpingLevel>('medium');
  const [userMeasurement, setUserMeasurement] = useState<number | ''>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [insight, setInsight] = useState<LocationInsightResponse | null>(null);

  const [polygon, setPolygon] = useState<any | null>(null);
  const [plotLoading, setPlotLoading] = useState(false);
  const [plotError, setPlotError] = useState('');
  const [plotResult, setPlotResult] = useState<PlotInsightResponse | null>(null);

  const containerIdRef = useRef(`leaflet-${Math.random().toString(36).slice(2, 9)}`);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    containerIdRef.current = `leaflet-${Date.now().toString(36)}`;
    setShowMap(false);
    const t = setTimeout(() => setShowMap(true), 80);
    return () => clearTimeout(t);
  }, []);

  const calibratedInsight = useMemo(() => {
    if (!insight) return null;
    if (userMeasurement === '' || Number.isNaN(Number(userMeasurement))) return insight;

    const obs = Number(userMeasurement);
    const bias = obs - insight.current_level_m_bgl;
    return {
      ...insight,
      current_level_m_bgl: insight.current_level_m_bgl + bias,
      forecast: (insight.forecast || []).map((p) => ({
        ...p,
        predicted_level: p.predicted_level + bias,
        lower_bound: p.lower_bound + bias,
        upper_bound: p.upper_bound + bias,
      })),
      meta: {
        ...(insight.meta || {}),
        _calibrated: true,
        _bias_m: bias,
      },
    };
  }, [insight, userMeasurement]);

  const suitability = useMemo(
    () => {
      if (plotResult?.recommended_point?.zone) {
        const z = plotResult.recommended_point.zone;
        return {
          color: z === 'Green' ? 'green' : z === 'Yellow' ? 'yellow' : 'red',
          label: z,
          riskTitle:
            z === 'Red'
              ? 'High risk: borewell 3–5 saal mein fail ho sakta hai'
              : z === 'Yellow'
                ? 'Medium risk: borewell ke liye savdhaani rakhein'
                : 'Lower risk: yahan borewell ki possibility theek hai',
          reasons: plotResult.recommended_point.reasons || [],
        };
      }
      return suitabilityFromInsight(calibratedInsight, pumping);
    },
    [plotResult, calibratedInsight, pumping]
  );

  const pumpingForecast = useMemo(
    () => buildPumpingForecast(calibratedInsight, pumping),
    [calibratedInsight, pumping]
  );

  const summary = useMemo(() => hindiSummary(calibratedInsight, pumping), [calibratedInsight, pumping]);

  const handlePick = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  const handlePolygonChange = (geom: any | null) => {
    setPolygon(geom);
    setPlotResult(null);
    setPlotError('');
  };

  const handleRunPlot = async () => {
    if (!polygon) {
      setPlotError('Please draw your field boundary first.');
      return;
    }
    setPlotLoading(true);
    setPlotError('');
    try {
      const response = await fetchWithAuth('/api/location/plot-insight', {
        method: 'POST',
        body: JSON.stringify({
          polygon: polygon,
          months_ahead: 12,
          k,
          power: 2.0,
          grid_size: 14,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed (${response.status})`);
      }

      const data: PlotInsightResponse = await response.json();
      setPlotResult(data);
    } catch (e) {
      setPlotError(e instanceof Error ? e.message : 'Failed to fetch plot insight');
    } finally {
      setPlotLoading(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithAuth('/api/location/groundwater', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          months_ahead: 12,
          k,
          power: 2.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed (${response.status})`);
      }

      const data: LocationInsightResponse = await response.json();
      setInsight(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
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
          months_ahead: 12,
          k,
          power: 2.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Failed to download (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/pdf')) {
        const txt = await response.text();
        throw new Error(`Unexpected response (content-type=${contentType}): ${txt.slice(0, 300)}`);
      }

      const contentDisposition = response.headers.get('content-disposition') || '';
      const m = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
      const filename = m?.[1] || 'my_farm_report.pdf';

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
      setError(e instanceof Error ? e.message : 'Failed to download report');
    }
  };

  const badgeColor =
    suitability.color === 'green'
      ? 'bg-green-500/15 text-green-300 border-green-500/30'
      : suitability.color === 'yellow'
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : suitability.color === 'red'
          ? 'bg-red-500/15 text-red-300 border-red-500/30'
          : 'bg-slate-500/15 text-slate-300 border-slate-500/30';

  return (
    <AppShell title="My Farm">
      <div className="p-8 flex-1">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {plotError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-400 text-sm">{plotError}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-500/30 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <MapPin size={18} className="text-cyan-300" />
                  Apna khet draw karein (polygon/rectangle)
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}>Zone: {suitability.label}</div>
              </div>
              <div style={{ height: 420 }}>
                {showMap && (
                  <MyFarmMap
                    latitude={latitude}
                    longitude={longitude}
                    onPick={handlePick}
                    onPolygonChange={handlePolygonChange}
                    grid={plotResult?.grid || []}
                    recommendedPoint={plotResult?.recommended_point || null}
                    containerId={containerIdRef.current}
                  />
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Drill / Bore Risk</h2>
                  <p className="mt-1 text-sm text-cyan-100/60">
                    {suitability.riskTitle}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRunPlot}
                    disabled={plotLoading}
                    className="px-5 py-2 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-900 font-bold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <Zap size={18} />
                    {plotLoading ? 'Analyzing...' : 'Analyze Field'}
                  </button>
                  <button
                    onClick={handleRun}
                    disabled={loading}
                    className="px-5 py-2 bg-slate-800/60 hover:bg-slate-800 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center gap-2 border border-cyan-500/20"
                  >
                    <Zap size={18} />
                    {loading ? 'Loading...' : 'Point Insight'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-xs text-gray-400 mb-1">Current level</p>
                  <p className="text-2xl font-bold text-white">
                    {plotResult?.recommended_point
                      ? plotResult.recommended_point.current_level_m_bgl.toFixed(1)
                      : calibratedInsight
                        ? calibratedInsight.current_level_m_bgl.toFixed(1)
                        : '--'}
                    <span className="text-xs text-gray-400 ml-2">m bgl</span>
                  </p>
                </div>
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-xs text-gray-400 mb-1">Confidence</p>
                  <p className="text-2xl font-bold text-white">
                    {plotResult?.recommended_point
                      ? confidenceLabelHindi(plotResult.recommended_point.confidence as any)
                      : calibratedInsight
                        ? confidenceLabelHindi(calibratedInsight.confidence)
                        : '--'}
                  </p>
                  {calibratedInsight && (
                    <p className="text-xs text-gray-400 mt-1">
                      {calibratedInsight.confidence === 'Low'
                        ? 'Aapke aas-paas monitoring wells kam hain.'
                        : 'Nearby wells ka data use hua hai.'}
                    </p>
                  )}
                </div>
                <div className="bg-slate-900/40 rounded-lg border border-cyan-500/20 p-4">
                  <p className="text-xs text-gray-400 mb-1">Uncertainty</p>
                  <p className="text-2xl font-bold text-white">
                    {plotResult?.recommended_point
                      ? `±${plotResult.recommended_point.uncertainty_m.toFixed(1)}`
                      : calibratedInsight
                        ? `±${calibratedInsight.uncertainty_m.toFixed(1)}`
                        : '--'}
                    <span className="text-xs text-gray-400 ml-2">m</span>
                  </p>
                </div>
              </div>

              {plotResult?.plot_stats && (
                <div className="mt-4 bg-slate-900/40 border border-cyan-500/20 rounded-lg p-4">
                  <p className="text-sm font-semibold text-white">Plot summary</p>
                  <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                    <div className="text-gray-200">
                      Mean: <span className="text-cyan-300 font-semibold">{plotResult.plot_stats.current_level_mean_m_bgl.toFixed(1)} m</span>
                    </div>
                    <div className="text-gray-200">
                      Min: <span className="text-cyan-300 font-semibold">{plotResult.plot_stats.current_level_min_m_bgl.toFixed(1)} m</span>
                    </div>
                    <div className="text-gray-200">
                      Max: <span className="text-cyan-300 font-semibold">{plotResult.plot_stats.current_level_max_m_bgl.toFixed(1)} m</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    Zones: Green {plotResult.plot_stats.zone_counts.Green}, Yellow {plotResult.plot_stats.zone_counts.Yellow}, Red {plotResult.plot_stats.zone_counts.Red}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="text-sm font-semibold text-white">Reasons</p>
                <div className="mt-2 space-y-2">
                  {suitability.reasons.map((r) => (
                    <div
                      key={r}
                      className="text-sm text-gray-200 bg-slate-900/40 border border-cyan-500/10 rounded-lg px-4 py-2"
                    >
                      {r}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleDownloadPdf}
                  disabled={!insight}
                  className="px-5 py-2 bg-slate-800/60 hover:bg-slate-800 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-cyan-500/20"
                >
                  <Download size={18} />
                  Download Report
                </button>
                {calibratedInsight?.meta?._calibrated && (
                  <div className="text-xs text-green-300 border border-green-500/30 bg-green-500/10 rounded-full px-3 py-1">
                    Calibrated with your data
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white">Farm inputs</h3>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Latitude</label>
                    <input
                      type="number"
                      value={latitude}
                      onChange={(e) => setLatitude(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded focus:outline-none focus:border-cyan-400 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-300 mb-2">Longitude</label>
                    <input
                      type="number"
                      value={longitude}
                      onChange={(e) => setLongitude(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded focus:outline-none focus:border-cyan-400 text-sm"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-gray-400">
                  Draw polygon/rectangle on the map to set your field boundary.
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">
                    Nearest wells (k): <span className="text-cyan-300">{k}</span>
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

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-2">Aapke bore/kua ka current level (m bgl) (optional)</label>
                  <input
                    type="number"
                    value={userMeasurement}
                    onChange={(e) => setUserMeasurement(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-cyan-500/30 text-white rounded focus:outline-none focus:border-cyan-400 text-sm"
                    placeholder="e.g. 32"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white">Future pumping impact</h3>
              <p className="text-sm text-cyan-100/60 mt-1">"Agar main pumping aise hi rakhoon to kya hoga?"</p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as PumpingLevel[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPumping(p)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                      pumping === p
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                        : 'bg-slate-900/40 text-gray-300 border-cyan-500/10 hover:border-cyan-400/40'
                    }`}
                  >
                    {pumpingHindi(p)}
                  </button>
                ))}
              </div>

              <div className="mt-4 bg-slate-900/40 border border-purple-500/20 rounded-lg p-4">
                <p className="text-sm text-white font-semibold">Hindi summary</p>
                <p className="mt-2 text-sm text-gray-200">{summary || 'Risk check run karein aur phir yahan summary milegi.'}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold text-white">5-year estimate</p>
                <div className="mt-2 space-y-2">
                  {pumpingForecast.length === 0 && <p className="text-sm text-gray-400">No data yet.</p>}
                  {pumpingForecast.length > 0 && (
                    <div className="space-y-2">
                      {pumpingForecast.map((pt) => (
                        <div
                          key={pt.year}
                          className="flex items-center justify-between text-sm bg-slate-900/30 border border-purple-500/10 rounded-lg px-3 py-2"
                        >
                          <span className="text-gray-300">Year {pt.year}</span>
                          <span className="text-white font-semibold">{pt.level.toFixed(1)} m</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 to-red-500/10 border border-amber-500/30 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white">Alerts (area-based)</h3>
              <p className="text-sm text-gray-200 mt-2">
                {calibratedInsight
                  ? `Aapka area ${suitability.label} zone ki taraf ja raha hai. Recharge ya pumping kam karne par vichaar karein.`
                  : 'Run risk check to see alerts for your area.'}
              </p>
            </div>
          </div>
        </div>

        {calibratedInsight?.nearest_stations?.length ? (
          <div className="mt-8 bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-cyan-500/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white">
              {plotResult?.recommended_point?.nearest_stations ? 'Plot Analysis: Nearby Wells Used' : 'Point Analysis: Nearby Wells Used'}
            </h3>
            <p className="text-sm text-gray-300 mt-1">
              {plotResult?.recommended_point?.nearest_stations 
                ? 'Stations used for plot analysis recommended point' 
                : 'Distances show how close monitoring wells are to your clicked location.'}
            </p>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(plotResult?.recommended_point?.nearest_stations || calibratedInsight.nearest_stations).slice(0, 6).map((s) => (
                <div
                  key={s.station_code}
                  className="p-4 bg-slate-800/50 rounded-lg border border-cyan-500/20 hover:border-cyan-400/50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{s.station_name}</p>
                      <p className="text-xs text-gray-400">
                        {s.district}, {s.state} • {s.distance_km.toFixed(1)} km
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-cyan-300">{s.gw_latest.toFixed(1)} m</p>
                      <p className="text-xs text-gray-500">weight {s.weight.toFixed(3)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
