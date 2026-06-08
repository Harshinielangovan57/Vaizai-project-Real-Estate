const express = require('express');
const router  = express.Router();
const ctrl    = require('./agreementController');
const { protect, requireRole } = require('../auth/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Agreements
 *   description: Property legal agreements, on-chain signature anchoring, and PDF generation
 */

/**
 * @swagger
 * /api/agreements:
 *   get:
 *     summary: Get agreements list for authenticated user (admin gets all)
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_signatures, partially_signed, fully_signed, on_chain, voided, expired]
 *       - in: query
 *         name: type
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
 *         description: List of agreements (omitting heavy document HTML content)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreements:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *                     pages: { type: integer }
 */
router.get('/',
  protect,
  ctrl.getAgreements
);

/**
 * @swagger
 * /api/agreements/{id}:
 *   get:
 *     summary: Get details of a single agreement by database ID
 *     tags: [Agreements]
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
 *         description: Agreement details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Access denied
 *       404:
 *         description: Agreement not found
 */
router.get('/:id',
  protect,
  ctrl.getAgreement
);

/**
 * @swagger
 * /api/agreements:
 *   post:
 *     summary: Create a new draft agreement (seller/admin only)
 *     tags: [Agreements]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, type, propertyId, signatories]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Purchase and Sale Agreement"
 *               type:
 *                 type: string
 *                 example: "sale"
 *               propertyId:
 *                 type: string
 *                 example: "664a1b2c3d4e5f6a7b8c9d0e"
 *               listingId:
 *                 type: string
 *               escrowId:
 *                 type: string
 *               auctionId:
 *                 type: string
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *               templateData:
 *                 type: object
 *                 properties:
 *                   salePrice: { type: number, example: 2.5 }
 *                   escrowAmount: { type: number, example: 0.5 }
 *                   additionalTerms: { type: string, example: "Subject to home inspection." }
 *               signatories:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [userId, role]
 *                   properties:
 *                     userId: { type: string, example: "664a1b2c3d4e5f6a7b8c9d0d" }
 *                     role: { type: string, example: "buyer" }
 *     responses:
 *       201:
 *         description: Agreement drafted and uploaded to IPFS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 agreement: { type: object }
 *                 ipfsDocumentCid: { type: string }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Property or user not found
 */
router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createAgreement
);

/**
 * @swagger
 * /api/agreements/{id}/sign:
 *   post:
 *     summary: Record user signature on an agreement
 *     tags: [Agreements]
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
 *             required: [ethSignature, txHash]
 *             properties:
 *               ethSignature:
 *                 type: string
 *                 example: "0x..."
 *               txHash:
 *                 type: string
 *                 example: "0x0000000000000000000000000000000000000000000000000000000000000000"
 *     responses:
 *       200:
 *         description: Signature recorded successfully (and anchored on-chain if all signed)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 status: { type: string }
 *                 agreementId: { type: number }
 *                 txHash: { type: string }
 *                 ipfsSignedCid: { type: string }
 *       400:
 *         description: Already signed, expired, or invalid transaction
 *       401:
 *         description: Signature verification failed
 *       403:
 *         description: Not a signatory
 *       404:
 *         description: Agreement not found
 */
router.post('/:id/sign',
  protect,
  ctrl.signAgreement
);

/**
 * @swagger
 * /api/agreements/{id}/document:
 *   get:
 *     summary: Retrieve agreement document PDF (streams PDF or returns signed IPFS CID link)
 *     tags: [Agreements]
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
 *         description: Streams the PDF inline or returns the signed IPFS CID
 *       403:
 *         description: Access denied
 *       404:
 *         description: Agreement not found
 */
router.get('/:id/document',
  protect,
  ctrl.getDocument
);

/**
 * @swagger
 * /api/agreements/{id}/void:
 *   post:
 *     summary: Void a pending agreement (creator/admin only)
 *     tags: [Agreements]
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
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Deal fell through."
 *     responses:
 *       200:
 *         description: Agreement voided successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Agreement voided" }
 *                 reason: { type: string }
 *       400:
 *         description: Cannot void a voided or fully executed agreement
 *       403:
 *         description: Forbidden
 */
router.post('/:id/void',
  protect,
  ctrl.voidAgreement
);

/**
 * @swagger
 * /api/agreements/{id}/verify:
 *   get:
 *     summary: Publicly verify the integrity of an agreement against on-chain records
 *     tags: [Agreements]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 verified: { type: boolean }
 *                 ipfsMatch: { type: boolean }
 *                 tokenMatch: { type: boolean }
 *                 signatories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role: { type: string }
 *                       signerAddress: { type: string }
 *                       verified: { type: boolean }
 *                 onChainId: { type: number }
 *                 txHash: { type: string }
 *       404:
 *         description: Agreement not found
 */
router.get('/:id/verify',
  ctrl.verifyAgreement
);

module.exports = router;