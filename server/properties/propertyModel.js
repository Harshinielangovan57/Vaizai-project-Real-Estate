const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
  {
    // Off-chain metadata
    title:        { type: String, required: true, trim: true },
    description:  { type: String, trim: true },
    address:      { type: String, required: true },
    city:         { type: String, required: true },
    state:        { type: String, required: true },
    country:      { type: String, default: 'US' },
    squareFeet:   { type: Number, required: true },
    bedrooms:     { type: Number, default: 0 },
    bathrooms:    { type: Number, default: 0 },
    yearBuilt:    { type: Number },
    lotSize:      { type: Number },
    propertyType: {
      type: String,
      enum: ['residential', 'commercial', 'land', 'industrial'],
      required: true,
    },
    askingPrice:  { type: Number, required: true }, // in USD

    // Images & tour
    images:          [{ type: String }],    // IPFS URLs
    primaryImage:    { type: String },
    virtualTourUrl:  { type: String },       // Matterport or Three.js 360 image IPFS URL

    // Owner
    ownerAddress: { type: String, required: true, lowercase: true },
    owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // AI valuation
    aiValuation:       { type: Number, default: null },
    aiValuationRange:  { low: Number, high: Number },
    aiComparables:     [mongoose.Schema.Types.Mixed],
    aiValuatedAt:      { type: Date, default: null },

    // Blockchain
    tokenId:          { type: Number, default: null },
    contractAddress:  { type: String, default: null },
    ipfsMetadataUri:  { type: String, default: null },
    tokenized:        { type: Boolean, default: false },

    // Status
    verified:   { type: Boolean, default: false },
    forSale:    { type: Boolean, default: false },
    forAuction: { type: Boolean, default: false },
    isDeleted:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Text index for search
propertySchema.index({ title: 'text', description: 'text', address: 'text' });

module.exports = mongoose.model('Property', propertySchema);
