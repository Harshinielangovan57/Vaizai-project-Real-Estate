// src/components/admin/AuditLogTab.jsx
import { useState } from 'react';

const ACTION_META = {
  VERIFY_PROPERTY:  { label: 'Verified Property',   icon: '✅', color: 'text-emerald-400' },
  REJECT_PROPERTY:  { label: 'Rejected Property',   icon: '❌', color: 'text-red-400'     },
  SUSPEND_USER:     { label: 'Suspended User',      icon: '🔒', color: 'text-red-400'     },
  UNSUSPEND_USER:   { label: 'Unsuspended User',    icon: '🔓', color: 'text-emerald-400' },
  PROMOTE_SELLER:   { label: 'Promoted to Seller',  icon: '⬆️', color: 'text-indigo-400'  },
  DEMOTE_USER:      { label: 'Demoted to User',     icon: '⬇️', color: 'text-neutral-400' },
  DISMISS_FLAG:     { label: 'Dismissed Flag',      icon: '🛡️', color: 'text-blue-400'    },
  RESOLVE_DISPUTE:  { label: 'Resolved Dispute',    icon: '⚖️', color: 'text-violet-400'  },
  REFUND_BUYER:     { label: 'Refunded Buyer',      icon: '↩️', color: 'text-emerald-400' },
};

// const ALL_TYPES = ['All', ...Object.keys(ACTION_META)];
const PER_PAGE  = 15;

export default function AuditLogTab({ auditLog, refetchAuditLog }) {
  const [filter, setFilter] = useState('All');
  const [page,   setPage]   = useState(1);

  const filtered = filter === 'All'
    ? auditLog
    : auditLog.filter((l) => l.action === filter);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Filter + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {['All', 'VERIFY_PROPERTY', 'SUSPEND_USER', 'RESOLVE_DISPUTE', 'DISMISS_FLAG'].map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
              }`}
            >
              {f === 'All' ? `All (${auditLog.length})` : (ACTION_META[f]?.label || f)}
            </button>
          ))}
        </div>

        <button
          onClick={refetchAuditLog}
          className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
          <span className="mb-3 text-4xl opacity-30">📋</span>
          <p>No audit entries yet</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-white/8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 hidden sm:table-cell">Admin</th>
                  <th className="px-4 py-3 hidden md:table-cell">Target</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Note</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paged.map((log, i) => {
                  const meta = ACTION_META[log.action] || { label: log.action, icon: '📄', color: 'text-neutral-400' };
                  return (
                    <tr key={log._id || i} className="bg-neutral-900 hover:bg-white/[0.02]">
                      {/* Action */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{meta.icon}</span>
                          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                        </div>
                      </td>

                      {/* Admin */}
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <p className="text-sm text-neutral-300">{log.adminName || 'Admin'}</p>
                        <p className="font-mono text-xs text-neutral-600 truncate max-w-[120px]">
                          {log.adminAddress?.slice(0, 10)}…
                        </p>
                      </td>

                      {/* Target */}
                      <td className="hidden px-4 py-3 md:table-cell text-xs text-neutral-500">
                        {log.targetType && (
                          <span className="capitalize">{log.targetType}: </span>
                        )}
                        {log.targetId && (
                          <span className="font-mono text-neutral-400">{log.targetId.slice(-8)}</span>
                        )}
                      </td>

                      {/* Note */}
                      <td className="hidden px-4 py-3 lg:table-cell text-xs text-neutral-500 max-w-[200px]">
                        <span className="truncate block">{log.note || '—'}</span>
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 text-xs text-neutral-500 whitespace-nowrap">
                        {log.createdAt
                          ? new Date(log.createdAt).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 hover:bg-white/5 transition"
              >
                ← Prev
              </button>
              <span className="text-sm text-neutral-500">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 hover:bg-white/5 transition"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}