// src/components/property/PaymentModal.jsx
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useWallet } from '../../hooks/useWallet';

const API = import.meta.env.VITE_API_URL;

// ── Tx state pill ─────────────────────────────────────────────────────────────
function TxState({ state }) {
  const map = {
    idle:      null,
    waiting:   { label: 'Waiting for MetaMask…', color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/25' },
    pending:   { label: 'Transaction pending…',  color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/25'   },
    confirmed: { label: '✓ Confirmed!',           color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25' },
    failed:    { label: 'Transaction failed',     color: 'text-red-300',     bg: 'bg-red-500/10 border-red-500/25'     },
  };
  const m = map[state];
  if (!m) return null;
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${m.bg} ${m.color}`}>
      {state === 'pending' && (
        <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {m.label}
    </div>
  );
}

/**
 * PaymentModal
 * Props:
 *   listing     – { _id, price, listingId }
 *   property    – { _id, title }
 *   ethUsd      – number   live ETH/USD rate
 *   onClose     – () => void
 */
export default function PaymentModal({ listing, property, ethUsd, onClose }) {
  const navigate = useNavigate();
  const { token } = useSelector((s) => s.auth);
  const { isConnected, isCorrectNetwork, connect, refreshBalance } = useWallet();

  const [method, setMethod]   = useState('eth'); // 'eth' | 'card'
  const [txState, setTxState] = useState('idle');

  const usdEquiv = ethUsd
    ? `≈ $${(parseFloat(listing.price) * ethUsd).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '';

  // ── ETH purchase ─────────────────────────────────────────────────────────
  const handleEthBuy = async () => {
    if (!isConnected || !isCorrectNetwork) {
      toast.error('Connect your wallet to Hardhat Local first');
      await connect();
      return;
    }
    try {
      setTxState('waiting');
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const contract = new ethers.Contract(
        cfg.Marketplace.address,
        cfg.Marketplace.abi,
        signer
      );

      const tx = await contract.buyProperty(listing.listingId, {
        value: ethers.parseEther(String(listing.price)),
      });
      setTxState('pending');

      await tx.wait();
      setTxState('confirmed');
      refreshBalance();

      toast.success('Purchase confirmed!');
      setTimeout(() => { onClose(); navigate('/dashboard'); }, 1500);
    } catch (err) {
      setTxState('failed');
      toast.error(err.reason || err.message || 'Transaction failed');
    }
  };

  // ── Stripe / card purchase ────────────────────────────────────────────────
  const handleCardBuy = async () => {
    try {
      setTxState('pending');
      const { data } = await axios.post(
        `${API}/api/marketplace/${listing._id}/buy/fiat`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTxState('idle');
      // Open Stripe checkout in new tab
      window.open(data.checkoutUrl, '_blank');
      toast.success('Redirecting to Stripe checkout…');
      onClose();
    } catch (err) {
      setTxState('failed');
      toast.error(err.response?.data?.message || 'Payment failed');
    }
  };

  const busy = txState === 'waiting' || txState === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Complete Purchase</h2>
            <p className="text-sm text-neutral-500 truncate max-w-[260px]">{property?.title}</p>
          </div>
          <button onClick={onClose} disabled={busy}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Price */}
        <div className="mb-5 rounded-2xl border border-white/8 bg-white/4 p-4 text-center">
          <p className="text-xs text-neutral-500 mb-1">Total Price</p>
          <p className="text-3xl font-black text-white">{listing.price} ETH</p>
          {usdEquiv && <p className="text-sm text-neutral-500 mt-0.5">{usdEquiv}</p>}
        </div>

        {/* Method selector */}
        <div className="mb-4 flex overflow-hidden rounded-xl border border-white/8 text-sm">
          {[
            { key: 'eth',  label: '⬡ Pay with ETH',   sub: 'MetaMask wallet' },
            { key: 'card', label: '💳 Pay with Card',  sub: 'Stripe · Fiat'  },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => { setMethod(m.key); setTxState('idle'); }}
              disabled={busy}
              className={`flex-1 py-3 px-2 transition ${
                method === m.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white'
              }`}
            >
              <p className="font-semibold">{m.label}</p>
              <p className={`text-xs mt-0.5 ${method === m.key ? 'text-indigo-200' : 'text-neutral-600'}`}>
                {m.sub}
              </p>
            </button>
          ))}
        </div>

        {/* Tx state */}
        {txState !== 'idle' && (
          <div className="mb-4">
            <TxState state={txState} />
          </div>
        )}

        {/* ETH method details */}
        {method === 'eth' && txState === 'idle' && (
          <div className="mb-4 rounded-xl border border-white/8 bg-white/4 p-3 text-xs text-neutral-400 space-y-1">
            <p>1. MetaMask will open asking you to confirm</p>
            <p>2. Transaction is sent to the Marketplace smart contract</p>
            <p>3. On confirmation, the NFT transfers to your wallet</p>
          </div>
        )}

        {/* Card method details */}
        {method === 'card' && txState === 'idle' && (
          <div className="mb-4 rounded-xl border border-white/8 bg-white/4 p-3 text-xs text-neutral-400 space-y-1">
            <p>1. You'll be redirected to a secure Stripe checkout page</p>
            <p>2. After payment, our backend mints the NFT to your wallet</p>
            <p>3. You'll receive a confirmation email from Stripe</p>
          </div>
        )}

        {/* Action button */}
        {txState !== 'confirmed' && (
          <button
            onClick={method === 'eth' ? handleEthBuy : handleCardBuy}
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98]"
          >
            {busy
              ? 'Processing…'
              : method === 'eth'
              ? `Buy with MetaMask · ${listing.price} ETH`
              : 'Continue to Stripe'}
          </button>
        )}

        {txState === 'failed' && (
          <button
            onClick={() => setTxState('idle')}
            className="mt-2 w-full rounded-xl border border-white/8 py-2.5 text-sm text-neutral-400 hover:bg-white/5 transition"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}