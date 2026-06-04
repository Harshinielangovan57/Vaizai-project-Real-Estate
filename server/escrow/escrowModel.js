const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },
  amount:      { type: String, required: true },   // wei as string
  amountEth:   { type: Number, required: true },
  released:    { type: Boolean, default: false },
  releasedAt:  { type: Date, default: null },
  releaseTxHash: { type: String, default: null },
}, { _id: true });

const disputeSchema = new mongoose.Schema({
  raisedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason:     { type: String, required: true },
  evidence:   [{ type: String }],                  // IPFS URLs
  resolution: { type: String, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
}, { _id: true });

const escrowSchema = new mongoose.Schema(
  {
    escrowId:      { type: Number, default: null },    // on-chain escrow ID
    propertyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tokenId:       { type: Number, required: true },
    seller:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerAddress: { type: String, required: true, lowercase: true },
    buyer:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerAddress:  { type: String, required: true, lowercase: true },

    totalAmount:    { type: String, required: true },  // wei
    totalAmountEth: { type: Number, required: true },
    totalAmountUsd: { type: Number, default: null },

    platformFeePercent: { type: Number, default: 2 }, // 2%
    platformFee:        { type: String, default: null },

    milestones: [milestoneSchema],
    dispute:    { type: disputeSchema, default: null },

    status: {
      type: String,
      enum: [
        'pending',      // created, awaiting buyer deposit
        'funded',       // buyer deposited funds on-chain
        'in_progress',  // milestones being released
        'completed',    // all milestones released
        'disputed',     // dispute raised
        'refunded',     // buyer refunded
        'cancelled',    // cancelled before funding
      ],
      default: 'pending',
    },

    createTxHash:  { type: String, default: null },
    fundTxHash:    { type: String, default: null },
    completeTxHash:{ type: String, default: null },
    refundTxHash:  { type: String, default: null },

    deadline:   { type: Date, default: null },
    completedAt:{ type: Date, default: null },
  },
  { timestamps: true }
);

escrowSchema.index({ buyer: 1, status: 1 });
escrowSchema.index({ seller: 1, status: 1 });
escrowSchema.index({ escrowId: 1 });

module.exports = mongoose.model('Escrow', escrowSchema);