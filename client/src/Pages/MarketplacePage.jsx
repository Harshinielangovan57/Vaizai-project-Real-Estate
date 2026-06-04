// src/pages/MarketplacePage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import PageShell from '../components/layout/PageShell';

const API = import.meta.env.VITE_API_URL;

const PROPERTY_TYPES = ['Any', 'House', 'Apartment', 'Villa', 'Commercial', 'Land'];
const SORT_OPTIONS = [
  { value: 'date', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'valuation', label: 'AI Valuation' },
  { value: 'sqft', label: 'Square Footage' },
];

function ListingCard({ listing }) {
  return (
    <Link
      to={`/properties/${listing.propertyId?._id || listing.propertyId}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-neutral-900 transition hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-950/40"
    >
      <div className="aspect-[16/10] w-full overflow-hidden bg-neutral-800">
        {listing.property?.images?.[0] ? (
          <img
            src={listing.property.images[0]}
            alt={listing.property?.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-700">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        {listing.property?.verified && (
          <span className="mb-2 self-start rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-xs text-emerald-300">
            ✓ Verified
          </span>
        )}
        <h3 className="font-semibold text-white truncate">{listing.property?.title || '—'}</h3>
        <p className="mt-0.5 text-sm text-neutral-500 truncate">
          {listing.property?.city}, {listing.property?.state}
        </p>
        <div className="mt-auto pt-4 flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-indigo-400">{listing.price} ETH</p>
            {listing.property?.aiValuation && (
              <p className="text-xs text-neutral-600">
                AI: ${listing.property.aiValuation.toLocaleString()}
              </p>
            )}
          </div>
          <div className="text-right text-xs text-neutral-600">
            <p>{listing.property?.bedrooms}bd · {listing.property?.bathrooms}ba</p>
            <p>{listing.property?.squareFeet?.toLocaleString()} sqft</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    propertyType: 'Any',
    priceMin: '',
    priceMax: '',
    sqFtMin: '',
    sqFtMax: '',
    verified: false,
    sort: 'date',
    page: 1,
  });

  const LIMIT = 12;

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: LIMIT,
        page: filters.page,
        sort: filters.sort,
        ...(filters.q && { q: filters.q }),
        ...(filters.propertyType !== 'Any' && { propertyType: filters.propertyType }),
        ...(filters.priceMin && { priceMin: filters.priceMin }),
        ...(filters.priceMax && { priceMax: filters.priceMax }),
        ...(filters.sqFtMin && { sqFtMin: filters.sqFtMin }),
        ...(filters.sqFtMax && { sqFtMax: filters.sqFtMax }),
        ...(filters.verified && { verified: true }),
      };
      const { data } = await axios.get(`${API}/api/marketplace`, { params });
      setListings(data.listings || []);
      setTotal(data.total || 0);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const setFilter = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <h1
          className="mb-2 text-3xl font-black text-white"
          style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
        >
          Marketplace
        </h1>
        <p className="mb-8 text-neutral-500">
          {total > 0 ? `${total} active listings` : 'Browse fixed-price property listings'}
        </p>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── Sidebar filters ─────────────────────────────────────────── */}
          <aside className="w-full shrink-0 lg:w-64">
            <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 space-y-5">
              {/* Search */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Search</label>
                <input
                  type="text"
                  value={filters.q}
                  onChange={(e) => setFilter('q', e.target.value)}
                  placeholder="Keyword, city…"
                  className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                />
              </div>

              {/* Property type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROPERTY_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilter('propertyType', t)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        filters.propertyType === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Price (ETH)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => setFilter('priceMin', e.target.value)}
                    className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => setFilter('priceMax', e.target.value)}
                    className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Sqft */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-neutral-400">
                  Sq Ft
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.sqFtMin}
                    onChange={(e) => setFilter('sqFtMin', e.target.value)}
                    className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.sqFtMax}
                    onChange={(e) => setFilter('sqFtMax', e.target.value)}
                    className="w-full rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
                  />
                </div>
              </div>

              {/* Verified toggle */}
              <label className="flex cursor-pointer items-center justify-between">
                <span className="text-sm text-neutral-400">Verified only</span>
                <div
                  onClick={() => setFilter('verified', !filters.verified)}
                  className={`relative h-5 w-9 rounded-full transition ${
                    filters.verified ? 'bg-indigo-600' : 'bg-neutral-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      filters.verified ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </label>
            </div>
          </aside>

          {/* ── Listing grid ─────────────────────────────────────────────── */}
          <div className="flex-1">
            {/* Sort bar */}
            <div className="mb-4 flex items-center justify-end gap-2">
              <span className="text-sm text-neutral-500">Sort by</span>
              <select
                value={filters.sort}
                onChange={(e) => setFilter('sort', e.target.value)}
                className="rounded-lg border border-white/8 bg-neutral-900 px-3 py-1.5 text-sm text-white outline-none"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 rounded-2xl bg-neutral-900 animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-neutral-600">
                <p className="text-lg">No listings found</p>
                <button
                  onClick={() => setFilters({ q: '', propertyType: 'Any', priceMin: '', priceMax: '', sqFtMin: '', sqFtMax: '', verified: false, sort: 'date', page: 1 })}
                  className="mt-3 text-sm text-indigo-400 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {listings.map((l) => (
                    <ListingCard key={l._id} listing={l} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <button
                      disabled={filters.page === 1}
                      onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 hover:bg-white/5"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-neutral-500">
                      {filters.page} / {totalPages}
                    </span>
                    <button
                      disabled={filters.page === totalPages}
                      onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 hover:bg-white/5"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}