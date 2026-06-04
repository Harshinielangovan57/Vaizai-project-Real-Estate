const ethers     = require('ethers');
const mongoose   = require('mongoose');
const User       = require('../auth/userModel');
const Property   = require('../properties/propertyModel');
const Listing    = require('../marketplace/listingModel');
const Escrow     = require('../escrow/escrowModel');
const Auction    = require('../auction/auctionModel');
const Agreement  = require('../agreements/agreementModel');
const Valuation  = require('../ai-valuation/valuationModel');
const contracts  = require('../config/contracts');
const {
  updateUserRoleSchema,
  updateKycSchema,
  suspendUserSchema,
  platformFeeSchema,
  broadcastSchema,
  dateRangeSchema,
} = require('./adminValidation');

/* ─── Helpers ────────────────────────────────────────────────────────── */

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');

const getPlatformWallet = () =>
  new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, getProvider());

const paginate = (req) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

/* ══════════════════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/dashboard ───────────────────────────────────────── */

exports.getDashboard = async (req, res) => {
  try {
    const now       = new Date();
    const thirtyAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sevenAgo  = new Date(now - 7  * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisWeek,
      pendingKyc,
      suspendedUsers,

      totalProperties,
      verifiedProperties,
      tokenizedProperties,
      pendingVerification,

      activeListings,
      totalSales,
      salesLast30Days,

      activeEscrows,
      disputedEscrows,

      liveAuctions,
      settledAuctions,

      totalAgreements,
      onChainAgreements,

      totalValuations,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenAgo } }),
      User.countDocuments({ kycStatus: 'pending' }),
      User.countDocuments({ isSuspended: true }),

      Property.countDocuments({ isDeleted: false }),
      Property.countDocuments({ verified: true,    isDeleted: false }),
      Property.countDocuments({ tokenized: true,   isDeleted: false }),
      Property.countDocuments({ verified: false, tokenized: true, isDeleted: false }),

      Listing.countDocuments({ active: true }),
      Listing.countDocuments({ active: false, soldAt: { $exists: true } }),
      Listing.countDocuments({ soldAt: { $gte: thirtyAgo } }),

      Escrow.countDocuments({ status: { $in: ['funded', 'in_progress'] } }),
      Escrow.countDocuments({ status: 'disputed' }),

      Auction.countDocuments({ status: 'live' }),
      Auction.countDocuments({ status: 'settled' }),

      Agreement.countDocuments(),
      Agreement.countDocuments({ status: 'on_chain' }),

      Valuation.countDocuments(),
    ]);

    // Revenue — sum of all completed listing sales (priceEth)
    const revenueAgg = await Listing.aggregate([
      { $match: { active: false, soldAt: { $exists: true } } },
      { $group: { _id: null, totalEth: { $sum: '$priceEth' }, totalUsd: { $sum: '$priceUsd' } } },
    ]);
    const revenue = revenueAgg[0] || { totalEth: 0, totalUsd: 0 };

    // Revenue last 30 days
    const recentRevenueAgg = await Listing.aggregate([
      { $match: { soldAt: { $gte: thirtyAgo } } },
      { $group: { _id: null, totalEth: { $sum: '$priceEth' }, totalUsd: { $sum: '$priceUsd' } } },
    ]);
    const recentRevenue = recentRevenueAgg[0] || { totalEth: 0, totalUsd: 0 };

    // Sales by payment method
    const paymentMethodAgg = await Listing.aggregate([
      { $match: { soldAt: { $exists: true } } },
      { $group: { _id: '$paymentMethod', count: { $sum: 1 } } },
    ]);
    const byPaymentMethod = Object.fromEntries(
      paymentMethodAgg.map((p) => [p._id || 'unknown', p.count])
    );

    // User registrations last 30 days — daily breakdown
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Property type breakdown
    const propertyTypeAgg = await Property.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$propertyType', count: { $sum: 1 } } },
    ]);
    const byPropertyType = Object.fromEntries(
      propertyTypeAgg.map((p) => [p._id, p.count])
    );

    res.json({
      users: {
        total:           totalUsers,
        newThisWeek:     newUsersThisWeek,
        pendingKyc,
        suspended:       suspendedUsers,
      },
      properties: {
        total:           totalProperties,
        verified:        verifiedProperties,
        tokenized:       tokenizedProperties,
        pendingVerification,
        byType:          byPropertyType,
      },
      marketplace: {
        activeListings,
        totalSales,
        salesLast30Days,
        byPaymentMethod,
      },
      escrow: {
        active:   activeEscrows,
        disputed: disputedEscrows,
      },
      auctions: {
        live:     liveAuctions,
        settled:  settledAuctions,
      },
      agreements: {
        total:   totalAgreements,
        onChain: onChainAgreements,
      },
      valuations: {
        total: totalValuations,
      },
      revenue: {
        allTimeEth:   Math.round(revenue.totalEth     * 100) / 100,
        allTimeUsd:   Math.round(revenue.totalUsd     || 0),
        last30DaysEth:Math.round(recentRevenue.totalEth * 100) / 100,
        last30DaysUsd:Math.round(recentRevenue.totalUsd || 0),
      },
      charts: {
        userGrowthLast30Days: userGrowth,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   USER MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/users ───────────────────────────────────────────── */

exports.getUsers = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const query = {};

    if (req.query.role)      query.role      = req.query.role;
    if (req.query.kycStatus) query.kycStatus = req.query.kycStatus;
    if (req.query.suspended) query.isSuspended = req.query.suspended === 'true';
    if (req.query.search) {
      query.$or = [
        { name:          new RegExp(req.query.search, 'i') },
        { email:         new RegExp(req.query.search, 'i') },
        { walletAddress: new RegExp(req.query.search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash -refreshToken')
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/admin/users/:id ───────────────────────────────────────── */

exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash -refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Attach summary counts
    const [properties, listings, escrows, auctions] = await Promise.all([
      Property.countDocuments({ owner: user._id, isDeleted: false }),
      Listing.countDocuments({ seller: user._id }),
      Escrow.countDocuments({ $or: [{ buyer: user._id }, { seller: user._id }] }),
      Auction.countDocuments({ seller: user._id }),
    ]);

    res.json({ user, activity: { properties, listings, escrows, auctions } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/users/:id/role ──────────────────────────────────── */

exports.updateUserRole = async (req, res) => {
  try {
    const { error, value } = updateUserRoleSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'Cannot change your own role' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: value.role },
      { new: true }
    ).select('-passwordHash -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Role updated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/users/:id/kyc ───────────────────────────────────── */

exports.updateKyc = async (req, res) => {
  try {
    const { error, value } = updateKycSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { kycStatus: value.kycStatus },
      { new: true }
    ).select('-passwordHash -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });

    // If approved and was not a seller, auto-promote to seller
    if (value.kycStatus === 'approved' && user.role === 'user') {
      user.role = 'seller';
      await user.save();
    }

    req.app.get('io')?.to(user._id.toString()).emit('kyc:updated', {
      kycStatus: value.kycStatus,
      note:      value.kycNote || null,
    });

    res.json({ message: 'KYC status updated', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/users/:id/suspend ───────────────────────────────── */

exports.suspendUser = async (req, res) => {
  try {
    const { error, value } = suspendUserSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    if (req.params.id === req.user.id)
      return res.status(400).json({ message: 'Cannot suspend yourself' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: true, refreshToken: null },
      { new: true }
    ).select('-passwordHash -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });

    req.app.get('io')?.to(user._id.toString()).emit('account:suspended', { reason: value.reason });

    res.json({ message: 'User suspended', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/users/:id/unsuspend ─────────────────────────────── */

exports.unsuspendUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: false },
      { new: true }
    ).select('-passwordHash -refreshToken');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User unsuspended', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PROPERTY MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/properties ──────────────────────────────────────── */

exports.getProperties = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);
    const query = { isDeleted: false };

    if (req.query.verified  !== undefined) query.verified  = req.query.verified  === 'true';
    if (req.query.tokenized !== undefined) query.tokenized = req.query.tokenized === 'true';
    if (req.query.propertyType) query.propertyType = req.query.propertyType;
    if (req.query.search) query.$text = { $search: req.query.search };

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name email walletAddress kycStatus')
        .lean(),
      Property.countDocuments(query),
    ]);

    res.json({ properties, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/properties/:id/verify ───────────────────────────── */
// Re-exported from propertyController for admin convenience
exports.verifyProperty = require('../properties/propertyController').verifyProperty;

/* ─── DELETE /api/admin/properties/:id ───────────────────────────────── */

exports.forceDeleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    property.isDeleted = true;
    await property.save();

    // Deactivate any open listings
    await Listing.updateMany({ propertyId: property._id, active: true }, { active: false });

    res.json({ message: 'Property force-deleted by admin' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   TRANSACTION LOGS
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/transactions ────────────────────────────────────── */

exports.getTransactions = async (req, res) => {
  try {
    const { error, value } = dateRangeSchema.validate(req.query, { allowUnknown: true });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { from, to, page, limit } = value;
    const skip = (page - 1) * limit;

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const listingQuery = { soldAt: { $exists: true } };
    if (from || to) listingQuery.soldAt = dateFilter;

    const [sales, total] = await Promise.all([
      Listing.find(listingQuery)
        .sort({ soldAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state tokenId')
        .populate('seller',     'name walletAddress')
        .populate('buyer',      'name walletAddress')
        .lean(),
      Listing.countDocuments(listingQuery),
    ]);

    res.json({ transactions: sales, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   DISPUTE MANAGEMENT
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/disputes ────────────────────────────────────────── */

exports.getDisputes = async (req, res) => {
  try {
    const { page, limit, skip } = paginate(req);

    const [escrows, total] = await Promise.all([
      Escrow.find({ status: 'disputed' })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state tokenId primaryImage')
        .populate('buyer',      'name walletAddress email')
        .populate('seller',     'name walletAddress email')
        .populate('dispute.raisedBy', 'name walletAddress')
        .lean(),
      Escrow.countDocuments({ status: 'disputed' }),
    ]);

    res.json({ disputes: escrows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Re-export resolve from escrow controller
exports.resolveDispute = require('../escrow/escrowController').resolveDispute;

/* ══════════════════════════════════════════════════════════════════════
   PLATFORM SETTINGS
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/settings ────────────────────────────────────────── */

exports.getSettings = async (req, res) => {
  try {
    const provider = getProvider();
    const { Marketplace, Escrow: EscrowContract, Auction: AuctionContract } =
      contracts.getContracts(provider);

    const [
      marketplaceFee,
      escrowFee,
      auctionFee,
      marketplacePaused,
    ] = await Promise.all([
      Marketplace.platformFeePercent().catch(() => null),
      EscrowContract.platformFeePercent().catch(() => null),
      AuctionContract.platformFeePercent().catch(() => null),
      Marketplace.paused().catch(() => false),
    ]);

    res.json({
      marketplace: {
        feePercent: marketplaceFee ? Number(marketplaceFee) : null,
        paused:     marketplacePaused,
      },
      escrow: {
        feePercent: escrowFee ? Number(escrowFee) : null,
      },
      auction: {
        feePercent: auctionFee ? Number(auctionFee) : null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/settings/marketplace-fee ───────────────────────── */

exports.updateMarketplaceFee = async (req, res) => {
  try {
    const { error, value } = platformFeeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const wallet = getPlatformWallet();
    const { Marketplace } = contracts.getContracts(wallet);

    const tx      = await Marketplace.setPlatformFee(value.feePercent);
    const receipt = await tx.wait();

    res.json({ message: 'Marketplace fee updated', feePercent: value.feePercent, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/settings/escrow-fee ─────────────────────────────── */

exports.updateEscrowFee = async (req, res) => {
  try {
    const { error, value } = platformFeeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    const tx      = await EscrowContract.setPlatformFee(value.feePercent);
    const receipt = await tx.wait();

    res.json({ message: 'Escrow fee updated', feePercent: value.feePercent, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/settings/auction-fee ───────────────────────────── */

exports.updateAuctionFee = async (req, res) => {
  try {
    const { error, value } = platformFeeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const wallet = getPlatformWallet();
    const { Auction: AuctionContract } = contracts.getContracts(wallet);

    const tx      = await AuctionContract.setPlatformFee(value.feePercent);
    const receipt = await tx.wait();

    res.json({ message: 'Auction fee updated', feePercent: value.feePercent, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/settings/pause ──────────────────────────────────── */

exports.pauseMarketplace = async (req, res) => {
  try {
    const wallet = getPlatformWallet();
    const { Marketplace } = contracts.getContracts(wallet);

    const tx      = await Marketplace.pause();
    const receipt = await tx.wait();

    res.json({ message: 'Marketplace paused', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/admin/settings/unpause ────────────────────────────────── */

exports.unpauseMarketplace = async (req, res) => {
  try {
    const wallet = getPlatformWallet();
    const { Marketplace } = contracts.getContracts(wallet);

    const tx      = await Marketplace.unpause();
    const receipt = await tx.wait();

    res.json({ message: 'Marketplace unpaused', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   ANALYTICS
══════════════════════════════════════════════════════════════════════ */

/* ─── GET /api/admin/analytics/sales ────────────────────────────────── */

exports.getSalesAnalytics = async (req, res) => {
  try {
    const days  = Math.min(365, parseInt(req.query.days) || 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [dailySales, topCities, topSellers, avgPrices] = await Promise.all([
      // Daily sales volume
      Listing.aggregate([
        { $match: { soldAt: { $gte: since } } },
        {
          $group: {
            _id:      { $dateToString: { format: '%Y-%m-%d', date: '$soldAt' } },
            count:    { $sum: 1 },
            totalEth: { $sum: '$priceEth' },
            totalUsd: { $sum: '$priceUsd' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // Top cities by sales
      Listing.aggregate([
        { $match: { soldAt: { $gte: since } } },
        {
          $lookup: {
            from:         'properties',
            localField:   'propertyId',
            foreignField: '_id',
            as:           'property',
          },
        },
        { $unwind: '$property' },
        {
          $group: {
            _id:      '$property.city',
            count:    { $sum: 1 },
            totalEth: { $sum: '$priceEth' },
          },
        },
        { $sort: { totalEth: -1 } },
        { $limit: 10 },
      ]),

      // Top sellers by volume
      Listing.aggregate([
        { $match: { soldAt: { $gte: since } } },
        {
          $group: {
            _id:      '$seller',
            count:    { $sum: 1 },
            totalEth: { $sum: '$priceEth' },
          },
        },
        { $sort: { totalEth: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from:         'users',
            localField:   '_id',
            foreignField: '_id',
            as:           'seller',
          },
        },
        { $unwind: '$seller' },
        {
          $project: {
            count: 1,
            totalEth: 1,
            'seller.name':          1,
            'seller.walletAddress': 1,
          },
        },
      ]),

      // Average price by property type
      Listing.aggregate([
        { $match: { soldAt: { $gte: since } } },
        {
          $lookup: {
            from:         'properties',
            localField:   'propertyId',
            foreignField: '_id',
            as:           'property',
          },
        },
        { $unwind: '$property' },
        {
          $group: {
            _id:     '$property.propertyType',
            avgEth:  { $avg: '$priceEth' },
            avgUsd:  { $avg: '$priceUsd' },
            count:   { $sum: 1 },
          },
        },
      ]),
    ]);

    res.json({ days, dailySales, topCities, topSellers, avgPriceByType: avgPrices });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/admin/analytics/users ────────────────────────────────── */

exports.getUserAnalytics = async (req, res) => {
  try {
    const days  = Math.min(365, parseInt(req.query.days) || 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [dailySignups, byRole, byKyc, walletVsEmail] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),

      User.aggregate([
        { $group: { _id: '$kycStatus', count: { $sum: 1 } } },
      ]),

      User.aggregate([
        {
          $group: {
            _id:   null,
            walletOnly: {
              $sum: { $cond: [{ $and: [{ $ifNull: ['$walletAddress', false] }, { $not: { $ifNull: ['$email', false] } }] }, 1, 0] },
            },
            emailOnly: {
              $sum: { $cond: [{ $and: [{ $ifNull: ['$email', false] }, { $not: { $ifNull: ['$walletAddress', false] } }] }, 1, 0] },
            },
            both: {
              $sum: { $cond: [{ $and: [{ $ifNull: ['$walletAddress', false] }, { $ifNull: ['$email', false] }] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.json({
      days,
      dailySignups,
      byRole:        Object.fromEntries(byRole.map((r) => [r._id, r.count])),
      byKycStatus:   Object.fromEntries(byKyc.map((k) => [k._id, k.count])),
      authMethod:    walletVsEmail[0] || { walletOnly: 0, emailOnly: 0, both: 0 },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/admin/analytics/blockchain ────────────────────────────── */

exports.getBlockchainAnalytics = async (req, res) => {
  try {
    const provider = getProvider();
    const { Marketplace, Escrow: EscrowContract, Auction: AuctionContract, PropertyNFT } =
      contracts.getContracts(provider);

    const [
      totalMinted,
      totalVerifiedOnChain,
      marketplaceBalance,
      escrowBalance,
      auctionBalance,
    ] = await Promise.all([
      PropertyNFT.totalSupply().catch(() => null),
      PropertyNFT.totalVerified?.().catch(() => null),
      provider.getBalance(await Marketplace.getAddress()).catch(() => null),
      provider.getBalance(await EscrowContract.getAddress()).catch(() => null),
      provider.getBalance(await AuctionContract.getAddress()).catch(() => null),
    ]);

    res.json({
      nft: {
        totalMinted:   totalMinted   ? Number(totalMinted)        : null,
        totalVerified: totalVerifiedOnChain ? Number(totalVerifiedOnChain) : null,
      },
      contractBalances: {
        marketplaceEth: marketplaceBalance ? parseFloat(ethers.formatEther(marketplaceBalance)) : null,
        escrowEth:      escrowBalance      ? parseFloat(ethers.formatEther(escrowBalance))      : null,
        auctionEth:     auctionBalance     ? parseFloat(ethers.formatEther(auctionBalance))     : null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PLATFORM UTILITIES
══════════════════════════════════════════════════════════════════════ */

/* ─── POST /api/admin/broadcast ──────────────────────────────────────── */

exports.broadcastMessage = async (req, res) => {
  try {
    const { error, value } = broadcastSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    req.app.get('io')?.emit(value.event, {
      ...value.payload,
      _broadcast: true,
      _timestamp: new Date().toISOString(),
    });

    res.json({ message: `Broadcast sent: ${value.event}`, payload: value.payload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/admin/withdraw-platform-fees ─────────────────────────── */

exports.withdrawPlatformFees = async (req, res) => {
  try {
    const { contract } = req.body;
    if (!['marketplace', 'escrow', 'auction'].includes(contract))
      return res.status(400).json({ message: 'contract must be marketplace, escrow, or auction' });

    const wallet = getPlatformWallet();
    const allContracts = contracts.getContracts(wallet);

    const contractMap = {
      marketplace: allContracts.Marketplace,
      escrow:      allContracts.Escrow,
      auction:     allContracts.Auction,
    };

    const target  = contractMap[contract];
    const tx      = await target.withdrawFees();
    const receipt = await tx.wait();

    res.json({ message: `${contract} fees withdrawn`, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};