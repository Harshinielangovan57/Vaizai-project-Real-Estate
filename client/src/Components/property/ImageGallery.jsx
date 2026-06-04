// src/components/property/ImageGallery.jsx
import { useState, useEffect, useCallback } from 'react';

/**
 * ImageGallery
 * Props:
 *   images – string[]   array of image URLs
 *   title  – string     property title (used for alt text)
 */
export default function ImageGallery({ images = [], title = '' }) {
  const [active, setActive]       = useState(0);
  const [lightbox, setLightbox]   = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  // Keyboard navigation for lightbox
  const handleKey = useCallback((e) => {
    if (!lightbox) return;
    if (e.key === 'Escape')     { setLightbox(false); }
    if (e.key === 'ArrowRight') { setLightboxIdx((i) => (i + 1) % images.length); }
    if (e.key === 'ArrowLeft')  { setLightboxIdx((i) => (i - 1 + images.length) % images.length); }
  }, [lightbox, images.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const openLightbox = (idx) => { setLightboxIdx(idx); setLightbox(true); };

  if (images.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-neutral-900 text-neutral-700">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
        </svg>
      </div>
    );
  }

  return (
    <>
      {/* ── Main image ──────────────────────────────────────────────── */}
      <div
        className="group relative aspect-video w-full cursor-zoom-in overflow-hidden rounded-2xl bg-neutral-900"
        onClick={() => openLightbox(active)}
      >
        <img
          src={images[active]}
          alt={`${title} — photo ${active + 1}`}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        />
        {/* Zoom hint */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white/70 backdrop-blur-sm opacity-0 transition group-hover:opacity-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
          Expand
        </div>
        {/* Image counter */}
        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {active + 1} / {images.length}
        </div>
      </div>

      {/* ── Thumbnails ──────────────────────────────────────────────── */}
      {images.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === active
                  ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={src} alt={`thumb ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          {/* Close */}
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
            onClick={() => setLightbox(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i - 1 + images.length) % images.length); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightboxIdx]}
            alt={`${title} — ${lightboxIdx + 1}`}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i + 1) % images.length); }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-sm text-white backdrop-blur-sm">
            {lightboxIdx + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}