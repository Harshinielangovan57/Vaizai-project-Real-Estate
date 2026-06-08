const express = require('express');
const router  = express.Router();
const ctrl    = require('./valuationController');
const { protect, requireRole } = require('../auth/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: AI Valuation
 *   description: AI property valuations, comparable listings analysis, and market trends
 */

/**
 * @swagger
 * /api/valuation:
 *   post:
 *     summary: Request a new hybrid AI valuation for a property (owner or admin only)
 *     tags: [AI Valuation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, city, state, squareFeet, bedrooms, bathrooms, propertyType]
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "664a1b2c3d4e5f6a7b8c9d0e"
 *               city:
 *                 type: string
 *                 example: "Chennai"
 *               state:
 *                 type: string
 *                 example: "Tamil Nadu"
 *               postalCode:
 *                 type: string
 *                 example: "600001"
 *               squareFeet:
 *                 type: number
 *                 example: 2400
 *               bedrooms:
 *                 type: number
 *                 example: 4
 *               bathrooms:
 *                 type: number
 *                 example: 3
 *               propertyType:
 *                 type: string
 *                 example: "house"
 *               yearBuilt:
 *                 type: number
 *                 example: 2020
 *               lotSize:
 *                 type: number
 *                 example: 3000
 *     responses:
 *       210:
 *         description: Valuation completed and record created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valuation: { type: object }
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied (Only property owner/admin)
 *       429:
 *         description: Re-valuation cooldown (30 days) not expired
 *       404:
 *         description: Property not found
 */
router.post('/',
  protect,
  ctrl.requestValuation
);

/**
 * @swagger
 * /api/valuation/property/{propertyId}:
 *   get:
 *     summary: Retrieve valuation history for a single property
 *     tags: [AI Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of valuations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valuations: { type: array, items: { type: object } }
 *                 pagination: { type: object }
 *       403:
 *         description: Access denied
 *       404:
 *         description: Property not found
 */
router.get('/property/:propertyId',
  protect,
  ctrl.getValuationHistory
);

/**
 * @swagger
 * /api/valuation/market-trend:
 *   get:
 *     summary: Retrieve market trend details for a specific city/state
 *     tags: [AI Valuation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *         example: "Chennai"
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         example: "Tamil Nadu"
 *     responses:
 *       200:
 *         description: Market trend details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Missing query parameters
 */
router.get('/market-trend',
  protect,
  ctrl.getMarketTrend
);

/**
 * @swagger
 * /api/valuation/stats:
 *   get:
 *     summary: Retrieve aggregate valuation statistics (admin only)
 *     tags: [AI Valuation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Aggregate analytics metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalValuations: { type: integer }
 *                 avgConfidenceScore: { type: number }
 *                 bySource: { type: object }
 *                 byMarketTrend: { type: object }
 *                 recentValuations: { type: array, items: { type: object } }
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/stats',
  protect,
  requireRole('admin'),
  ctrl.getValuationStats
);

/**
 * @swagger
 * /api/valuation/comparables:
 *   post:
 *     summary: Fetch comparable properties in the area
 *     tags: [AI Valuation]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [city, propertyType]
 *             properties:
 *               city:
 *                 type: string
 *                 example: "Chennai"
 *               propertyType:
 *                 type: string
 *                 example: "house"
 *               bedrooms:
 *                 type: number
 *               bathrooms:
 *                 type: number
 *               squareFeet:
 *                 type: number
 *     responses:
 *       200:
 *         description: List of comparable properties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 comparables: { type: array, items: { type: object } }
 *       400:
 *         description: Validation error
 */
router.post('/comparables',
  protect,
  ctrl.getComparables
);

/**
 * @swagger
 * /api/valuation/{id}:
 *   get:
 *     summary: Get a single valuation record by ID
 *     tags: [AI Valuation]
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
 *         description: Valuation record details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Access denied
 *       404:
 *         description: Valuation not found
 */
router.get('/:id',
  protect,
  ctrl.getValuation
);

module.exports = router;