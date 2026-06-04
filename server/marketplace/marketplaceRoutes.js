const express = require('express');
const router  = express.Router();
const ctrl    = require('./marketplaceController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.get('/',                              ctrl.getListings);
router.get('/:listingId',                    ctrl.getListing);

router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createListing
);

router.delete('/:listingId',
  protect,
  ctrl.cancelListing
);

router.put('/:listingId/price',
  protect,
  ctrl.updatePrice
);

router.post('/:listingId/buy/crypto',
  protect,
  ctrl.initiateCryptoPurchase
);

router.post('/:listingId/buy/fiat',
  protect,
  ctrl.initiateFiatPurchase
);

module.exports = router;