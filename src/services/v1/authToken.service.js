const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { AuthSession, User } = require('../../models');

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_refresh`;
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, typ: 'access' },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function signRefreshToken(sessionId, userId) {
  return jwt.sign(
    { sid: sessionId, sub: userId, typ: 'refresh' },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function decodeExpiry(token) {
  const decoded = jwt.decode(token);
  return decoded?.exp ? new Date(decoded.exp * 1000) : null;
}

function buildAuthPayload(user, accessToken, refreshToken) {
  const accessTokenExpiresAt = decodeExpiry(accessToken);
  const refreshTokenExpiresAt = decodeExpiry(refreshToken);

  return {
    id: user.id,
    salesRepId: user.salesRepId || user.branchManagerId || null,
    fullName: user.fullName || null,
    role: user.role,
    apiToken: accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt ? accessTokenExpiresAt.toISOString() : null,
    refreshTokenExpiresAt: refreshTokenExpiresAt ? refreshTokenExpiresAt.toISOString() : null,
  };
}

function sanitizeUser(user) {
  const raw = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete raw.password;
  return raw;
}

function getSessionSalesRepId(user) {
  return user.salesRepId || user.branchManagerId || null;
}

async function createSessionForUser(user, metadata = {}) {
  const session = await AuthSession.create({
    userId: user.id,
    salesRepId: getSessionSalesRepId(user),
    refreshTokenHash: crypto.randomBytes(32).toString('hex'),
    deviceId: metadata.deviceId || null,
    deviceName: metadata.deviceName || null,
    lastUsedAt: new Date(),
    expiresAt: new Date(),
  });

  const refreshToken = signRefreshToken(session.id, user.id);
  const refreshTokenExpiresAt = decodeExpiry(refreshToken);

  await session.update({
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiresAt,
  });

  const accessToken = signAccessToken(user);

  return {
    session,
    accessToken,
    refreshToken,
    payload: buildAuthPayload(user, accessToken, refreshToken),
  };
}

async function rotateRefreshToken(refreshToken, metadata = {}) {
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      const tokenError = new Error('Refresh token expired');
      tokenError.statusCode = 401;
      tokenError.code = 'REFRESH_TOKEN_EXPIRED';
      throw tokenError;
    }

    const tokenError = new Error('Refresh token invalid');
    tokenError.statusCode = 401;
    tokenError.code = 'REFRESH_TOKEN_INVALID';
    throw tokenError;
  }

  if (decoded?.typ !== 'refresh' || !decoded?.sid || !decoded?.sub) {
    const tokenError = new Error('Refresh token invalid');
    tokenError.statusCode = 401;
    tokenError.code = 'REFRESH_TOKEN_INVALID';
    throw tokenError;
  }

  const session = await AuthSession.findByPk(decoded.sid);
  if (!session || session.revokedAt) {
    const tokenError = new Error('Refresh token invalid');
    tokenError.statusCode = 401;
    tokenError.code = 'REFRESH_TOKEN_INVALID';
    throw tokenError;
  }

  if (session.userId !== decoded.sub || session.refreshTokenHash !== hashToken(refreshToken)) {
    await session.update({ revokedAt: new Date() });
    const tokenError = new Error('Refresh token invalid');
    tokenError.statusCode = 401;
    tokenError.code = 'REFRESH_TOKEN_INVALID';
    throw tokenError;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await session.update({ revokedAt: new Date() });
    const tokenError = new Error('Refresh token expired');
    tokenError.statusCode = 401;
    tokenError.code = 'REFRESH_TOKEN_EXPIRED';
    throw tokenError;
  }

  const user = await User.findByPk(session.userId);
  if (!user) {
    await session.update({ revokedAt: new Date() });
    const tokenError = new Error('User deleted');
    tokenError.statusCode = 401;
    tokenError.code = 'USER_DELETED';
    throw tokenError;
  }

  const newRefreshToken = signRefreshToken(session.id, user.id);
  const refreshTokenExpiresAt = decodeExpiry(newRefreshToken);
  const accessToken = signAccessToken(user);

  await session.update({
    salesRepId: getSessionSalesRepId(user),
    refreshTokenHash: hashToken(newRefreshToken),
    expiresAt: refreshTokenExpiresAt,
    lastUsedAt: new Date(),
    deviceId: metadata.deviceId || session.deviceId,
    deviceName: metadata.deviceName || session.deviceName,
  });

  return {
    session,
    accessToken,
    refreshToken: newRefreshToken,
    payload: buildAuthPayload(user, accessToken, newRefreshToken),
  };
}

function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    if (decoded?.typ && decoded.typ !== 'access') {
      const tokenError = new Error('Invalid token');
      tokenError.statusCode = 401;
      tokenError.code = 'ACCESS_TOKEN_INVALID';
      throw tokenError;
    }
    return decoded;
  } catch (err) {
    if (err.statusCode) throw err;

    if (err.name === 'TokenExpiredError') {
      const tokenError = new Error('Invalid token');
      tokenError.statusCode = 401;
      tokenError.code = 'ACCESS_TOKEN_EXPIRED';
      throw tokenError;
    }

    const tokenError = new Error('Invalid token');
    tokenError.statusCode = 401;
    tokenError.code = 'ACCESS_TOKEN_INVALID';
    throw tokenError;
  }
}

async function ensureActiveUser(decoded) {
  const user = await User.findByPk(decoded.id);
  if (!user) {
    const tokenError = new Error('User deleted');
    tokenError.statusCode = 401;
    tokenError.code = 'USER_DELETED';
    throw tokenError;
  }

  return user;
}

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  sanitizeUser,
  createSessionForUser,
  rotateRefreshToken,
  verifyAccessToken,
  ensureActiveUser,
};
