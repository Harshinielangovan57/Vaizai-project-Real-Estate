// src/components/admin/StatsTab.jsx
import {
  ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'indigo', icon }) {
  const colors = {
    indigo:  { ring: 'border-indigo-500/25',  bg: 'bg-indigo-500/8',  text: 'text-indigo-400'  },
    emerald: { ring: 'border-emerald-500/25', bg: 'bg-emerald-500/8', text: 'text-emerald-400' },
    amber:   { ring: 'border-amber-500/25',   bg: 'bg-amber-500/8',   text: 'text-amber-400'   },
    red:     { ring: 'border-red-500/25',     bg: 'bg-red-500/8',     text: 'text-red-400'     },
    violet:  { ring: 'border-violet-500/25',  bg: 'bg-violet-500/8',  text: 'text-violet-400'  },
  };
  const c = colors[color];
  return (
    <div className={`rounded-2xl border p-5 ${c.ring} ${c.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-3xl font-black text-white">{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 shadow-xl text-xs">
      <p className="mb-1 font-semibold text-neutral-400">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

// ── Fallback chart data ────────────────────────────────────────────────────────
const MOCK = Array.from({ length: 6 }, (_, i) => {
  const m = new Date();
  m.setMonth(m.getMonth() - (5 - i));
  return {
    month: m.toLocaleString('default', { month: 'short' }),
    listings: Math.floor(Math.random() * 40 + 10),
    volume:   parseFloat((Math.random() * 20 + 5).toFixed(2)),
    fees:     parseFloat((Math.random() * 1.5 + 0.2).toFixed(3)),
  };
});

export default function StatsTab({ stats, charts }) {
  const data = charts?.monthly || MOCK;

  return (
    <div className="space-y-8">
      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon="👥" label="Total Users"      value={stats?.totalUsers?.toLocaleString()}        color="indigo"  sub="registered accounts" />
        <StatCard icon="🏠" label="Total Properties" value={stats?.totalProperties?.toLocaleString()}   color="emerald" sub={`${stats?.verifiedProperties ?? 0} verified`} />
        <StatCard icon="💰" label="Total Volume"     value={stats?.totalVolume ? `${stats.totalVolume} ETH` : '—'} color="amber"  sub="all-time sales" />
        <StatCard icon="💎" label="Fee Revenue"      value={stats?.feeRevenue  ? `${stats.feeRevenue} ETH`  : '—'} color="violet" sub="2% platform fee" />
        <StatCard icon="⚠️" label="Open Disputes"    value={stats?.openDisputes ?? 0}                   color="red"    sub="needs resolution" />
      </div>

      {/* ── Charts row ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Monthly listings + sales volume */}
        <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Monthly Listings & Volume (ETH)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gListing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                </linearGradient>
                <linearGradient id="gVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Area type="monotone" dataKey="listings" stroke="#6366f1" fill="url(#gListing)" strokeWidth={2} dot={false} name="Listings" />
              <Area type="monotone" dataKey="volume"   stroke="#f59e0b" fill="url(#gVolume)"  strokeWidth={2} dot={false} name="Volume (ETH)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fee revenue bar chart */}
        <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Monthly Fee Revenue (ETH)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="fees" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Fees (ETH)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Platform health ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Platform Health</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
          {[
            { label: 'Active Listings',       value: stats?.activeListings   ?? '—' },
            { label: 'Live Auctions',         value: stats?.activeAuctions   ?? '—' },
            { label: 'Pending Verifications', value: stats?.pendingVerify    ?? '—' },
            { label: 'Fraud Flags (open)',    value: stats?.openFraudFlags   ?? '—' },
          ].map((r) => (
            <div key={r.label} className="rounded-xl bg-white/4 p-3">
              <p className="text-xs text-neutral-500">{r.label}</p>
              <p className="mt-0.5 text-xl font-black text-white">{r.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}