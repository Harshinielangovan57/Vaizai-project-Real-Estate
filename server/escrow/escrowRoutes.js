const express = require('express');
const router  = express.Router();
const ctrl    = require('./escrowController');
const { protect, requireRole } = require('../auth/authMiddleware');

router.get('/',
  protect,
  ctrl.getEscrows
);

router.get('/:id',
  protect,
  ctrl.getEscrow
);

router.post('/',
  protect,
  requireRole('seller', 'admin'),
  ctrl.createEscrow
);

router.post('/:id/fund',
  protect,
  ctrl.confirmFunding
);

router.post('/:id/milestone/:milestoneId/release',
  protect,
  ctrl.releaseMilestone
);

router.post('/:id/dispute',
  protect,
  ctrl.evidenceUploadMiddleware,
  ctrl.raiseDispute
);

router.put('/:id/dispute/resolve',
  protect,
  requireRole('admin'),
  ctrl.resolveDispute
);

router.post('/:id/cancel',
  protect,
  ctrl.cancelEscrow
);

module.exports = router;