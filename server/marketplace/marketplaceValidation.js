const Joi = require('joi');

exports.createListingSchema = Joi.object({
  propertyId: Joi.string().hex().length(24).required(),
  priceEth:   Joi.number().positive().required(),
});

exports.updatePriceSchema = Joi.object({
  priceEth: Joi.number().positive().required(),
});

exports.fiatBuySchema = Joi.object({
  buyerWalletAddress: Joi.string()
    .pattern(/^0x[a-fA-F0-9]{40}$/)
    .required()
    .messages({ 'string.pattern.base': 'Invalid Ethereum wallet address' }),
});