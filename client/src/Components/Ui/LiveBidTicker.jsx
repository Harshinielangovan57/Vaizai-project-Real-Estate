// src/components/ui/LiveBidTicker.jsx
import { useState, useEffect, useCallback } from 'react';
import { useSocketEvent } from '../../hooks/useSocket';
import { Link } from 'react-router-dom';

const MAX_TICKS = 5;

export default function LiveBidTicker() {
  const [ticks, setTicks] = useState([]);
  const [visible, setVisible] = useState(true);

  const onBidNew = useCallback((data) => {
    setTicks((prev) => [
      {
        id:            `${data.auctionId}-${Date.now()}`,
        propertyId:    data.propertyId,
        propertyTitle: data.propertyTitle || 'Property',
        amount:        data.amount,
        bidder:        data.bidder,
        at:            new Date(),
      },
      ...prev,
    ].slice(0, MAX_TICKS));
  }, []);

  useSocketEvent('bid:new', onBidNew);

  // Auto-fade oldest tick after 8s
  useEffect(() => {
    if (ticks.length === 0) return;
    const t = setTimeout(() => setTicks((p) => p.slice(0, -1)), 8000);
    return () => clearTimeout(t);
  }, [ticks]);

  if (!visible || ticks.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 w-72 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          Live Bids
        </div>
        <button
          onClick={() => setVisible(false)}
          className="text-neutral-600 hover:text-neutral-400 text-xs"
        >
          Hide
        </button>
      </div>

      {ticks.map((tick, i) => (
        <Link
          key={tick.id}
          to={`/properties/${tick.propertyId}`}
          className={`flex items-center gap-3 rounded-xl border border-amber-500/20 bg-neutral-900/95 px-3 py-2.5 shadow-lg backdrop-blur-sm transition hover:border-amber-500/40 ${
            i === 0 ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ animation: 'slideInLeft 0.3s ease' }}
        >
          <span className="text-base shrink-0">⚡</span>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-semibold text-white">{tick.propertyTitle}</p>
            <p className="truncate font-mono text-[10px] text-neutral-500">
              {tick.bidder?.slice(0, 10)}…
            </p>
          </div>
          <span className="shrink-0 text-sm font-black text-amber-400">{tick.amount} ETH</span>
        </Link>
      ))}

      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}