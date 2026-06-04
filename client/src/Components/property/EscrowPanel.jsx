// src/components/property/EscrowPanel.jsx
import { useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

const STATE_CFG = {
  AWAITING_PAYMENT:  { label: 'Awaiting Payment',  icon: '⏳', color: 'text-blue-300',    border: 'border-blue-500/25',    bg: 'bg-blue-500/8'    },
  AWAITING_DELIVERY: { label: 'Awaiting Delivery', icon: '🚚', color: 'text-amber-300',   border: 'border-amber-500/25',   bg: 'bg-amber-500/8'   },
  COMPLETE:          { label: 'Complete',           icon: '✅', color: 'text-emerald-300', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8' },
  DISPUTED:          { label: 'Disputed',           icon: '⚠️', color: 'text-red-300',     border: 'border-red-500/25',     bg: 'bg-red-500/8'     },
  REFUNDED:          { label: 'Refunded',           icon: '↩️', color: 'text-neutral-400', border: 'border-neutral-700',    bg: 'bg-neutral-800'   },
};

/**
 * EscrowPanel
 * Props:
 *   escrow     – deal object from API
 *   onRefetch  – () => void
 */
export default function EscrowPanel({ escrow, onRefetch }) {
  const { token } = useSelector((s) => s.auth);
  const { address } = useSelector((s) => s.wallet);

  const [actioning, setActioning]         = useState(null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeNote, setDisputeNote]     = useState('');

  if (!escrow) return null;

  const isBuyer  = escrow.buyer?.toLowerCase()  === address?.toLowerCase();
  const isSeller = escrow.seller?.toLowerCase() === address?.toLowerCase();
  const cfg = STATE_CFG[escrow.state] || STATE_CFG.AWAITING_PAYMENT;

  const doAction = async (action, body = {}) => {
    setActioning(action);
    try {
      await axios.put(
        `${API}/api/escrow/${escrow._id}/${action}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Escrow updated`);
      onRefetch?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className={`rounded-2xl border p-5 space-y-4 ${cfg.border} ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Escrow Status</h3>
        <div className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.border} ${cfg.color}`}>
          <span>{cfg.icon}</span>
          {cfg.label}
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-black/20 p-2.5">
          <p className="text-neutral-500">Buyer</p>
          <p className={`mt-0.5 truncate font-mono ${isBuyer ? 'text-indigo-300' : 'text-neutral-300'}`}>
            {escrow.buyer?.slice(0, 14)}… {isBuyer && <span className="text-indigo-400">(you)</span>}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 p-2.5">
          <p className="text-neutral-500">Seller</p>
          <p className={`mt-0.5 truncate font-mono ${isSeller ? 'text-indigo-300' : 'text-neutral-300'}`}>
            {escrow.seller?.slice(0, 14)}… {isSeller && <span className="text-indigo-400">(you)</span>}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3">
        <span className="text-sm text-neutral-400">Escrowed Amount</span>
        <span className="text-lg font-black text-white">{escrow.amount} ETH</span>
      </div>

      {/* State: AWAITING_DELIVERY actions */}
      {escrow.state === 'AWAITING_DELIVERY' && (
        <div className="space-y-2">
          {/* Buyer: confirm delivery */}
          {isBuyer && (
            <button
              onClick={() => doAction('confirm')}
              disabled={actioning === 'confirm'}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {actioning === 'confirm' ? 'Confirming…' : '✓ Confirm Delivery — Release Funds'}
            </button>
          )}

          {/* Buyer or Seller: raise dispute */}
          {(isBuyer || isSeller) && !showDisputeForm && (
            <button
              onClick={() => setShowDisputeForm(true)}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
            >
              ⚠ Raise Dispute
            </button>
          )}

          {showDisputeForm && (
            <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
              <p className="text-xs font-medium text-red-300">Describe the issue</p>
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                rows={3}
                placeholder="e.g. Property condition doesn't match listing photos…"
                className="w-full resize-none rounded-lg border border-red-500/25 bg-black/30 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => doAction('dispute', { note: disputeNote })}
                  disabled={actioning === 'dispute'}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {actioning === 'dispute' ? 'Submitting…' : 'Submit Dispute'}
                </button>
                <button
                  onClick={() => { setShowDisputeForm(false); setDisputeNote(''); }}
                  className="rounded-lg border border-white/8 px-4 py-2 text-sm text-neutral-400 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {escrow.state === 'COMPLETE' && (
        <p className="text-center text-sm text-emerald-400">
          ✓ Funds released to seller — deal complete
        </p>
      )}

      {escrow.state === 'DISPUTED' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          {escrow.disputeNote && <p className="italic mb-1">"{escrow.disputeNote}"</p>}
          <p>Dispute raised — awaiting admin resolution.</p>
        </div>
      )}

      {escrow.state === 'REFUNDED' && (
        <p className="text-center text-sm text-neutral-400">↩ Amount refunded to buyer</p>
      )}
    </div>
  );
}