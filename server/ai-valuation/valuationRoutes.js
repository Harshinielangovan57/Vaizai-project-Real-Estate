const express = require('express');
const router  = express.Router();
const ctrl    = require('./valuationController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.post('/',
  protect,
  ctrl.requestValuation
);

router.get('/property/:propertyId',
  protect,
  ctrl.getValuationHistory
);

router.get('/market-trend',
  protect,
  ctrl.getMarketTrend
);

router.get('/stats',
  protect,
  requireRole('admin'),
  ctrl.getValuationStats
);

router.post('/comparables',
  protect,
  ctrl.getComparables
);

router.get('/:id',
  protect,
  ctrl.getValuation
);

module.exports = router;