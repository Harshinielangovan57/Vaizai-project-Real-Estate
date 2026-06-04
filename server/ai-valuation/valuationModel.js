const mongoose = require('mongoose');

const comparableSchema = new mongoose.Schema({
  address:      { type: String },
  city:         { type: String },
  state:        { type: String },
  squareFeet:   { type: Number },
  bedrooms:     { type: Number },
  bathrooms:    { type: Number },
  soldPrice:    { type: Number },
  soldDate:     { type: String },
  pricePerSqFt: { type: Number },
  distance:     { type: Number },   // miles from subject property
  similarity:   { type: Number },   // 0–100 score
}, { _id: false });

const featureImportanceSchema = new mongoose.Schema({
  feature:    { type: String },
  importance: { type: Number },   // 0–1 weight
}, { _id: false });

const valuationSchema = new mongoose.Schema(
  {
    propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true },

    // Input snapshot
    input: {
      address:      { type: String },
      city:         { type: String },
      state:        { type: String },
      postalCode:   { type: String },
      squareFeet:   { type: Number },
      bedrooms:     { type: Number },
      bathrooms:    { type: Number },
      propertyType: { type: String },
      yearBuilt:    { type: Number },
      lotSize:      { type: Number },
    },

    // Output
    estimatedValue:  { type: Number, required: true },
    lowEstimate:     { type: Number, required: true },
    highEstimate:    { type: Number, required: true },
    confidenceScore: { type: Number, required: true },   // 0–100
    pricePerSqFt:    { type: Number, default: null },

    // Explanation
    comparables:        [comparableSchema],
    featureImportance:  [featureImportanceSchema],
    marketTrend:        { type: String, enum: ['rising', 'stable', 'declining'], default: 'stable' },
    marketSummary:      { type: String, default: null },
    aiNarrative:        { type: String, default: null },  // LLM-generated explanation

    // Model metadata
    modelVersion: { type: String, default: null },
    source:       { type: String, enum: ['internal_ml', 'openai', 'hybrid'], default: 'hybrid' },
    valuatedAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

valuationSchema.index({ propertyId: 1, valuatedAt: -1 });
valuationSchema.index({ requestedBy: 1 });

module.exports = mongoose.model('Valuation', valuationSchema);