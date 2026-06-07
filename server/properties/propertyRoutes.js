const express = require('express');
const router  = require('express').Router();
const ctrl    = require('./propertyController');
const { protect, requireRole } = require('../auth/authMiddleware');
const { computeValuation } = require('../ai-valuation/tmpValuationService');

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Property listing, tokenization and AI valuation
 */

/**
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Get all properties with filters and pagination
 *     tags: [Properties]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         example: Chennai
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *           enum: [residential, commercial, land, industrial]
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: number
 *         example: 100000
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: number
 *         example: 500000
 *       - in: query
 *         name: sqFtMin
 *         schema:
 *           type: number
 *       - in: query
 *         name: sqFtMax
 *         schema:
 *           type: number
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: forSale
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: forAuction
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search on title, description, address
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price, createdAt, aiValuation, squareFeet]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *         description: Paginated list of properties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 properties:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Property'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:  { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 */
router.get('/', ctrl.getProperties);

/**
 * POST /api/properties/tmp/valuate
 * Quick AI valuation before a property record exists.
 * Requires auth (seller / admin).
 */
router.post('/tmp/valuate', protect, (req, res) => {
  try {
    const { city, state, squareFeet, bedrooms, bathrooms, propertyType, yearBuilt } = req.body;

    if (!city || !squareFeet) {
      return res.status(400).json({ message: 'city and squareFeet are required' });
    }

    const result = computeValuation({
      city, state, squareFeet, bedrooms, bathrooms,
      propertyType: propertyType || 'house',
      yearBuilt,
    });

    return res.json({
      valuation:    result.estimatedValue,
      suggestedEth: result.suggestedEth,
      lowEstimate:  result.lowEstimate,
      highEstimate: result.highEstimate,
      confidence:   result.confidenceScore,
      pricePerSqFt: result.pricePerSqFt,
      marketTrend:  result.marketTrend,
      marketSummary:result.marketSummary,
      aiNarrative:  result.aiNarrative,
      comparables:  result.comparables,
      featureImportance: result.featureImportance,
      source:       result.source,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @swagger
 * /api/properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     tags: [Properties]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 664a1b2c3d4e5f6a7b8c9d0e
 *     responses:
 *       200:
 *         description: Property details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Property'
 *       404:
 *         description: Property not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', ctrl.getProperty);

/**
 * @swagger
 * /api/properties/{id}/tour:
 *   get:
 *     summary: Get virtual tour URL for a property
 *     tags: [Properties]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Virtual tour data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:          { type: string }
 *                 virtualTourUrl: { type: string }
 *                 fallbackImage:  { type: string }
 *                 hasTour:        { type: boolean }
 *       404:
 *         description: Property not found
 */
router.get('/:id/tour', ctrl.getTour);

/**
 * @swagger
 * /api/properties:
 *   post:
 *     summary: Create a new property listing (seller or admin only)
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title, address, city, state, squareFeet, askingPrice, propertyType]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Modern Villa in Chennai
 *               description:
 *                 type: string
 *               address:
 *                 type: string
 *                 example: 123 Anna Nagar
 *               city:
 *                 type: string
 *                 example: Chennai
 *               state:
 *                 type: string
 *                 example: Tamil Nadu
 *               country:
 *                 type: string
 *                 example: IN
 *               squareFeet:
 *                 type: number
 *                 example: 2400
 *               bedrooms:
 *                 type: number
 *                 example: 4
 *               bathrooms:
 *                 type: number
 *                 example: 3
 *               yearBuilt:
 *                 type: number
 *                 example: 2020
 *               lotSize:
 *                 type: number
 *               propertyType:
 *                 type: string
 *                 enum: [residential, commercial, land, industrial]
 *               askingPrice:
 *                 type: number
 *                 example: 250000
 *               virtualTourUrl:
 *                 type: string
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Property created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Property'
 *       400:
 *         description: Validation error
 *       403:
 *         description: KYC approval required or insufficient role
 */
router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.uploadMiddleware,
  ctrl.createProperty
);

/**
 * @swagger
 * /api/properties/{id}:
 *   put:
 *     summary: Update property details (owner only)
 *     tags: [Properties]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title:        { type: string }
 *               description:  { type: string }
 *               askingPrice:  { type: number }
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Property updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Property'
 *       403:
 *         description: Not the property owner
 *       404:
 *         description: Property not found
 */
router.put('/:id',
  protect,
  ctrl.uploadMiddleware,
  ctrl.updateProperty
);

/**
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     summary: Soft delete a property (owner or admin)
 *     tags: [Properties]
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
 *         description: Property removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Property removed }
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Property not found
 */
router.delete('/:id',
  protect,
  ctrl.deleteProperty
);

/**
 * @swagger
 * /api/properties/{id}/tokenize:
 *   post:
 *     summary: Mint property as ERC-721 NFT on blockchain (owner only)
 *     tags: [Properties]
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
 *         description: Property tokenized on blockchain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:        { type: string }
 *                 tokenId:        { type: number }
 *                 txHash:         { type: string }
 *                 metadataUri:    { type: string }
 *       400:
 *         description: Already tokenized or not verified
 *       403:
 *         description: Not the property owner
 *       404:
 *         description: Property not found
 */
router.post('/:id/tokenize',
  protect,
  ctrl.tokenizeProperty
);

/**
 * @swagger
 * /api/properties/{id}/valuate:
 *   post:
 *     summary: Request AI valuation for property (30-day cooldown)
 *     tags: [Properties]
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
 *         description: AI valuation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 estimatedValue: { type: number }
 *                 range:
 *                   type: object
 *                   properties:
 *                     low:  { type: number }
 *                     high: { type: number }
 *                 comparables:
 *                   type: array
 *                   items:
 *                     type: object
 *       429:
 *         description: Re-valuation cooldown not expired
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:          { type: string }
 *                 nextAvailableAt:  { type: string, format: date-time }
 *       403:
 *         description: Not the property owner
 */
router.post('/:id/valuate',
  protect,
  ctrl.valuateProperty
);

/**
 * @swagger
 * /api/properties/{id}/verify:
 *   put:
 *     summary: Verify property on blockchain (admin only)
 *     tags: [Properties]
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
 *         description: Property verified on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 txHash:  { type: string }
 *       400:
 *         description: Must be tokenized before verification
 *       403:
 *         description: Admin access required
 */
router.put('/:id/verify',
  protect,
  requireRole('admin'),
  ctrl.verifyProperty
);

module.exports = router;