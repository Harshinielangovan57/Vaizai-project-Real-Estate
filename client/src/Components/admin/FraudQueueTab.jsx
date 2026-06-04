// src/components/admin/FraudQueueTab.jsx
import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

const SEVERITY = {
  high:   { label: 'High',   bg: 'bg-red-500/15 border-red-500/25',     text: 'text-red-300'    },
  medium: { label: 'Medium', bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-300'  },
  low:    { label: 'Low',    bg: 'bg-blue-500/15 border-blue-500/25',   text: 'text-blue-300'   },
};

const FLAG_TYPES = {
  FAKE_LISTING:    { label: 'Fake Listing',      icon: '🏚️' },
  DUPLICATE:       { label: 'Duplicate',         icon: '📋' },
  PRICE_MANIP:     { label: 'Price Manipulation',icon: '💸' },
  FRAUD:           { label: 'Fraud',             icon: '🚨' },
  SPAM:            { label: 'Spam',              icon: '🗑️' },
  WRONG_INFO:      { label: 'Wrong Info',        icon: '❌' },
};

export default function FraudQueueTab({ fraudQueue, refetchFraud, token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [acting, setActing] = useState(null);
  const [filter, setFilter] = useState('all'); // all | high | medium | low

  const doAction = async (flagId, action) => {
    setActing(flagId);
    try {
      await axios.put(
        `${API}/api/admin/fraud-queue/${flagId}/${action}`,
        {},
        { headers }
      );
      toast.success(action === 'dismiss' ? 'Flag dismissed' : 'Action taken — user suspended');
      refetchFraud();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const displayed = filter === 'all'
    ? fraudQueue
    : fraudQueue.filter((f) => f.severity === filter);

  if (fraudQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
        <span className="mb-3 text-4xl opacity-30">🛡️</span>
        <p>No fraud flags — platform looks clean</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter + count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-xl border border-white/8 bg-neutral-900 p-1">
          {['all', 'high', 'medium', 'low'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filter === f ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
              }`}
            >
              {f === 'all' ? `All (${fraudQueue.length})` : f}
            </button>
          ))}
        </div>
        <p className="text-sm text-neutral-500">{displayed.length} flag{displayed.length !== 1 ? 's' : ''}</p>
      </div>

      {displayed.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-600">No {filter} severity flags</p>
      ) : (
        <div className="space-y-3">
          {displayed.map((f) => {
            const sev   = SEVERITY[f.severity || 'low'];
            const ftype = FLAG_TYPES[f.flagType] || { label: f.flagType, icon: '🚩' };

            return (
              <div
                key={f._id}
                className={`rounded-2xl border p-5 ${sev.bg}`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {/* Left: flag info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{ftype.icon}</span>
                      <span className="font-semibold text-white">{ftype.label}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${sev.bg} ${sev.text}`}>
                        {sev.label} Severity
                      </span>
                      <span className="text-xs text-neutral-600">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                      </span>
                    </div>

                    {/* Description */}
                    {f.description && (
                      <p className="text-sm text-neutral-300">{f.description}</p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                      {f.flaggedBy && (
                        <span>Flagged by: <span className="font-mono text-neutral-400">{f.flaggedBy.slice(0, 12)}…</span></span>
                      )}
                      {f.targetType && (
                        <span>Target: <span className="text-neutral-400 capitalize">{f.targetType}</span></span>
                      )}
                      {f.targetId && (
                        <span>ID: <span className="font-mono text-neutral-400">{f.targetId.slice(-8)}</span></span>
                      )}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => doAction(f._id, 'dismiss')}
                      disabled={acting === f._id}
                      className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-neutral-400 hover:bg-white/5 disabled:opacity-50 transition"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => doAction(f._id, 'action')}
                      disabled={acting === f._id}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50 transition"
                    >
                      {acting === f._id ? 'Acting…' : 'Suspend User'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}