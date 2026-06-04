const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    listingId:    { type: Number, default: null },        // on-chain listing ID
    propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tokenId:      { type: Number, required: true },
    seller:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerAddress:{ type: String, required: true, lowercase: true },
    price:        { type: Number, required: true },        // in wei (BigInt stored as String)
    priceEth:     { type: Number, required: true },        // human-readable ETH
    priceUsd:     { type: Number, default: null },         // USD equivalent (fetched at list time)
    active:       { type: Boolean, default: true },
    txHash:       { type: String, default: null },         // listing tx
    soldTxHash:   { type: String, default: null },
    buyerAddress: { type: String, default: null, lowercase: true },
    buyer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paymentMethod:{ type: String, enum: ['crypto', 'fiat'], default: null },
    soldAt:       { type: Date, default: null },

    // Stripe
    stripePaymentIntentId: { type: String, default: null },
    stripeStatus:          { type: String, default: null },
  },
  { timestamps: true }
);

listingSchema.index({ active: 1, createdAt: -1 });
listingSchema.index({ seller: 1 });
listingSchema.index({ listingId: 1 });

module.exports = mongoose.model('Listing', listingSchema);