const express = require('express');
const router  = express.Router();
const ctrl    = require('./adminController');
const { protect, requireRole } = require('../auth/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(requireRole('admin'));

/* ─── Dashboard ──────────────────────────────────────────────────────── */
router.get('/dashboard', ctrl.getDashboard);

/* ─── User Management ────────────────────────────────────────────────── */
router.get('/users',                    ctrl.getUsers);
router.get('/users/:id',                ctrl.getUser);
router.put('/users/:id/role',           ctrl.updateUserRole);
router.put('/users/:id/kyc',            ctrl.updateKyc);
router.put('/users/:id/suspend',        ctrl.suspendUser);
router.put('/users/:id/unsuspend',      ctrl.unsuspendUser);

/* ─── Property Management ────────────────────────────────────────────── */
router.get('/properties',               ctrl.getProperties);
router.put('/properties/:id/verify',    ctrl.verifyProperty);
router.delete('/properties/:id',        ctrl.forceDeleteProperty);

/* ─── Transactions ───────────────────────────────────────────────────── */
router.get('/transactions',             ctrl.getTransactions);

/* ─── Disputes ───────────────────────────────────────────────────────── */
router.get('/disputes',                 ctrl.getDisputes);
router.put('/disputes/:id/resolve',     ctrl.resolveDispute);

/* ─── Platform Settings ──────────────────────────────────────────────── */
router.get('/settings',                 ctrl.getSettings);
router.put('/settings/marketplace-fee', ctrl.updateMarketplaceFee);
router.put('/settings/escrow-fee',      ctrl.updateEscrowFee);
router.put('/settings/auction-fee',     ctrl.updateAuctionFee);
router.put('/settings/pause',           ctrl.pauseMarketplace);
router.put('/settings/unpause',         ctrl.unpauseMarketplace);

/* ─── Analytics ──────────────────────────────────────────────────────── */
router.get('/analytics/sales',          ctrl.getSalesAnalytics);
router.get('/analytics/users',          ctrl.getUserAnalytics);
router.get('/analytics/blockchain',     ctrl.getBlockchainAnalytics);

/* ─── Utilities ──────────────────────────────────────────────────────── */
router.post('/broadcast',               ctrl.broadcastMessage);
router.post('/withdraw-platform-fees',  ctrl.withdrawPlatformFees);

module.exports = router;