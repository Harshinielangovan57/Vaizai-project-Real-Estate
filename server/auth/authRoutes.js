const express = require('express');
const router = express.Router();
const ctrl = require('./authController');
const { protect } = require('./authMiddleware');

router.post('/register',        ctrl.register);
router.post('/login',           ctrl.login);
router.get('/nonce/:address',   ctrl.getNonce);
router.post('/wallet',          ctrl.walletLogin);
router.post('/refresh',         ctrl.refresh);
router.post('/logout',  protect, ctrl.logout);
router.get('/me',       protect, ctrl.me);

module.exports = router;