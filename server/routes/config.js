// routes/config.js
//
// Exposes contract addresses and ABIs to the frontend.
// The frontend calls GET /api/config/contracts on app init and caches
// the result — it never hardcodes addresses or ABIs in source.
//
// Routes:
//   GET /api/config/contracts        → full manifest (addresses + ABIs)
//   GET /api/config/contracts/addresses → addresses only (lightweight)
//   GET /api/config/network          → network metadata

const express  = require('express');
const router   = express.Router();
const {
  getFullManifest,
  getAllAddresses,
  getNetworkInfo,
} = require('../config/contracts');

/**
 * @swagger
 * tags:
 *   name: System Config
 *   description: Platform deployment configuration, addresses, and smart contract ABIs
 */

// ── GET /api/config/contracts ─────────────────────────────────────────────────
// Returns full manifest: { PropertyNFT: { address, abi }, ... }
// Frontend uses this on init to instantiate ethers.js contract objects.

/**
 * @swagger
 * /api/config/contracts:
 *   get:
 *     summary: Get full contract manifest including addresses and ABIs
 *     tags: [System Config]
 *     security: []
 *     responses:
 *       200:
 *         description: Full contract metadata manifest
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 */
router.get('/contracts', (req, res) => {
  try {
    const manifest = getFullManifest();
    res.json({
      success: true,
      data:    manifest,
    });
  } catch (err) {
    console.error('[Config] /contracts error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load contract config. Ensure contracts are deployed.',
      error:   err.message,
    });
  }
});

// ── GET /api/config/contracts/addresses ──────────────────────────────────────
// Returns addresses only (no ABIs) — lighter payload for simple lookups.
// { PropertyNFT: "0x...", Marketplace: "0x...", ... }

/**
 * @swagger
 * /api/config/contracts/addresses:
 *   get:
 *     summary: Get deployed contract addresses only (no ABIs)
 *     tags: [System Config]
 *     security: []
 *     responses:
 *       200:
 *         description: Contract addresses lookup map
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 */
router.get('/contracts/addresses', (req, res) => {
  try {
    const addresses = getAllAddresses();
    res.json({
      success: true,
      data:    addresses,
    });
  } catch (err) {
    console.error('[Config] /contracts/addresses error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load contract addresses.',
      error:   err.message,
    });
  }
});

// ── GET /api/config/network ───────────────────────────────────────────────────
// Returns network metadata: { network, chainId, deployedAt, deployer }
// Frontend uses chainId to validate MetaMask is on the right network.

/**
 * @swagger
 * /api/config/network:
 *   get:
 *     summary: Get network metadata and chain status
 *     tags: [System Config]
 *     security: []
 *     responses:
 *       200:
 *         description: Active network deployment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 */
router.get('/network', (req, res) => {
  try {
    const info = getNetworkInfo();
    res.json({
      success: true,
      data:    info,
    });
  } catch (err) {
    console.error('[Config] /network error:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load network info.',
      error:   err.message,
    });
  }
});

module.exports = router;