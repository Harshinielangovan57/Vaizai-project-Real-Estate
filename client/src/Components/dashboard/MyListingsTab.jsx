// src/components/dashboard/MyListingsTab.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const API = import.meta.env.VITE_API_URL;

export default function MyListingsTab({ listings, token, onRefetch }) {
  // Track which listing is in "edit price" mode
  const [editingId, setEditingId]     = useState(null);
  const [editPrice, setEditPrice]     = useState('');
  const [savingId, setSavingId]       = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const startEdit = (listing) => {
    setEditingId(listing._id);
    setEditPrice(String(listing.price));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice('');
  };

  const savePrice = async (listingId) => {
    if (!editPrice || parseFloat(editPrice) <= 0) {
      toast.error('Enter a valid price');
      return;
    }
    setSavingId(listingId);
    try {
      await axios.put(
        `${API}/api/marketplace/${listingId}`,
        { price: editPrice },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Price updated');
      cancelEdit();
      onRefetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const cancelListing = async (listingId, title) => {
    if (!window.confirm(`Cancel listing for "${title}"?`)) return;
    setCancellingId(listingId);
    try {
      await axios.delete(
        `${API}/api/marketplace/${listingId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Listing cancelled');
      onRefetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    } finally {
      setCancellingId(null);
    }
  };

  if (listings.length === 0) {
    return (
      <EmptyState
        icon="📋"
        message="No active listings"
        action="/list"
        actionLabel="Create a listing →"
      />
    );
  }

  return (
    <div className="space-y-3">
      {listings.map((l) => {
        const isEditing   = editingId === l._id;
        const isSaving    = savingId === l._id;
        const isCancelling = cancellingId === l._id;
        const title = l.property?.title || l.propertyId;

        return (
          <div
            key={l._id}
            className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-neutral-900 p-4 sm:flex-row sm:items-center"
          >
            {/* Thumbnail */}
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
              {l.property?.images?.[0] ? (
                <img src={l.property.images[0]} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg">📋</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link
                to={`/properties/${l.propertyId}`}
                className="truncate font-semibold text-white hover:text-indigo-400 transition"
              >
                {title}
              </Link>
              <p className="mt-0.5 text-xs text-neutral-500">
                {l.property?.city}, {l.property?.state}
              </p>

              {/* Price row */}
              <div className="mt-2 flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      autoFocus
                      className="w-28 rounded-lg border border-indigo-500/50 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white outline-none focus:ring-1 focus:ring-indigo-500/30"
                    />
                    <span className="text-sm text-neutral-500">ETH</span>
                    <button
                      onClick={() => savePrice(l._id)}
                      disabled={isSaving}
                      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="rounded-lg border border-white/8 px-3 py-1.5 text-xs text-neutral-400 hover:bg-white/5 transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-bold text-indigo-400">{l.price} ETH</span>
                    <button
                      onClick={() => startEdit(l)}
                      className="text-xs text-neutral-500 underline underline-offset-2 hover:text-white transition"
                    >
                      Edit price
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Status + cancel */}
            <div className="flex items-center gap-3 shrink-0">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                l.active
                  ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300'
                  : 'border-neutral-700 bg-neutral-800 text-neutral-500'
              }`}>
                {l.active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => cancelListing(l._id, title)}
                disabled={isCancelling}
                className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
              >
                {isCancelling ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
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