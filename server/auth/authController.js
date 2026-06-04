const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
const redis = require('../config/redis'); // ioredis or redis v4 client
const User = require('./userModel');

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const signAccess = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

const signRefresh = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

const NONCE_TTL = 300; // 5 minutes in seconds

const setRefreshCookie = (res, token) =>
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

/* ─── Register (email + password) ────────────────────────────────────── */

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const user = await User.create({ name, email, passwordHash: password }); // pre-save hook hashes it

    const payload = { id: user._id, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user: { id: user._id, name, email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── Login (email + password) ───────────────────────────────────────── */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ message: 'Invalid credentials' });

    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended' });

    const payload = { id: user._id, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── Nonce — wallet auth step 1 ─────────────────────────────────────── */

exports.getNonce = async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();
    if (!ethers.isAddress(address)) return res.status(400).json({ message: 'Invalid wallet address' });

    const nonce = uuidv4();
    const message = `Sign this message to authenticate with Real Estate NFT Marketplace.\n\nNonce: ${nonce}`;

    // Store nonce in Redis — single-use, 5-min TTL
    await redis.set(`nonce:${address}`, message, 'EX', NONCE_TTL);

    res.json({ message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── Wallet auth — step 2 ───────────────────────────────────────────── */

exports.walletLogin = async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature)
      return res.status(400).json({ message: 'walletAddress and signature required' });

    const address = walletAddress.toLowerCase();
    const storedMessage = await redis.get(`nonce:${address}`);
    if (!storedMessage) return res.status(401).json({ message: 'Nonce expired or not found' });

    // Verify the signature
    const recovered = ethers.verifyMessage(storedMessage, signature).toLowerCase();
    if (recovered !== address) return res.status(401).json({ message: 'Signature verification failed' });

    // Consume nonce — single-use
    await redis.del(`nonce:${address}`);

    // Upsert user
    let user = await User.findOne({ walletAddress: address });
    if (!user) user = await User.create({ walletAddress: address });

    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended' });

    const payload = { id: user._id, role: user.role };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user: { id: user._id, walletAddress: address, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── Refresh token ───────────────────────────────────────────────────── */

exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ message: 'No refresh token' });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token)
      return res.status(401).json({ message: 'Invalid refresh token' });

    const payload = { id: user._id, role: user.role };
    const accessToken = signAccess(payload);
    res.json({ accessToken });
  } catch (err) {
    res.status(401).json({ message: 'Refresh token invalid or expired' });
  }
};

/* ─── Logout ─────────────────────────────────────────────────────────── */

exports.logout = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ─── Current user ───────────────────────────────────────────────────── */

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash -refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};