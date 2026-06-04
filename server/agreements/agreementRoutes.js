const express = require('express');
const router  = express.Router();
const ctrl    = require('./agreementController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.get('/',
  protect,
  ctrl.getAgreements
);

router.get('/:id',
  protect,
  ctrl.getAgreement
);

router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createAgreement
);

router.post('/:id/sign',
  protect,
  ctrl.signAgreement
);

router.get('/:id/document',
  protect,
  ctrl.getDocument
);

router.post('/:id/void',
  protect,
  ctrl.voidAgreement
);

router.get('/:id/verify',
  ctrl.verifyAgreement          // public — no auth required
);

module.exports = router;