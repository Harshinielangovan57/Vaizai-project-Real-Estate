// src/components/wallet/NetworkGuard.jsx

import { useSelector } from 'react-redux';
import { useWallet } from '../../hooks/useWallet';

/**
 * NetworkGuard
 *
 * Wraps any component that requires the user to be on Hardhat local (chainId 31337).
 * Shows a full-screen overlay prompt if they are on the wrong network.
 */
export default function NetworkGuard({ children }) {
  const { isConnected, isCorrectNetwork, chainId } = useSelector((s) => s.wallet);
  const { switchNetwork } = useWallet();

  if (!isConnected || isCorrectNetwork) {
    return children;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 max-w-sm rounded-2xl border border-red-500/30 bg-neutral-900 p-8 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          <span className="rounded-full bg-red-500/10 p-4">
            <svg
              className="h-10 w-10 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </span>
        </div>
        <h2 className="mb-2 text-lg font-bold text-white">Wrong Network</h2>
        <p className="mb-1 text-sm text-neutral-400">
          You are connected to chain <span className="font-mono text-red-300">{chainId}</span>.
        </p>
        <p className="mb-6 text-sm text-neutral-400">
          This app requires the <span className="text-white">Hardhat Local</span> network
          (chain ID <span className="font-mono text-emerald-300">31337</span>).
        </p>
        <button
          onClick={switchNetwork}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95"
        >
          Switch to Hardhat Local
        </button>
      </div>
    </div>
  );
}