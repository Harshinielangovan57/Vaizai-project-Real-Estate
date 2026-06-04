// src/components/admin/UsersTab.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

const ROLE_COLORS = {
  admin:  'border-violet-500/25 bg-violet-500/10 text-violet-300',
  seller: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
  user:   'border-white/10 bg-white/5 text-neutral-400',
};

const KYC_COLORS = {
  approved: 'text-emerald-400',
  pending:  'text-amber-400',
  rejected: 'text-red-400',
  none:     'text-neutral-600',
};

export default function UsersTab({ fetchUsers, users, userTotal, token }) {
  const headers = { Authorization: `Bearer ${token}` };

  const [q,      setQ]      = useState('');
  const [role,   setRole]   = useState('');
  const [page,   setPage]   = useState(1);
  const [acting, setActing] = useState(null); // userId being actioned

  const load = useCallback(() => {
    fetchUsers({ q, role, page });
  }, [q, role, page, fetchUsers]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchUsers({ q, role, page: 1 }); }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const doAction = async (userId, action, payload = {}) => {
    setActing(userId);
    try {
      if (action === 'role') {
        await axios.put(`${API}/api/admin/users/${userId}/role`, payload, { headers });
        toast.success(`Role updated to ${payload.role}`);
      } else if (action === 'suspend') {
        await axios.put(`${API}/api/admin/users/${userId}/suspend`, {}, { headers });
        toast.success('User suspended');
      } else if (action === 'unsuspend') {
        await axios.put(`${API}/api/admin/users/${userId}/unsuspend`, {}, { headers });
        toast.success('User unsuspended');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const totalPages = Math.ceil(userTotal / 20);

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, wallet…"
              className="w-full rounded-xl border border-white/8 bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50"
            />
          </div>

          <select
            value={role}
            onChange={(e) => { setRole(e.target.value); setPage(1); }}
            className="rounded-xl border border-white/8 bg-neutral-900 px-3 py-2.5 text-sm text-white outline-none"
          >
            <option value="">All roles</option>
            <option value="user">User</option>
            <option value="seller">Seller</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <span className="text-sm text-neutral-500 shrink-0">{userTotal} users</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-white/8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 hidden sm:table-cell">Wallet</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 hidden md:table-cell">KYC</th>
                <th className="px-4 py-3 hidden lg:table-cell">Joined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-neutral-600">
                    No users found
                  </td>
                </tr>
              ) : users.map((u) => (
                <tr
                  key={u._id}
                  className={`bg-neutral-900 transition hover:bg-white/[0.02] ${u.suspended ? 'opacity-50' : ''}`}
                >
                  {/* User */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                        {(u.name || u.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white max-w-[140px]">{u.name || '—'}</p>
                        <p className="truncate text-xs text-neutral-500 max-w-[140px]">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Wallet */}
                  <td className="hidden px-4 py-3 font-mono text-xs text-neutral-500 sm:table-cell">
                    {u.walletAddress ? `${u.walletAddress.slice(0, 10)}…` : '—'}
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
                      {u.role}
                    </span>
                  </td>

                  {/* KYC */}
                  <td className={`hidden px-4 py-3 text-xs font-medium capitalize md:table-cell ${KYC_COLORS[u.kycStatus || 'none']}`}>
                    {u.kycStatus || 'none'}
                  </td>

                  {/* Joined */}
                  <td className="hidden px-4 py-3 text-xs text-neutral-600 lg:table-cell">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {/* Promote to seller */}
                      {u.role === 'user' && (
                        <button
                          onClick={() => doAction(u._id, 'role', { role: 'seller' })}
                          disabled={acting === u._id}
                          title="Promote to Seller"
                          className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-50 transition"
                        >
                          → Seller
                        </button>
                      )}

                      {/* Demote to user */}
                      {u.role === 'seller' && (
                        <button
                          onClick={() => doAction(u._id, 'role', { role: 'user' })}
                          disabled={acting === u._id}
                          title="Demote to User"
                          className="rounded-lg border border-white/8 px-2.5 py-1 text-xs text-neutral-400 hover:bg-white/5 disabled:opacity-50 transition"
                        >
                          → User
                        </button>
                      )}

                      {/* Suspend / Unsuspend */}
                      {u.role !== 'admin' && (
                        u.suspended ? (
                          <button
                            onClick={() => doAction(u._id, 'unsuspend')}
                            disabled={acting === u._id}
                            className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <button
                            onClick={() => doAction(u._id, 'suspend')}
                            disabled={acting === u._id}
                            className="rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50 transition"
                          >
                            Suspend
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}