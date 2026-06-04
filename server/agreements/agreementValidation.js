const Joi = require('joi');

exports.createAgreementSchema = Joi.object({
  title:      Joi.string().min(3).max(300).required(),
  type:       Joi.string().valid('sale', 'lease', 'escrow', 'auction_settlement', 'transfer').required(),
  propertyId: Joi.string().hex().length(24).required(),
  listingId:  Joi.string().hex().length(24).allow(null, ''),
  escrowId:   Joi.string().hex().length(24).allow(null, ''),
  auctionId:  Joi.string().hex().length(24).allow(null, ''),
  templateData: Joi.object().default({}),
  expiresAt:  Joi.date().greater('now').allow(null),
  signatories: Joi.array().items(
    Joi.object({
      userId:  Joi.string().hex().length(24).required(),
      role:    Joi.string().valid('buyer', 'seller', 'witness', 'agent').required(),
    })
  ).min(2).required(),
});

exports.signAgreementSchema = Joi.object({
  ethSignature: Joi.string().required(),
  txHash:       Joi.string().required(),
});

exports.voidAgreementSchema = Joi.object({
  reason: Joi.string().min(5).max(1000).required(),
});