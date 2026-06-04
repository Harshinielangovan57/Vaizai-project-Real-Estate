const jwt = require('jsonwebtoken');

// Verifies JWT and attaches req.user
exports.protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

// Role guard — call after protect
exports.requireRole = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role))
      return res.status(403).json({ message: 'Insufficient permissions' });
    next();
  };