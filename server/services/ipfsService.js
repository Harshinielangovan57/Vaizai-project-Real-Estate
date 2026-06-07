// services/ipfsService.js
//
// Handles all IPFS operations via the Pinata API.
//
// Responsibilities:
//   • Upload property images (binary files) to IPFS
//   • Build ERC-721 metadata JSON from property data + image CIDs
//   • Upload metadata JSON to IPFS
//   • Return ipfs:// and https:// gateway URIs
//
// Environment variables required:
//   PINATA_API_KEY     — from https://app.pinata.cloud/keys
//   PINATA_SECRET_KEY  — from https://app.pinata.cloud/keys

const axios      = require('axios');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');

const PINATA_API_URL    = 'https://api.pinata.cloud';
const PINATA_GATEWAY    = 'https://gateway.pinata.cloud/ipfs';
const PUBLIC_GATEWAY    = 'https://ipfs.io/ipfs';

// ── Internal helpers ──────────────────────────────────────────────────────────

function pinataHeaders() {
  const key    = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET_KEY;

  if (!key || !secret) {
    throw new Error(
      '[IPFS] PINATA_API_KEY and PINATA_SECRET_KEY must be set in .env'
    );
  }

  return {
    pinata_api_key:        key,
    pinata_secret_api_key: secret,
  };
}

/**
 * Convert a Pinata CID to gateway URLs.
 * @param  {string} cid   IPFS content identifier
 * @returns {{ ipfsUri, gatewayUrl, publicUrl }}
 */
function cidToUris(cid) {
  return {
    ipfsUri:    `ipfs://${cid}`,
    gatewayUrl: `${PINATA_GATEWAY}/${cid}`,
    publicUrl:  `${PUBLIC_GATEWAY}/${cid}`,
  };
}

// ── Step 2: Upload image file to IPFS ────────────────────────────────────────

/**
 * Upload a single image file to IPFS via Pinata.
 * Accepts either a file path (string) or a Buffer with a filename.
 *
 * @param  {string|Buffer} fileInput   File path OR Buffer
 * @param  {string}        filename    Original filename (used as pin name)
 * @returns {Promise<{ cid, ipfsUri, gatewayUrl, publicUrl }>}
 */
