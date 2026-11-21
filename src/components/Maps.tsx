import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { TIER } from '../lib/format';

const BAGHDAD: [number, number] = [33.3152, 44.3661];
const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; OpenStreetMap';

export interface MapFamily { id: string; head_name: string; lat: number | null; lng: number | null; tier: string; neighborhood?: string; code?: string; delivered?: boolean | null }

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 15 });
    else if (points.length === 1) map.setView(points[0], 15);
  }, [map, points]);
  return null;
}

export function FamilyMap({ families, height = 320, interactive = true, colorBy = 'tier' }: { families: MapFamily[]; height?: number | string; interactive?: boolean; colorBy?: 'tier' | 'delivery' }) {
  const pts = useMemo(() => families.filter((f) => f.lat && f.lng).map((f) => [f.lat!, f.lng!] as [number, number]), [families]);
  return (
    <div className="rounded-xl overflow-hidden border border-ink-200 relative z-0" style={{ height }}>
      <MapContainer center={BAGHDAD} zoom={11} style={{ height: '100%', width: '100%' }} scrollWheelZoom={interactive} dragging={interactive} zoomControl={interactive} attributionControl={false}>
        <TileLayer url={TILE} attribution={ATTR} />
        <Fit points={pts} />
        {families.filter((f) => f.lat && f.lng).map((f) => {
          const color = colorBy === 'delivery' ? (f.delivered ? '#1a7746' : f.delivered === false ? '#dc2626' : '#f59e0b') : (TIER[f.tier]?.color ?? '#666');
          return (
            <CircleMarker key={f.id} center={[f.lat!, f.lng!]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 }}>
              <Popup>
                <div className="font-bold">{f.head_name}</div>
                <div className="text-xs text-gray-600">{f.neighborhood} · {TIER[f.tier]?.label}</div>
                <Link to={`/families/${f.id}`} className="text-green-800 font-semibold">فتح الملف ←</Link>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

const pin = L.divIcon({
  className: '',
  html: '<svg width="36" height="46" viewBox="0 0 36 46"><path d="M18 0C8 0 0 8 0 18c0 13 18 28 18 28s18-15 18-28C36 8 28 0 18 0z" fill="#dc2626"/><circle cx="18" cy="18" r="7" fill="#fff"/></svg>',
  iconSize: [36, 46], iconAnchor: [18, 46],
});

function Clicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}
function Recenter({ at }: { at: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (at) map.setView(at, Math.max(map.getZoom(), 16)); }, [map, at]);
  return null;
}

export function PickerMap({ value, onChange, focus = null, height = 300 }: { value: [number, number] | null; onChange: (v: [number, number]) => void; focus?: [number, number] | null; height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-ink-200 relative z-0" style={{ height }}>
      <MapContainer center={value ?? BAGHDAD} zoom={value ? 16 : 11} style={{ height: '100%', width: '100%' }} attributionControl={false}>
        <TileLayer url={TILE} attribution={ATTR} />
        <Clicker onPick={(a, b) => onChange([a, b])} />
        <Recenter at={focus} />
        {value && (
          <Marker position={value} icon={pin} draggable eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange([p.lat, p.lng]); } }} />
        )}
      </MapContainer>
    </div>
  );
}
