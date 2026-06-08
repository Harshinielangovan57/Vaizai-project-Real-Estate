const express = require('express');
const router  = express.Router();
const ctrl    = require('./adminController');
const { protect, requireRole } = require('../auth/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(requireRole('admin'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative console dashboards, user controls, KYC validation, platform fee management, analytics, and messaging
 */

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Retrieve dashboard statistics overview
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       403:
 *         description: Forbidden (Admin only)
 */
router.get('/dashboard', ctrl.getDashboard);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Search and list users with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, seller, admin]
 *       - in: query
 *         name: kycStatus
 *         schema:
 *           type: string
 *           enum: [none, pending, approved, rejected]
 *       - in: query
 *         name: suspended
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or wallet address
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users: { type: array, items: { type: object } }
 *                 pagination: { type: object }
 */
router.get('/users',                    ctrl.getUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user details and platform activity summary
 *     tags: [Admin]
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
 *         description: User profile and stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: User not found
 */
router.get('/users/:id',                ctrl.getUser);

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   put:
 *     summary: Update a user's system role
 *     tags: [Admin]
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, seller, admin]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Cannot change your own role or validation error
 *       404:
 *         description: User not found
 */
router.put('/users/:id/role',           ctrl.updateUserRole);

/**
 * @swagger
 * /api/admin/users/{id}/kyc:
 *   put:
 *     summary: Update a user's KYC verification status
 *     tags: [Admin]
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
 *             required: [kycStatus]
 *             properties:
 *               kycStatus:
 *                 type: string
 *                 enum: [none, pending, approved, rejected]
 *               kycNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: KYC status updated successfully (auto-promotes user to seller if approved)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: User not found
 */
router.put('/users/:id/kyc',            ctrl.updateKyc);

/**
 * @swagger
 * /api/admin/users/{id}/suspend:
 *   put:
 *     summary: Suspend a user account (invalidates active refresh tokens)
 *     tags: [Admin]
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
 *                 example: "Fraudulent listings."
 *     responses:
 *       200:
 *         description: User suspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Cannot suspend yourself
 *       404:
 *         description: User not found
 */
router.put('/users/:id/suspend',        ctrl.suspendUser);

/**
 * @swagger
 * /api/admin/users/{id}/unsuspend:
 *   put:
 *     summary: Unsuspend a user account
 *     tags: [Admin]
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
 *         description: User unsuspended successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: User not found
 */
router.put('/users/:id/unsuspend',      ctrl.unsuspendUser);

/**
 * @swagger
 * /api/admin/properties:
 *   get:
 *     summary: List all properties in the system with pagination
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: verified
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: tokenized
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: propertyType
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
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
 *           default: 20
 *     responses:
 *       200:
 *         description: List of properties
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 properties: { type: array, items: { type: object } }
 *                 pagination: { type: object }
 */
router.get('/properties',               ctrl.getProperties);

/**
 * @swagger
 * /api/admin/properties/{id}/verify:
 *   put:
 *     summary: Verify a tokenized property on-chain
 *     tags: [Admin]
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
 *         description: Property verified successfully on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       400:
 *         description: Must be tokenized before verification
 *       404:
 *         description: Property not found
 */
router.put('/properties/:id/verify',    ctrl.verifyProperty);

/**
 * @swagger
 * /api/admin/properties/{id}:
 *   delete:
 *     summary: Force-delete a property listing (soft delete + deactivates listings)
 *     tags: [Admin]
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
 *         description: Property removed by admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Property not found
 */
router.delete('/properties/:id',        ctrl.forceDeleteProperty);

