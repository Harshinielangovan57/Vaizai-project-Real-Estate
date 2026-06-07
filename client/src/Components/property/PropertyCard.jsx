// src/components/property/PropertyCard.jsx
import { Link } from 'react-router-dom';
import VirtualTourBadge from '../ui/VirtualTourBadge';

/**
 * PropertyCard
 *
 * Reusable card used on HomePage, MarketplacePage, and AuctionsPage.
 *
 * Props:
 *   property  – property object from API
 *   price     – string  ETH price to show (optional; uses property.askingPrice if omitted)
 *   badge     – 'auction' | 'sale' | null
 */
export default function PropertyCard({ property, price, badge }) {
  const displayPrice = price || (property.askingPrice ? `${property.askingPrice} ETH` : null);

  const tourType =
    property.virtualTourUrl && property.tour360Url ? 'both'        :
    property.virtualTourUrl                        ? 'matterport'  :
    property.tour360Url                            ? '360'         :
    null;

  return (
    <Link
      to={`/properties/${property._id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-neutral-900 transition hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-950/50"
    >
      {/* ── Image ─────────────────────────────────────────────────── */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-800">
        {property.images?.[0] ? (
          <img
            src={property.images[0]}
            alt={property.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-700">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Overlay badges (top-left) ─────────────────────────────── */}
      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
        {property.verified && (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300 backdrop-blur-sm">
            ✓ Verified
          </span>
        )}
        {badge === 'auction' && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 backdrop-blur-sm">
            Auction
          </span>
        )}
        {tourType && <VirtualTourBadge type={tourType} />}
      </div>

      {/* ── Info ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-semibold text-white">{property.title}</h3>
        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {property.city}, {property.state}
        </p>

        {/* Stats row */}
        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-600">
          {property.bedrooms  && <span>{property.bedrooms}bd</span>}
          {property.bathrooms && <span>{property.bathrooms}ba</span>}
          {property.squareFeet && (
            <span>{property.squareFeet.toLocaleString()} sqft</span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-bold text-indigo-400">
            {displayPrice || 'Make Offer'}
          </span>
          {property.aiValuation && (
            <span className="text-xs text-neutral-600">
              AI: ${property.aiValuation.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}