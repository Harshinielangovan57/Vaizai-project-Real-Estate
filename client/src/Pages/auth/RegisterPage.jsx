import  { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerWithEmail } from '../../store/slices/authSlice';
import { useWallet } from '../../hooks/useWallet';
import toast from 'react-hot-toast';

const passwordRules = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /\d/.test(p) },
];

function PasswordStrength({ password }) {
  const passed = passwordRules.filter((r) => r.test(password)).length;
  const colors = ['bg-red-500', 'bg-amber-500', 'bg-emerald-500'];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {passwordRules.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i < passed ? colors[passed - 1] : 'bg-neutral-700'
            }`}
          />
        ))}
      </div>
      <div className="space-y-0.5">
        {passwordRules.map((r) => (
          <p key={r.label} className={`text-xs ${r.test(password) ? 'text-emerald-400' : 'text-neutral-600'}`}>
            {r.test(password) ? '✓' : '○'} {r.label}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isLoading, error } = useSelector((s) => s.auth);
  const { connect, isConnecting } = useWallet();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (!agreed) {
      toast.error('Please accept the terms of service');
      return;
    }
    const action = await dispatch(
      registerWithEmail({ name: form.name, email: form.email, password: form.password })
    );
    if (registerWithEmail.fulfilled.match(action)) {
      toast.success('Account created!');
      navigate('/dashboard', { replace: true });
    }
  };

  const handleWalletRegister = async () => {
    if (!agreed) { toast.error('Please accept the terms first'); return; }
    await connect();
  };

  const passwordsMatch = form.confirmPassword && form.password === form.confirmPassword;
  const passwordMismatch = form.confirmPassword && form.password !== form.confirmPassword;
  const allRulesPassed = passwordRules.every((r) => r.test(form.password));

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[700px] rounded-full bg-indigo-600/8 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-black text-white">
              RE
            </span>
            <span
              className="text-xl font-black text-white"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
            >
              RealNFT
            </span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-white">Create an account</h1>
          <p className="mt-1 text-sm text-neutral-500">Start buying and selling tokenized property</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/8 bg-neutral-900 p-6 shadow-2xl">
          {/* Wallet register */}
          <button
            onClick={handleWalletRegister}
            disabled={isConnecting}
            className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Connecting…
              </>
            ) : (
              <>
                <MetaMaskIcon />
                Sign up with MetaMask
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative mb-5 flex items-center">
            <div className="flex-1 border-t border-white/8" />
            <span className="mx-3 text-xs text-neutral-600">or create with email</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          {/* Email form */}
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Full Name</label>
              <input
                type="text"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="John Doe"
                className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setField('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder-neutral-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {form.password && <PasswordStrength password={form.password} />}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-neutral-300">Confirm Password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-xl border bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none focus:ring-1 ${
                  passwordMismatch
                    ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
                    : passwordsMatch
                    ? 'border-emerald-500/50 focus:border-emerald-500/50 focus:ring-emerald-500/20'
                    : 'border-white/8 focus:border-indigo-500/50 focus:ring-indigo-500/20'
                }`}
              />
              {passwordMismatch && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="mt-1 text-xs text-emerald-400">✓ Passwords match</p>
              )}
            </div>

            {/* ToS */}
            <label className="flex cursor-pointer items-start gap-2.5">
              <div
                onClick={() => setAgreed((a) => !a)}
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                  agreed ? 'bg-indigo-600 border-indigo-600' : 'border-white/20 bg-white/5'
                }`}
              >
                {agreed && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2">
                    <polyline points="2 6 5 9 10 3" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-neutral-500 leading-relaxed">
                I agree to the{' '}
                <a href="#" className="text-indigo-400 hover:underline">Terms of Service</a> and{' '}
                <a href="#" className="text-indigo-400 hover:underline">Privacy Policy</a>
              </span>
            </label>

            {error && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !agreed || !allRulesPassed || passwordMismatch}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40 active:scale-95"
            >
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-indigo-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function MetaMaskIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 35 33" fill="none">
      <path d="M32.96 1L19.37 10.86l2.49-5.85L32.96 1z" fill="#E17726" />
      <path d="M2.04 1l13.47 9.96-2.37-5.95L2.04 1z" fill="#E27625" />
      <path d="M28.23 23.51l-3.61 5.52 7.73 2.13 2.22-7.54-6.34-.11z" fill="#E27625" />
      <path d="M1.27 23.62l2.2 7.54 7.72-2.13-3.6-5.52-6.32.11z" fill="#E27625" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}