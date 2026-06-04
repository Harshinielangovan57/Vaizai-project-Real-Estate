import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
// import { ethers } from 'ethers';
import axios from 'axios';
import toast from 'react-hot-toast';

import PageShell from '../components/layout/PageShell';
import ImageUploader from '../components/listing/ImageUploader';
import VirtualTourUploader from '../components/listing/VirtualTourUploader';
import GasEstimateBox from '../components/listing/GasEstimateBox';
import MintProgressIndicator from '../components/listing/MintProgressIndicator';
import { useEthPrice } from '../hooks/useEthPrice';
import { useWallet } from '../hooks/useWallet';

const API = import.meta.env.VITE_API_URL;

const STEPS = [
  { label: 'Property Details', icon: '🏠' },
  { label: 'Upload Images',    icon: '🖼️' },
  { label: 'Virtual Tour',     icon: '🌐' },
  { label: 'Pricing & Type',   icon: '💰' },
  { label: 'Review & Mint',    icon: '⛓️' },
];

const PROPERTY_TYPES = ['House', 'Apartment', 'Villa', 'Commercial', 'Land'];
const AUCTION_DURATIONS = [
  { value: '3600',   label: '1 hour' },
  { value: '86400',  label: '24 hours' },
  { value: '259200', label: '3 days' },
  { value: '604800', label: '7 days' },
];

