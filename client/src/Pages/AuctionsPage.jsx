// src/pages/AuctionsPage.jsx
import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link }    from 'react-router-dom';
import PageShell   from '../components/layout/PageShell';
import LiveBidTicker from '../components/ui/LiveBidTicker';
import { fetchAuctions } from '../store/slices/auctionSlice';

// ── Countdown hook ─────────────────────────────────────────────────────────
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

function Countdown({ endTime }) {
  const { d, h, m, s, ended } = useCountdown(endTime);
  if (ended) return <span className="text-sm font-semibold text-red-400">Ended</span>;
  const urgent = d === 0 && h === 0 && m < 10;
  return (
    <span className={`font-mono text-sm font-semibold tabular-nums ${urgent ? 'text-amber-400' : 'text-white'}`}>
      {d > 0 && `${d}d `}{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
    </span>
  );
}

function AuctionCard({ auction }) {
  return (
    <Link
      to={`/properties/${auction.propertyId}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-neutral-900 transition hover:-translate-y-0.5 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-950/30"
    >
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
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
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
            {/* Live value from Redux (updated by socket) */}
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

export default function AuctionsPage() {
  const dispatch = useDispatch();
  const { auctions, loading } = useSelector((s) => s.auction);
  const [filter, setFilter]   = useState('active');

  useEffect(() => { dispatch(fetchAuctions()); }, [dispatch]);

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
              {displayed.length} auction{displayed.length !== 1 ? 's' : ''} ·{' '}
              <span className="text-emerald-400">real-time bids</span>
            </p>
          </div>

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
              <div key={i} className="h-64 animate-pulse rounded-2xl bg-neutral-900" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-600">
            <p className="text-lg">
              {filter === 'active' ? 'No live auctions right now' : 'No ended auctions'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((a) => (
              <AuctionCard key={a._id} auction={a} />
            ))}
          </div>
        )}
      </div>

      {/* Floating live bid ticker — bottom-left */}
      <LiveBidTicker />
    </PageShell>
  );
}