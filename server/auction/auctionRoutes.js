const express = require('express');
const router  = express.Router();
const ctrl    = require('./auctionController');
const { protect, requireRole } = require('../auth/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auctions
 *   description: Property auctions, placing bids, settling and bid withdrawals
 */

/**
 * @swagger
 * /api/auctions:
 *   get:
 *     summary: Get live and scheduled auctions
 *     tags: [Auctions]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, live, ended, settled, cancelled]
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
 *         description: List of auctions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auctions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Auction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 */
router.get('/',                ctrl.getAuctions);

/**
 * @swagger
 * /api/auctions/{id}:
 *   get:
 *     summary: Get details of a single auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction details (reserve price visible only to seller/admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Auction'
 *       404:
 *         description: Auction not found
 */
router.get('/:id',             protect, ctrl.getAuction);

/**
 * @swagger
 * /api/auctions/{id}/bids:
 *   get:
 *     summary: Get bid history of an auction
 *     tags: [Auctions]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bid history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auctionId: { type: number }
 *                 status: { type: string }
 *                 bids:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       bidder: { type: string }
 *                       bidderAddress: { type: string }
 *                       amountEth: { type: number }
 *                       txHash: { type: string }
 *                       timestamp: { type: string, format: date-time }
 *                       withdrawn: { type: boolean }
 *       404:
 *         description: Auction not found
 */
router.get('/:id/bids',        ctrl.getBidHistory);

/**
 * @swagger
 * /api/auctions:
 *   post:
 *     summary: Create a new auction listing (seller/admin only)
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, startingPriceEth, minBidIncrementEth, startTime, endTime]
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "664a1b2c3d4e5f6a7b8c9d0e"
 *               startingPriceEth:
 *                 type: number
 *                 example: 1.5
 *               reservePriceEth:
 *                 type: number
 *                 example: 2.5
 *               minBidIncrementEth:
 *                 type: number
 *                 example: 0.1
 *               startTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-09T00:00:00Z"
 *               endTime:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-06-16T00:00:00Z"
 *     responses:
 *       201:
 *         description: Auction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auction:
 *                   $ref: '#/components/schemas/Auction'
 *                 txHash:
 *                   type: string
 *       400:
 *         description: Validation or on-chain approval error
 *       403:
 *         description: Forbidden
 */
router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createAuction
);

/**
 * @swagger
 * /api/auctions/{id}/bid:
 *   post:
 *     summary: Place a bid on a live auction
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amountEth, txHash]
 *             properties:
 *               amountEth:
 *                 type: number
 *                 example: 1.8
 *               txHash:
 *                 type: string
 *                 example: "0x0000000000000000000000000000000000000000000000000000000000000000"
 *     responses:
 *       201:
 *         description: Bid placed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Bid placed" }
 *                 amountEth: { type: number }
 *                 reserveMet: { type: boolean }
 *                 endTime: { type: string, format: date-time }
 *       400:
 *         description: Invalid bid (lower than minRequired) or validation error
 *       404:
 *         description: Auction not found
 */
router.post('/:id/bid',
  protect,
  ctrl.placeBid
);

/**
 * @swagger
 * /api/auctions/{id}/settle:
 *   post:
 *     summary: Settle an ended auction (seller/admin only)
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Auction settled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Auction settled" }
 *                 txHash: { type: string }
 *       400:
 *         description: Already settled or auction not yet ended
 *       403:
 *         description: Forbidden
 */
router.post('/:id/settle',
  protect,
  ctrl.settleAuction
);

/**
 * @swagger
 * /api/auctions/{id}/cancel:
 *   post:
 *     summary: Cancel an auction before any bids are placed (seller) or at any time (admin)
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Market conditions changed"
 *     responses:
 *       200:
 *         description: Auction cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Auction cancelled" }
 *                 txHash: { type: string }
 *       400:
 *         description: Auction has bids or cannot be cancelled in current state
 *       403:
 *         description: Forbidden
 */
router.post('/:id/cancel',
  protect,
  ctrl.cancelAuction
);

/**
 * @swagger
 * /api/auctions/{id}/withdraw:
 *   post:
 *     summary: Withdraw outbid funds for losing bidders after the auction ends
 *     tags: [Auctions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [txHash]
 *             properties:
 *               txHash:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bid withdrawn successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Bid withdrawn" }
 *                 amountEth: { type: number }
 *                 txHash: { type: string }
 *       400:
 *         description: State error or invalid txHash
 *       404:
 *         description: No withdrawable bid found
 */
router.post('/:id/withdraw',
  protect,
  ctrl.withdrawBid
);

module.exports = router;