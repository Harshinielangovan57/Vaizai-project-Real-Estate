// src/components/admin/DisputeResolutionTab.jsx
import { useState } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

export default function DisputeResolutionTab({ disputes, refetchDisputes, token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [acting, setActing] = useState(null);
  const [note,   setNote]   = useState({});    // keyed by deal._id

  const resolve = async (deal, outcome) => {
    // outcome: 'release_to_seller' | 'refund_buyer'
    setActing(deal._id);
    try {
      // 1. On-chain resolution via Escrow contract
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const escrowContract = new ethers.Contract(
        cfg.Escrow.address,
        cfg.Escrow.abi,
        signer
      );

      let tx;
      if (outcome === 'release_to_seller') {
        tx = await escrowContract.resolveDispute(deal.escrowId, true);
      } else {
        tx = await escrowContract.resolveDispute(deal.escrowId, false);
      }

      toast.loading('Confirming on-chain…', { id: 'resolve' });
      await tx.wait();
      toast.success('Dispute resolved on-chain!', { id: 'resolve' });

      // 2. Update MongoDB
      await axios.put(
        `${API}/api/escrow/${deal._id}/resolve`,
        { action: outcome, adminNote: note[deal._id] || '' },
        { headers }
      );

      refetchDisputes();
    } catch (err) {
      toast.error(err.reason || err.response?.data?.message || 'Resolution failed', { id: 'resolve' });
    } finally {
      setActing(null);
    }
  };

  if (disputes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
        <span className="mb-3 text-4xl opacity-30">⚖️</span>
        <p>No open disputes — all deals resolved</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        {disputes.length} open dispute{disputes.length !== 1 ? 's' : ''} requiring admin resolution
      </p>

      {disputes.map((d) => (
        <div
          key={d._id}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-full border border-red-500/25 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-300">
                  ⚠ DISPUTED
                </span>
                <span className="text-xs text-neutral-500">
                  Deal #{d._id.slice(-8).toUpperCase()}
                </span>
              </div>
              <p className="font-semibold text-white">
                {d.property?.title || `Property ${d.propertyId?.slice(-6)}`}
              </p>
            </div>
            <p className="text-2xl font-black text-white shrink-0">{d.amount} ETH</p>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-xs text-neutral-500 mb-1">Buyer</p>
              <p className="font-mono text-xs text-neutral-300 truncate">{d.buyer}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-xs text-neutral-500 mb-1">Seller</p>
              <p className="font-mono text-xs text-neutral-300 truncate">{d.seller}</p>
            </div>
          </div>

          {/* Dispute note */}
          {d.disputeNote && (
            <div className="rounded-xl border border-red-500/20 bg-black/20 px-4 py-3 text-sm text-red-200 italic">
              "{d.disputeNote}"
            </div>
          )}

          {/* Timeline */}
          <div className="text-xs text-neutral-600 space-y-0.5">
            {d.createdAt  && <p>Created: {new Date(d.createdAt).toLocaleString('en-IN')}</p>}
            {d.updatedAt  && <p>Disputed: {new Date(d.updatedAt).toLocaleString('en-IN')}</p>}
            {d.escrowId   && <p>On-chain escrow ID: <span className="font-mono text-neutral-500">{d.escrowId}</span></p>}
          </div>

          {/* Admin note */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-neutral-400">
              Admin resolution note (optional)
            </label>
            <textarea
              value={note[d._id] || ''}
              onChange={(e) => setNote((n) => ({ ...n, [d._id]: e.target.value }))}
              rows={2}
              placeholder="Document your decision reason…"
              className="w-full resize-none rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-red-500/30"
            />
          </div>

          {/* Resolution buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => resolve(d, 'release_to_seller')}
              disabled={acting === d._id}
              className="rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {acting === d._id ? 'Processing…' : '→ Release to Seller'}
            </button>
            <button
              onClick={() => resolve(d, 'refund_buyer')}
              disabled={acting === d._id}
              className="rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              {acting === d._id ? 'Processing…' : '↩ Refund Buyer'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}