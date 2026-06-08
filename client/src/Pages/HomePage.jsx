// src/pages/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import PageShell from '../components/layout/PageShell';

const API = import.meta.env.VITE_API_URL;

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <div className="flex flex-col">
      <span className="text-3xl font-black text-white" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
        {value}
      </span>
      <span className="text-sm text-neutral-500">{label}</span>
    </div>
  );
}

// ── Property card ─────────────────────────────────────────────────────────────
function PropertyCard({ property }) {
  return (
    <Link
      to={`/properties/${property._id}`}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-neutral-900 transition hover:-translate-y-1 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-950/50"
    >
      {/* Image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-800">
        {property.images?.[0] ? (
          <img
            src={property.images[0]}
            alt={property.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-700">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
            </svg>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="absolute left-3 top-3 flex gap-1.5">
        {property.verified && (
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-xs font-medium text-emerald-300">
            ✓ Verified
          </span>
        )}
        {property.forAuction && (
          <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-300">
            Auction
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="truncate font-semibold text-white">{property.title}</h3>
        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {property.city}, {property.state}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-bold text-indigo-400">
            {property.askingPrice ? `${property.askingPrice} ETH` : 'Make Offer'}
          </span>
          <span className="text-xs text-neutral-600">
            {property.squareFeet?.toLocaleString()} sqft
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((s) => s.auth);
  const [query, setQuery] = useState('');
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/api/properties?limit=6&sort=date`)
      .then((r) => setFeatured(r.data?.properties || []))
      .catch(() => setFeatured([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <PageShell>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-24 pt-20 lg:pt-32">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
          <div className="mt-10 h-[500px] w-[900px] rounded-full bg-indigo-600/10 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-6">
            Real Estate · Tokenized on Blockchain
          </span>

          <h1
            className="text-5xl font-black leading-tight tracking-tight text-white lg:text-7xl"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            Own Real Estate
            <br />
            <span className="text-indigo-400">On-Chain.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-400">
            Buy, sell, and auction tokenized properties. Trustless escrow.
            AI-powered valuations. Secure digital agreements.
          </p>

          {!isAuthenticated && (
            <div className="mt-8 flex justify-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
              <Link
                to="/auth/login"
                className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/20"
              >
                Sign In to Start
              </Link>
              <Link
                to="/auth/register"
                className="rounded-xl border border-white/10 bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5 active:scale-95"
              >
                Create Account
              </Link>
            </div>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearch} className="mx-auto mt-10 flex max-w-lg gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by city, type, or keyword…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-neutral-500 outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
            >
              Search
            </button>
          </form>

          {/* Quick links */}
          <div className="mt-4 flex justify-center gap-4 text-sm text-neutral-500">
            <Link to="/marketplace" className="hover:text-indigo-400 transition">Browse All →</Link>
            <Link to="/auctions" className="hover:text-amber-400 transition">Live Auctions →</Link>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02] px-4 py-10">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
          <StatCard value="1,240+" label="Properties Listed" />
          <StatCard value="$48M+" label="Total Volume" />
          <StatCard value="340" label="Active Auctions" />
          <StatCard value="99%" label="Escrow Success Rate" />
        </div>
      </section>

      {/* ── Featured Listings ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2
            className="text-2xl font-black text-white"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            Featured Properties
          </h2>
          <Link to="/marketplace" className="text-sm text-indigo-400 hover:underline">
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-neutral-900 animate-pulse" />
            ))}
          </div>
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p) => (
              <PropertyCard key={p._id} property={p} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mb-3 opacity-30">
              <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
            </svg>
            <p>No properties listed yet.</p>
            <Link to="/list" className="mt-3 text-sm text-indigo-400 hover:underline">
              Be the first to list →
            </Link>
          </div>
        )}
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-indigo-600 px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-900/50 blur-3xl" />
          </div>
          <h2
            className="relative text-3xl font-black text-white lg:text-4xl"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            Ready to tokenize your property?
          </h2>
          <p className="relative mt-3 text-indigo-200">
            List in minutes. Sell globally. All secured by smart contracts.
          </p>
          <Link
            to="/list"
            className="relative mt-8 inline-block rounded-xl bg-white px-8 py-3 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 active:scale-95"
          >
            List a Property
          </Link>
        </div>
      </section>
    </PageShell>
  );
}