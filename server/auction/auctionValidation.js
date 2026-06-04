const Joi = require('joi');

exports.createAuctionSchema = Joi.object({
  propertyId:         Joi.string().hex().length(24).required(),
  startingPriceEth:   Joi.number().positive().required(),
  reservePriceEth:    Joi.number().positive().greater(Joi.ref('startingPriceEth')),
  minBidIncrementEth: Joi.number().positive().required(),
  startTime:          Joi.date().greater('now').required(),
  endTime:            Joi.date().greater(Joi.ref('startTime')).required(),
});

exports.placeBidSchema = Joi.object({
  amountEth: Joi.number().positive().required(),
  txHash:    Joi.string().required(),
});

exports.cancelAuctionSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
});