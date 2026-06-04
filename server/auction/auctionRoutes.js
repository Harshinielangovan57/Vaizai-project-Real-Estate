const express = require('express');
const router  = express.Router();
const ctrl    = require('./auctionController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.get('/',                ctrl.getAuctions);
router.get('/:id',             protect, ctrl.getAuction);
router.get('/:id/bids',        ctrl.getBidHistory);

router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createAuction
);

router.post('/:id/bid',
  protect,
  ctrl.placeBid
);

router.post('/:id/settle',
  protect,
  ctrl.settleAuction
);

router.post('/:id/cancel',
  protect,
  ctrl.cancelAuction
);

router.post('/:id/withdraw',
  protect,
  ctrl.withdrawBid
);

module.exports = router;