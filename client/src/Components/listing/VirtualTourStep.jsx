// src/components/listing/VirtualTourStep.jsx
/**
 * VirtualTourStep
 *
 * This replaces step 2 in ListPropertyPage (index 2 / "Virtual Tour").
 * Combines VirtualTourUploader + HotspotEditor + live Viewer360 preview.
 *
 * Props:
 *   matterportUrl     – string
 *   tour360File       – File | null
 *   tour360Preview    – string | null  (data URL)
 *   hotspots          – HotspotDef[]
 *   onMatterport      – (url) => void
 *   onTour360         – (file, preview) => void
 *   onHotspotsChange  – (hotspots) => void
 *   onClear           – () => void
 */
import { useRef, useState } from 'react';
import Viewer360      from '../property/Viewer360';
import HotspotEditor  from '../property/HotspotEditor';
import toast          from 'react-hot-toast';

export default function VirtualTourStep({
  matterportUrl,
  tour360File,
  tour360Preview,
  hotspots,
  onMatterport,
  onTour360,
  onHotspotsChange,
  onClear,
}) {
  const [mode, setMode]       = useState(
    tour360File ? '360' : matterportUrl ? 'matterport' : null
  );
  const [showPreview, setShowPreview] = useState(false);
  const inputRef = useRef();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('360° image must be JPG, PNG, or WEBP');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error('360° image must be under 30 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onTour360(file, reader.result);
    reader.readAsDataURL(file);
  };

  const handleClear = () => { setMode(null); setShowPreview(false); onClear(); };

  // ── No mode selected ───────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">
          Add an optional virtual tour for buyers. You can skip this step.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode('matterport')}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/4 p-5 text-center transition hover:border-indigo-500/40 hover:bg-indigo-500/5">
            <span className="text-2xl">🏠</span>
            <span className="text-sm font-semibold text-white">Matterport</span>
            <span className="text-xs text-neutral-500">Paste embed URL</span>
          </button>
          <button type="button" onClick={() => setMode('360')}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/4 p-5 text-center transition hover:border-indigo-500/40 hover:bg-indigo-500/5">
            <span className="text-2xl">🌐</span>
            <span className="text-sm font-semibold text-white">360° Photo</span>
            <span className="text-xs text-neutral-500">Upload equirectangular image</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Matterport mode ────────────────────────────────────────────────────────
  if (mode === 'matterport') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Matterport URL</h3>
          <button type="button" onClick={handleClear} className="text-xs text-neutral-500 hover:text-white">
            ← Change method
          </button>
        </div>

        <input
          type="url"
          value={matterportUrl}
          onChange={(e) => onMatterport(e.target.value)}
          placeholder="https://my.matterport.com/show/?m=XXXXXXX"
          className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
        />

        {matterportUrl && (
          <div className="overflow-hidden rounded-xl border border-white/8">
            <iframe
              src={matterportUrl}
              className="h-52 w-full"
              allow="fullscreen; xr-spatial-tracking"
              title="Matterport preview"
            />
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Matterport → Share → Embed Link → copy the iframe src URL.
        </p>
      </div>
    );
  }

  // ── 360° mode ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">360° Equirectangular Image</h3>
        <button type="button" onClick={handleClear} className="text-xs text-neutral-500 hover:text-white">
          ← Change method
        </button>
      </div>

      {/* Upload zone */}
      {!tour360Preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 p-10 text-center transition hover:border-indigo-500/50"
        >
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          <span className="text-4xl">🌐</span>
          <div>
            <p className="text-sm font-medium text-neutral-300">Upload a 360° equirectangular image</p>
            <p className="mt-1 text-xs text-neutral-600">JPG, PNG, WEBP · Max 30 MB</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Live preview toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-400">
              ✓ <span className="text-white font-medium">{tour360File?.name}</span> uploaded
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 transition"
              >
                {showPreview ? 'Hide Preview' : 'Preview Tour'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                Remove
              </button>
            </div>
          </div>

          {/* Live 360 preview */}
          {showPreview && tour360Preview && (
            <Viewer360
              imageUrl={tour360Preview}
              hotspots={hotspots}
              className="h-72"
            />
          )}
        </div>
      )}

      {/* Hotspot editor — only when image is uploaded */}
      {tour360Preview && (
        <HotspotEditor hotspots={hotspots} onChange={onHotspotsChange} />
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-neutral-400">
        <p className="font-medium text-indigo-300 mb-1">What is equirectangular?</p>
        <p>
          Photos from Ricoh Theta, Google Street View, or similar 360° cameras are
          equirectangular — they look like stretched panoramas. The Three.js viewer
          maps them onto a sphere so buyers can look in any direction.
        </p>
      </div>
    </div>
  );
}