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
  const requestPath = req.originalUrl || req.url;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log(`[AUTH] ❌ Missing/invalid Authorization header | path=${requestPath}`);
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[AUTH] ✅ Token verified | path=${requestPath} | role=${decoded?.role} | userId=${decoded?.id}`);
    req.user = decoded;
    next();
  } catch (err) {
    const decodedUnsafe = jwt.decode(token);
    console.error(
      `[AUTH] ❌ Invalid token | path=${requestPath} | reason=${err.message} | role=${decodedUnsafe?.role || 'UNKNOWN'} | userId=${decodedUnsafe?.id || 'UNKNOWN'}`
    );
    return res.status(401).json({ error: 'Invalid token' });
  }
};

exports.authenticateOptional = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (_err) {
    // Treat invalid token as guest for optional-auth routes.
    req.user = null;
  }
  return next();
};

exports.restrictToRoles = (...roles) => {
  return (req, res, next) => {
      console.log('[AUTH] required:', roles, 'got:', req.user?.role);
    if (!req.user?.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    next();
  };
};