async function uploadImageToIPFS(fileInput, filename) {
  const form = new FormData();

  if (typeof fileInput === 'string') {
    // File path — stream directly (no memory buffering)
    form.append('file', fs.createReadStream(fileInput), {
      filename: path.basename(fileInput),
    });
  } else if (Buffer.isBuffer(fileInput)) {
    form.append('file', fileInput, { filename });
  } else {
    throw new Error('[IPFS] uploadImageToIPFS: fileInput must be a path or Buffer');
  }

  const pinataMetadata = JSON.stringify({ name: `renft-image-${filename}` });
  const pinataOptions  = JSON.stringify({ cidVersion: 1 });

  form.append('pinataMetadata', pinataMetadata);
  form.append('pinataOptions',  pinataOptions);

  try {
    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinFileToIPFS`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          ...pinataHeaders(),
        },
        maxBodyLength: Infinity,   // allow large files
        maxContentLength: Infinity,
      }
    );

    const cid = response.data.IpfsHash;
    console.log(`[IPFS] Image uploaded: ${filename} → ${cid}`);
    return { cid, ...cidToUris(cid) };
  } catch (err) {
    const msg = err.response?.data?.error?.details || err.message;
    throw new Error(`[IPFS] Image upload failed for ${filename}: ${msg}`);
  }
}

/**
 * Upload multiple images concurrently.
 * @param  {Array<{ buffer: Buffer, originalname: string }>} files  Multer file objects
 * @returns {Promise<Array<{ cid, ipfsUri, gatewayUrl, publicUrl }>>}
 */
async function uploadImagesToIPFS(files) {
  if (!files || files.length === 0) {
    throw new Error('[IPFS] No files provided for upload');
  }

  const results = await Promise.all(
    files.map((file) => uploadImageToIPFS(file.buffer, file.originalname))
  );

  console.log(`[IPFS] Uploaded ${results.length} image(s) to IPFS`);
  return results;
}

// ── Step 3: Build ERC-721 metadata JSON ──────────────────────────────────────

/**
 * Build an ERC-721 compliant metadata JSON object.
 * @param {object} params
 * @param {string} params.name              Property display name
 * @param {string} params.description       Property description
 * @param {string} params.propertyAddress   Physical address
 * @param {number} params.areaSqft          Area in square feet
 * @param {number} params.valuation         Appraised value in ETH (not wei)
 * @param {string} params.propertyType      e.g. 'Residential', 'Commercial'
 * @param {string} params.city
 * @param {string} params.state
 * @param {string} params.country
 * @param {Array}  params.imageUris         Array of ipfs:// image URIs
 * @returns {object}  ERC-721 metadata JSON
 */
function buildMetadataJson({
  name,
  description,
  propertyAddress,
  areaSqft,
  valuation,
  propertyType,
  city,
  state,
  country,
  imageUris = [],
}) {
  return {
    name,
    description,
    image: imageUris[0] || '',          // primary image (ERC-721 standard)
    external_url: '',                   // can be updated later
    attributes: [
      { trait_type: 'Property Address', value: propertyAddress },
      { trait_type: 'Area (sqft)',       value: areaSqft,     display_type: 'number' },
      { trait_type: 'Valuation (ETH)',   value: valuation,    display_type: 'number' },
      { trait_type: 'Property Type',     value: propertyType },
      { trait_type: 'City',              value: city          },
      { trait_type: 'State',             value: state         },
      { trait_type: 'Country',           value: country       },
    ],
    images: imageUris,                  // all images (non-standard but widely supported)
  };
}

// ── Step 4: Upload metadata JSON to IPFS ─────────────────────────────────────

/**
 * Upload a metadata JSON object to IPFS via Pinata.
 * @param  {object} metadataJson   The ERC-721 metadata object
 * @param  {string} pinName        Human-readable label for Pinata dashboard
 * @returns {Promise<{ cid, ipfsUri, gatewayUrl, publicUrl }>}
 */
async function uploadMetadataToIPFS(metadataJson, pinName = 'renft-metadata') {
  try {
    const response = await axios.post(
      `${PINATA_API_URL}/pinning/pinJSONToIPFS`,
      {
        pinataMetadata: { name: pinName },
        pinataOptions:  { cidVersion: 1 },
        pinataContent:  metadataJson,
      },
      { headers: pinataHeaders() }
    );

    const cid = response.data.IpfsHash;
    console.log(`[IPFS] Metadata uploaded → ${cid}`);
    return { cid, ...cidToUris(cid) };
  } catch (err) {
    const msg = err.response?.data?.error?.details || err.message;
    throw new Error(`[IPFS] Metadata upload failed: ${msg}`);
  }
}

// ── Full pipeline (Steps 2 → 4) ───────────────────────────────────────────────

/**
 * Complete IPFS pipeline:
 *   1. Upload all images to IPFS
 *   2. Build ERC-721 metadata JSON with IPFS image URLs
 *   3. Upload metadata JSON to IPFS
 *   4. Return metadata URI + image CIDs
 *
 * @param  {Array}  files          Multer file objects (buffer, originalname)
 * @param  {object} propertyData   Property fields (see buildMetadataJson params)
 * @returns {Promise<{
 *   metadataUri:  string,   // ipfs:// URI to pass to mintProperty()
 *   metadataCid:  string,
 *   gatewayUrl:   string,   // https gateway URL for frontend rendering
 *   imageResults: Array,    // per-image { cid, ipfsUri, gatewayUrl }
 *   metadataJson: object,   // the full JSON that was uploaded
 * }>}
 */
async function uploadPropertyToIPFS(files, propertyData) {
  // Step 2 — Upload images
  console.log('[IPFS] Step 2: Uploading images...');
  const imageResults = await uploadImagesToIPFS(files);
  const imageUris    = imageResults.map((r) => r.ipfsUri);

  // Step 3 — Build metadata JSON
  console.log('[IPFS] Step 3: Building ERC-721 metadata JSON...');
  const metadataJson = buildMetadataJson({
    ...propertyData,
    imageUris,
  });

  // Step 4 — Upload metadata JSON
  console.log('[IPFS] Step 4: Uploading metadata JSON...');
  const pinName       = `renft-property-${propertyData.name || 'unknown'}`;
  const metadataResult = await uploadMetadataToIPFS(metadataJson, pinName);

  return {
    metadataUri:  metadataResult.ipfsUri,    // → passed to mintProperty()
    metadataCid:  metadataResult.cid,
    gatewayUrl:   metadataResult.gatewayUrl, // → stored in MongoDB for frontend
    imageResults,
    metadataJson,
  };
}

// ── Utility: test Pinata credentials ─────────────────────────────────────────

/**
 * Verify Pinata API keys are valid. Call on server startup.
 * @returns {Promise<boolean>}
 */
async function testPinataConnection() {
  try {
    const res = await axios.get(
      `${PINATA_API_URL}/data/testAuthentication`,
      { headers: pinataHeaders() }
    );
    console.log('[IPFS] ✅ Pinata connection verified:', res.data.message);
    return true;
  } catch (err) {
    console.error('[IPFS] ❌ Pinata auth failed:', err.response?.data || err.message);
    return false;
  }
}

module.exports = {
  uploadImageToIPFS,
  uploadImagesToIPFS,
  buildMetadataJson,
  uploadMetadataToIPFS,
  uploadPropertyToIPFS,
  testPinataConnection,
  cidToUris,
};