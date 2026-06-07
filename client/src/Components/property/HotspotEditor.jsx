// src/components/property/HotspotEditor.jsx
import { useState } from 'react';

const DEFAULT_ROOMS = [
  'Living Room', 'Kitchen', 'Master Bedroom',
  'Bedroom 2', 'Bathroom', 'Balcony', 'Garden', 'Garage',
];

/**
 * HotspotEditor
 *
 * Used inside ListPropertyPage step 3 (Virtual Tour).
 * Lets the seller define named room markers with lon/lat coordinates.
 *
 * Props:
 *   hotspots  – HotspotDef[]
 *   onChange  – (hotspots: HotspotDef[]) => void
 */
export default function HotspotEditor({ hotspots = [], onChange }) {
  const [lon,   setLon]   = useState('0');
  const [lat,   setLat]   = useState('0');
  const [label, setLabel] = useState('Living Room');
  const [custom, setCustom] = useState('');

  const add = () => {
    const finalLabel = label === '__custom__' ? custom.trim() : label;
    if (!finalLabel) return;
    const newHotspot = {
      id:         `hs-${Date.now()}`,
      label:      finalLabel,
      lon:        parseFloat(lon)  || 0,
      lat:        parseFloat(lat)  || 0,
      targetLon:  parseFloat(lon)  || 0,
      targetLat:  parseFloat(lat)  || 0,
    };
    onChange([...hotspots, newHotspot]);
    setLon('0'); setLat('0');
  };

  const remove = (id) => onChange(hotspots.filter((h) => h.id !== id));

  const update = (id, field, value) =>
    onChange(hotspots.map((h) =>
      h.id === id ? { ...h, [field]: parseFloat(value) || 0 } : h
    ));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-300">Room Hotspots</p>
        <p className="text-xs text-neutral-600">
          {hotspots.length} / 10 markers
        </p>
      </div>

      <p className="text-xs text-neutral-500">
        Add markers for each room. Use the viewer to find the lon/lat of a
        position: <span className="text-neutral-400">Lon (−180…180)</span> is
        left/right; <span className="text-neutral-400">Lat (−85…85)</span> is
        up/down.
      </p>

      {/* ── Add form ──────────────────────────────────────────────── */}
      {hotspots.length < 10 && (
        <div className="rounded-2xl border border-white/8 bg-neutral-900 p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Add Marker</p>

          <div>
            <label className="mb-1.5 block text-xs text-neutral-400">Room name</label>
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            >
              {DEFAULT_ROOMS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>

            {label === '__custom__' && (
              <input
                className="mt-2 w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                placeholder="e.g. Home Office"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">Longitude (−180 to 180)</label>
              <input
                type="number" min="-180" max="180" step="1"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-neutral-400">Latitude (−85 to 85)</label>
              <input
                type="number" min="-85" max="85" step="1"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={add}
            className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            + Add Hotspot
          </button>
        </div>
      )}

      {/* ── Hotspot list ──────────────────────────────────────────── */}
      {hotspots.length > 0 && (
        <div className="space-y-2">
          {hotspots.map((hs) => (
            <div
              key={hs.id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-neutral-900 px-4 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                ●
              </span>
              <span className="flex-1 text-sm font-medium text-white truncate">{hs.label}</span>

              {/* Inline lon/lat edit */}
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>lon:</span>
                <input
                  type="number" min="-180" max="180"
                  value={hs.lon}
                  onChange={(e) => update(hs.id, 'lon', e.target.value)}
                  className="w-16 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                />
                <span>lat:</span>
                <input
                  type="number" min="-85" max="85"
                  value={hs.lat}
                  onChange={(e) => update(hs.id, 'lat', e.target.value)}
                  className="w-16 rounded-lg border border-white/8 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => remove(hs.id)}
                className="shrink-0 rounded-lg p-1.5 text-neutral-600 hover:bg-white/5 hover:text-red-400 transition"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}