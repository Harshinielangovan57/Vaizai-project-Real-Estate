// // models/Property.js
// const mongoose = require('mongoose');

// const propertySchema = new mongoose.Schema(
//   {
//     // ── Off-chain metadata ──────────────────────────────────────────────────
//     title:        { type: String, required: true, trim: true },
//     description:  { type: String, trim: true },
//     address:      { type: String, required: true },
//     city:         { type: String, required: true },
//     state:        { type: String, required: true },
//     country:      { type: String, default: 'US' },
//     squareFeet:   { type: Number, required: true },
//     bedrooms:     { type: Number, default: 0 },
//     bathrooms:    { type: Number, default: 0 },
//     yearBuilt:    { type: Number },
//     lotSize:      { type: Number },
//     propertyType: {
//       type: String,
//       enum: ['residential', 'commercial', 'land', 'industrial'],
//       required: true,
//     },
//     askingPrice: { type: Number, required: true }, // in USD

//     // ── Images & tour ───────────────────────────────────────────────────────
//     images:         [{ type: String }],  // IPFS gateway URLs
//     primaryImage:   { type: String },    // primary IPFS gateway URL
//     virtualTourUrl: { type: String },    // Matterport / Three.js 360 IPFS URL

//     // ── IPFS metadata (added for 5.3 flow) ─────────────────────────────────
//     // Raw IPFS CIDs and URIs stored separately from gateway URLs so the
//     // frontend can build any gateway URL it needs without hitting the backend.
//     imageCids: [
//       {
//         filename:   { type: String },
//         cid:        { type: String },          // raw CID
//         ipfsUri:    { type: String },          // ipfs://
//         gatewayUrl: { type: String },          // https://gateway.pinata.cloud/...
//         _id: false,
//       },
//     ],
//     metadataCid:        { type: String, default: null }, // raw CID of ERC-721 JSON
//     metadataGatewayUrl: { type: String, default: null }, // https gateway URL for metadata

//     // ── Owner ───────────────────────────────────────────────────────────────
//     ownerAddress: { type: String, required: true, lowercase: true },
//     owner:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

//     // ── AI valuation ────────────────────────────────────────────────────────
//     aiValuation:      { type: Number, default: null },
//     aiValuationRange: { low: Number, high: Number },
//     aiComparables:    [mongoose.Schema.Types.Mixed],
//     aiValuatedAt:     { type: Date, default: null },

//     // ── Blockchain ──────────────────────────────────────────────────────────
//     tokenId:         { type: Number, default: null },
//     contractAddress: { type: String, default: null },
//     ipfsMetadataUri: { type: String, default: null }, // ipfs:// URI passed to mintProperty()
//     tokenized:       { type: Boolean, default: false },
//     mintTxHash:      { type: String, default: null },  // tx hash of the mint transaction

//     // ── Status ──────────────────────────────────────────────────────────────
//     verified:   { type: Boolean, default: false },
//     forSale:    { type: Boolean, default: false },
//     forAuction: { type: Boolean, default: false },
//     isDeleted:  { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// // Text index for search
// propertySchema.index({ title: 'text', description: 'text', address: 'text' });

// // Common query indexes
// propertySchema.index({ ownerAddress: 1 });
// propertySchema.index({ city: 1, propertyType: 1 });
// propertySchema.index({ verified: 1, forSale: 1 });
// propertySchema.index({ tokenId: 1 });

// module.exports = mongoose.model('Property', propertySchema);
