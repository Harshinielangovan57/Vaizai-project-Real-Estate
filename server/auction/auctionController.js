const ethers    = require('ethers');
const Auction   = require('./auctionModel');
const Property  = require('../properties/propertyModel');
const User      = require('../auth/userModel');
const contracts = require('../config/contracts');
const {
  createAuctionSchema,
  placeBidSchema,
  cancelAuctionSchema,
} = require('./auctionValidation');

/* ─── Helpers ────────────────────────────────────────────────────────── */

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');

const getPlatformWallet = () =>
  new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, getProvider());

const toWei   = (eth) => ethers.parseEther(eth.toString()).toString();
const fromWei = (wei) => parseFloat(ethers.formatEther(wei.toString()));

// Auto-settle scheduler reference (cleared on cancel/settle)
const settleTimers = new Map();

const scheduleAutoSettle = (auctionDbId, endTime, io) => {
  const delay = new Date(endTime).getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(async () => {
    try {
      const auction = await Auction.findById(auctionDbId);
      if (!auction || auction.status !== 'live') return;
      await settleAuctionInternal(auction, io);
    } catch (err) {
      console.error('[AutoSettle] Error:', err.message);
    }
  }, delay);

  settleTimers.set(auctionDbId.toString(), timer);
};

// Internal settle — also called by the Socket.io route
const settleAuctionInternal = async (auction, io) => {
  const wallet = getPlatformWallet();
  const { Auction: AuctionContract } = contracts.getContracts(wallet);

  const tx      = await AuctionContract.settleAuction(auction.auctionId);
  const receipt = await tx.wait();

  // Parse AuctionSettled event
  const settledEvent = receipt.logs
    .map((log) => { try { return AuctionContract.interface.parseLog(log); } catch { return null; } })
    .find((e) => e?.name === 'AuctionSettled');

  const winnersAddress = settledEvent?.args?.winner?.toLowerCase() || null;
  const finalPriceWei  = settledEvent?.args?.amount?.toString()    || auction.highestBid;

  const winner = winnersAddress
    ? await User.findOne({ walletAddress: winnersAddress })
    : null;

  const reserveMet = auction.reservePrice
    ? BigInt(finalPriceWei) >= BigInt(auction.reservePrice)
    : true;

  auction.status        = 'settled';
  auction.settleTxHash  = receipt.hash;
  auction.winner        = winner?._id || null;
  auction.winnerAddress = winnersAddress;
  auction.finalPrice    = finalPriceWei;
  auction.finalPriceEth = fromWei(finalPriceWei);
  auction.reserveMet    = reserveMet;
  await auction.save();

  if (reserveMet && winner) {
    await Property.findByIdAndUpdate(auction.propertyId, {
      ownerAddress: winnersAddress,
      owner:        winner._id,
      forSale:      false,
      forAuction:   false,
    });
  } else {
    // Reserve not met — property stays with seller
    await Property.findByIdAndUpdate(auction.propertyId, { forAuction: false });
  }

  io?.emit('auction:settled', {
    auctionId:    auction.auctionId,
    winner:       winnersAddress,
    finalPrice:   fromWei(finalPriceWei),
    reserveMet,
  });

  settleTimers.delete(auction._id.toString());
  return receipt;
};

exports.settleAuctionInternal = settleAuctionInternal;

/* ─── GET /api/auctions ──────────────────────────────────────────────── */