/**
 * @swagger
 * /api/admin/transactions:
 *   get:
 *     summary: Get completed transaction sales logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         example: "2026-12-31"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of transactions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/transactions',             ctrl.getTransactions);

/**
 * @swagger
 * /api/admin/disputes:
 *   get:
 *     summary: List all active disputed escrow agreements
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
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
 *           default: 20
 *     responses:
 *       200:
 *         description: List of disputed escrows
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/disputes',                 ctrl.getDisputes);

/**
 * @swagger
 * /api/admin/disputes/{id}/resolve:
 *   put:
 *     summary: Resolve a disputed escrow (refund buyer or release to seller)
 *     tags: [Admin]
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
 *               releaseToSeller:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Dispute resolved successfully on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/disputes/:id/resolve',     ctrl.resolveDispute);

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     summary: Get current fee percentages and platform status
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform parameters configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/settings',                 ctrl.getSettings);

/**
 * @swagger
 * /api/admin/settings/marketplace-fee:
 *   put:
 *     summary: Update marketplace platform fee percentage on-chain
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feePercent]
 *             properties:
 *               feePercent:
 *                 type: number
 *                 example: 2
 *     responses:
 *       200:
 *         description: Fee updated successfully on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/settings/marketplace-fee', ctrl.updateMarketplaceFee);

/**
 * @swagger
 * /api/admin/settings/escrow-fee:
 *   put:
 *     summary: Update escrow platform fee percentage on-chain
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feePercent]
 *             properties:
 *               feePercent:
 *                 type: number
 *                 example: 2
 *     responses:
 *       200:
 *         description: Fee updated successfully on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/settings/escrow-fee',      ctrl.updateEscrowFee);

/**
 * @swagger
 * /api/admin/settings/auction-fee:
 *   put:
 *     summary: Update auction platform fee percentage on-chain
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [feePercent]
 *             properties:
 *               feePercent:
 *                 type: number
 *                 example: 2
 *     responses:
 *       200:
 *         description: Fee updated successfully on-chain
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/settings/auction-fee',     ctrl.updateAuctionFee);

/**
 * @swagger
 * /api/admin/settings/pause:
 *   put:
 *     summary: Pause marketplace contract interactions (emergency stop)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marketplace contract paused successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/settings/pause',           ctrl.pauseMarketplace);

/**
 * @swagger
 * /api/admin/settings/unpause:
 *   put:
 *     summary: Resume marketplace contract interactions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marketplace contract resumed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.put('/settings/unpause',         ctrl.unpauseMarketplace);

/**
 * @swagger
 * /api/admin/analytics/sales:
 *   get:
 *     summary: Retrieve aggregate sales analytics data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Sales analytics graphs data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/analytics/sales',          ctrl.getSalesAnalytics);

/**
 * @swagger
 * /api/admin/analytics/users:
 *   get:
 *     summary: Retrieve user signup and demographic analytics data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: User analytics graphs data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/analytics/users',          ctrl.getUserAnalytics);

/**
 * @swagger
 * /api/admin/analytics/blockchain:
 *   get:
 *     summary: Retrieve blockchain stats (token counts and balances)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supply counts and smart contract ETH balances
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/analytics/blockchain',     ctrl.getBlockchainAnalytics);

/**
 * @swagger
 * /api/admin/broadcast:
 *   post:
 *     summary: Broadcast Socket.io message event to all listening clients
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [event, payload]
 *             properties:
 *               event:
 *                 type: string
 *                 example: "system:alert"
 *               payload:
 *                 type: object
 *                 properties:
 *                   message: { type: string, example: "Scheduled maintenance in 2 hours." }
 *     responses:
 *       200:
 *         description: Broadcast message triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/broadcast',               ctrl.broadcastMessage);

/**
 * @swagger
 * /api/admin/withdraw-platform-fees:
 *   post:
 *     summary: Withdraw accumulated fee balances from platform smart contracts to platform wallet
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contract]
 *             properties:
 *               contract:
 *                 type: string
 *                 enum: [marketplace, escrow, auction]
 *     responses:
 *       200:
 *         description: Platform fees withdrawn successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.post('/withdraw-platform-fees',  ctrl.withdrawPlatformFees);

module.exports = router;