// ── Step progress bar ─────────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="mb-10">
      {/* Mobile: just show current step name */}
      <p className="mb-4 text-sm font-medium text-indigo-400 sm:hidden">
        Step {current + 1} of {STEPS.length} — {STEPS[current].label}
      </p>

      {/* Desktop: full bar */}
      <div className="hidden items-center sm:flex">
        {STEPS.map((step, i) => (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition ${
                i < current  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                i === current ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20' :
                                'bg-neutral-800 text-neutral-500'
              }`}>
                {i < current ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5">
                    <polyline points="2 7 5.5 10.5 12 3" />
                  </svg>
                ) : (
                  step.icon
                )}
              </div>
              <span className={`text-xs whitespace-nowrap ${i === current ? 'font-semibold text-white' : 'text-neutral-600'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-5 h-0.5 flex-1 mx-2 transition-colors ${i < current ? 'bg-emerald-500' : 'bg-neutral-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Input + label ─────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-300">
          {label}{required && <span className="ml-0.5 text-red-400">*</span>}
        </label>
        {hint && <span className="text-xs text-neutral-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-white/8 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-neutral-600 outline-none transition focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20';

// ── Review row ────────────────────────────────────────────────────────────────
function ReviewRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-neutral-500">{label}</span>
      <span className="text-right text-sm text-white">{value || '—'}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListPropertyPage() {
  const navigate = useNavigate();
  const { token } = useSelector((s) => s.auth);
  const { isConnected, isCorrectNetwork } = useSelector((s) => s.wallet);
  const { toUsd } = useEthPrice();
  const { connect } = useWallet();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ── Step 1: Details ──────────────────────────────────────────────────────
  const [details, setDetails] = useState({
    title: '', description: '',
    address: '', city: '', state: '', country: 'India',
    propertyType: 'House',
    bedrooms: '', bathrooms: '', squareFeet: '', yearBuilt: '',
  });
  const setDetail = (k, v) => setDetails((d) => ({ ...d, [k]: v }));

  // ── Step 2: Images ───────────────────────────────────────────────────────
  const [images, setImages]       = useState([]);
  const [previews, setPreviews]   = useState([]);
  const [primaryIdx, setPrimaryIdx] = useState(0);

  const handleImagesChange = (files, prevs) => {
    setImages(files);
    setPreviews(prevs);
  };

  // ── Step 3: Virtual tour ─────────────────────────────────────────────────
  const [matterportUrl, setMatterportUrl] = useState('');
  const [tour360File, setTour360File]     = useState(null);
  const [tour360Preview, setTour360Preview] = useState(null);

  const handleTour360 = (file, preview) => {
    setTour360File(file);
    setTour360Preview(preview);
    setMatterportUrl('');
  };
  const handleClearTour = () => {
    setMatterportUrl('');
    setTour360File(null);
    setTour360Preview(null);
  };

  // ── Step 4: Pricing ──────────────────────────────────────────────────────
  const [listingType, setListingType]     = useState('fixed');
  const [price, setPrice]                 = useState('');
  const [auctionDuration, setAuctionDuration] = useState('86400');
  const [aiValuation, setAiValuation]     = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);

  const requestAiValuation = async () => {
    setValuationLoading(true);
    try {
      const { data } = await axios.post(
        `${API}/api/properties/tmp/valuate`,
        {
          city: details.city, state: details.state,
          squareFeet: details.squareFeet, bedrooms: details.bedrooms,
          bathrooms: details.bathrooms, propertyType: details.propertyType,
          yearBuilt: details.yearBuilt,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAiValuation({ usd: data.valuation, eth: data.suggestedEth });
      if (!price) setPrice(String(data.suggestedEth));
      toast.success(`AI valuation: $${data.valuation.toLocaleString()}`);
    } catch {
      toast.error('Valuation unavailable — AI service may be offline');
    } finally {
      setValuationLoading(false);
    }
  };

  // ── Step 5: Mint progress ────────────────────────────────────────────────
  const MINT_STEPS = [
    { label: 'Uploading images to IPFS',                         done: false },
    { label: 'Minting property NFT on blockchain',               done: false },
    { label: listingType === 'fixed' ? 'Creating marketplace listing' : 'Creating auction', done: false },
  ];
  const [mintSteps, setMintSteps] = useState(MINT_STEPS);
  const markDone = (i) =>
    setMintSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, done: true } : s)));
  const markError = (i) =>
    setMintSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, error: true } : s)));

  // ── Validation ────────────────────────────────────────────────────────────
  const canProceed = () => {
    switch (step) {
      case 0: return details.title && details.address && details.city && details.state;
      case 1: return images.length > 0;
      case 2: return true; // virtual tour is optional
      case 3: return price && parseFloat(price) > 0;
      default: return true;
    }
  };

  // ── Mint & List ───────────────────────────────────────────────────────────
  const handleMint = async () => {
    if (!isConnected || !isCorrectNetwork) {
      toast.error('Connect your MetaMask wallet to the Hardhat network first');
      await connect();
      return;
    }

    setSubmitting(true);
    setMintSteps(MINT_STEPS.map((s) => ({ ...s, done: false, error: false })));

    const headers = { Authorization: `Bearer ${token}` };

    try {
      // ── 1. Upload images + create property record ──────────────────────
      const formData = new FormData();
      Object.entries(details).forEach(([k, v]) => v && formData.append(k, v));
      images.forEach((f) => formData.append('images', f));
      formData.append('primaryImageIndex', String(primaryIdx));
      if (matterportUrl) formData.append('virtualTourUrl', matterportUrl);
      if (tour360File)   formData.append('tour360', tour360File);

      const { data: propData } = await axios.post(
        `${API}/api/properties`,
        formData,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } }
      );
      const propertyId = propData.property._id;
      markDone(0);

      // ── 2. Tokenize (mint NFT) ─────────────────────────────────────────
      // Backend builds metadata, uploads to IPFS, calls contract.mintProperty()
      await axios.post(`${API}/api/properties/${propertyId}/tokenize`, {}, { headers });
      markDone(1);

      // ── 3. Create listing or auction ───────────────────────────────────
      if (listingType === 'fixed') {
        await axios.post(`${API}/api/marketplace`, { propertyId, price }, { headers });
      } else {
        await axios.post(
          `${API}/api/auctions`,
          { propertyId, startingPrice: price, duration: auctionDuration },
          { headers }
        );
      }
      markDone(2);

      toast.success('Property minted and listed successfully!');
      setTimeout(() => navigate(`/properties/${propertyId}`), 1800);
    } catch (err) {
      const failedIdx = mintSteps.findIndex((s) => !s.done);
      if (failedIdx >= 0) markError(failedIdx);
      const msg = err.response?.data?.message || err.message || 'Minting failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-4 py-12 lg:px-0">

        {/* Page heading */}
        <div className="mb-8">
          <h1
            className="text-3xl font-black text-white"
            style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
          >
            List a Property
          </h1>
          <p className="mt-1 text-neutral-500">
            Tokenize your real estate as an NFT and list it for sale or auction.
          </p>
        </div>

        <StepBar current={step} />

        {/* ── Step 0: Property Details ────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5">
            <Field label="Title" required>
              <input
                className={inputCls}
                value={details.title}
                onChange={(e) => setDetail('title', e.target.value)}
                placeholder="e.g. Modern 3BHK in Bandra West"
                maxLength={120}
              />
            </Field>

            <Field label="Description" hint={`${details.description.length}/1000`}>
              <textarea
                className={`${inputCls} h-28 resize-none`}
                value={details.description}
                onChange={(e) => setDetail('description', e.target.value)}
                placeholder="Describe the property, amenities, neighbourhood…"
                maxLength={1000}
              />
            </Field>

            <Field label="Street Address" required>
              <input
                className={inputCls}
                value={details.address}
                onChange={(e) => setDetail('address', e.target.value)}
                placeholder="123 Marine Drive"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="City" required>
                <input className={inputCls} value={details.city}
                  onChange={(e) => setDetail('city', e.target.value)} placeholder="Mumbai" />
              </Field>
              <Field label="State" required>
                <input className={inputCls} value={details.state}
                  onChange={(e) => setDetail('state', e.target.value)} placeholder="Maharashtra" />
              </Field>
            </div>

            <Field label="Country">
              <input className={inputCls} value={details.country}
                onChange={(e) => setDetail('country', e.target.value)} placeholder="India" />
            </Field>

            <Field label="Property Type">
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDetail('propertyType', t)}
                    className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
                      details.propertyType === t
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Bedrooms">
                <input type="number" min="0" className={inputCls} value={details.bedrooms}
                  onChange={(e) => setDetail('bedrooms', e.target.value)} placeholder="3" />
              </Field>
              <Field label="Bathrooms">
                <input type="number" min="0" className={inputCls} value={details.bathrooms}
                  onChange={(e) => setDetail('bathrooms', e.target.value)} placeholder="2" />
              </Field>
              <Field label="Sq Ft">
                <input type="number" min="0" className={inputCls} value={details.squareFeet}
                  onChange={(e) => setDetail('squareFeet', e.target.value)} placeholder="1200" />
              </Field>
              <Field label="Year Built">
                <input type="number" min="1800" max={new Date().getFullYear()} className={inputCls}
                  value={details.yearBuilt}
                  onChange={(e) => setDetail('yearBuilt', e.target.value)} placeholder="2010" />
              </Field>
            </div>
          </div>
        )}

        {/* ── Step 1: Images ──────────────────────────────────────────── */}
        {step === 1 && (
          <ImageUploader
            images={images}
            previews={previews}
            primaryIdx={primaryIdx}
            onChange={handleImagesChange}
            onPrimary={setPrimaryIdx}
          />
        )}

        {/* ── Step 2: Virtual Tour ─────────────────────────────────────── */}
        {step === 2 && (
          <VirtualTourUploader
            matterportUrl={matterportUrl}
            tour360File={tour360File}
            tour360Preview={tour360Preview}
            onMatterport={setMatterportUrl}
            onTour360={handleTour360}
            onClear={handleClearTour}
          />
        )}

        {/* ── Step 3: Pricing & Type ───────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Listing type toggle */}
            <div>
              <p className="mb-2 text-sm font-medium text-neutral-300">Listing Type</p>
              <div className="flex overflow-hidden rounded-xl border border-white/8 text-sm">
                {[
                  { value: 'fixed',   label: '📌 Fixed Price' },
                  { value: 'auction', label: '⚡ Auction'     },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setListingType(t.value)}
                    className={`flex-1 py-3 font-medium transition ${
                      listingType === t.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-neutral-900 text-neutral-500 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price input */}
            <Field
              label={listingType === 'fixed' ? 'Asking Price (ETH)' : 'Starting Price (ETH)'}
              required
            >
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  className={`${inputCls} pr-28`}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.500"
                />
                {price && (
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500">
                    {toUsd(price)}
                  </span>
                )}
              </div>
            </Field>

            {/* Auction duration */}
            {listingType === 'auction' && (
              <Field label="Auction Duration">
                <div className="flex flex-wrap gap-2">
                  {AUCTION_DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setAuctionDuration(d.value)}
                      className={`rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
                        auctionDuration === d.value
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* AI Valuation button */}
            <div>
              <button
                type="button"
                onClick={requestAiValuation}
                disabled={valuationLoading || !details.city}
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:opacity-40"
              >
                {valuationLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Getting valuation…
                  </>
                ) : (
                  <>
                    <span>✦</span>
                    Request AI Valuation
                  </>
                )}
              </button>
              {!details.city && (
                <p className="mt-1.5 text-xs text-neutral-600">
                  Enter a city on Step 1 to enable AI valuation
                </p>
              )}
            </div>

            {/* AI Valuation result */}
            {aiValuation && (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500">AI Estimated Market Value</p>
                    <p className="text-2xl font-black text-white">
                      ${aiValuation.usd.toLocaleString()}
                    </p>
                    <p className="text-sm text-indigo-300">≈ {aiValuation.eth} ETH</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrice(String(aiValuation.eth))}
                    className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    Use this price
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Review & Mint ────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5">
            {/* Summary card */}
            <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
              <h2 className="mb-3 text-base font-bold text-white">Summary</h2>
              <ReviewRow label="Title"       value={details.title} />
              <ReviewRow label="Address"     value={`${details.address}, ${details.city}, ${details.state}`} />
              <ReviewRow label="Type"        value={details.propertyType} />
              <ReviewRow label="Bedrooms"    value={details.bedrooms} />
              <ReviewRow label="Bathrooms"   value={details.bathrooms} />
              <ReviewRow label="Sq Ft"       value={details.squareFeet ? `${parseInt(details.squareFeet).toLocaleString()} sqft` : null} />
              <ReviewRow label="Year Built"  value={details.yearBuilt} />
              <ReviewRow label="Images"      value={`${images.length} photo${images.length !== 1 ? 's' : ''}`} />
              <ReviewRow
                label="Virtual Tour"
                value={matterportUrl ? 'Matterport' : tour360File ? '360° image' : 'None'}
              />
              <ReviewRow
                label="Listing"
                value={listingType === 'fixed'
                  ? `Fixed price — ${price} ETH${toUsd(price) ? ` ${toUsd(price)}` : ''}`
                  : `Auction — starting ${price} ETH · ${AUCTION_DURATIONS.find(d => d.value === auctionDuration)?.label}`
                }
              />
            </div>

            {/* Gas estimate */}
            <GasEstimateBox price={price} listingType={listingType} />

            {/* Wallet check */}
            {(!isConnected || !isCorrectNetwork) && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span className="text-red-300">
                  {!isConnected
                    ? 'MetaMask not connected — click Mint & List to connect'
                    : 'Wrong network — connect to Hardhat Local (chain 31337)'}
                </span>
              </div>
            )}

            {/* Mint progress (shown during/after submit) */}
            {submitting || mintSteps.some((s) => s.done || s.error) ? (
              <div className="rounded-2xl border border-white/8 bg-neutral-900 p-5">
                <h3 className="mb-4 text-sm font-semibold text-white">Minting progress</h3>
                <MintProgressIndicator steps={mintSteps} active={submitting} />
              </div>
            ) : null}

            {/* Mint button */}
            {!mintSteps.every((s) => s.done) && (
              <button
                type="button"
                onClick={handleMint}
                disabled={submitting}
                className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? 'Minting…' : '⛓️ Mint & List Property'}
              </button>
            )}

            {mintSteps.every((s) => s.done) && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                <p className="text-lg font-bold text-emerald-400">🎉 Property minted and listed!</p>
                <p className="mt-1 text-sm text-neutral-400">Redirecting to your property page…</p>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ────────────────────────────────────────────── */}
        {!submitting && !mintSteps.some((s) => s.done) && (
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="rounded-xl border border-white/8 px-5 py-2.5 text-sm font-medium text-neutral-400 transition hover:bg-white/5 disabled:pointer-events-none disabled:opacity-30"
            >
              ← Back
            </button>

            {step < 4 && (
              <div className="flex items-center gap-3">
                {/* Show "skip" on virtual tour step */}
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-sm text-neutral-500 hover:text-neutral-300"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  disabled={!canProceed()}
                  className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:pointer-events-none disabled:opacity-40 active:scale-95"
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}