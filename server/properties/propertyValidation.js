const Joi = require('joi');

exports.createSchema = Joi.object({
  title:        Joi.string().min(3).max(200).required(),
  description:  Joi.string().max(2000),
  address:      Joi.string().required(),
  city:         Joi.string().required(),
  state:        Joi.string().required(),
  country:      Joi.string().default('US'),
  squareFeet:   Joi.number().positive().required(),
  bedrooms:     Joi.number().min(0),
  bathrooms:    Joi.number().min(0),
  yearBuilt:    Joi.number().min(1800).max(new Date().getFullYear()),
  lotSize:      Joi.number().positive(),
  propertyType: Joi.string().valid('residential', 'commercial', 'land', 'industrial').required(),
  askingPrice:  Joi.number().positive().required(),
  virtualTourUrl: Joi.string().uri().allow('', null),
});

exports.updateSchema = Joi.object({
  title:          Joi.string().min(3).max(200),
  description:    Joi.string().max(2000),
  address:        Joi.string(),
  city:           Joi.string(),
  state:          Joi.string(),
  country:        Joi.string(),
  squareFeet:     Joi.number().positive(),
  bedrooms:       Joi.number().min(0),
  bathrooms:      Joi.number().min(0),
  yearBuilt:      Joi.number().min(1800).max(new Date().getFullYear()),
  lotSize:        Joi.number().positive(),
  propertyType:   Joi.string().valid('residential', 'commercial', 'land', 'industrial'),
  askingPrice:    Joi.number().positive(),
  virtualTourUrl: Joi.string().uri().allow('', null),
}).min(1);

exports.filterSchema = Joi.object({
  city:         Joi.string(),
  propertyType: Joi.string().valid('residential', 'commercial', 'land', 'industrial'),
  priceMin:     Joi.number().positive(),
  priceMax:     Joi.number().positive(),
  sqFtMin:      Joi.number().positive(),
  sqFtMax:      Joi.number().positive(),
  verified:     Joi.boolean(),
  forSale:      Joi.boolean(),
  forAuction:   Joi.boolean(),
  search:       Joi.string(),
  sortBy:       Joi.string().valid('price', 'createdAt', 'aiValuation', 'squareFeet').default('createdAt'),
  order:        Joi.string().valid('asc', 'desc').default('desc'),
  page:         Joi.number().integer().min(1).default(1),
  limit:        Joi.number().integer().min(1).max(50).default(12),
});
