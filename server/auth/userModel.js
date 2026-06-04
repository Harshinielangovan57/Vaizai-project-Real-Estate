const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    walletAddress: { type: String, unique: true, sparse: true, lowercase: true },
    role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' },
    kycStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    isSuspended: { type: Boolean, default: false },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);