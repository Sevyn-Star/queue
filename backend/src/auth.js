const jwt = require('jsonwebtoken');
const { jwtSecret } = require('./env');

function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '30d' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: '请先登录' });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return next();
  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch {
    req.user = null;
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: '请先登录' });
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({ success: false, message: '无权限' });
    }
    next();
  };
}

module.exports = { signToken, authRequired, optionalAuth, requireRole };
