// src/pages/DashboardPage.jsx
import  { useState } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { useEffect } from 'react';

import PageShell from '../components/layout/PageShell';
import MyPropertiesTab   from '../components/dashboard/MyPropertiesTab';
import MyListingsTab     from '../components/dashboard/MyListingsTab';
import MyBidsTab         from '../components/dashboard/MyBidsTab';
import MyTransactionsTab from '../components/dashboard/MyTransactionsTab';
import EscrowDealsTab    from '../components/dashboard/EscrowDealsTab';
import ProfileTab        from '../components/dashboard/ProfileTab';
import { useDashboard }  from '../hooks/useDashboard';

const API = import.meta.env.VITE_API_URL;

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'properties',   label: 'My Properties',  icon: '🏠' },
  { key: 'listings',     label: 'My Listings',    icon: '📋' },
  { key: 'bids',         label: 'My Bids',        icon: '⚡' },
  { key: 'transactions', label: 'Transactions',   icon: '📄' },
  { key: 'escrow',       label: 'Escrow Deals',   icon: '🔒' },
  { key: 'profile',      label: 'Profile',        icon: '👤' },
];

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-neutral-900 animate-pulse" />
      ))}
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabBtn({ tab, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition ${
        active ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white'
      }`}
    >
      <span className="hidden sm:inline">{tab.icon}</span>
      {tab.label}
      {badge > 0 && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, token } = useSelector((s) => s.auth);
  const { address }     = useSelector((s) => s.wallet);

  const [activeTab, setActiveTab] = useState('properties');

  const {
    properties, listings, bids, transactions, escrowDeals,
    loading,
    refetchProperties, refetchListings, refetchEscrow,
  } = useDashboard(token);

  // ── Real-time: update escrow state on socket events ─────────────────────
  useEffect(() => {
    const socket = io(API, { transports: ['websocket'] });

    socket.on('escrow:stateChange', (data) => {
      refetchEscrow();
    });

    socket.on('listing:sold', () => {
      refetchListings();
      refetchProperties();
    });

    return () => socket.disconnect();
  }, []);

  // ── Stat summary for header ──────────────────────────────────────────────
  const stats = [
    { label: 'Properties',   value: properties.length },
    { label: 'Active Listings', value: listings.filter((l) => l.active).length },
    { label: 'Active Bids',  value: bids.filter((b) => !b.auction?.ended).length },
    { label: 'Escrow Deals', value: escrowDeals.filter((d) => !['COMPLETE','REFUNDED'].includes(d.state)).length },
  ];

  // Tab badges
  const badges = {
    properties:   0,
    listings:     listings.filter((l) => l.active).length,
    bids:         bids.filter((b) => {
      const a = b.auction || {};
      return !a.ended && a.highestBidder?.toLowerCase() !== address?.toLowerCase();
    }).length, // outbid count
    transactions: 0,
    escrow:       escrowDeals.filter((d) => d.state === 'AWAITING_DELIVERY').length,
    profile:      0,
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white select-none">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <h1
                className="text-xl font-black text-white"
                style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
              >
                {user?.name || 'My Dashboard'}
              </h1>
              <p className="text-sm text-neutral-500 capitalize">
                {user?.role}
                {address && (
                  <span className="ml-2 font-mono text-xs">
                    · {address.slice(0, 8)}…{address.slice(-4)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* KYC badge */}
          {user?.kycStatus && (
            <span className={`self-start rounded-full border px-3 py-1 text-xs font-semibold ${
              user.kycStatus === 'approved'
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                : user.kycStatus === 'pending'
                ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                : 'border-red-500/25 bg-red-500/10 text-red-300'
            }`}>
              KYC: {user.kycStatus}
            </span>
          )}
        </div>

        {/* ── Quick stats ──────────────────────────────────────────── */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/8 bg-neutral-900 p-4">
              <p className="text-xs text-neutral-500">{s.label}</p>
              <p className="mt-0.5 text-2xl font-black text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────── */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-neutral-900 p-1.5 scrollbar-none">
          {TABS.map((tab) => (
            <TabBtn
              key={tab.key}
              tab={tab}
              active={activeTab === tab.key}
              badge={badges[tab.key] || 0}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────── */}
        {loading ? (
          <SkeletonList />
        ) : (
          <>
            {activeTab === 'properties' && (
              <MyPropertiesTab
                properties={properties}
                token={token}
                onRefetch={refetchProperties}
              />
            )}

            {activeTab === 'listings' && (
              <MyListingsTab
                listings={listings}
                token={token}
                onRefetch={refetchListings}
              />
            )}

            {activeTab === 'bids' && (
              <MyBidsTab
                bids={bids}
                token={token}
              />
            )}

            {activeTab === 'transactions' && (
              <MyTransactionsTab
                transactions={transactions}
              />
            )}

            {activeTab === 'escrow' && (
              <EscrowDealsTab
                escrowDeals={escrowDeals}
                token={token}
                onRefetch={refetchEscrow}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileTab token={token} />
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}