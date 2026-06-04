const ethers    = require('ethers');
const multer    = require('multer');
const Escrow    = require('./escrowModel');
const Property  = require('../properties/propertyModel');
const User      = require('../auth/userModel');
const contracts = require('../config/contracts');
const pinata    = require('../config/pinata');
const {
  createEscrowSchema,
  disputeSchema,
  resolveDisputeSchema,
} = require('./escrowValidation');

/* ─── Helpers ────────────────────────────────────────────────────────── */

const getProvider = () =>
  new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');

const getPlatformWallet = () =>
  new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, getProvider());

// Multer — evidence uploads (IPFS)
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Only JPG, PNG, WEBP, PDF allowed'), allowed.includes(ext));
  },
}).array('evidence', 5);

exports.evidenceUploadMiddleware = evidenceUpload;

/* ─── GET /api/escrow ────────────────────────────────────────────────── */

exports.getEscrows = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    // Users see only their own escrows; admins see all
    const query = req.user.role === 'admin'
      ? {}
      : { $or: [{ buyer: req.user.id }, { seller: req.user.id }] };

    if (req.query.status) query.status = req.query.status;

    const [escrows, total] = await Promise.all([
      Escrow.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('propertyId', 'title city state primaryImage tokenId')
        .populate('buyer',  'name walletAddress')
        .populate('seller', 'name walletAddress')
        .lean(),
      Escrow.countDocuments(query),
    ]);

    res.json({ escrows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/escrow/:id ────────────────────────────────────────────── */

exports.getEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id)
      .populate('propertyId')
      .populate('buyer',  'name walletAddress email')
      .populate('seller', 'name walletAddress email');

    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    // Only buyer, seller, or admin can view
    const isParty = [escrow.buyer?._id.toString(), escrow.seller?._id.toString()].includes(req.user.id);
    if (!isParty && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    res.json(escrow);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/escrow ───────────────────────────────────────────────── */

exports.createEscrow = async (req, res) => {
  try {
    const { error, value } = createEscrowSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const { propertyId, buyerAddress, totalAmountEth, deadline, milestones } = value;

    // Validate milestone amounts sum to total
    const milestonesSum = milestones.reduce((s, m) => s + m.amountEth, 0);
    if (Math.abs(milestonesSum - totalAmountEth) > 0.0001)
      return res.status(400).json({ message: 'Milestone amounts must sum to totalAmountEth' });

    const property = await Property.findOne({ _id: propertyId, isDeleted: false });
    if (!property)          return res.status(404).json({ message: 'Property not found' });
    if (!property.tokenized) return res.status(400).json({ message: 'Property must be tokenized' });
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only the property owner can initiate escrow' });

    // Look up buyer by wallet address
    const buyer = await User.findOne({ walletAddress: buyerAddress.toLowerCase() });
    if (!buyer) return res.status(404).json({ message: 'Buyer wallet not registered on platform' });

    const seller = await User.findById(req.user.id);

    const totalWei = ethers.parseEther(totalAmountEth.toString()).toString();
    const platformFeeWei = (BigInt(totalWei) * 2n / 100n).toString(); // 2%

    const milestonesWei = milestones.map((m) => ({
      ...m,
      amount:    ethers.parseEther(m.amountEth.toString()).toString(),
    }));

    // Call Escrow.createEscrow() on-chain
    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    const milestoneAmountsWei = milestonesWei.map((m) => m.amount);
    const deadlineTimestamp   = Math.floor(new Date(deadline).getTime() / 1000);

    const tx = await EscrowContract.createEscrow(
      property.tokenId,
      seller.walletAddress,
      buyerAddress.toLowerCase(),
      totalWei,
      milestoneAmountsWei,
      deadlineTimestamp,
    );
    const receipt = await tx.wait();

    // Parse EscrowCreated event
    const createdEvent = receipt.logs
      .map((log) => { try { return EscrowContract.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === 'EscrowCreated');

    const escrowId = createdEvent ? Number(createdEvent.args.escrowId) : null;

    const escrow = await Escrow.create({
      escrowId,
      propertyId:    property._id,
      tokenId:       property.tokenId,
      seller:        seller._id,
      sellerAddress: seller.walletAddress,
      buyer:         buyer._id,
      buyerAddress:  buyer.walletAddress,
      totalAmount:   totalWei,
      totalAmountEth,
      platformFeePercent: 2,
      platformFee:   platformFeeWei,
      milestones:    milestonesWei,
      deadline,
      createTxHash:  receipt.hash,
      status:        'pending',
    });

    res.status(201).json({ escrow, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/escrow/:id/fund ──────────────────────────────────────── */
// Buyer funds the escrow on-chain via MetaMask (frontend tx).
// This endpoint marks it funded after the tx is confirmed.

exports.confirmFunding = async (req, res) => {
  try {
    const { txHash } = req.body;
    if (!txHash) return res.status(400).json({ message: 'txHash required' });

    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });
    if (escrow.buyer.toString() !== req.user.id)
      return res.status(403).json({ message: 'Only the buyer can confirm funding' });
    if (escrow.status !== 'pending')
      return res.status(400).json({ message: 'Escrow is not in pending state' });

    // Verify tx on-chain
    const provider = getProvider();
    const receipt  = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1)
      return res.status(400).json({ message: 'Transaction not confirmed or failed' });

    escrow.status      = 'funded';
    escrow.fundTxHash  = txHash;
    await escrow.save();

    res.json({ message: 'Escrow funded', escrow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/escrow/:id/milestone/:milestoneId/release ─────────────── */

exports.releaseMilestone = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    // Only seller can request release; admin can override
    const isSeller = escrow.seller.toString() === req.user.id;
    if (!isSeller && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Only the seller can release milestones' });

    if (!['funded', 'in_progress'].includes(escrow.status))
      return res.status(400).json({ message: 'Escrow must be funded to release milestones' });

    const milestone = escrow.milestones.id(req.params.milestoneId);
    if (!milestone)          return res.status(404).json({ message: 'Milestone not found' });
    if (milestone.released)  return res.status(400).json({ message: 'Milestone already released' });

    // Get milestone index for on-chain call
    const milestoneIndex = escrow.milestones.findIndex(
      (m) => m._id.toString() === req.params.milestoneId
    );

    // Call Escrow.releaseMilestone() on-chain
    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    const tx      = await EscrowContract.releaseMilestone(escrow.escrowId, milestoneIndex);
    const receipt = await tx.wait();

    milestone.released      = true;
    milestone.releasedAt    = new Date();
    milestone.releaseTxHash = receipt.hash;

    // Check if all milestones released
    const allReleased = escrow.milestones.every((m) => m.released);
    escrow.status = allReleased ? 'completed' : 'in_progress';
    if (allReleased) {
      escrow.completedAt    = new Date();
      escrow.completeTxHash = receipt.hash;

      // Transfer property ownership in MongoDB
      await Property.findByIdAndUpdate(escrow.propertyId, {
        ownerAddress: escrow.buyerAddress,
        owner:        escrow.buyer,
        forSale:      false,
      });
    }

    await escrow.save();
    res.json({ message: `Milestone released${allReleased ? ' — escrow complete' : ''}`, escrow, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/escrow/:id/dispute ───────────────────────────────────── */

exports.raiseDispute = async (req, res) => {
  try {
    const { error, value } = disputeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const isParty = [escrow.buyer.toString(), escrow.seller.toString()].includes(req.user.id);
    if (!isParty) return res.status(403).json({ message: 'Only escrow parties can raise a dispute' });

    if (!['funded', 'in_progress'].includes(escrow.status))
      return res.status(400).json({ message: 'Can only dispute funded or in-progress escrows' });

    if (escrow.dispute) return res.status(400).json({ message: 'Dispute already raised' });

    // Upload evidence files to IPFS if provided
    const evidenceUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const url = await pinata.uploadFile(file.buffer, file.originalname, file.mimetype);
        evidenceUrls.push(url);
      }
    }

    // Flag escrow in dispute on-chain
    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    const tx      = await EscrowContract.raiseDispute(escrow.escrowId);
    const receipt = await tx.wait();

    escrow.status  = 'disputed';
    escrow.dispute = {
      raisedBy: req.user.id,
      reason:   value.reason,
      evidence: [...(value.evidence || []), ...evidenceUrls],
    };
    await escrow.save();

    res.json({ message: 'Dispute raised', txHash: receipt.hash, escrow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/escrow/:id/dispute/resolve (admin) ────────────────────── */

exports.resolveDispute = async (req, res) => {
  try {
    const { error, value } = resolveDisputeSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const escrow = await Escrow.findById(req.params.id);
    if (!escrow)           return res.status(404).json({ message: 'Escrow not found' });
    if (escrow.status !== 'disputed')
      return res.status(400).json({ message: 'Escrow is not in disputed state' });

    const { resolution, releaseToSeller } = value;

    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    let receipt;

    if (releaseToSeller) {
      // Release remaining funds to seller
      const tx = await EscrowContract.resolveDisputeToSeller(escrow.escrowId);
      receipt  = await tx.wait();
      escrow.status = 'completed';
      escrow.completedAt    = new Date();
      escrow.completeTxHash = receipt.hash;

      await Property.findByIdAndUpdate(escrow.propertyId, {
        ownerAddress: escrow.buyerAddress,
        owner:        escrow.buyer,
        forSale:      false,
      });
    } else {
      // Refund buyer
      const tx = await EscrowContract.resolveDisputeRefund(escrow.escrowId);
      receipt  = await tx.wait();
      escrow.status       = 'refunded';
      escrow.refundTxHash = receipt.hash;

      await Property.findByIdAndUpdate(escrow.propertyId, { forSale: false });
    }

    escrow.dispute.resolution  = resolution;
    escrow.dispute.resolvedBy  = req.user.id;
    escrow.dispute.resolvedAt  = new Date();
    await escrow.save();

    res.json({ message: `Dispute resolved — ${releaseToSeller ? 'released to seller' : 'refunded to buyer'}`, escrow, txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/escrow/:id/cancel ────────────────────────────────────── */

exports.cancelEscrow = async (req, res) => {
  try {
    const escrow = await Escrow.findById(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const isSeller = escrow.seller.toString() === req.user.id;
    const isAdmin  = req.user.role === 'admin';
    if (!isSeller && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    if (escrow.status !== 'pending')
      return res.status(400).json({ message: 'Only pending escrows can be cancelled' });

    const wallet = getPlatformWallet();
    const { Escrow: EscrowContract } = contracts.getContracts(wallet);

    const tx      = await EscrowContract.cancelEscrow(escrow.escrowId);
    const receipt = await tx.wait();

    escrow.status = 'cancelled';
    await escrow.save();

    res.json({ message: 'Escrow cancelled', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};