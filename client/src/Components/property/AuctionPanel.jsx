// src/components/property/AuctionPanel.jsx
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useWallet } from '../../hooks/useWallet';

const API = import.meta.env.VITE_API_URL;
const MIN_INCREMENT = 0.001; // ETH

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(endTime) {
  const calc = () => {
    const diff = endTime ? new Date(endTime).getTime() - Date.now() : -1;
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, ended: true, urgent: false };
    return {
      d: Math.floor(diff / 86400000),
      h: Math.floor((diff % 86400000) / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
      ended: false,
      urgent: diff < 600_000, // under 10 min
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

// ── Countdown display ─────────────────────────────────────────────────────────
function Countdown({ endTime }) {
  const { d, h, m, s, ended, urgent } = useCountdown(endTime);
  if (ended) return (
    <span className="text-sm font-bold text-red-400">Auction Ended</span>
  );
  return (
    <div className={`flex items-center gap-1 font-mono text-xl font-black tabular-nums ${urgent ? 'text-red-400' : 'text-white'}`}>
      {d > 0 && <span>{d}d </span>}
      <span>{String(h).padStart(2,'0')}</span>
      <span className="animate-pulse">:</span>
      <span>{String(m).padStart(2,'0')}</span>
      <span className="animate-pulse">:</span>
      <span>{String(s).padStart(2,'0')}</span>
    </div>
  );
}

/**
 * AuctionPanel
 * Props:
 *   auction   – auction object from API
 *   onBidPlaced – () => void  called after successful bid (triggers parent refetch)
 */
export default function AuctionPanel({ auction, onBidPlaced }) {
  const { token } = useSelector((s) => s.auth);
  const { isAuthenticated } = useSelector((s) => s.auth);
  const { address, isConnected, isCorrectNetwork, connect } = useWallet();

  const [bidAmount, setBidAmount] = useState('');
  const [placing, setPlacing]     = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const countdown = useCountdown(auction?.endTime);
  const minBid = parseFloat(auction?.highestBid || auction?.startingPrice || 0) + MIN_INCREMENT;
  const isOwner = address?.toLowerCase() === auction?.sellerAddress?.toLowerCase();

  const handleBid = async () => {
    if (!isConnected || !isCorrectNetwork) {
      toast.error('Connect wallet to Hardhat Local first');
      await connect();
      return;
    }
    const amount = parseFloat(bidAmount);
    if (!bidAmount || amount < minBid) {
      toast.error(`Bid must be at least ${minBid.toFixed(3)} ETH`);
      return;
    }
    try {
      setPlacing(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const contract = new ethers.Contract(cfg.Auction.address, cfg.Auction.abi, signer);

      const tx = await contract.placeBid(auction.auctionId, {
        value: ethers.parseEther(bidAmount),
      });
      toast.loading('Bid pending…', { id: 'bid' });
      await tx.wait();
      toast.success('Bid placed!', { id: 'bid' });
      setBidAmount('');
      onBidPlaced?.();
    } catch (err) {
      toast.error(err.reason || err.message || 'Bid failed');
    } finally {
      setPlacing(false);
    }
  };

  if (!auction) return null;

  const bids = auction.bids || [];

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-neutral-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Live Auction
          </span>
        </div>
        <span className="text-xs text-neutral-500">
          {auction.bidCount || 0} bid{auction.bidCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Current bid + countdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/4 p-3">
          <p className="text-xs text-neutral-500 mb-1">Current Bid</p>
          <p className="text-2xl font-black text-amber-400">
            {auction.highestBid || auction.startingPrice} ETH
          </p>
          {auction.highestBidder && (
            <p className="mt-1 truncate font-mono text-[10px] text-neutral-600">
              {auction.highestBidder}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-white/4 p-3">
          <p className="text-xs text-neutral-500 mb-1">Ends in</p>
          <Countdown endTime={auction.endTime} />
          {!countdown.ended && countdown.urgent && (
            <p className="mt-1 text-[10px] font-bold text-red-400">⚠ Ending soon!</p>
          )}
        </div>
      </div>

      {/* Bid input */}
      {!countdown.ended && isAuthenticated && !isOwner && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="number"
              step={MIN_INCREMENT}
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={`Min ${minBid.toFixed(3)} ETH`}
              className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-3 pr-16 text-sm text-white placeholder-neutral-600 outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
              ETH
            </span>
          </div>

          {/* Quick bid buttons */}
          <div className="flex gap-2">
            {[minBid, minBid + 0.05, minBid + 0.1].map((v) => (
              <button
                key={v}
                onClick={() => setBidAmount(v.toFixed(3))}
                className="flex-1 rounded-lg border border-white/8 py-1.5 text-xs font-medium text-neutral-400 hover:border-amber-500/40 hover:text-amber-300 transition"
              >
                {v.toFixed(3)}
              </button>
            ))}
          </div>

          <button
            onClick={handleBid}
            disabled={placing}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-50 active:scale-[0.98]"
          >
            {placing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Placing bid…
              </span>
            ) : 'Place Bid'}
          </button>
        </div>
      )}

      {countdown.ended && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center text-sm text-red-400">
          This auction has ended
        </div>
      )}

      {!isAuthenticated && !countdown.ended && (
        <p className="text-center text-sm text-neutral-500">
          <a href="/auth/login" className="text-amber-400 underline">Sign in</a> to place a bid
        </p>
      )}

      {/* Bid history toggle */}
      {bids.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex w-full items-center justify-between text-sm text-neutral-400 hover:text-white transition"
          >
            <span>Bid History ({bids.length})</span>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              className={`transition-transform ${showHistory ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showHistory && (
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {bids.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                    i === 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-white/4'
                  }`}
                >
                  <span className="font-mono text-neutral-400 truncate max-w-[180px]">
                    {i === 0 && <span className="mr-1 text-amber-400">🏆</span>}
                    {b.bidder}
                  </span>
                  <span className={`font-bold shrink-0 ml-2 ${i === 0 ? 'text-amber-400' : 'text-white'}`}>
                    {b.amount} ETH
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}