const express = require('express');
const router  = express.Router();
const ctrl    = require('./authController');
const { protect } = require('./authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication — email/password and MetaMask wallet
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             name: "John Doe"
 *             email: "john@example.com"
 *             password: "Secret@123"
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Email and password required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', ctrl.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "john@example.com"
 *             password: "Secret@123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Account suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', ctrl.login);

/**
 * @swagger
 * /api/auth/nonce/{address}:
 *   get:
 *     summary: Get nonce message for MetaMask wallet authentication
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         description: Ethereum wallet address
 *         schema:
 *           type: string
 *         example: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
 *     responses:
 *       200:
 *         description: Nonce message to sign with MetaMask
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Sign this message to authenticate.\n\nNonce: abc-123"
 *       400:
 *         description: Invalid wallet address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/nonce/:address', ctrl.getNonce);

/**
 * @swagger
 * /api/auth/wallet:
 *   post:
 *     summary: Login with MetaMask wallet signature
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [walletAddress, signature]
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 example: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
 *               signature:
 *                 type: string
 *                 example: "0x1234abcd..."
 *     responses:
 *       200:
 *         description: Wallet login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Signature verification failed or nonce expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Account suspended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/wallet', ctrl.walletLogin);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using httpOnly refresh token cookie
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: No refresh token or token invalid/expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/refresh', ctrl.refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout and invalidate refresh token
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out"
 *       401:
 *         description: No token provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', protect, ctrl.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:           { type: string }
 *                 name:          { type: string }
 *                 email:         { type: string }
 *                 walletAddress: { type: string }
 *                 role:          { type: string, enum: [user, seller, admin] }
 *                 kycStatus:     { type: string, enum: [none, pending, approved, rejected] }
 *                 isSuspended:   { type: boolean }
 *                 createdAt:     { type: string, format: date-time }
 *       401:
 *         description: Token invalid or expired
 *       404:
 *         description: User not found
 */
router.get('/me', protect, ctrl.me);
router.post('/become-seller', protect, ctrl.becomeSeller);

module.exports = router;