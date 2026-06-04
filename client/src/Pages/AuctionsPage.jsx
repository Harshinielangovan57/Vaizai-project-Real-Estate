// src/pages/AuctionsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import PageShell from '../components/layout/PageShell';

const API = import.meta.env.VITE_API_URL;

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(endTime) {
  const calc = () => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, ended: true };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      ended: false,
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return t;
}

// ── Countdown display ─────────────────────────────────────────────────────────
function Countdown({ endTime }) {
  const { d, h, m, s, ended } = useCountdown(endTime);
  if (ended) return <span className="text-red-400 text-sm font-semibold">Ended</span>;
  const urgent = d === 0 && h === 0 && m < 10;
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${urgent ? 'text-amber-400' : 'text-white'}`}>
      {d > 0 && `${d}d `}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ── Auction card ──────────────────────────────────────────────────────────────
function AuctionCard({ auction }) {
  return (
    <Link
      to={`/properties/${auction.propertyId}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-neutral-900 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-950/30"
    >
      {/* Image */}
      <div className="aspect-[16/9] overflow-hidden bg-neutral-800">
        {auction.property?.images?.[0] ? (
          <img
            src={auction.property.images[0]}
            alt={auction.property?.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-700">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9.5L12 3l9 6.5V21H3V9.5z" />
            </svg>
          </div>
        )}
        {/* Live badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      </div>

      <div className="p-4">
        <h3 className="truncate font-semibold text-white">{auction.property?.title || '—'}</h3>
        <p className="mt-0.5 truncate text-sm text-neutral-500">
          {auction.property?.city}, {auction.property?.state}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-white/4 p-2.5">
            <p className="text-xs text-neutral-500">Current Bid</p>
            <p className="text-base font-bold text-amber-400">
              {auction.highestBid || auction.startingPrice} ETH
            </p>
          </div>
          <div className="rounded-lg bg-white/4 p-2.5">
            <p className="text-xs text-neutral-500">Ends in</p>
            <Countdown endTime={auction.endTime} />
          </div>
        </div>

        <p className="mt-2 text-xs text-neutral-600">
          {auction.bidCount || 0} bid{auction.bidCount !== 1 ? 's' : ''}
        </p>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuctionsPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active | ended

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/auctions`);
      setAuctions(data.auctions || []);
    } catch {
      setAuctions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  // Real-time: update highest bid on incoming bid:new events
  useEffect(() => {
    const socket = io(API, { transports: ['websocket'] });
    socket.on('bid:new', ({ auctionId, amount }) => {
      setAuctions((prev) =>
        prev.map((a) =>
          a._id === auctionId ? { ...a, highestBid: amount, bidCount: (a.bidCount || 0) + 1 } : a
        )
      );
    });
    socket.on('auction:ended', ({ auctionId }) => {
      setAuctions((prev) =>
        prev.map((a) => (a._id === auctionId ? { ...a, ended: true } : a))
      );
    });
    return () => socket.disconnect();
  }, []);

  const displayed = auctions.filter((a) =>
    filter === 'active' ? !a.ended : a.ended
  );

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              className="text-3xl font-black text-white"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
            >
              Live Auctions
            </h1>
            <p className="text-neutral-500">
              {displayed.length} auction{displayed.length !== 1 ? 's' : ''} •{' '}
              <span className="text-emerald-400">real-time bids</span>
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex rounded-xl border border-white/8 bg-neutral-900 p-1 text-sm">
            {['active', 'ended'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-1.5 font-medium capitalize transition ${
                  filter === f ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-neutral-900 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-600">
            <p className="text-lg">{filter === 'active' ? 'No live auctions right now' : 'No ended auctions'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((a) => (
              <AuctionCard key={a._id} auction={a} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}