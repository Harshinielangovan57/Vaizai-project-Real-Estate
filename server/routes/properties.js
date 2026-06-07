// routes/properties.js
//
// POST /api/properties
// Full pipeline: receive multipart upload → IPFS → mint NFT → MongoDB
//
// Steps (matching spec 5.3):
//   1. Receive multipart form with images + property data
//   2. Upload images to IPFS via Pinata
//   3. Build ERC-721 metadata JSON
//   4. Upload metadata JSON to IPFS
//   5. Call PropertyNFT.mintProperty() on-chain
//   6. Return minted tokenId + IPFS URIs (event listener handles MongoDB update)

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const { ethers }= require('ethers');

const { uploadPropertyToIPFS }  = require('../services/ipfsService');
const { getContract }           = require('../config/contracts');
const Property                  = require('../properties/propertyModel');

// ── Multer — memory storage (files held as Buffer, not written to disk) ───────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize:  20 * 1024 * 1024,   // 20 MB per file
    files:     10,                  // max 10 images per property
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }
  },
});

// ── Platform wallet (used to call mintProperty on-chain) ─────────────────────
function getPlatformSigner() {
  const provider   = new ethers.JsonRpcProvider(
    process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545'
  );
  const privateKey = process.env.PLATFORM_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('[Properties] PLATFORM_WALLET_PRIVATE_KEY not set in .env');
  }
  return new ethers.Wallet(privateKey, provider);
}

// ── POST /api/properties ──────────────────────────────────────────────────────
//
// Multipart form fields:
//   images[]          — one or more image files
//   name              — property display name
//   description       — property description
//   propertyAddress   — physical address
//   areaSqft          — area in sq ft (number)
//   valuation         — appraised value in ETH (number)
//   propertyType      — e.g. 'Residential'
//   city, state, country
//   ownerWallet       — buyer/owner wallet address (receives the NFT)

router.post(
  '/',
  upload.array('images', 10),
  async (req, res) => {
    try {
      // ── Validate files ──────────────────────────────────────────────────────
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one image is required.',
        });
      }

      // ── Validate required fields ────────────────────────────────────────────
      const {
        name,
        description,
        propertyAddress,
        areaSqft,
        valuation,
        propertyType,
        city,
        state,
        country,
        ownerWallet,
      } = req.body;

      const missing = [];
      if (!name)            missing.push('name');
      if (!propertyAddress) missing.push('propertyAddress');
      if (!areaSqft)        missing.push('areaSqft');
      if (!valuation)       missing.push('valuation');
      if (!ownerWallet)     missing.push('ownerWallet');

      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missing.join(', ')}`,
        });
      }

      if (!ethers.isAddress(ownerWallet)) {
        return res.status(400).json({
          success: false,
          message: 'ownerWallet is not a valid Ethereum address.',
        });
      }

      // ── Steps 2, 3, 4: Upload to IPFS ──────────────────────────────────────
      console.log(`[Properties] Starting IPFS upload for: ${name}`);

      const propertyData = {
        name,
        description:     description || '',
        propertyAddress,
        areaSqft:        Number(areaSqft),
        valuation:       Number(valuation),
        propertyType:    propertyType || 'Residential',
        city:            city    || '',
        state:           state   || '',
        country:         country || '',
      };

      const {
        metadataUri,
        gatewayUrl,
        imageResults,
        metadataJson,
      } = await uploadPropertyToIPFS(req.files, propertyData);

      console.log(`[Properties] IPFS metadata URI: ${metadataUri}`);

      // ── Step 5: Mint NFT on-chain ───────────────────────────────────────────
      console.log(`[Properties] Minting NFT → owner: ${ownerWallet}`);

      const signer      = getPlatformSigner();
      const propertyNFT = getContract('PropertyNFT', signer);

      const valuationWei = ethers.parseEther(valuation.toString());

      const tx = await propertyNFT.mintProperty(
        ownerWallet,
        propertyAddress,
        Number(areaSqft),
        valuationWei,
        metadataUri
      );

      const receipt = await tx.wait();
      console.log(`[Properties] Mint tx confirmed: ${receipt.hash}`);

      // Extract tokenId from PropertyMinted event
      const mintEvent = receipt.logs
        .map((log) => {
          try { return propertyNFT.interface.parseLog(log); } catch { return null; }
        })
        .find((e) => e && e.name === 'PropertyMinted');

      const tokenId = mintEvent ? mintEvent.args.tokenId.toString() : null;

      // ── Save to MongoDB (pre-event listener record) ─────────────────────────
      // The event listener (server.js) will also update this record when
      // PropertyMinted fires — this gives an immediate DB record.
      const property = await Property.create({
        tokenId,
        name,
        description:     description || '',
        propertyAddress,
        areaSqft:        Number(areaSqft),
        valuation:       Number(valuation),
        propertyType:    propertyType || 'Residential',
        city:            city    || '',
        state:           state   || '',
        country:         country || '',
        ownerWallet,
        metadataUri,
        metadataGatewayUrl: gatewayUrl,
        images: imageResults.map((img) => ({
          cid:        img.cid,
          ipfsUri:    img.ipfsUri,
          gatewayUrl: img.gatewayUrl,
        })),
        verified:  false,
        txHash:    receipt.hash,
        mintedAt:  new Date(),
      });

      // ── Step 8: Return response for frontend ────────────────────────────────
      return res.status(201).json({
        success: true,
        message: 'Property minted successfully.',
        data: {
          tokenId,
          metadataUri,
          metadataGatewayUrl: gatewayUrl,
          images: imageResults.map((img) => ({
            ipfsUri:    img.ipfsUri,
            gatewayUrl: img.gatewayUrl,
          })),
          txHash:   receipt.hash,
          property: property._id,
        },
      });
    } catch (err) {
      console.error('[Properties] POST /api/properties error:', err.message);
      return res.status(500).json({
        success: false,
        message: err.message || 'Internal server error during property creation.',
      });
    }
  }
);

// ── GET /api/properties ───────────────────────────────────────────────────────
// Returns all properties with IPFS image URLs for frontend rendering (Step 8)

router.get('/', async (req, res) => {
  try {
    const { city, propertyType, verified, page = 1, limit = 12 } = req.query;

    const filter = {};
    if (city)         filter.city         = new RegExp(city, 'i');
    if (propertyType) filter.propertyType = propertyType;
    if (verified !== undefined) filter.verified = verified === 'true';

    const skip       = (Number(page) - 1) * Number(limit);
    const properties = await Property.find(filter)
      .sort({ mintedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: {
        properties,
        pagination: {
          total,
          page:       Number(page),
          limit:      Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/properties/:tokenId ──────────────────────────────────────────────

router.get('/:tokenId', async (req, res) => {
  try {
    const property = await Property.findOne({ tokenId: req.params.tokenId });
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    res.json({ success: true, data: property });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;