// src/components/listing/VirtualTourUploader.jsx
import  { useRef, useState } from 'react';
import toast from 'react-hot-toast';

/**
 * VirtualTourUploader
 *
 * Lets the seller choose one of two modes:
 *   1. Paste a Matterport embed URL
 *   2. Upload a 360° equirectangular JPG for the Three.js viewer
 *
 * Props:
 *   matterportUrl    – string
 *   tour360File      – File | null
 *   tour360Preview   – string | null  (data URL)
 *   onMatterport     – (url: string) => void
 *   onTour360        – (file: File, preview: string) => void
 *   onClear          – () => void
 */
export default function VirtualTourUploader({
  matterportUrl,
  tour360File,
  tour360Preview,
  onMatterport,
  onTour360,
  onClear,
}) {
  const [mode, setMode] = useState(
    tour360File ? '360' : matterportUrl ? 'matterport' : null
  );
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

  const handleClear = () => {
    setMode(null);
    onClear();
  };

  // ── Mode selector ────────────────────────────────────────────────────────
  if (!mode) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-neutral-400">
          Add an optional virtual tour. Choose a method or skip this step.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode('matterport')}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/4 p-5 text-center transition hover:border-indigo-500/40 hover:bg-indigo-500/5"
          >
            <span className="text-2xl">🏠</span>
            <span className="text-sm font-semibold text-white">Matterport</span>
            <span className="text-xs text-neutral-500">Paste your embed URL</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('360')}
            className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/4 p-5 text-center transition hover:border-indigo-500/40 hover:bg-indigo-500/5"
          >
            <span className="text-2xl">🌐</span>
            <span className="text-sm font-semibold text-white">360° Image</span>
            <span className="text-xs text-neutral-500">Upload equirectangular photo</span>
          </button>
        </div>
        <p className="text-center text-xs text-neutral-600">
          or{' '}
          <button type="button" className="text-indigo-400 hover:underline">
            skip this step
          </button>
        </p>
      </div>
    );
  }

  // ── Matterport input ─────────────────────────────────────────────────────
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
          className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
        />
        {matterportUrl && (
          <div className="overflow-hidden rounded-xl border border-white/8">
            <iframe
              src={matterportUrl}
              className="h-48 w-full"
              allow="fullscreen; xr-spatial-tracking"
              title="Matterport preview"
            />
          </div>
        )}
        <p className="text-xs text-neutral-600">
          Go to Matterport → Share → Copy embed link, then paste it above.
        </p>
      </div>
    );
  }

  // ── 360° image upload ────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">360° Equirectangular Image</h3>
        <button type="button" onClick={handleClear} className="text-xs text-neutral-500 hover:text-white">
          ← Change method
        </button>
      </div>

      {!tour360Preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/15 p-10 text-center transition hover:border-indigo-500/50"
        >
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
          <span className="text-3xl">🌐</span>
          <div>
            <p className="text-sm font-medium text-neutral-300">
              Upload a 360° equirectangular image
            </p>
            <p className="mt-1 text-xs text-neutral-600">JPG, PNG, WEBP · Max 30 MB</p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-white/8">
          <img src={tour360Preview} alt="360 preview" className="h-40 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center">
              <p className="text-sm font-semibold text-white">360° image ready</p>
              <p className="text-xs text-neutral-400">{tour360File?.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { onClear(); }}
            className="absolute right-2 top-2 rounded-lg bg-red-600/80 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
          >
            Remove
          </button>
        </div>
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-xs text-neutral-400">
        <p className="font-medium text-indigo-300 mb-1">What is equirectangular?</p>
        <p>
          A 360° photo captured by a camera like a Ricoh Theta or Google Street View is
          typically equirectangular. It looks like a stretched panorama. The Three.js viewer
          maps it onto a sphere so buyers can look around in any direction.
        </p>
      </div>
    </div>
  );
}