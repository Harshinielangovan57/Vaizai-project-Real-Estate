// src/pages/PropertyDetailPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import axios from 'axios';
import toast from 'react-hot-toast';

import PageShell      from '../components/layout/PageShell';
import ImageGallery   from '../components/property/ImageGallery';
import VirtualTourViewer from '../components/property/VirtualTourViewer';
import AuctionPanel   from '../components/property/AuctionPanel';
import EscrowPanel    from '../components/property/EscrowPanel';
import AgreementPanel from '../components/property/AgreementPanel';
import PaymentModal   from '../components/property/PaymentModal';
import { useEthPrice } from '../hooks/useEthPrice';

const API = import.meta.env.VITE_API_URL;

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            <div className="aspect-video rounded-2xl bg-neutral-900 animate-pulse" />
            <div className="flex gap-2">
              {[0,1,2,3].map(i => <div key={i} className="h-16 w-16 rounded-lg bg-neutral-900 animate-pulse" />)}
            </div>
            <div className="h-8 w-2/3 rounded-xl bg-neutral-900 animate-pulse" />
            <div className="h-4 w-1/2 rounded-xl bg-neutral-900 animate-pulse" />
          </div>
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 rounded-2xl bg-neutral-900 animate-pulse" />)}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2.5 last:border-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PropertyDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { token, isAuthenticated } = useSelector((s) => s.auth);
  const { address } = useSelector((s) => s.wallet);
  const { toUsd }  = useEthPrice();

  const [property,  setProperty]  = useState(null);
  const [listing,   setListing]   = useState(null);
  const [auction,   setAuction]   = useState(null);
  const [escrow,    setEscrow]    = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Fetch all data ──────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [propR, listR, aucR] = await Promise.allSettled([
        axios.get(`${API}/api/properties/${id}`),
        axios.get(`${API}/api/marketplace?propertyId=${id}`),
        axios.get(`${API}/api/auctions?propertyId=${id}`),
      ]);

      if (propR.status === 'fulfilled') setProperty(propR.value.data.property);
      if (listR.status === 'fulfilled') setListing(listR.value.data.listings?.[0] || null);
      if (aucR.status  === 'fulfilled') setAuction(aucR.value.data.auctions?.[0]  || null);

      if (isAuthenticated) {
        const [escR, agrR] = await Promise.allSettled([
          axios.get(`${API}/api/escrow?propertyId=${id}`,    { headers }),
          axios.get(`${API}/api/agreements?propertyId=${id}`, { headers }),
        ]);
        if (escR.status === 'fulfilled') setEscrow(escR.value.data.deal         || null);
        if (agrR.status === 'fulfilled') setAgreement(agrR.value.data.agreement || null);
      }
    } catch {
      toast.error('Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id, isAuthenticated]);

  // ── Socket.io real-time ────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API, { transports: ['websocket'] });

    socket.on('bid:new', ({ auctionId, amount, bidder, bidCount }) => {
      setAuction((a) => a && a._id === auctionId
        ? { ...a, highestBid: amount, highestBidder: bidder, bidCount,
            bids: [{ bidder, amount }, ...(a.bids || [])] }
        : a
      );
    });

    socket.on('auction:ended', ({ auctionId }) => {
      setAuction((a) => a && a._id === auctionId ? { ...a, ended: true } : a);
    });

    socket.on('escrow:stateChange', (data) => {
      if (data.propertyId === id) setEscrow(data.deal);
    });

    socket.on('agreement:signed', (data) => {
      if (data.propertyId === id) setAgreement(data.agreement);
    });

    return () => socket.disconnect();
  }, [id]);

  if (loading) return <Skeleton />;

  if (!property) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
          <p className="text-lg mb-3">Property not found</p>
          <Link to="/marketplace" className="text-indigo-400 hover:underline text-sm">← Back to Marketplace</Link>
        </div>
      </PageShell>
    );
  }

  const isOwner = address?.toLowerCase() === property.ownerAddress?.toLowerCase();
  const canBuy  = listing && !listing.inactive && !isOwner && isAuthenticated;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-xs text-neutral-500">
          <Link to="/" className="hover:text-white transition">Home</Link>
          <span>/</span>
          <Link to="/marketplace" className="hover:text-white transition">Marketplace</Link>
          <span>/</span>
          <span className="text-neutral-300 truncate max-w-[200px]">{property.title}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">

          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="space-y-6">

            {/* Image gallery */}
            <ImageGallery images={property.images || []} title={property.title} />

            {/* Virtual tour */}
            {(property.virtualTourUrl || property.tour360Url) && (
              <VirtualTourViewer
                matterportUrl={property.virtualTourUrl}
                tour360Url={property.tour360Url}
              />
            )}

            {/* Property header */}
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {property.verified && (
                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                    ✓ Verified
                  </span>
                )}
                <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-0.5 text-xs text-neutral-400">
                  {property.propertyType}
                </span>
                {property.tokenId && (
                  <span className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs text-indigo-300">
                    NFT #{property.tokenId}
                  </span>
                )}
              </div>

              <h1
                className="text-3xl font-black leading-tight text-white"
                style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
              >
                {property.title}
              </h1>
              <p className="mt-1.5 text-neutral-400">
                {property.address && `${property.address}, `}
                {property.city}, {property.state}, {property.country}
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Bedrooms',   value: property.bedrooms  },
                { label: 'Bathrooms',  value: property.bathrooms },
                { label: 'Sq Ft',      value: property.squareFeet?.toLocaleString() },
                { label: 'Year Built', value: property.yearBuilt },
              ].map((s) => s.value ? (
                <div key={s.label} className="rounded-xl border border-white/8 bg-neutral-900 p-3 text-center">
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                </div>
              ) : null)}
            </div>

            {/* Description */}
            {property.description && (
              <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
                <h2 className="mb-3 font-semibold text-white">About this property</h2>
                <p className="leading-relaxed text-neutral-400">{property.description}</p>
              </div>
            )}

            {/* Property details */}
            <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
              <h2 className="mb-3 font-semibold text-white">Property Details</h2>
              <InfoRow label="Property Type"  value={property.propertyType} />
              <InfoRow label="Address"        value={property.address} />
              <InfoRow label="City / State"   value={`${property.city}, ${property.state}`} />
              <InfoRow label="Country"        value={property.country} />
              <InfoRow label="Square Footage" value={property.squareFeet ? `${property.squareFeet.toLocaleString()} sqft` : null} />
              <InfoRow label="Bedrooms"       value={property.bedrooms} />
              <InfoRow label="Bathrooms"      value={property.bathrooms} />
              <InfoRow label="Year Built"     value={property.yearBuilt} />
              <InfoRow label="Owner"          value={property.ownerAddress ? `${property.ownerAddress.slice(0, 10)}…` : null} />
            </div>

            {/* AI Valuation */}
            {property.aiValuation && (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                <h2 className="mb-3 font-semibold text-white">AI Valuation</h2>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-xs text-neutral-500">AI Estimated Value</p>
                    <p className="text-2xl font-black text-white">
                      ${property.aiValuation.toLocaleString()}
                    </p>
                  </div>
                  {listing && (
                    <div>
                      <p className="text-xs text-neutral-500">Asking Price</p>
                      <p className={`text-lg font-bold ${
                        parseFloat(listing.price) * (property.aiValuation / 3000) < property.aiValuation
                          ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {listing.price} ETH
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Fixed-price buy panel */}
            {listing && !listing.inactive && (
              <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
                <p className="text-xs text-neutral-500 mb-1">Listed Price</p>
                <div className="mb-4 flex items-end gap-2">
                  <p className="text-3xl font-black text-white">{listing.price} ETH</p>
                  {toUsd(listing.price) && (
                    <p className="mb-0.5 text-sm text-neutral-500">{toUsd(listing.price)}</p>
                  )}
                </div>

                {canBuy ? (
                  <button
                    onClick={() => setShowPayment(true)}
                    className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-[0.98]"
                  >
                    Buy Now
                  </button>
                ) : isOwner ? (
                  <p className="text-center text-sm text-neutral-500">You own this property</p>
                ) : !isAuthenticated ? (
                  <Link
                    to="/auth/login"
                    className="block w-full rounded-xl border border-white/8 py-3 text-center text-sm font-medium text-neutral-400 hover:bg-white/5 transition"
                  >
                    Sign in to purchase
                  </Link>
                ) : null}
              </div>
            )}

            {/* Auction panel */}
            {auction && (
              <AuctionPanel
                auction={auction}
                onBidPlaced={fetchData}
              />
            )}

            {/* Escrow panel */}
            {escrow && (
              <EscrowPanel
                escrow={escrow}
                onRefetch={fetchData}
              />
            )}

            {/* Agreement panel */}
            {agreement && (
              <AgreementPanel
                agreement={agreement}
                onRefetch={fetchData}
              />
            )}

            {/* No panels at all — not listed */}
            {!listing && !auction && !escrow && !agreement && (
              <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5 text-center">
                <p className="text-sm text-neutral-500">This property is not currently listed for sale.</p>
                {isOwner && (
                  <Link
                    to={`/list?propertyId=${property._id}`}
                    className="mt-3 inline-block text-sm text-indigo-400 hover:underline"
                  >
                    List this property →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && listing && (
        <PaymentModal
          listing={listing}
          property={property}
          ethUsd={0}
          onClose={() => setShowPayment(false)}
        />
      )}
    </PageShell>
  );
}