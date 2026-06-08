const express = require('express');
const router  = express.Router();
const ctrl    = require('./escrowController');
const { protect, requireRole } = require('../auth/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Escrow
 *   description: Property escrow agreements, milestone releases, and dispute resolution
 */

/**
 * @swagger
 * /api/escrow:
 *   get:
 *     summary: Get escrows list for the authenticated user (admin gets all)
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, funded, in_progress, completed, disputed, refunded, cancelled]
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
 *         description: List of escrows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 escrows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Escrow'
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
  ctrl.getEscrows
);

/**
 * @swagger
 * /api/escrow/{id}:
 *   get:
 *     summary: Get details of a single escrow by database ID
 *     tags: [Escrow]
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
 *         description: Escrow details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Escrow'
 *       403:
 *         description: Access denied
 *       404:
 *         description: Escrow not found
 */
router.get('/:id',
  protect,
  ctrl.getEscrow
);

/**
 * @swagger
 * /api/escrow:
 *   post:
 *     summary: Create/initialize an escrow agreement (seller/admin only)
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [propertyId, buyerAddress, totalAmountEth, deadline, milestones]
 *             properties:
 *               propertyId:
 *                 type: string
 *                 example: "664a1b2c3d4e5f6a7b8c9d0e"
 *               buyerAddress:
 *                 type: string
 *                 example: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
 *               totalAmountEth:
 *                 type: number
 *                 example: 3.5
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-31T23:59:59Z"
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [title, amountEth]
 *                   properties:
 *                     title: { type: string, example: "Phase 1 - Inspection Complete" }
 *                     amountEth: { type: number, example: 1.5 }
 *     responses:
 *       201:
 *         description: Escrow created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 escrow:
 *                   $ref: '#/components/schemas/Escrow'
 *                 txHash:
 *                   type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createEscrow
);

/**
 * @swagger
 * /api/escrow/{id}/fund:
 *   post:
 *     summary: Confirm escrow funding (buyer only)
 *     tags: [Escrow]
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
 *                 example: "0x0000000000000000000000000000000000000000000000000000000000000000"
 *     responses:
 *       200:
 *         description: Funding confirmed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Escrow funded" }
 *                 escrow:
 *                   $ref: '#/components/schemas/Escrow'
 *       400:
 *         description: Transaction not confirmed or state error
 *       403:
 *         description: Forbidden
 */
router.post('/:id/fund',
  protect,
  ctrl.confirmFunding
);

/**
 * @swagger
 * /api/escrow/{id}/milestone/{milestoneId}/release:
 *   post:
 *     summary: Release a funded milestone to the seller (seller or admin only)
 *     tags: [Escrow]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Milestone released successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Milestone released" }
 *                 escrow:
 *                   $ref: '#/components/schemas/Escrow'
 *                 txHash: { type: string }
 *       400:
 *         description: Milestone already released or state error
 *       403:
 *         description: Forbidden
 */
router.post('/:id/milestone/:milestoneId/release',
  protect,
  ctrl.releaseMilestone
);

/**
 * @swagger
 * /api/escrow/{id}/dispute:
 *   post:
 *     summary: Raise a dispute on an active escrow (buyer or seller only)
 *     tags: [Escrow]
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Seller failed to deliver documentation."
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Dispute raised successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Dispute raised" }
 *                 txHash: { type: string }
 *                 escrow:
 *                   $ref: '#/components/schemas/Escrow'
 *       400:
 *         description: State error or dispute already raised
 *       403:
 *         description: Forbidden
 */
router.post('/:id/dispute',
  protect,
  ctrl.evidenceUploadMiddleware,
  ctrl.raiseDispute
);

/**
 * @swagger
 * /api/escrow/{id}/dispute/resolve:
 *   put:
 *     summary: Resolve a disputed escrow (admin only)
 *     tags: [Escrow]
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
 *             required: [resolution, releaseToSeller]
 *             properties:
 *               resolution:
 *                 type: string
 *                 example: "Insufficent evidence from buyer. Release to seller."
 *               releaseToSeller:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Dispute resolved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Dispute resolved — released to seller" }
 *                 escrow:
 *                   $ref: '#/components/schemas/Escrow'
 *                 txHash: { type: string }
 *       400:
 *         description: Escrow not disputed
 *       403:
 *         description: Forbidden (Admin only)
 */
router.put('/:id/dispute/resolve',
  protect,
  requireRole('admin'),
  ctrl.resolveDispute
);

/**
 * @swagger
 * /api/escrow/{id}/cancel:
 *   post:
 *     summary: Cancel a pending escrow agreement (seller/admin only)
 *     tags: [Escrow]
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
 *         description: Escrow cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Escrow cancelled" }
 *                 txHash: { type: string }
 *       400:
 *         description: State error
 *       403:
 *         description: Forbidden
 */
router.post('/:id/cancel',
  protect,
  ctrl.cancelEscrow
);

module.exports = router;