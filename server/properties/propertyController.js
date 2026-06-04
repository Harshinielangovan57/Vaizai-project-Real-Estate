const axios   = require('axios');
const ethers  = require('ethers');
const multer  = require('multer');
const path    = require('path');
const Property  = require('./propertyModel');
const User      = require('../auth/userModel');
const contracts = require('../config/contracts');   // loads localhost.json
const pinata    = require('../config/pinata');       // Pinata helper (see below)
const { createSchema, updateSchema, filterSchema } = require('./propertyValidation');

/* ─── Multer — in-memory storage for IPFS upload ────────────────────── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(allowed.includes(ext) ? null : new Error('Only JPG, PNG, WEBP allowed'), allowed.includes(ext));
  },
}).array('images', 10);

exports.uploadMiddleware = upload;

/* ─── GET /api/properties ────────────────────────────────────────────── */

exports.getProperties = async (req, res) => {
  try {
    const { error, value } = filterSchema.validate(req.query, { allowUnknown: false });
    if (error) return res.status(400).json({ message: error.details[0].message });

    const {
      city, propertyType, priceMin, priceMax, sqFtMin, sqFtMax,
      verified, forSale, forAuction, search,
      sortBy, order, page, limit,
    } = value;

    const query = { isDeleted: false };

    if (city)         query.city         = new RegExp(city, 'i');
    if (propertyType) query.propertyType = propertyType;
    if (verified   !== undefined) query.verified   = verified;
    if (forSale    !== undefined) query.forSale    = forSale;
    if (forAuction !== undefined) query.forAuction = forAuction;

    if (priceMin || priceMax) {
      query.askingPrice = {};
      if (priceMin) query.askingPrice.$gte = priceMin;
      if (priceMax) query.askingPrice.$lte = priceMax;
    }
    if (sqFtMin || sqFtMax) {
      query.squareFeet = {};
      if (sqFtMin) query.squareFeet.$gte = sqFtMin;
      if (sqFtMax) query.squareFeet.$lte = sqFtMax;
    }
    if (search) query.$text = { $search: search };

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [properties, total] = await Promise.all([
      Property.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(query),
    ]);

    res.json({
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/properties/:id ────────────────────────────────────────── */

exports.getProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false })
      .populate('owner', 'name email walletAddress');
    if (!property) return res.status(404).json({ message: 'Property not found' });
    res.json(property);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/properties ───────────────────────────────────────────── */

exports.createProperty = async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    // KYC check — must be approved before listing
    const user = await User.findById(req.user.id);
    if (user.kycStatus !== 'approved')
      return res.status(403).json({ message: 'KYC approval required to create a listing' });

    // Upload images to IPFS
    const imageUrls = [];
    if (req.files?.length) {
      for (const file of req.files) {
        const ipfsUrl = await pinata.uploadFile(file.buffer, file.originalname, file.mimetype);
        imageUrls.push(ipfsUrl);
      }
    }

    const property = await Property.create({
      ...value,
      owner:        req.user.id,
      ownerAddress: user.walletAddress,
      images:       imageUrls,
      primaryImage: imageUrls[0] || null,
    });

    res.status(201).json(property);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/properties/:id ────────────────────────────────────────── */

exports.updateProperty = async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.details[0].message });

    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // Only owner can update
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the property owner' });

    Object.assign(property, value);

    // If new images uploaded, add to IPFS
    if (req.files?.length) {
      for (const file of req.files) {
        const url = await pinata.uploadFile(file.buffer, file.originalname, file.mimetype);
        property.images.push(url);
      }
      if (!property.primaryImage) property.primaryImage = property.images[0];
    }

    await property.save();
    res.json(property);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── DELETE /api/properties/:id ─────────────────────────────────────── */

