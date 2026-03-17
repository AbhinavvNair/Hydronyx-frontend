'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

type Zone = 'Green' | 'Yellow' | 'Red';

export type PlotGridPoint = {
  latitude: number;
  longitude: number;
  zone: Zone;
  risk_score: number;
  current_level_m_bgl: number;
  trend_m_per_month: number;
  uncertainty_m: number;
  confidence: string;
};

export type RecommendedPoint = {
  latitude: number;
  longitude: number;
  zone: Zone;
  current_level_m_bgl: number;
  risk_score: number;
  trend_m_per_month: number;
  uncertainty_m: number;
  confidence: string;
  reasons: string[];
  nearest_stations: Array<{
    station_code: string;
    station_name: string;
    state: string;
    district: string;
    latitude: number;
    longitude: number;
    distance_km: number;
    gw_latest: number;
    weight: number;
  }>;
};

export default function MyFarmMap({
  latitude,
  longitude,
  onPick,
  onPolygonChange,
  grid,
  recommendedPoint,
  containerId,
}: {
  latitude: number;
  longitude: number;
  onPick: (lat: number, lng: number) => void;
  onPolygonChange: (geojson: any | null) => void;
  grid: PlotGridPoint[];
  recommendedPoint: RecommendedPoint | null;
  containerId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<any>(null);
  const gridLayerRef = useRef<L.LayerGroup | null>(null);
  const recommendedMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    } catch {
      // ignore
    }

    const map = L.map(containerRef.current as HTMLElement, {
      center: [latitude, longitude],
      zoom: 11,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      html: `
        <div style="width: 18px; height: 18px; background: #00d4ff; border: 3px solid #0ea5e9; border-radius: 9999px; box-shadow: 0 0 18px rgba(0,212,255,0.55);"></div>
      `,
      iconSize: [18, 18],
      className: '',
    });

    const marker = L.marker([latitude, longitude], { icon }).addTo(map);
    markerRef.current = marker;

    const drawnItems = new L.FeatureGroup();
    drawnItems.addTo(map);
    drawnItemsRef.current = drawnItems;

    const drawControl = new (L as any).Control.Draw({
      edit: {
        featureGroup: drawnItems,
        edit: true,
        remove: true,
      },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: true,
          shapeOptions: { color: '#00d4ff', weight: 2, opacity: 0.8, fillOpacity: 0.08 },
        },
        rectangle: {
          shapeOptions: { color: '#00d4ff', weight: 2, opacity: 0.8, fillOpacity: 0.08 },
        },
        circle: false,
        circlemarker: false,
        polyline: false,
        marker: false,
      },
    });
    drawControlRef.current = drawControl;
    map.addControl(drawControl);

    const publishGeoJson = () => {
      try {
        const gj = drawnItems.toGeoJSON();
        if (gj && Array.isArray((gj as any).features) && (gj as any).features.length > 0) {
          const geom = (gj as any).features[0].geometry;
          onPolygonChange(geom);
        } else {
          onPolygonChange(null);
        }
      } catch {
        onPolygonChange(null);
      }
    };

    map.on((L as any).Draw.Event.CREATED, (e: any) => {
      try {
        // Only keep one polygon at a time
        drawnItems.clearLayers();
        drawnItems.addLayer(e.layer);
      } catch {
        // ignore
      }
      publishGeoJson();
    });

    map.on((L as any).Draw.Event.EDITED, () => {
      publishGeoJson();
    });

    map.on((L as any).Draw.Event.DELETED, () => {
      onPolygonChange(null);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      onPick(e.latlng.lat, e.latlng.lng);
    });

    return () => {
      try {
        map.off();
        if (drawControlRef.current) {
          try {
            map.removeControl(drawControlRef.current);
          } catch {
            // ignore
          }
          drawControlRef.current = null;
        }
        map.remove();
      } catch {
        // ignore
      }
      mapRef.current = null;
      markerRef.current = null;
      drawnItemsRef.current = null;
      gridLayerRef.current = null;
      recommendedMarkerRef.current = null;
    };
  }, [containerId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
    }

    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const getZoneColor = (z: Zone) => {
      if (z === 'Green') return '#22c55e';
      if (z === 'Yellow') return '#f59e0b';
      return '#ef4444';
    };

    if (gridLayerRef.current) {
      try {
        gridLayerRef.current.remove();
      } catch {
        // ignore
      }
      gridLayerRef.current = null;
    }

    const lg = L.layerGroup();
    gridLayerRef.current = lg;
    lg.addTo(map);

    grid.forEach((p) => {
      const c = L.circleMarker([p.latitude, p.longitude], {
        radius: 6,
        color: getZoneColor(p.zone),
        weight: 2,
        opacity: 0.9,
        fillColor: getZoneColor(p.zone),
        fillOpacity: 0.25,
      });
      c.bindTooltip(`Depth: ${p.current_level_m_bgl.toFixed(1)} m bgl<br/>Zone: ${p.zone} (score ${p.risk_score.toFixed(1)})<br/>Trend: ${p.trend_m_per_month.toFixed(2)} m/month<br/>Confidence: ${p.confidence}`, { direction: 'top' });
      c.addTo(lg);
    });

    if (recommendedMarkerRef.current) {
      try {
        recommendedMarkerRef.current.remove();
      } catch {
        // ignore
      }
      recommendedMarkerRef.current = null;
    }

    if (recommendedPoint) {
      const recIcon = L.divIcon({
        html: `
          <div style="width: 22px; height: 22px; background: #00d4ff; border: 3px solid #0ea5e9; border-radius: 9999px; box-shadow: 0 0 18px rgba(0,212,255,0.65); display:flex; align-items:center; justify-content:center;">
            <div style="width: 8px; height: 8px; background: #0b1220; border-radius: 9999px;"></div>
          </div>
        `,
        iconSize: [22, 22],
        className: '',
      });
      const m = L.marker([recommendedPoint.latitude, recommendedPoint.longitude], { icon: recIcon }).addTo(map);
      m.bindTooltip(`Recommended point<br/>Depth: ${recommendedPoint.current_level_m_bgl?.toFixed(1) || 'N/A'} m bgl<br/>Zone: ${recommendedPoint.zone}<br/>Risk Score: ${recommendedPoint.risk_score?.toFixed(1) || 'N/A'}<br/>${recommendedPoint.reasons?.slice(0, 2).join('<br/>') || ''}`, { direction: 'top' });
      recommendedMarkerRef.current = m;
    }
  }, [grid, recommendedPoint]);

  return <div id={containerId} ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
