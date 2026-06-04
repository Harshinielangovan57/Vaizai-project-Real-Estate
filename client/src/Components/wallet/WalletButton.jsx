// src/components/wallet/WalletButton.jsx
import React, { useState } from 'react';
import { useWallet } from '../../hooks/useWallet';

/**
 * WalletButton
 *
 * Handles all states:
 *  - MetaMask not installed  → "Install MetaMask" link
 *  - Not connected           → "Connect Wallet" button
 *  - Connecting              → spinner
 *  - Wrong network           → "Switch Network" warning button
 *  - Connected               → address chip + ETH balance + disconnect option
 */
export default function WalletButton() {
  const {
    address,
    balance,
    chainId,
    isConnected,
    isConnecting,
    isCorrectNetwork,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();

  const [menuOpen, setMenuOpen] = useState(false);

  const metamaskInstalled = !!window.ethereum;

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : '';

  // ── MetaMask not installed ──────────────────────────────────────────────
  if (!metamaskInstalled) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-400 transition hover:bg-amber-400/10"
      >
        <MetaMaskIcon />
        Install MetaMask
      </a>
    );
  }

  // ── Connecting ──────────────────────────────────────────────────────────
  if (isConnecting) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600/60 px-4 py-2 text-sm font-semibold text-white"
      >
        <Spinner />
        Connecting…
      </button>
    );
  }

  // ── Not connected ───────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <button
        onClick={connect}
        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
      >
        <MetaMaskIcon />
        Connect Wallet
      </button>
    );
  }

  // ── Wrong network ───────────────────────────────────────────────────────
  if (!isCorrectNetwork) {
    return (
      <button
        onClick={switchNetwork}
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        <WarningIcon />
        Wrong Network (chain {chainId}) — Switch
      </button>
    );
  }

  // ── Connected + correct network ─────────────────────────────────────────
  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-700/30 border border-emerald-500/40 px-3 py-2 text-sm font-mono text-emerald-300 transition hover:bg-emerald-700/50"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>{shortAddress}</span>
        <span className="text-emerald-400/70">|</span>
        <span className="font-semibold">{parseFloat(balance).toFixed(4)} ETH</span>
        <ChevronIcon open={menuOpen} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-white/10 bg-neutral-900 shadow-xl z-50">
          <button
            onClick={() => {
              setMenuOpen(false);
              navigator.clipboard.writeText(address);
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
          >
            <CopyIcon /> Copy address
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              disconnect();
            }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/5"
          >
            <DisconnectIcon /> Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tiny inline icons (no external dep needed) ─────────────────────────────

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

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
      <path d="M22 12a10 10 0 0 0-10-10" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 3.5L20.5 19h-17L12 5.5zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}