// src/components/ui/VirtualTourBadge.jsx

/**
 * VirtualTourBadge
 *
 * Shows a small pill on a property card when a virtual tour is available.
 *
 * Props:
 *   type – 'matterport' | '360' | 'both'  (optional, defaults to showing generic badge)
 */
export default function VirtualTourBadge({ type }) {
  const label =
    type === 'matterport' ? '🏠 3D Tour' :
    type === '360'        ? '🌐 360° Tour' :
    type === 'both'       ? '🌐 360° + 3D' :
                            '🌐 Virtual Tour';

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-300 backdrop-blur-sm">
      {label}
    </span>
  );
}