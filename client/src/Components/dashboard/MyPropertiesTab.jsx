// src/components/dashboard/MyPropertiesTab.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

// ── Inline "Update Metadata" modal (title / description only) ────────────────
function UpdateModal({ property, token, onClose, onSaved }) {
  const [title, setTitle]       = useState(property.title);
  const [description, setDesc]  = useState(property.description || '');
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/api/properties/${property._id}`,
        { title, description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Property updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-bold text-white">Update Property</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/8 py-2.5 text-sm font-medium text-neutral-400 hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function MyPropertiesTab({ properties, token, onRefetch }) {
  const [updateTarget, setUpdateTarget] = useState(null);

  const handleDelist = async (listingId, propertyTitle) => {
    if (!window.confirm(`Delist "${propertyTitle}" from the marketplace?`)) return;
    try {
      await axios.delete(`${API}/api/marketplace/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Listing cancelled');
      onRefetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delist failed');
    }
  };

  if (properties.length === 0) {
    return (
      <EmptyState
        icon="🏠"
        message="You don't own any properties yet"
        action="/marketplace"
        actionLabel="Browse marketplace →"
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {properties.map((p) => (
          <div
            key={p._id}
            className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-neutral-900 p-4 sm:flex-row sm:items-center"
          >
            {/* Thumbnail */}
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
              {p.images?.[0] ? (
                <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-neutral-700 text-xl">🏠</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-white">{p.title}</p>
                {p.verified && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    ✓ Verified
                  </span>
                )}
                {p.tokenId && (
                  <span className="rounded-full bg-indigo-500/15 border border-indigo-500/20 px-2 py-0.5 font-mono text-xs text-indigo-300">
                    #{p.tokenId}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                {p.city}, {p.state} · {p.propertyType}
              </p>
              {p.activeListing && (
                <p className="mt-0.5 text-xs text-indigo-400">
                  Listed at {p.activeListing.price} ETH
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Link
                to={`/properties/${p._id}`}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-white/5 transition"
              >
                View
              </Link>

              <button
                onClick={() => setUpdateTarget(p)}
                className="rounded-lg border border-white/8 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-white/5 transition"
              >
                Update
              </button>

              {p.activeListing ? (
                <button
                  onClick={() => handleDelist(p.activeListing._id, p.title)}
                  className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition"
                >
                  Delist
                </button>
              ) : (
                <Link
                  to={`/list?propertyId=${p._id}`}
                  className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition"
                >
                  + List
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Update modal */}
      {updateTarget && (
        <UpdateModal
          property={updateTarget}
          token={token}
          onClose={() => setUpdateTarget(null)}
          onSaved={onRefetch}
        />
      )}
    </>
  );
}

function EmptyState({ icon, message, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-neutral-600">
      <span className="mb-3 text-4xl opacity-30">{icon}</span>
      <p>{message}</p>
      {action && (
        <a href={action} className="mt-3 text-sm text-indigo-400 hover:underline">
          {actionLabel}
        </a>
      )}
    </div>
  );
}