exports.deleteProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const isOwner = property.owner.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' });

    property.isDeleted = true;
    await property.save();
    res.json({ message: 'Property removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/properties/:id/tokenize ──────────────────────────────── */

exports.tokenizeProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the property owner' });
    if (property.tokenized)
      return res.status(400).json({ message: 'Property already tokenized' });

    // Build ERC-721 metadata JSON
    const metadata = {
      name:        property.title,
      description: property.description,
      image:       property.primaryImage,
      attributes: [
        { trait_type: 'Address',       value: property.address },
        { trait_type: 'City',          value: property.city },
        { trait_type: 'State',         value: property.state },
        { trait_type: 'Square Feet',   value: property.squareFeet },
        { trait_type: 'Bedrooms',      value: property.bedrooms },
        { trait_type: 'Bathrooms',     value: property.bathrooms },
        { trait_type: 'Property Type', value: property.propertyType },
        { trait_type: 'Year Built',    value: property.yearBuilt || 'Unknown' },
        { trait_type: 'AI Valuation',  value: property.aiValuation || 'Not evaluated' },
      ],
      external_url:   property.virtualTourUrl || '',
      animation_url:  property.virtualTourUrl || '',
    };

    // Upload metadata JSON to IPFS
    const metadataUri = await pinata.uploadJSON(metadata, `property-${property._id}-metadata.json`);

    // Connect to Hardhat local node and call mintProperty()
    const provider = new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');
    const wallet   = new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, provider);
    const { PropertyNFT } = contracts.getContracts(wallet);

    const tx = await PropertyNFT.mintProperty(
      property.ownerAddress,
      metadataUri,
      property.address,
      property.squareFeet,
      property.aiValuation || 0,
      false,                       // verified = false until admin approves
    );
    const receipt = await tx.wait();

    // Parse PropertyMinted event to get tokenId
    const mintEvent = receipt.logs
      .map((log) => { try { return PropertyNFT.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === 'PropertyMinted');

    const tokenId = mintEvent ? Number(mintEvent.args.tokenId) : null;

    property.tokenized       = true;
    property.tokenId         = tokenId;
    property.contractAddress = await PropertyNFT.getAddress();
    property.ipfsMetadataUri = metadataUri;
    await property.save();

    res.json({ message: 'Property tokenized', tokenId, txHash: receipt.hash, metadataUri });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── POST /api/properties/:id/valuate ───────────────────────────────── */

exports.valuateProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.owner.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not the property owner' });

    // Enforce 30-day re-valuation cooldown
    if (property.aiValuatedAt) {
      const daysSince = (Date.now() - property.aiValuatedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < 30)
        return res.status(429).json({ message: `Re-valuation available in ${Math.ceil(30 - daysSince)} days` });
    }

    // Call Python AI microservice
    const { data } = await axios.post(`${process.env.AI_SERVICE_URL}/valuate`, {
      city:         property.city,
      state:        property.state,
      postalCode:   property.address,
      squareFeet:   property.squareFeet,
      bedrooms:     property.bedrooms,
      bathrooms:    property.bathrooms,
      propertyType: property.propertyType,
      yearBuilt:    property.yearBuilt,
      lotSize:      property.lotSize,
    });

    property.aiValuation      = data.estimatedValue;
    property.aiValuationRange = { low: data.lowEstimate, high: data.highEstimate };
    property.aiComparables    = data.comparables || [];
    property.aiValuatedAt     = new Date();
    await property.save();

    res.json({
      estimatedValue: data.estimatedValue,
      range:          { low: data.lowEstimate, high: data.highEstimate },
      comparables:    data.comparables,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── PUT /api/properties/:id/verify (admin) ─────────────────────────── */

exports.verifyProperty = async (req, res) => {
  try {
    const property = await Property.findOne({ _id: req.params.id, isDeleted: false });
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!property.tokenized)
      return res.status(400).json({ message: 'Property must be tokenized before verification' });
    if (property.verified)
      return res.status(400).json({ message: 'Property already verified' });

    // Call verifyProperty() on-chain
    const provider = new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || 'http://localhost:8545');
    const wallet   = new ethers.Wallet(process.env.PLATFORM_WALLET_PRIVATE_KEY, provider);
    const { PropertyNFT } = contracts.getContracts(wallet);

    const tx      = await PropertyNFT.verifyProperty(property.tokenId);
    const receipt = await tx.wait();

    property.verified = true;
    await property.save();

    res.json({ message: 'Property verified on-chain', txHash: receipt.hash });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── GET /api/properties/:id/tour ───────────────────────────────────── */

exports.getTour = async (req, res) => {
  try {
    const property = await Property.findOne(
      { _id: req.params.id, isDeleted: false },
      'title virtualTourUrl primaryImage',
    );
    if (!property) return res.status(404).json({ message: 'Property not found' });

    res.json({
      title:          property.title,
      virtualTourUrl: property.virtualTourUrl || null,
      fallbackImage:  property.primaryImage   || null,
      hasTour:        !!property.virtualTourUrl,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};