const mongoose = require('mongoose');

const signatureSchema = new mongoose.Schema({
  signer:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  signerAddress:   { type: String, required: true, lowercase: true },
  role:            { type: String, enum: ['buyer', 'seller', 'witness', 'agent'], required: true },
  signatureHash:   { type: String, default: null },   // keccak256 of signature
  ethSignature:    { type: String, default: null },   // raw eth_sign signature
  ipfsCid:         { type: String, default: null },   // signed doc IPFS CID
  signedAt:        { type: Date,   default: null },
  txHash:          { type: String, default: null },   // on-chain sign tx
  signed:          { type: Boolean, default: false },
}, { _id: true });

const agreementSchema = new mongoose.Schema(
  {
    agreementId:   { type: Number, default: null },   // on-chain agreement ID
    title:         { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['sale', 'lease', 'escrow', 'auction_settlement', 'transfer'],
      required: true,
    },

    propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    tokenId:      { type: Number, required: true },

    // Linked modules (optional — depending on type)
    listingId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Listing',  default: null },
    escrowId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow',   default: null },
    auctionId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Auction',  default: null },

    createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Document
    templateData:     { type: mongoose.Schema.Types.Mixed, default: {} },  // JSON fields filled into template
    documentContent:  { type: String, default: null },                      // rendered HTML/Markdown
    ipfsDocumentCid:  { type: String, default: null },                      // unsigned doc on IPFS
    ipfsSignedCid:    { type: String, default: null },                      // fully-signed doc on IPFS

    // Signatories
    signatories: [signatureSchema],

    // Status
    status: {
      type: String,
      enum: ['draft', 'pending_signatures', 'partially_signed', 'fully_signed', 'on_chain', 'expired', 'voided'],
      default: 'draft',
    },

    expiresAt:     { type: Date, default: null },
    fullySignedAt: { type: Date, default: null },
    onChainAt:     { type: Date, default: null },
    createTxHash:  { type: String, default: null },
    voidReason:    { type: String, default: null },
  },
  { timestamps: true }
);

agreementSchema.index({ propertyId: 1, status: 1 });
agreementSchema.index({ 'signatories.signer': 1 });
agreementSchema.index({ agreementId: 1 });

module.exports = mongoose.model('Agreement', agreementSchema);