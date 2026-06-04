const Joi = require('joi');

exports.createEscrowSchema = Joi.object({
  propertyId:  Joi.string().hex().length(24).required(),
  buyerAddress:Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  totalAmountEth: Joi.number().positive().required(),
  deadline:    Joi.date().greater('now').required(),
  milestones: Joi.array().items(
    Joi.object({
      title:      Joi.string().required(),
      description:Joi.string().allow('', null),
      amountEth:  Joi.number().positive().required(),
    })
  ).min(1).required(),
});

exports.disputeSchema = Joi.object({
  reason:   Joi.string().min(10).max(2000).required(),
  evidence: Joi.array().items(Joi.string().uri()).max(5),
});

exports.resolveDisputeSchema = Joi.object({
  resolution:  Joi.string().min(10).max(2000).required(),
  releaseToSeller: Joi.boolean().required(), // true = release to seller, false = refund buyer
});