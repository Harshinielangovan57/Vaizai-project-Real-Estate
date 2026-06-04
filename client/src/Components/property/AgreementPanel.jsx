// src/components/property/AgreementPanel.jsx
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

/**
 * AgreementPanel
 * Props:
 *   agreement  – agreement object from API
 *   onRefetch  – () => void
 */
export default function AgreementPanel({ agreement, onRefetch }) {
  const { token } = useSelector((s) => s.auth);
  const { address, isConnected, isCorrectNetwork } = useSelector((s) => s.wallet);

  const [signing, setSigning] = useState(false);

  if (!agreement) return null;

  const isSeller = agreement.seller?.toLowerCase() === address?.toLowerCase();
  const isBuyer  = agreement.buyer?.toLowerCase()  === address?.toLowerCase();
  const myRole   = isSeller ? 'seller' : isBuyer ? 'buyer' : null;

  const hasSigned =
    (isSeller && agreement.sellerSigned) ||
    (isBuyer  && agreement.buyerSigned);

  const bothSigned = agreement.sellerSigned && agreement.buyerSigned;

  const handleSign = async () => {
    if (!isConnected || !isCorrectNetwork) {
      toast.error('Connect wallet to Hardhat Local');
      return;
    }
    try {
      setSigning(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const contract = new ethers.Contract(
        cfg.AgreementSigner.address,
        cfg.AgreementSigner.abi,
        signer
      );
      const tx = await contract.signAgreement(agreement.agreementId);
      toast.loading('Signing on-chain…', { id: 'sign' });
      await tx.wait();
      toast.success('Agreement signed!', { id: 'sign' });
      onRefetch?.();
    } catch (err) {
      toast.error(err.reason || err.message || 'Signing failed');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Digital Agreement</h3>
        {bothSigned && (
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
            ✓ Fully Signed
          </span>
        )}
      </div>

      {/* Signing status */}
      <div className="space-y-2">
        {[
          { role: 'Seller', address: agreement.seller, signed: agreement.sellerSigned },
          { role: 'Buyer',  address: agreement.buyer,  signed: agreement.buyerSigned  },
        ].map((p) => (
          <div key={p.role} className="flex items-center justify-between rounded-xl bg-white/4 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                p.signed ? 'bg-emerald-500 text-white' : 'bg-neutral-700 text-neutral-400'
              }`}>
                {p.signed ? '✓' : '?'}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{p.role}</p>
                <p className="font-mono text-xs text-neutral-500 truncate max-w-[160px]">{p.address}</p>
              </div>
            </div>
            <span className={`text-xs font-semibold ${p.signed ? 'text-emerald-400' : 'text-neutral-500'}`}>
              {p.signed ? 'Signed' : 'Pending'}
            </span>
          </div>
        ))}
      </div>

      {/* Agreement ID on-chain */}
      {agreement.agreementId && (
        <div className="rounded-xl bg-white/4 px-4 py-2.5 text-xs">
          <span className="text-neutral-500">On-chain ID </span>
          <span className="font-mono text-indigo-300">{agreement.agreementId}</span>
        </div>
      )}

      {/* Sign button */}
      {myRole && !hasSigned && !bothSigned && (
        <button
          onClick={handleSign}
          disabled={signing}
          className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98]"
        >
          {signing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing on-chain…
            </span>
          ) : `Sign as ${myRole === 'seller' ? 'Seller' : 'Buyer'} (MetaMask)`}
        </button>
      )}

      {hasSigned && !bothSigned && (
        <p className="text-center text-sm text-neutral-500">
          Waiting for the {isSeller ? 'buyer' : 'seller'} to sign…
        </p>
      )}

      {/* Download PDF */}
      {bothSigned && (
        <a
          href={`${API}/api/agreements/${agreement._id}/download`}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-sm font-medium text-neutral-300 hover:bg-white/5 transition"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download Signed Agreement (PDF)
        </a>
      )}
    </div>
  );
}