// src/components/admin/PropertyVerificationTab.jsx
import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

export default function PropertyVerificationTab({ properties, fetchProperties, token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [acting, setActing] = useState(null);
  const [preview, setPreview] = useState(null); // property being previewed

  useEffect(() => { fetchProperties(); }, []);

  const handleVerify = async (property) => {
    setActing(property._id);
    try {
      // 1. Call on-chain verifyProperty()
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer   = await provider.getSigner();
      const { data: cfg } = await axios.get(`${API}/api/config/contracts`);
      const contract = new ethers.Contract(
        cfg.PropertyNFT.address,
        cfg.PropertyNFT.abi,
        signer
      );

      const tx = await contract.verifyProperty(property.tokenId);
      toast.loading('Confirming on-chain…', { id: 'verify' });
      await tx.wait();
      toast.success('Property verified on-chain!', { id: 'verify' });

      // 2. Update MongoDB (backend also listens for PropertyVerified event,
      //    but we call directly for instant UI feedback)
      await axios.put(
        `${API}/api/admin/properties/${property._id}/verify`,
        { verified: true },
        { headers }
      );

      fetchProperties();
      setPreview(null);
    } catch (err) {
      toast.error(err.reason || err.response?.data?.message || 'Verification failed', { id: 'verify' });
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (propertyId) => {
    if (!window.confirm('Reject this property listing?')) return;
    setActing(propertyId);
    try {
      await axios.put(
        `${API}/api/admin/properties/${propertyId}/verify`,
        { verified: false, rejected: true },
        { headers }
      );
      toast.success('Property rejected');
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActing(null);
    }
  };

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
        <span className="mb-3 text-4xl opacity-30">✅</span>
        <p>All properties are verified — queue is empty</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {properties.length} propert{properties.length !== 1 ? 'ies' : 'y'} pending verification
        </p>
      </div>

      <div className="space-y-3">
        {properties.map((p) => (
          <div
            key={p._id}
            className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-neutral-900 p-4 sm:flex-row sm:items-start"
          >
            {/* Thumbnail */}
            <div
              className="h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-neutral-800"
              onClick={() => setPreview(p)}
            >
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover hover:scale-105 transition" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl">🏠</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-white truncate">{p.title}</p>
                <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
                  {p.propertyType}
                </span>
                {p.tokenId && (
                  <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 font-mono text-xs text-indigo-300">
                    Token #{p.tokenId}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500">{p.address}, {p.city}, {p.state}</p>
              <div className="flex flex-wrap gap-3 text-xs text-neutral-600">
                <span>Owner: <span className="font-mono text-neutral-400">{p.ownerAddress?.slice(0, 12)}…</span></span>
                {p.squareFeet && <span>{p.squareFeet.toLocaleString()} sqft</span>}
                {p.bedrooms   && <span>{p.bedrooms}bd · {p.bathrooms}ba</span>}
                <span>Listed: {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '—'}</span>
              </div>

              {/* Images count */}
              <p className="text-xs text-neutral-600">{p.images?.length || 0} photos uploaded</p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0 sm:items-end">
              <button
                onClick={() => setPreview(p)}
                className="rounded-xl border border-white/8 px-4 py-2 text-xs font-medium text-neutral-400 hover:bg-white/5 transition"
              >
                Preview
              </button>
              <button
                onClick={() => handleVerify(p)}
                disabled={acting === p._id || !p.tokenId}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
                title={!p.tokenId ? 'Property must be minted first' : ''}
              >
                {acting === p._id ? 'Verifying…' : '✓ Verify On-Chain'}
              </button>
              <button
                onClick={() => handleReject(p._id)}
                disabled={acting === p._id}
                className="rounded-xl border border-red-500/25 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-white">{preview.title}</h3>
              <button onClick={() => setPreview(null)} className="text-neutral-500 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Image grid */}
            {preview.images?.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-2">
                {preview.images.slice(0, 6).map((img, i) => (
                  <img key={i} src={img} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}

            <div className="space-y-1.5 text-sm">
              {[
                ['Address',   `${preview.address}, ${preview.city}, ${preview.state}`],
                ['Type',      preview.propertyType],
                ['Size',      preview.squareFeet ? `${preview.squareFeet.toLocaleString()} sqft` : '—'],
                ['Beds/Baths',`${preview.bedrooms || '—'} / ${preview.bathrooms || '—'}`],
                ['Owner',     preview.ownerAddress],
                ['Description', preview.description],
              ].map(([k, v]) => v ? (
                <div key={k} className="flex gap-3">
                  <span className="w-24 shrink-0 text-neutral-500">{k}</span>
                  <span className="text-neutral-300 truncate">{v}</span>
                </div>
              ) : null)}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => { handleVerify(preview); }}
                disabled={acting === preview._id || !preview.tokenId}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                ✓ Verify On-Chain
              </button>
              <button
                onClick={() => { handleReject(preview._id); setPreview(null); }}
                className="flex-1 rounded-xl border border-red-500/25 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition"
              >
                ✕ Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}