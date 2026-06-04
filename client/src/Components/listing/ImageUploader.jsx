// src/components/listing/ImageUploader.jsx
import  { useRef, useState } from 'react';
import toast from 'react-hot-toast';

const MAX_FILES = 10;
const MAX_SIZE_MB = 10;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * ImageUploader
 *
 * Props:
 *   images      – File[]        current files
 *   previews    – string[]      data URL previews
 *   primaryIdx  – number        index of primary image
 *   onChange    – (files, previews) => void
 *   onPrimary   – (index) => void
 */
export default function ImageUploader({ images, previews, primaryIdx, onChange, onPrimary }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const processFiles = (rawFiles) => {
    const incoming = Array.from(rawFiles);

    const valid = incoming.filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`${f.name}: unsupported type (JPG, PNG, WEBP only)`);
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: exceeds ${MAX_SIZE_MB} MB`);
        return false;
      }
      return true;
    });

    const merged = [...images, ...valid].slice(0, MAX_FILES);
    if (images.length + valid.length > MAX_FILES) {
      toast(`Max ${MAX_FILES} images — extras trimmed`);
    }

    const readers = merged.map(
      (f) =>
        new Promise((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.readAsDataURL(f);
        })
    );
    Promise.all(readers).then((prevs) => onChange(merged, prevs));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleRemove = (idx) => {
    const nextFiles = images.filter((_, i) => i !== idx);
    const nextPrevs = previews.filter((_, i) => i !== idx);
    const nextPrimary = primaryIdx >= nextFiles.length ? Math.max(0, nextFiles.length - 1) : primaryIdx;
    onChange(nextFiles, nextPrevs);
    onPrimary(nextPrimary);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
          dragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-white/15 hover:border-indigo-500/50 hover:bg-white/[0.02]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => processFiles(e.target.files)}
        />
        <div className={`rounded-xl p-3 transition ${dragging ? 'bg-indigo-500/20' : 'bg-white/5'}`}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            className={dragging ? 'text-indigo-400' : 'text-neutral-500'}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-300">
            Drag &amp; drop images, or <span className="text-indigo-400">browse</span>
          </p>
          <p className="mt-1 text-xs text-neutral-600">
            JPG, PNG, WEBP · Max {MAX_FILES} images · {MAX_SIZE_MB} MB each
          </p>
        </div>
      </div>

      {/* Count indicator */}
      {images.length > 0 && (
        <p className="text-xs text-neutral-500">
          {images.length} / {MAX_FILES} images uploaded
          {images.length < MAX_FILES && (
            <button onClick={() => inputRef.current?.click()}
              className="ml-2 text-indigo-400 hover:underline">
              + Add more
            </button>
          )}
        </p>
      )}

      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {previews.map((src, i) => (
            <div key={i} className="group relative">
              <button
                type="button"
                onClick={() => onPrimary(i)}
                className={`relative block aspect-square w-full overflow-hidden rounded-xl border-2 transition ${
                  i === primaryIdx
                    ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'border-transparent hover:border-white/20'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === primaryIdx && (
                  <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 py-0.5 text-center text-[10px] font-bold text-white">
                    PRIMARY
                  </span>
                )}
              </button>
              {/* Remove button */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow group-hover:flex"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {previews.length > 0 && (
        <p className="text-xs text-neutral-600">
          Click an image to set it as the primary (cover) image. Hover to remove.
        </p>
      )}
    </div>
  );
}