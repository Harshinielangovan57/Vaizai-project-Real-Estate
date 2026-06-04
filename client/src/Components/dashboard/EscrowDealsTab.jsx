// src/components/dashboard/EscrowDealsTab.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

// ── State config ──────────────────────────────────────────────────────────────
const STATE_META = {
  AWAITING_PAYMENT:  { label: 'Awaiting Payment',  color: 'text-blue-300',    bg: 'border-blue-500/25 bg-blue-500/10'    },
  AWAITING_DELIVERY: { label: 'Awaiting Delivery', color: 'text-amber-300',   bg: 'border-amber-500/25 bg-amber-500/10'  },
  COMPLETE:          { label: 'Complete',           color: 'text-emerald-300', bg: 'border-emerald-500/25 bg-emerald-500/10' },
  DISPUTED:          { label: 'Disputed',           color: 'text-red-300',     bg: 'border-red-500/25 bg-red-500/10'      },
  REFUNDED:          { label: 'Refunded',           color: 'text-neutral-400', bg: 'border-neutral-700 bg-neutral-800'    },
};

// ── State flow diagram (inline) ───────────────────────────────────────────────
function StateFlow({ current }) {
  const STATES = ['AWAITING_PAYMENT', 'AWAITING_DELIVERY', 'COMPLETE'];
  const idx = STATES.indexOf(current);

  if (current === 'DISPUTED' || current === 'REFUNDED') return null;

  return (
    <div className="flex items-center gap-0 mt-3">
      {STATES.map((s, i) => {
        const done    = i < idx;
        const active  = i === idx;
        // const meta    = STATE_META[s];
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition ${
                done   ? 'bg-emerald-500 text-white' :
                active ? 'bg-amber-500 text-black' :
                         'bg-neutral-800 text-neutral-600'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${active ? 'text-white' : 'text-neutral-600'}`}>
                {s === 'AWAITING_PAYMENT' ? 'Payment' : s === 'AWAITING_DELIVERY' ? 'Delivery' : 'Done'}
              </span>
            </div>
            {i < STATES.length - 1 && (
              <div className={`mb-4 h-px flex-1 mx-1 ${i < idx ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Single deal card ──────────────────────────────────────────────────────────
function DealCard({ deal, token, walletAddress, onRefetch }) {
  const [actioning, setActioning] = useState(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);

  const meta = STATE_META[deal.state] || STATE_META.AWAITING_PAYMENT;

  const isBuyer  = deal.buyer?.toLowerCase()  === walletAddress?.toLowerCase();
  const isSeller = deal.seller?.toLowerCase() === walletAddress?.toLowerCase();
  const role     = isBuyer ? 'Buyer' : isSeller ? 'Seller' : 'Observer';

  const doAction = async (action, body = {}) => {
    setActioning(action);
    try {
      await axios.put(
        `${API}/api/escrow/${deal._id}/${action}`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Escrow ${action} submitted`);
      onRefetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className={`rounded-2xl border p-5 ${
      deal.state === 'DISPUTED' ? 'border-red-500/25 bg-red-500/5' : 'border-white/8 bg-neutral-900'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            <span className="rounded-full bg-white/5 border border-white/8 px-2 py-0.5 text-xs text-neutral-500">
              {role}
            </span>
          </div>
          <p className="font-semibold text-white">
            Deal #{deal._id.slice(-8).toUpperCase()}
          </p>
          <Link
            to={`/properties/${deal.propertyId}`}
            className="text-sm text-indigo-400 hover:underline"
          >
            {deal.property?.title || 'View property →'}
          </Link>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-black text-white">{deal.amount} ETH</p>
          {deal.createdAt && (
            <p className="text-xs text-neutral-600">
              {new Date(deal.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* State flow */}
      <StateFlow current={deal.state} />

      {/* Parties */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-white/4 p-2">
          <p className="text-neutral-500">Buyer</p>
          <p className="font-mono text-neutral-300 truncate">{deal.buyer?.slice(0, 14)}…</p>
        </div>
        <div className="rounded-lg bg-white/4 p-2">
          <p className="text-neutral-500">Seller</p>
          <p className="font-mono text-neutral-300 truncate">{deal.seller?.slice(0, 14)}…</p>
        </div>
      </div>

      {/* Dispute note */}
      {deal.disputeNote && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300 italic">
          "{deal.disputeNote}"
        </div>
      )}

      {/* Action buttons */}
      {deal.state === 'AWAITING_DELIVERY' && (
        <div className="mt-4 space-y-2">
          {/* Buyer: confirm delivery */}
          {isBuyer && (
            <button
              onClick={() => doAction('confirm')}
              disabled={actioning === 'confirm'}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {actioning === 'confirm' ? 'Confirming…' : '✓ Confirm Delivery'}
            </button>
          )}

          {/* Buyer or Seller: raise dispute */}
          {(isBuyer || isSeller) && !showDisputeInput && (
            <button
              onClick={() => setShowDisputeInput(true)}
              className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
            >
              ⚠ Raise Dispute
            </button>
          )}

          {showDisputeInput && (
            <div className="space-y-2">
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                rows={2}
                placeholder="Briefly describe the issue…"
                className="w-full resize-none rounded-xl border border-red-500/30 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => doAction('dispute', { note: disputeNote })}
                  disabled={actioning === 'dispute'}
                  className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {actioning === 'dispute' ? 'Submitting…' : 'Submit Dispute'}
                </button>
                <button
                  onClick={() => { setShowDisputeInput(false); setDisputeNote(''); }}
                  className="rounded-xl border border-white/8 px-4 py-2 text-sm text-neutral-400 hover:bg-white/5 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Seller: request refund */}
          {isSeller && (
            <button
              onClick={() => doAction('refund')}
              disabled={actioning === 'refund'}
              className="w-full rounded-xl border border-white/8 py-2.5 text-sm font-medium text-neutral-400 hover:bg-white/5 disabled:opacity-50 transition"
            >
              {actioning === 'refund' ? 'Processing…' : 'Request Refund'}
            </button>
          )}
        </div>
      )}

      {deal.state === 'COMPLETE' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Deal completed — funds released to seller
        </div>
      )}

      {deal.state === 'DISPUTED' && (
        <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
          Dispute raised — awaiting admin resolution. Check back soon.
        </div>
      )}

      {deal.state === 'REFUNDED' && (
        <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
          ↩ Refunded to buyer
        </div>
      )}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────
export default function EscrowDealsTab({ escrowDeals, token, onRefetch }) {
  const { address } = useSelector((s) => s.wallet);
  const [filter, setFilter] = useState('active');

  const filtered = escrowDeals.filter((d) => {
    if (filter === 'active')   return !['COMPLETE', 'REFUNDED'].includes(d.state);
    if (filter === 'complete') return d.state === 'COMPLETE';
    if (filter === 'disputed') return d.state === 'DISPUTED';
    return true;
  });

  if (escrowDeals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
        <span className="mb-3 text-4xl opacity-30">🔒</span>
        <p>No escrow deals yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 rounded-xl border border-white/8 bg-neutral-900 p-1 w-fit">
        {[
          { key: 'all',      label: `All (${escrowDeals.length})` },
          { key: 'active',   label: 'Active' },
          { key: 'disputed', label: 'Disputed' },
          { key: 'complete', label: 'Complete' },
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
        <p className="py-10 text-center text-sm text-neutral-600">No deals in this category</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((d) => (
            <DealCard
              key={d._id}
              deal={d}
              token={token}
              walletAddress={address}
              onRefetch={onRefetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}