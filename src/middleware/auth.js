const jwt = require('jsonwebtoken');

exports.protect = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('[AUTH] ❌ No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[AUTH] ✅ Decoded token:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[AUTH] ❌ Invalid token', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

exports.restrictToRoles = (...roles) => {
  return (req, res, next) => {
      console.log('[AUTH] required:', roles, 'got:', req.user?.role);
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    next();
  };
};

/**
 * Like `authenticate`, but never rejects the request.
 * - Valid token → req.user = decoded payload, continue.
 * - No token, or invalid/expired token → req.user = null, continue.
 * Use only on routes that must stay open to unauthenticated callers
 * but want role-aware behavior *when* a valid token happens to be present.
 */
exports.optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null; // invalid/expired token — proceed unauthenticated rather than 401
  }
  next();
};
