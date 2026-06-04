// src/components/dashboard/MyTransactionsTab.jsx
import  { useState } from 'react';

const HARDHAT_EXPLORER = 'http://localhost:8545';

// ── Type config ───────────────────────────────────────────────────────────────
const TX_META = {
  BUY:        { label: 'Purchase',      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '🛒' },
  SELL:       { label: 'Sale',          color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20',  icon: '💰' },
  BID:        { label: 'Bid Placed',    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   icon: '⚡' },
  BID_REFUND: { label: 'Bid Refunded',  color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',     icon: '↩️' },
  MINT:       { label: 'NFT Minted',    color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20', icon: '⛓️' },
  ESCROW:     { label: 'Escrow',        color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',     icon: '🔒' },
};

const ALL_TYPES = ['All', 'BUY', 'SELL', 'BID', 'BID_REFUND', 'MINT', 'ESCROW'];

function TxRow({ tx }) {
  const meta  = TX_META[tx.type] || { label: tx.type, color: 'text-neutral-400', bg: 'bg-white/4', icon: '📄' };
  const date  = tx.createdAt ? new Date(tx.createdAt) : null;
  const short = tx.txHash ? `${tx.txHash.slice(0, 10)}…${tx.txHash.slice(-6)}` : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-neutral-900 p-4 sm:flex-row sm:items-center">
      {/* Icon */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg ${meta.bg}`}>
        {meta.icon}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
          {tx.property?.title && (
            <span className="truncate text-sm text-neutral-400 max-w-[200px]">
              — {tx.property.title}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          {date && (
            <span>
              {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' · '}
              {date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {tx.from && (
            <span className="font-mono">
              From: {tx.from.slice(0, 8)}…
            </span>
          )}
          {tx.to && (
            <span className="font-mono">
              To: {tx.to.slice(0, 8)}…
            </span>
          )}
        </div>

        {/* txHash link */}
        {short && (
          <a
            href={`${HARDHAT_EXPLORER}/tx/${tx.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-indigo-400 hover:underline"
          >
            {short}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        )}
      </div>

      {/* Amount */}
      {tx.amount != null && (
        <div className="shrink-0 text-right">
          <p className={`text-base font-black ${meta.color}`}>
            {['BUY', 'BID', 'ESCROW'].includes(tx.type) ? '−' : '+'}
            {tx.amount} ETH
          </p>
          {tx.amountUsd && (
            <p className="text-xs text-neutral-600">${tx.amountUsd.toLocaleString()}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyTransactionsTab({ transactions }) {
  const [typeFilter, setTypeFilter] = useState('All');
  const [page, setPage]             = useState(1);
  const PER_PAGE = 10;

  const filtered = typeFilter === 'All'
    ? transactions
    : transactions.filter((t) => t.type === typeFilter);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Running totals
  const totalSpent = transactions
    .filter((t) => ['BUY', 'BID', 'ESCROW'].includes(t.type))
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const totalEarned = transactions
    .filter((t) => t.type === 'SELL')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon="📄"
        message="No transactions yet"
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Transactions', value: transactions.length, color: 'text-white' },
          { label: 'Total Spent',    value: `${totalSpent.toFixed(3)} ETH`,  color: 'text-red-400' },
          { label: 'Total Earned',   value: `${totalEarned.toFixed(3)} ETH`, color: 'text-emerald-400' },
          { label: 'Buys / Sells',   value: `${transactions.filter(t=>t.type==='BUY').length} / ${transactions.filter(t=>t.type==='SELL').length}`, color: 'text-indigo-400' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-white/8 bg-neutral-900 p-3">
            <p className="text-xs text-neutral-500">{c.label}</p>
            <p className={`mt-0.5 text-base font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => { setTypeFilter(t); setPage(1); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-white/5 text-neutral-400 hover:bg-white/10'
            }`}
          >
            {t === 'All' ? `All (${transactions.length})` : TX_META[t]?.label || t}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {paged.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-600">No {typeFilter} transactions</p>
      ) : (
        <div className="space-y-2">
          {paged.map((tx) => <TxRow key={tx._id || tx.txHash} tx={tx} />)}
        </div>
      )}

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
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/8 px-3 py-1.5 text-sm text-neutral-400 disabled:opacity-30 hover:bg-white/5 transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
      <span className="mb-3 text-4xl opacity-30">{icon}</span>
      <p>{message}</p>
    </div>
  );
}