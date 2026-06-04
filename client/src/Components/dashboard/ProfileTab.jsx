// src/components/dashboard/ProfileTab.jsx
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';
import { setAuthFromWallet } from '../../store/slices/authSlice';

const API = import.meta.env.VITE_API_URL;

const KYC_META = {
  none:     { label: 'Not submitted',  color: 'text-neutral-400',  bg: 'bg-neutral-800 border-neutral-700', dot: 'bg-neutral-500' },
  pending:  { label: 'Under review',   color: 'text-amber-300',    bg: 'bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400 animate-pulse' },
  approved: { label: 'Approved',       color: 'text-emerald-300',  bg: 'bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected',       color: 'text-red-300',      bg: 'bg-red-500/10 border-red-500/25', dot: 'bg-red-500' },
};

export default function ProfileTab({ token }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { address, balance, chainId } = useSelector((s) => s.wallet);

  const [name,  setName]  = useState(user?.name  || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const kyc = KYC_META[user?.kycStatus || 'none'];

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const { data } = await axios.put(
        `${API}/api/users/me`,
        { name, email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Update user in Redux
      dispatch(setAuthFromWallet({
        user: data.user,
        token,
        walletAddress: address,
      }));
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isDirty = name !== (user?.name || '') || email !== (user?.email || '');

  return (
    <div className="max-w-lg space-y-6">
      {/* ── Avatar & role ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white select-none">
          {(name || user?.email || 'U')[0].toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-white">{user?.name || 'Anonymous'}</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-white/5 border border-white/8 px-2.5 py-0.5 text-xs font-medium capitalize text-neutral-400">
              {user?.role || 'user'}
            </span>
            {user?.role === 'user' && (
              <span className="text-xs text-neutral-600">
                Need to list?{' '}
                <a href="mailto:support@realnft.io" className="text-indigo-400 hover:underline">
                  Request seller role
                </a>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit form ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 space-y-4">
        <h3 className="font-semibold text-white">Personal Information</h3>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">Display Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-300">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* ── Wallet info ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 space-y-3">
        <h3 className="font-semibold text-white">Connected Wallet</h3>

        {address ? (
          <>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-white/4 px-4 py-3">
              <span className="font-mono text-sm text-neutral-300 truncate">{address}</span>
              <button
                onClick={copyAddress}
                className="shrink-0 rounded-lg border border-white/8 px-2.5 py-1 text-xs text-neutral-400 hover:bg-white/5 transition"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/4 p-3">
                <p className="text-xs text-neutral-500">Balance</p>
                <p className="font-bold text-white">{parseFloat(balance).toFixed(4)} ETH</p>
              </div>
              <div className="rounded-xl bg-white/4 p-3">
                <p className="text-xs text-neutral-500">Network</p>
                <p className="font-bold text-white">
                  {chainId === 31337 ? (
                    <span className="text-emerald-400">Hardhat Local</span>
                  ) : (
                    <span className="text-red-400">Chain {chainId}</span>
                  )}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-neutral-500">No wallet connected</p>
        )}
      </div>

      {/* ── KYC status ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 space-y-3">
        <h3 className="font-semibold text-white">KYC Verification</h3>

        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${kyc.bg}`}>
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${kyc.dot}`} />
          <div>
            <p className={`text-sm font-semibold ${kyc.color}`}>{kyc.label}</p>
            <p className="text-xs text-neutral-600 mt-0.5">
              {user?.kycStatus === 'approved'
                ? 'You are verified and can buy or sell properties.'
                : user?.kycStatus === 'pending'
                ? 'Your documents are under review. This usually takes 1–2 business days.'
                : user?.kycStatus === 'rejected'
                ? 'Your KYC was rejected. Please resubmit with valid documents.'
                : 'Submit your documents to unlock buying and selling.'}
            </p>
          </div>
        </div>

        {(!user?.kycStatus || user?.kycStatus === 'none' || user?.kycStatus === 'rejected') && (
          <button
            className="w-full rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20 transition"
          >
            Start KYC Verification →
          </button>
        )}
      </div>

      {/* ── Danger zone ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-red-500/15 bg-red-500/5 p-5 space-y-3">
        <h3 className="font-semibold text-red-400">Danger Zone</h3>
        <p className="text-xs text-neutral-500">
          Deleting your account is irreversible. All data will be removed.
          Tokenized properties will remain on-chain but won't be manageable from this account.
        </p>
        <button className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition">
          Delete Account
        </button>
      </div>
    </div>
  );
}