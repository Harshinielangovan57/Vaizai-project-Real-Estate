// src/components/PropertyUploadForm.jsx
//
// Step 1 (spec 5.3): User uploads images + property details.
// Sends multipart POST to /api/properties.
// On success, shows the minted tokenId and IPFS image URLs.

import { useState, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function PropertyUploadForm() {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name:            '',
    description:     '',
    propertyAddress: '',
    areaSqft:        '',
    valuation:       '',
    propertyType:    'Residential',
    city:            '',
    state:           '',
    country:         '',
    ownerWallet:     '',
  });

  const [images,    setImages]    = useState([]);     // File objects
  const [previews,  setPreviews]  = useState([]);     // blob URLs for preview
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [result,    setResult]    = useState(null);   // successful mint response

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files);
    setImages(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  }

  function removeImage(index) {
    setImages((prev)   => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (images.length === 0) {
      setError('Please select at least one image.');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Build multipart form data
      const formData = new FormData();

      // Append all images under the key 'images'
      images.forEach((file) => formData.append('images', file));

      // Append all text fields
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Step 1: POST to /api/properties
      const res = await fetch(`${API_URL}/api/properties`, {
        method: 'POST',
        body:   formData,
        // Do NOT set Content-Type — browser sets it with the boundary
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Property creation failed.');
      }

      // Steps 2–6 happen on the backend; we get back the result
      setResult(data.data);

      // Reset form
      setForm({
        name: '', description: '', propertyAddress: '',
        areaSqft: '', valuation: '', propertyType: 'Residential',
        city: '', state: '', country: '', ownerWallet: '',
      });
      setImages([]);
      setPreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">List a Property</h2>

      {/* ── Success result ────────────────────────────────────────────────── */}
      {result && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-800 font-semibold mb-2">
            ✅ Property Minted Successfully!
          </h3>
          <p className="text-sm text-green-700">
            <strong>Token ID:</strong> {result.tokenId}
          </p>
          <p className="text-sm text-green-700 break-all">
            <strong>Metadata URI:</strong> {result.metadataUri}
          </p>
          <p className="text-sm text-green-700">
            <strong>Tx Hash:</strong>{' '}
            <a
              href={`http://localhost:8545/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {result.txHash?.slice(0, 20)}...
            </a>
          </p>

          {/* Step 8: Render IPFS image URLs */}
          {result.images?.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-green-700 mb-2">
                IPFS Images:
              </p>
              <div className="flex gap-2 flex-wrap">
                {result.images.map((img, i) => (
                  <a
                    key={i}
                    href={img.gatewayUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      src={img.gatewayUrl}
                      alt={`Property ${i + 1}`}
                      className="w-20 h-20 object-cover rounded border"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* ── Form ──────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Images upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Images *
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2
                       file:px-4 file:rounded file:border-0 file:text-sm
                       file:font-semibold file:bg-blue-50 file:text-blue-700
                       hover:file:bg-blue-100"
          />
          {/* Image previews */}
          {previews.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    alt={`preview-${i}`}
                    className="w-20 h-20 object-cover rounded border"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 bg-red-500 text-white
                               rounded-full w-5 h-5 text-xs flex items-center
                               justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Name *
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g. Beachfront Villa"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="Describe the property..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Physical address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Physical Address *
          </label>
          <input
            name="propertyAddress"
            value={form.propertyAddress}
            onChange={handleChange}
            required
            placeholder="123 Main Street"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Area + Valuation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area (sqft) *
            </label>
            <input
              name="areaSqft"
              type="number"
              value={form.areaSqft}
              onChange={handleChange}
              required
              min="1"
              placeholder="1500"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valuation (ETH) *
            </label>
            <input
              name="valuation"
              type="number"
              value={form.valuation}
              onChange={handleChange}
              required
              min="0"
              step="0.001"
              placeholder="1.5"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Property type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Type
          </label>
          <select
            name="propertyType"
            value={form.propertyType}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                       focus:ring-2 focus:ring-blue-400"
          >
            {['Residential', 'Commercial', 'Industrial', 'Land', 'Other'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* City / State / Country */}
        <div className="grid grid-cols-3 gap-3">
          {['city', 'state', 'country'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                {field}
              </label>
              <input
                name={field}
                value={form[field]}
                onChange={handleChange}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none
                           focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>

        {/* Owner wallet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Owner Wallet Address *
          </label>
          <input
            name="ownerWallet"
            value={form.ownerWallet}
            onChange={handleChange}
            required
            placeholder="0x..."
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono
                       focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                     text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Uploading to IPFS &amp; Minting...
            </span>
          ) : (
            'Upload &amp; Mint Property NFT'
          )}
        </button>
      </form>
    </div>
  );
}