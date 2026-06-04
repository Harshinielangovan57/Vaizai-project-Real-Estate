// src/pages/AdminPage.jsx
import { useState } from 'react';
import { useSelector } from 'react-redux';

import PageShell              from '../components/layout/PageShell';
import StatsTab               from '../components/admin/StatsTab';
import UsersTab               from '../components/admin/UsersTab';
import PropertyVerificationTab from '../components/admin/PropertyVerificationTab';
import FraudQueueTab          from '../components/admin/FraudQueueTab';
import DisputeResolutionTab   from '../components/admin/DisputeResolutionTab';
import AuditLogTab            from '../components/admin/AuditLogTab';
import { useAdminData }       from '../hooks/useAdminData';

const TABS = [
  { key: 'stats',      label: 'Overview',     icon: '📊' },
  { key: 'users',      label: 'Users',        icon: '👥' },
  { key: 'properties', label: 'Verify Queue', icon: '🏠' },
  { key: 'fraud',      label: 'Fraud Queue',  icon: '🚨' },
  { key: 'disputes',   label: 'Disputes',     icon: '⚖️' },
  { key: 'audit',      label: 'Audit Log',    icon: '📋' },
];

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
        <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[1,2,3,4,5].map(i => <div key={i} className="h-24 rounded-2xl bg-neutral-900 animate-pulse" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[1,2].map(i => <div key={i} className="h-64 rounded-2xl bg-neutral-900 animate-pulse" />)}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { token, user } = useSelector((s) => s.auth);
  const [activeTab, setActiveTab] = useState('stats');

  const {
    stats, charts,
    users, userTotal, fetchUsers,
    properties, fetchProperties,
    fraudQueue,  refetchFraud,
    disputes,    refetchDisputes,
    auditLog,    refetchAuditLog,
    loading,
  } = useAdminData(token);

  const badges = {
    stats:      0,
    users:      0,
    properties: properties.length,
    fraud:      fraudQueue.length,
    disputes:   disputes.length,
    audit:      0,
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-3xl font-black text-white"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
            >
              Admin Panel
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Platform management &amp; moderation
              {user?.name && <span className="ml-2 text-neutral-600">· {user.name}</span>}
            </p>
          </div>

          {/* Alert summary */}
          {(fraudQueue.length > 0 || disputes.length > 0 || properties.length > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {properties.length > 0 && (
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 font-semibold text-amber-300">
                  {properties.length} pending verification
                </span>
              )}
              {fraudQueue.length > 0 && (
                <span className="rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1 font-semibold text-red-300">
                  {fraudQueue.length} fraud flags
                </span>
              )}
              {disputes.length > 0 && (
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 font-semibold text-violet-300">
                  {disputes.length} open disputes
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────── */}
        <div className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-neutral-900 p-1.5 scrollbar-none">
          {TABS.map((tab) => (
            <TabBtn
              key={tab.key}
              tab={tab}
              active={activeTab === tab.key}
              badge={badges[tab.key]}
              onClick={() => setActiveTab(tab.key)}
            />
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────────────── */}
        {loading && activeTab === 'stats' ? (
          <SkeletonGrid />
        ) : (
          <>
            {activeTab === 'stats' && (
              <StatsTab stats={stats} charts={charts} />
            )}

            {activeTab === 'users' && (
              <UsersTab
                fetchUsers={fetchUsers}
                users={users}
                userTotal={userTotal}
                token={token}
              />
            )}

            {activeTab === 'properties' && (
              <PropertyVerificationTab
                properties={properties}
                fetchProperties={fetchProperties}
                token={token}
              />
            )}

            {activeTab === 'fraud' && (
              <FraudQueueTab
                fraudQueue={fraudQueue}
                refetchFraud={refetchFraud}
                token={token}
              />
            )}

            {activeTab === 'disputes' && (
              <DisputeResolutionTab
                disputes={disputes}
                refetchDisputes={refetchDisputes}
                token={token}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLogTab
                auditLog={auditLog}
                refetchAuditLog={refetchAuditLog}
              />
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}