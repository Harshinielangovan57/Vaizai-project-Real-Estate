const express = require('express');
const router  = express.Router();
const ctrl    = require('./propertyController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.get('/',                   ctrl.getProperties);
router.get('/:id',                ctrl.getProperty);
router.get('/:id/tour',           ctrl.getTour);

router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.uploadMiddleware,
  ctrl.createProperty
);

router.put('/:id',
  protect,
  ctrl.uploadMiddleware,
  ctrl.updateProperty
);

router.delete('/:id',
  protect,
  ctrl.deleteProperty
);

router.post('/:id/tokenize',
  protect,
  ctrl.tokenizeProperty
);

router.post('/:id/valuate',
  protect,
  ctrl.valuateProperty
);

router.put('/:id/verify',
  protect,
  requireRole('admin'),
  ctrl.verifyProperty
);

module.exports = router;