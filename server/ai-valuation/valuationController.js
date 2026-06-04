const Valuation  = require('./valuationModel');
const Property   = require('../properties/propertyModel');
const valuationService = require('./valuationService');
const {
  valuationRequestSchema,
  comparablesRequestSchema,
} = require('./valuationValidation');

const COOLDOWN_DAYS = 30;

/* ─── POST /api/valuation ────────────────────────────────────────────── */

exports.requestValuation = async (req, res) => {
  try {
    const { error, value } = valuationRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const property = await Property.findOne({ _id: value.propertyId, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // Ownership check — only owner or admin
    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: 'Only the property owner can request a valuation' });

    // 30-day cooldown
    if (property.aiValuatedAt) {
      const daysSince = (Date.now() - new Date(property.aiValuatedAt)) / (1000 * 60 * 60 * 24);
      if (daysSince < COOLDOWN_DAYS && !isAdmin) {
        return res.status(429).json({
          message: `Re-valuation available in ${Math.ceil(COOLDOWN_DAYS - daysSince)} days`,
          nextAvailableAt: new Date(
            new Date(property.aiValuatedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
          ),
        });
      }
    }

    const input = {
      address:      property.address,
      city:         value.city,
      state:        value.state,
      postalCode:   value.postalCode   || null,
      squareFeet:   value.squareFeet,
      bedrooms:     value.bedrooms,
      bathrooms:    value.bathrooms,
      propertyType: value.propertyType,
      yearBuilt:    value.yearBuilt    || null,
      lotSize:      value.lotSize      || null,
    };

    // Run hybrid valuation (ML + GPT-4o narrative)
    const result = await valuationService.runValuation(input);

    // Persist valuation record
    const valuation = await Valuation.create({
      propertyId:        property._id,
      requestedBy:       req.user.id,
      input,
      estimatedValue:    result.estimatedValue,
      lowEstimate:       result.lowEstimate,
      highEstimate:      result.highEstimate,
      confidenceScore:   result.confidenceScore,
      pricePerSqFt:      result.pricePerSqFt,
      comparables:       result.comparables,
      featureImportance: result.featureImportance,
      marketTrend:       result.marketTrend,
      marketSummary:     result.marketSummary,
      aiNarrative:       result.aiNarrative,
      modelVersion:      result.modelVersion,
      source:            result.source,
    });

    // Update property with latest valuation snapshot
    property.aiValuation      = result.estimatedValue;
    property.aiValuationRange = { low: result.lowEstimate, high: result.highEstimate };
    property.aiComparables    = result.comparables;
    property.aiValuatedAt     = new Date();
    await property.save();

    res.status(201).json({ valuation });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/valuation/property/:propertyId ────────────────────────── */
// Full valuation history for a property

exports.getValuationHistory = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.propertyId, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: 'Access denied' });

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const [valuations, total] = await Promise.all([
      Valuation.find({ propertyId: property._id })
        .sort({ valuatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('requestedBy', 'name walletAddress')
        .lean(),
      Valuation.countDocuments({ propertyId: property._id }),
    ]);

    res.json({ valuations, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/valuation/:id ─────────────────────────────────────────── */

exports.getValuation = async (req, res) => {
  try {
    const valuation = await Valuation.findById(req.params.id)
      .populate('propertyId',  'title city state address squareFeet tokenId primaryImage')
      .populate('requestedBy', 'name walletAddress');

    if (!valuation) return res.status(404).json({ message: 'Valuation not found' });

    const property = await Property.findById(valuation.propertyId);
    const isOwner  = property?.owner.toString() === req.user.id;
    const isAdmin  = req.user.role === 'admin';
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: 'Access denied' });

    res.json(valuation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/valuation/comparables ────────────────────────────────── */

exports.getComparables = async (req, res) => {
  try {
    const { error, value } = comparablesRequestSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const comparables = await valuationService.fetchComparables(value);
    res.json({ comparables });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/valuation/market-trend ────────────────────────────────── */

exports.getMarketTrend = async (req, res) => {
  try {
    const { city, state } = req.query;
    if (!city || !state)
      return res.status(400).json({ message: 'city and state query params required' });

    const trend = await valuationService.getMarketTrend(city, state);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/valuation/stats (admin) ───────────────────────────────── */

exports.getValuationStats = async (req, res) => {
  try {
    const [totalCount, avgConfidence, bySource, byTrend, recent] = await Promise.all([
      Valuation.countDocuments(),
      Valuation.aggregate([
        { $group: { _id: null, avg: { $avg: '$confidenceScore' } } },
      ]),
      Valuation.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Valuation.aggregate([
        { $group: { _id: '$marketTrend', count: { $sum: 1 } } },
      ]),
      Valuation.find()
        .sort({ valuatedAt: -1 })
        .limit(5)
        .populate('propertyId', 'title city')
        .populate('requestedBy', 'name')
        .select('estimatedValue confidenceScore marketTrend source valuatedAt')
        .lean(),
    ]);

    res.json({
      totalValuations:    totalCount,
      avgConfidenceScore: Math.round(avgConfidence[0]?.avg || 0),
      bySource:           Object.fromEntries(bySource.map((b) => [b._id, b.count])),
      byMarketTrend:      Object.fromEntries(byTrend.map((b) => [b._id, b.count])),
      recentValuations:   recent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};