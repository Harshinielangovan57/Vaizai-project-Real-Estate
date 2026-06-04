const Joi = require('joi');

exports.updateUserRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'seller', 'admin').required(),
});

exports.updateKycSchema = Joi.object({
  kycStatus: Joi.string().valid('none', 'pending', 'approved', 'rejected').required(),
  kycNote:   Joi.string().max(500).allow('', null),
});

exports.suspendUserSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
});

exports.platformFeeSchema = Joi.object({
  feePercent: Joi.number().min(0).max(20).required(),
});

exports.broadcastSchema = Joi.object({
  event:   Joi.string().min(2).max(100).required(),
  payload: Joi.object().default({}),
});

exports.dateRangeSchema = Joi.object({
  from:  Joi.date().allow(null),
  to:    Joi.date().allow(null),
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});