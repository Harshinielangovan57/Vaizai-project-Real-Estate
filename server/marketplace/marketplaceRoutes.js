const express = require('express');
const router  = express.Router();
const ctrl    = require('./marketplaceController');
const { protect, requireRole } = require('../auth/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Marketplace
 *   description: Property marketplace listings, purchases, and pricing
 */

/**
 * @swagger
 * /api/marketplace:
 *   get:
 *     summary: Get all active listings with pagination
 *     tags: [Marketplace]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Paginated active marketplace listings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Listing'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 */
router.get('/', ctrl.getListings);

/**
 * @swagger
 * /api/marketplace/{listingId}:
 *   get:
 *     summary: Get marketplace listing details by listing DB ID
 *     tags: [Marketplace]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *         example: "664a1b2c3d4e5f6a7b8c9d0e"
 *     responses:
 *       200:
 *         description: Marketplace listing details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Listing'
 *       404:
 *         description: Listing not found
 */
router.get('/:listingId', ctrl.getListing);

/**
 * @swagger
 * /api/marketplace:
 *   post:
 *     summary: Create a new marketplace listing (seller/admin only)
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, priceEth]
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "664a1b2c3d4e5f6a7b8c9d0e"
 *               priceEth:
 *                 type: number
 *                 example: 2.5
 *     responses:
 *       201:
 *         description: Listing created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listing:
 *                   $ref: '#/components/schemas/Listing'
 *                 txHash:
 *                   type: string
 *       400:
 *         description: Validation or approval error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */
router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createListing
);

/**
 * @swagger
 * /api/marketplace/{listingId}:
 *   delete:
 *     summary: Cancel/remove a marketplace listing
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Listing cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Listing cancelled" }
 *                 txHash: { type: string }
 *       400:
 *         description: Listing already inactive
 *       403:
 *         description: Not the listing owner
 *       404:
 *         description: Listing not found
 */
router.delete('/:listingId',
  protect,
  ctrl.cancelListing
);

/**
 * @swagger
 * /api/marketplace/{listingId}/price:
 *   put:
 *     summary: Update active listing price
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [priceEth]
 *             properties:
 *               priceEth:
 *                 type: number
 *                 example: 2.8
 *     responses:
 *       200:
 *         description: Price updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Price updated" }
 *                 listing:
 *                   $ref: '#/components/schemas/Listing'
 *                 txHash: { type: string }
 *       400:
 *         description: Validation or status error
 *       403:
 *         description: Not the listing owner
 *       404:
 *         description: Listing not found
 */
router.put('/:listingId/price',
  protect,
  ctrl.updatePrice
);

/**
 * @swagger
 * /api/marketplace/{listingId}/buy/crypto:
 *   post:
 *     summary: Initiate purchase via crypto (returns data needed for MetaMask tx)
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Crypto purchase data to be sent on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 listingId: { type: number }
 *                 tokenId: { type: number }
 *                 priceWei: { type: string }
 *                 priceEth: { type: number }
 *                 sellerAddress: { type: string }
 *                 contractAddress: { type: string }
 *       400:
 *         description: Listing not active
 *       404:
 *         description: Listing not found
 */
router.post('/:listingId/buy/crypto',
  protect,
  ctrl.initiateCryptoPurchase
);

/**
 * @swagger
 * /api/marketplace/{listingId}/buy/fiat:
 *   post:
 *     summary: Initiate purchase via fiat (Stripe payment intent)
 *     tags: [Marketplace]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [buyerWalletAddress]
 *             properties:
 *               buyerWalletAddress:
 *                 type: string
 *                 example: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
 *     responses:
 *       200:
 *         description: Stripe Client Secret and details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret: { type: string }
 *                 amount: { type: number }
 *       400:
 *         description: Listing not active or USD price unavailable
 *       404:
 *         description: Listing not found
 */
router.post('/:listingId/buy/fiat',
  protect,
  ctrl.initiateFiatPurchase
);

/**
 * @swagger
 * /api/marketplace/webhook/stripe:
 *   post:
 *     summary: Stripe payment intent success webhook
 *     tags: [Marketplace]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event handled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received: { type: boolean, example: true }
 */

module.exports = router;