exports.getAuctions = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)   || 1);
    const limit  = Math.min(50, parseInt(req.query.limit)  || 12);
    const skip   = (page - 1) * limit;
    const status = req.query.status;

    const query = {};
    if (status) query.status = status;
    else        query.status = { $in: ['scheduled', 'live'] };

    const [auctions, total] = await Promise.all([
      Auction.find(query)
        .sort({ endTime: 1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state primaryImage verified squareFeet propertyType')
        .populate('seller', 'name walletAddress')
        .populate('highestBidder', 'name walletAddress')
        .select('-bids -reservePrice')          // hide full bid history & reserve from list
        .lean(),
      Auction.countDocuments(query),
    ]);

    res.json({ auctions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/auctions/:id ──────────────────────────────────────────── */

exports.getAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('propertyId')
      .populate('seller',        'name walletAddress')
      .populate('highestBidder', 'name walletAddress')
      .populate('winner',        'name walletAddress')
      .populate('bids.bidder',   'name walletAddress');

    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    // Strip reserve price from non-sellers / non-admins
    const isSeller = auction.seller._id.toString() === req.user?.id;
    const isAdmin  = req.user?.role === 'admin';
    if (!isSeller && !isAdmin) {
      auction.reservePrice    = undefined;
      auction.reservePriceEth = undefined;
    }

    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/auctions ─────────────────────────────────────────────── */

exports.createAuction = async (req, res) => {
  try {
    const { error, value } = createAuctionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const {
      propertyId, startingPriceEth, reservePriceEth,
      minBidIncrementEth, startTime, endTime,
    } = value;

    const property = await Property.findOne({ _id: propertyId, isDeleted: false });
    if (!property)           return res.status(404).json({ message: 'Property not found' });
    if (!property.tokenized) return res.status(400).json({ message: 'Property must be tokenized' });
    if (!property.verified)  return res.status(400).json({ message: 'Property must be verified' });
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the property owner' });
    if (property.forAuction) return res.status(400).json({ message: 'Property already in an auction' });

    const seller = await User.findById(req.user.id);

    const startingPriceWei   = toWei(startingPriceEth);
    const reservePriceWei    = reservePriceEth ? toWei(reservePriceEth) : null;
    const minBidIncrementWei = toWei(minBidIncrementEth);
    const startTimestamp     = Math.floor(new Date(startTime).getTime() / 1000);
    const endTimestamp       = Math.floor(new Date(endTime).getTime()   / 1000);

    // Call Auction.createAuction() on-chain
    const wallet = getPlatformWallet();
    const { Auction: AuctionContract, PropertyNFT } = contracts.getContracts(wallet);

    // Verify NFT approval
    const auctionAddress = await AuctionContract.getAddress();
    const isApprovedAll  = await PropertyNFT.isApprovedForAll(seller.walletAddress, auctionAddress);
    const approved       = await PropertyNFT.getApproved(property.tokenId);
    if (approved.toLowerCase() !== auctionAddress.toLowerCase() && !isApprovedAll)
      return res.status(400).json({
        message: 'Auction contract not approved to transfer NFT.',
        requiresApproval: true,
        auctionAddress,
      });

    const tx = await AuctionContract.createAuction(
      property.tokenId,
      startingPriceWei,
      reservePriceWei || 0,
      minBidIncrementWei,
      startTimestamp,
      endTimestamp,
    );
    const receipt = await tx.wait();

    // Parse AuctionCreated event
    const createdEvent = receipt.logs
      .map((log) => { try { return AuctionContract.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === 'AuctionCreated');

    const auctionId = createdEvent ? Number(createdEvent.args.auctionId) : null;

    const auction = await Auction.create({
      auctionId,
      propertyId:         property._id,
      tokenId:            property.tokenId,
      seller:             seller._id,
      sellerAddress:      seller.walletAddress,
      startingPrice:      startingPriceWei,
      startingPriceEth,
      reservePrice:       reservePriceWei,
      reservePriceEth:    reservePriceEth || null,
      minBidIncrement:    minBidIncrementWei,
      minBidIncrementEth,
      startTime,
      endTime,
      status:             new Date(startTime) <= new Date() ? 'live' : 'scheduled',
      createTxHash:       receipt.hash,
    });

    // Mark property as in auction
    property.forAuction = true;
    await property.save();

    // Schedule auto-settle at endTime
    scheduleAutoSettle(auction._id, endTime, req.app.get('io'));

    res.status(201).json({ auction, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/auctions/:id/bid ─────────────────────────────────────── */

exports.placeBid = async (req, res) => {
  try {
    const { error, value } = placeBidSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { amountEth, txHash } = value;

    const auction = await Auction.findById(req.params.id);
    if (!auction)                return res.status(404).json({ message: 'Auction not found' });
    if (auction.status !== 'live') return res.status(400).json({ message: 'Auction is not live' });
    if (new Date() > new Date(auction.endTime))
      return res.status(400).json({ message: 'Auction has ended' });
    if (auction.seller.toString() === req.user.id)
      return res.status(400).json({ message: 'Seller cannot bid on their own auction' });

    const bidder = await User.findById(req.user.id);
    const amountWei = toWei(amountEth);

    // Validate bid is above current highest + increment
    const minRequired = BigInt(auction.highestBid) + BigInt(auction.minBidIncrement);
    if (BigInt(amountWei) < minRequired)
      return res.status(400).json({
        message: `Bid must be at least ${fromWei(minRequired.toString())} ETH`,
        minRequired: fromWei(minRequired.toString()),
      });

    // Verify tx on-chain (bid tx must already be submitted by frontend via MetaMask)
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1)
      return res.status(400).json({ message: 'Bid transaction not confirmed or failed' });

    // Anti-sniping: extend by 10 minutes if bid placed in last 10 minutes
    const ANTI_SNIPE_WINDOW  = 10 * 60 * 1000;  // 10 min ms
    const EXTENSION_DURATION = 10 * 60 * 1000;
    const timeLeft = new Date(auction.endTime).getTime() - Date.now();

    if (timeLeft < ANTI_SNIPE_WINDOW) {
      const newEndTime = new Date(new Date(auction.endTime).getTime() + EXTENSION_DURATION);
      auction.endTime        = newEndTime;
      auction.extended       = true;
      auction.extensionCount += 1;

      // Update on-chain end time
      const wallet = getPlatformWallet();
      const { Auction: AuctionContract } = contracts.getContracts(wallet);
      const extTx = await AuctionContract.extendAuction(
        auction.auctionId,
        Math.floor(newEndTime.getTime() / 1000)
      );
      await extTx.wait();

      // Reschedule auto-settle
      const existing = settleTimers.get(auction._id.toString());
      if (existing) clearTimeout(existing);
      scheduleAutoSettle(auction._id, newEndTime, req.app.get('io'));

      req.app.get('io')?.emit('auction:extended', {
        auctionId:  auction.auctionId,
        newEndTime,
        extensionCount: auction.extensionCount,
      });
    }

    // Record bid
    auction.bids.push({
      bidder:        req.user.id,
      bidderAddress: bidder.walletAddress,
      amount:        amountWei,
      amountEth,
      txHash,
    });

    auction.highestBid            = amountWei;
    auction.highestBidEth         = amountEth;
    auction.highestBidder         = req.user.id;
    auction.highestBidderAddress  = bidder.walletAddress;

    // Check reserve
    if (auction.reservePrice && BigInt(amountWei) >= BigInt(auction.reservePrice))
      auction.reserveMet = true;

    await auction.save();

    // Emit real-time update to all connected clients
    req.app.get('io')?.emit('auction:bid', {
      auctionId:     auction.auctionId,
      amountEth,
      bidderAddress: bidder.walletAddress,
      reserveMet:    auction.reserveMet,
      endTime:       auction.endTime,
    });

    res.status(201).json({
      message:    'Bid placed',
      amountEth,
      reserveMet: auction.reserveMet,
      endTime:    auction.endTime,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/auctions/:id/settle ──────────────────────────────────── */

exports.settleAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    const isSeller = auction.seller.toString() === req.user.id;
    const isAdmin  = req.user.role === 'admin';
    if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    if (auction.status === 'settled')   return res.status(400).json({ message: 'Already settled' });
    if (auction.status === 'cancelled') return res.status(400).json({ message: 'Auction cancelled' });
    if (new Date() < new Date(auction.endTime) && !isAdmin)
      return res.status(400).json({ message: 'Auction has not ended yet' });

    const receipt = await settleAuctionInternal(auction, req.app.get('io'));
    res.json({ message: 'Auction settled', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/auctions/:id/cancel ──────────────────────────────────── */

exports.cancelAuction = async (req, res) => {
  try {
    const { error, value } = cancelAuctionSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    const isSeller = auction.seller.toString() === req.user.id;
    const isAdmin  = req.user.role === 'admin';
    if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    if (!['scheduled', 'live'].includes(auction.status))
      return res.status(400).json({ message: 'Auction cannot be cancelled in its current state' });

    // Seller can only cancel before any bids; admin can cancel at any time
    if (isSeller && !isAdmin && auction.bids.length > 0)
      return res.status(400).json({ message: 'Cannot cancel after bids have been placed' });

    const wallet = getPlatformWallet();
    const { Auction: AuctionContract } = contracts.getContracts(wallet);

    const tx      = await AuctionContract.cancelAuction(auction.auctionId);
    const receipt = await tx.wait();

    auction.status       = 'cancelled';
    auction.cancelTxHash = receipt.hash;
    await auction.save();

    await Property.findByIdAndUpdate(auction.propertyId, { forAuction: false });

    // Clear scheduled auto-settle
    const timer = settleTimers.get(auction._id.toString());
    if (timer) { clearTimeout(timer); settleTimers.delete(auction._id.toString()); }

    req.app.get('io')?.emit('auction:cancelled', { auctionId: auction.auctionId });

    res.json({ message: 'Auction cancelled', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/auctions/:id/withdraw ────────────────────────────────── */
// Losing bidders withdraw their outbid funds from the contract

exports.withdrawBid = async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) return res.status(400).json({ message: 'txHash required' });

    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    if (!['ended', 'settled'].includes(auction.status))
      return res.status(400).json({ message: 'Can only withdraw after auction ends' });

    // Find the bidder's most recent non-withdrawn bid
    const bid = [...auction.bids]
      .reverse()
      .find((b) => b.bidder.toString() === req.user.id && !b.withdrawn);

    if (!bid) return res.status(404).json({ message: 'No withdrawable bid found' });

    // Verify withdraw tx on-chain
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1)
      return res.status(400).json({ message: 'Withdrawal transaction not confirmed' });

    bid.withdrawn      = true;
    bid.withdrawTxHash = txHash;
    await auction.save();

    res.json({ message: 'Bid withdrawn', amountEth: bid.amountEth, txHash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/auctions/:id/bids ─────────────────────────────────────── */

exports.getBidHistory = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id)
      .populate('bids.bidder', 'name walletAddress')
      .select('bids auctionId status');

    if (!auction) return res.status(404).json({ message: 'Auction not found' });

    // Return bids sorted latest first, omit wei amounts for cleanliness
    const bids = [...auction.bids]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(({ bidder, bidderAddress, amountEth, txHash, timestamp, withdrawn }) => ({
        bidder, bidderAddress, amountEth, txHash, timestamp, withdrawn,
      }));

    res.json({ auctionId: auction.auctionId, status: auction.status, bids });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};