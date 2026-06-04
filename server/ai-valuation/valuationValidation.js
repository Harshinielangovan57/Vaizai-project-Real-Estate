const Joi = require('joi');

exports.valuationRequestSchema = Joi.object({
  propertyId:   Joi.string().hex().length(24).required(),
  address:      Joi.string().allow('', null),
  city:         Joi.string().required(),
  state:        Joi.string().required(),
  postalCode:   Joi.string().allow('', null),
  squareFeet:   Joi.number().positive().required(),
  bedrooms:     Joi.number().min(0).required(),
  bathrooms:    Joi.number().min(0).required(),
  propertyType: Joi.string().valid('residential', 'commercial', 'land', 'industrial').required(),
  yearBuilt:    Joi.number().min(1800).max(new Date().getFullYear()).allow(null),
  lotSize:      Joi.number().positive().allow(null),
});

exports.comparablesRequestSchema = Joi.object({
  city:         Joi.string().required(),
  state:        Joi.string().required(),
  squareFeet:   Joi.number().positive().required(),
  propertyType: Joi.string().valid('residential', 'commercial', 'land', 'industrial').required(),
  radius:       Joi.number().positive().max(50).default(10),
  limit:        Joi.number().integer().min(1).max(20).default(5),
});