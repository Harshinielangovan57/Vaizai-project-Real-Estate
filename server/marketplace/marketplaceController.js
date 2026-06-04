const ethers   = require('ethers');
const axios    = require('axios');
// ✅ Fix — initialize only when first used
let _stripe = null;
const getStripe = () => {
  if (!_stripe) _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return _stripe;
};
const Listing  = require('./listingModel');
const Property = require('../properties/propertyModel');
const User     = require('../auth/userModel');
const contracts= require('../config/contracts');
const { createListingSchema, updatePriceSchema, fiatBuySchema } = require('./marketplaceValidation');

/* ─── Helpers ────────────────────────────────────────────────────────── */

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');

const getPlatformWallet = () =>
  new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, getProvider());

// Fetch live ETH/USD rate (CoinGecko free tier)
const getEthUsdRate = async () => {
  try {
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { timeout: 4000 }
    );
    return data?.ethereum?.usd || null;
  } catch {
    return null; // non-fatal — USD field just stays null
  }
};

/* ─── GET /api/marketplace ───────────────────────────────────────────── */

exports.getListings = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 12);
    const skip  = (page - 1) * limit;

    const query = { active: true };

    const [listings, total] = await Promise.all([
      Listing.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state primaryImage verified propertyType squareFeet')
        .populate('seller', 'name walletAddress')
        .lean(),
      Listing.countDocuments(query),
    ]);

    res.json({
      listings,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/marketplace/:listingId ────────────────────────────────── */

exports.getListing = async (req, res) => {
  try {
    const listing = await Listing.findOne({ _id: req.params.listingId })
      .populate('propertyId')
      .populate('seller', 'name walletAddress email');

    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    res.json(listing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/marketplace ──────────────────────────────────────────── */

exports.createListing = async (req, res) => {
  try {
    const { error, value } = createListingSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { propertyId, priceEth } = value;

    // Fetch property and verify ownership + status
    const property = await Property.findOne({ _id: propertyId, isDeleted: false });
    if (!property)      return res.status(404).json({ message: 'Property not found' });
    if (!property.tokenized) return res.status(400).json({ message: 'Property must be tokenized first' });
    if (!property.verified)  return res.status(400).json({ message: 'Property must be verified before listing' });
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the property owner' });

    const user = await User.findById(req.user.id);

    // Convert ETH to wei
    const priceWei = ethers.parseEther(priceEth.toString()).toString();

    // Call Marketplace.listProperty() on-chain
    const wallet = getPlatformWallet();
    const { Marketplace, PropertyNFT } = contracts.getContracts(wallet);

    // Check NFT approval — seller must have approved the Marketplace contract
    const marketplaceAddress = await Marketplace.getAddress();
    const approved = await PropertyNFT.getApproved(property.tokenId);
    const isApprovedAll = await PropertyNFT.isApprovedForAll(user.walletAddress, marketplaceAddress);

    if (approved.toLowerCase() !== marketplaceAddress.toLowerCase() && !isApprovedAll) {
      return res.status(400).json({
        message: 'Marketplace contract not approved to transfer NFT. Approve from frontend first.',
        requiresApproval: true,
        marketplaceAddress,
      });
    }

    const tx      = await Marketplace.listProperty(property.tokenId, priceWei);
    const receipt = await tx.wait();

    // Parse Listed event to get on-chain listingId
    const listedEvent = receipt.logs
      .map((log) => { try { return Marketplace.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === 'Listed');

    const listingId = listedEvent ? Number(listedEvent.args.listingId) : null;

    // Get USD price
    const ethUsdRate = await getEthUsdRate();
    const priceUsd   = ethUsdRate ? Math.round(priceEth * ethUsdRate) : null;

    const listing = await Listing.create({
      listingId,
      propertyId: property._id,
      tokenId:    property.tokenId,
      seller:     req.user.id,
      sellerAddress: user.walletAddress,
      price:      priceWei,
      priceEth,
      priceUsd,
      txHash:     receipt.hash,
    });

    // Mark property as for sale
    property.forSale = true;
    await property.save();

    res.status(201).json({ listing, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── DELETE /api/marketplace/:listingId ─────────────────────────────── */

exports.cancelListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.listingId);
    if (!listing)        return res.status(404).json({ message: 'Listing not found' });
    if (!listing.active) return res.status(400).json({ message: 'Listing already inactive' });
    if (listing.seller.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the listing owner' });

    // Call Marketplace.cancelListing() on-chain
    const wallet = getPlatformWallet();
    const { Marketplace } = contracts.getContracts(wallet);

    const tx      = await Marketplace.cancelListing(listing.listingId);
    const receipt = await tx.wait();

    listing.active = false;
    await listing.save();

    // Mark property as not for sale
    await Property.findByIdAndUpdate(listing.propertyId, { forSale: false });

    res.json({ message: 'Listing cancelled', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/marketplace/:listingId/price ──────────────────────────── */

exports.updatePrice = async (req, res) => {
  try {
    const { error, value } = updatePriceSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const listing = await Listing.findById(req.params.listingId);
    if (!listing)        return res.status(404).json({ message: 'Listing not found' });
    if (!listing.active) return res.status(400).json({ message: 'Listing is not active' });
    if (listing.seller.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the listing owner' });

    const { priceEth } = value;
    const priceWei = ethers.parseEther(priceEth.toString()).toString();

    // Update price on-chain
    const wallet = getPlatformWallet();
    const { Marketplace } = contracts.getContracts(wallet);

    const tx      = await Marketplace.updatePrice(listing.listingId, priceWei);
    const receipt = await tx.wait();

    const ethUsdRate = await getEthUsdRate();

    listing.priceEth = priceEth;
    listing.price    = priceWei;
    listing.priceUsd = ethUsdRate ? Math.round(priceEth * ethUsdRate) : null;
    await listing.save();

    res.json({ message: 'Price updated', listing, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/marketplace/:listingId/buy/crypto ────────────────────── */
// Frontend submits the tx directly via MetaMask.
// This endpoint just validates state and returns the data needed.
// Ownership update happens via the Sold event listener (see eventListeners.js).

exports.initiateCryptoPurchase = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.listingId)
      .populate('propertyId', 'title tokenId contractAddress');

    if (!listing)        return res.status(404).json({ message: 'Listing not found' });
    if (!listing.active) return res.status(400).json({ message: 'Listing is not active' });

    // Return data the frontend needs to construct the MetaMask tx
    res.json({
      listingId:       listing.listingId,
      tokenId:         listing.tokenId,
      priceWei:        listing.price,
      priceEth:        listing.priceEth,
      sellerAddress:   listing.sellerAddress,
      contractAddress: listing.propertyId?.contractAddress || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/marketplace/:listingId/buy/fiat ──────────────────────── */

exports.initiateFiatPurchase = async (req, res) => {
  try {
    const { error, value } = fiatBuySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const listing = await Listing.findById(req.params.listingId)
      .populate('propertyId', 'title primaryImage');
    if (!listing)        return res.status(404).json({ message: 'Listing not found' });
    if (!listing.active) return res.status(400).json({ message: 'Listing is not active' });

    if (!listing.priceUsd)
      return res.status(400).json({ message: 'USD price unavailable — use crypto purchase' });

    // Create Stripe PaymentIntent
    const paymentIntent = await getStripe().paymentIntents.create({
      amount:   listing.priceUsd * 100,     // Stripe uses cents
      currency: 'usd',
      metadata: {
        listingId:          listing._id.toString(),
        onChainListingId:   String(listing.listingId),
        tokenId:            String(listing.tokenId),
        buyerWalletAddress: value.buyerWalletAddress,
        buyerUserId:        req.user.id,
        sellerAddress:      listing.sellerAddress,
      },
      description: `Purchase of property NFT #${listing.tokenId} — ${listing.propertyId?.title || ''}`,
    });

    // Persist intent ID on listing for webhook reconciliation
    listing.stripePaymentIntentId = paymentIntent.id;
    listing.stripeStatus          = paymentIntent.status;
    await listing.save();

    res.json({ clientSecret: paymentIntent.client_secret, amount: listing.priceUsd });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/marketplace/webhook/stripe ───────────────────────────── */
// Called by Stripe — must be registered in app.js BEFORE express.json() middleware
// using express.raw({ type: 'application/json' })

exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook signature error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const {
      listingId,
      onChainListingId,
      tokenId,
      buyerWalletAddress,
      buyerUserId,
    } = intent.metadata;

    try {
      const listing = await Listing.findById(listingId);
      if (!listing || !listing.active) return res.json({ received: true });

      // Platform wallet executes the on-chain buy
      const wallet = getPlatformWallet();
      const { Marketplace } = contracts.getContracts(wallet);

      const tx      = await Marketplace.buyProperty(Number(onChainListingId), {
        value: ethers.parseEther(listing.priceEth.toString()),
      });
      const receipt = await tx.wait();

      // Update listing record
      listing.active        = false;
      listing.soldTxHash    = receipt.hash;
      listing.buyerAddress  = buyerWalletAddress;
      listing.buyer         = buyerUserId || null;
      listing.paymentMethod = 'fiat';
      listing.stripeStatus  = 'succeeded';
      listing.soldAt        = new Date();
      await listing.save();

      // Update property ownership in MongoDB
      await Property.findByIdAndUpdate(listing.propertyId, {
        ownerAddress: buyerWalletAddress.toLowerCase(),
        owner:        buyerUserId || listing.buyer,
        forSale:      false,
      });

      console.log(`[Stripe] Fiat purchase complete — tokenId ${tokenId}, txHash ${receipt.hash}`);
    } catch (err) {
      console.error('[Stripe] On-chain execution failed:', err.message);
      // Do NOT return 500 to Stripe — log and alert instead to avoid retries
    }
  }

  res.json({ received: true });
};