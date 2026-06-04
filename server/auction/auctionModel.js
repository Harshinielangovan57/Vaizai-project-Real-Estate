const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  bidder:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bidderAddress: { type: String, required: true, lowercase: true },
  amount:        { type: String, required: true },   // wei as string
  amountEth:     { type: Number, required: true },
  txHash:        { type: String, default: null },
  timestamp:     { type: Date, default: Date.now },
  withdrawn:     { type: Boolean, default: false },
  withdrawTxHash:{ type: String, default: null },
}, { _id: true });

const auctionSchema = new mongoose.Schema(
  {
    auctionId:      { type: Number, default: null },   // on-chain auction ID
    propertyId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tokenId:        { type: Number, required: true },
    seller:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerAddress:  { type: String, required: true, lowercase: true },

    startingPrice:    { type: String, required: true },    // wei
    startingPriceEth: { type: Number, required: true },
    reservePrice:     { type: String, default: null },     // wei — hidden from buyers
    reservePriceEth:  { type: Number, default: null },
    minBidIncrement:  { type: String, required: true },    // wei
    minBidIncrementEth: { type: Number, required: true },

    startTime:  { type: Date, required: true },
    endTime:    { type: Date, required: true },
    extended:   { type: Boolean, default: false },         // true if anti-sniping extended it
    extensionCount: { type: Number, default: 0 },

    bids:           [bidSchema],
    highestBid:     { type: String, default: '0' },        // wei
    highestBidEth:  { type: Number, default: 0 },
    highestBidder:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    highestBidderAddress: { type: String, default: null },

    reserveMet:    { type: Boolean, default: false },
    winner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    winnerAddress: { type: String, default: null },
    finalPrice:    { type: String, default: null },        // wei
    finalPriceEth: { type: Number, default: null },

    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'settled', 'cancelled'],
      default: 'scheduled',
    },

    createTxHash: { type: String, default: null },
    settleTxHash: { type: String, default: null },
    cancelTxHash: { type: String, default: null },
  },
  { timestamps: true }
);

auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ seller: 1 });
auctionSchema.index({ auctionId: 1 });

module.exports = mongoose.model('Auction', auctionSchema);