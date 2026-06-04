// src/components/dashboard/MyBidsTab.jsx
import  { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(endTime) {
  const calc = () => {
    const diff = endTime ? new Date(endTime).getTime() - Date.now() : -1;
    if (diff <= 0) return { label: 'Ended', ended: true, urgent: false };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return {
      label: h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`,
      ended: false,
      urgent: h === 0 && m < 10,
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    if (!endTime) return;
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [endTime]);
  return t;
}

// ── Single bid row ────────────────────────────────────────────────────────────
function BidRow({ bid, token, walletAddress }) {
  const auction = bid.auction || {};
  const countdown = useCountdown(auction.endTime);

  const isWinning =
    auction.highestBidder?.toLowerCase() === walletAddress?.toLowerCase();

  const [rebidAmount, setRebidAmount] = useState('');
  const [showRebid, setShowRebid]     = useState(false);
  const [placing, setPlacing]         = useState(false);

  const { isConnected, isCorrectNetwork, address } = useSelector((s) => s.wallet);

  const handleRebid = async () => {
    if (!isConnected || !isCorrectNetwork) {
      toast.error('Connect wallet to Hardhat network');
      return;
    }
    const min = parseFloat(auction.highestBid || auction.startingPrice);
    if (!rebidAmount || parseFloat(rebidAmount) <= min) {
      toast.error(`Bid must be > ${min} ETH`);
      return;
    }
    setPlacing(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const contract = new ethers.Contract(cfg.Auction.address, cfg.Auction.abi, signer);
      const tx = await contract.placeBid(auction.auctionId, {
        value: ethers.parseEther(rebidAmount),
      });
      toast.loading('Bid pending…', { id: 'rebid' });
      await tx.wait();
      toast.success('Bid placed!', { id: 'rebid' });
      setShowRebid(false);
      setRebidAmount('');
    } catch (err) {
      toast.error(err.reason || err.message || 'Bid failed');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className={`rounded-2xl border p-4 transition ${
      isWinning ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-neutral-900'
    }`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* Thumbnail */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
          {auction.property?.images?.[0] ? (
            <img src={auction.property.images[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg">⚡</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link
            to={`/properties/${auction.propertyId}`}
            className="font-semibold text-white hover:text-indigo-400 transition truncate block"
          >
            {auction.property?.title || 'Auction'}
          </Link>
          <p className="mt-0.5 text-xs text-neutral-500">
            {auction.property?.city}, {auction.property?.state}
          </p>

          {/* Bid details grid */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-white/4 p-2">
              <p className="text-xs text-neutral-500">Your Bid</p>
              <p className="text-sm font-bold text-white">{bid.amount} ETH</p>
            </div>
            <div className="rounded-lg bg-white/4 p-2">
              <p className="text-xs text-neutral-500">Highest</p>
              <p className="text-sm font-bold text-amber-400">
                {auction.highestBid || auction.startingPrice} ETH
              </p>
            </div>
            <div className="rounded-lg bg-white/4 p-2">
              <p className="text-xs text-neutral-500">Ends in</p>
              <p className={`text-sm font-bold tabular-nums ${
                countdown.ended ? 'text-neutral-500' :
                countdown.urgent ? 'text-red-400' : 'text-white'
              }`}>
                {countdown.label}
              </p>
            </div>
          </div>
        </div>

        {/* Status badge + action */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {isWinning ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Winning
            </span>
          ) : countdown.ended ? (
            <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs font-medium text-neutral-500">
              Ended
            </span>
          ) : (
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400">
              Outbid
            </span>
          )}

          {!countdown.ended && !isWinning && (
            <button
              onClick={() => setShowRebid((s) => !s)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 transition"
            >
              Bid Again
            </button>
          )}
        </div>
      </div>

      {/* Re-bid input */}
      {showRebid && (
        <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
          <input
            type="number"
            step="0.001"
            value={rebidAmount}
            onChange={(e) => setRebidAmount(e.target.value)}
            placeholder={`> ${auction.highestBid || auction.startingPrice} ETH`}
            className="flex-1 rounded-xl border border-white/8 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-amber-500/50"
          />
          <button
            onClick={handleRebid}
            disabled={placing}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50 transition"
          >
            {placing ? 'Placing…' : 'Place Bid'}
          </button>
          <button
            onClick={() => setShowRebid(false)}
            className="rounded-xl border border-white/8 px-3 py-2 text-sm text-neutral-400 hover:bg-white/5 transition"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export default function MyBidsTab({ bids, token }) {
  const { address } = useSelector((s) => s.wallet);
  const [filter, setFilter] = useState('all'); // all | winning | outbid | ended

  const filtered = bids.filter((b) => {
    const auction = b.auction || {};
    const ended   = auction.endTime && new Date(auction.endTime) < new Date();
    const winning = auction.highestBidder?.toLowerCase() === address?.toLowerCase();
    if (filter === 'winning') return winning && !ended;
    if (filter === 'outbid')  return !winning && !ended;
    if (filter === 'ended')   return ended;
    return true;
  });

  if (bids.length === 0) {
    return (
      <EmptyState
        icon="⚡"
        message="You haven't placed any bids yet"
        action="/auctions"
        actionLabel="Browse live auctions →"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-white/8 bg-neutral-900 p-1 w-fit">
        {[
          { key: 'all',     label: `All (${bids.length})` },
          { key: 'winning', label: 'Winning' },
          { key: 'outbid',  label: 'Outbid' },
          { key: 'ended',   label: 'Ended' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === f.key ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-600">No bids in this category</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BidRow key={b._id} bid={b} token={token} walletAddress={address} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, message, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
      <span className="mb-3 text-4xl opacity-30">{icon}</span>
      <p>{message}</p>
      {action && (
        <a href={action} className="mt-3 text-sm text-indigo-400 hover:underline">
          {actionLabel}
        </a>
      )}
    </div>
  );
}