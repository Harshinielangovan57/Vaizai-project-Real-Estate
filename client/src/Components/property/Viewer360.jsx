// src/components/property/Viewer360.jsx
import { useRef, useState, useEffect } from 'react';
import { use360Viewer } from '../../hooks/use360Viewer';

/**
 * Viewer360
 *
 * Props:
 *   imageUrl  – string   equirectangular image URL
 *   hotspots  – Array<{
 *                 id: string,
 *                 label: string,
 *                 lon: number,        // horizontal angle −180…180
 *                 lat: number,        // vertical   angle −85…85
 *                 targetLon?: number, // camera jumps here on click
 *                 targetLat?: number,
 *               }>
 *   className – string   extra CSS classes for the wrapper
 */
export default function Viewer360({ imageUrl, hotspots = [], className = '' }) {
  const canvasRef = useRef(null);
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [isFullscreen, setIsFullscreen]   = useState(false);
  const [loaded, setLoaded]               = useState(false);
  const wrapperRef = useRef(null);

  const handleHotspot = (hs) => {
    setActiveHotspot(hs);
    if (hs.targetLon !== undefined && hs.targetLat !== undefined) {
      jumpTo(hs.targetLon, hs.targetLat);
    }
  };

  const { jumpTo } = use360Viewer({
    canvasRef,
    imageUrl,
    hotspots,
    onHotspot: handleHotspot,
    initialLon: 0,
    initialLat: 0,
  });

  // Detect when canvas has rendered its first frame (approx)
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 600);
    return () => clearTimeout(t);
  }, [imageUrl]);

  // Fullscreen API
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  if (!imageUrl) return null;

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden rounded-2xl border border-white/8 bg-neutral-950 ${className}`}
    >
      {/* Loading overlay */}
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950">
          <div className="flex flex-col items-center gap-3 text-neutral-500">
            <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Loading 360° tour…</p>
          </div>
        </div>
      )}

      {/* Three.js canvas */}
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', display: 'block', width: '100%', height: '100%' }}
      />

      {/* ── Hotspot overlay labels ─────────────────────────────────── */}
      {/* These are CSS-positioned labels; actual click detection is via raycasting */}
      {hotspots.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-4 space-y-1.5">
          {hotspots.map((hs) => (
            <button
              key={hs.id}
              className="pointer-events-auto flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm transition hover:bg-indigo-600"
              onClick={() => handleHotspot(hs)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="10" fillOpacity="0.3" />
              </svg>
              {hs.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Active hotspot tooltip ─────────────────────────────────── */}
      {activeHotspot && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-900/90 px-4 py-2 text-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-white">{activeHotspot.label}</p>
          <button
            onClick={() => setActiveHotspot(null)}
            className="mt-0.5 text-xs text-neutral-500 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Control bar ───────────────────────────────────────────── */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        {/* Reset view */}
        <button
          onClick={() => jumpTo(0, 0)}
          title="Reset view"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-neutral-300 backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-neutral-300 backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Drag hint ─────────────────────────────────────────────── */}
      {loaded && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs text-neutral-400 backdrop-blur-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
          </svg>
          Drag to look around
        </div>
      )}

      {/* ── 360° badge ────────────────────────────────────────────── */}
      <div className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
        360°
      </div>
    </div>
  );
}