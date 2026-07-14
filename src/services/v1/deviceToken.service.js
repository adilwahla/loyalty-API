const { DeviceToken, User } = require('../../models');

const VALID_PLATFORMS = new Set(['android', 'ios']);

function normalizePlatform(platform) {
  return String(platform || '').trim().toLowerCase();
}

function pickSalesRepCodeFromUser(user) {
  if (!user) return null;
  const role = String(user.role || '').toUpperCase();
  const salesRepCode = String(user.salesRepId || '').trim();
  const branchManagerCode = String(user.branchManagerId || '').trim();

  if (role === 'SALES_REP' && salesRepCode) return salesRepCode;
  if (role === 'BRANCH_MANAGER' && branchManagerCode) return branchManagerCode;
  return salesRepCode || branchManagerCode || null;
}

async function resolveSalesRepCodeForUser(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'role', 'salesRepId', 'branchManagerId'],
  });
  return pickSalesRepCodeFromUser(user);
}

async function upsertDeviceToken({ salesRepId, fcmToken, platform, deviceName }) {
  const now = new Date();
  const payload = {
    salesRepId,
    platform,
    deviceName: deviceName || null,
    lastActiveAt: now,
  };

  const existing = await DeviceToken.findOne({ where: { fcmToken } });
  if (existing) {
    await existing.update(payload);
    return existing;
  }

  return DeviceToken.create({
    ...payload,
    fcmToken,
  });
}

async function removeDeviceToken({ salesRepId, fcmToken }) {
  return DeviceToken.destroy({
    where: { salesRepId, fcmToken },
  });
}

async function getFcmTokensForSalesRep(salesRepId) {
  const rows = await DeviceToken.findAll({
    where: { salesRepId },
    attributes: ['fcmToken'],
  });
  return rows.map((row) => row.fcmToken).filter(Boolean);
}

async function removeFcmTokens(tokens) {
  if (!tokens?.length) return 0;
  return DeviceToken.destroy({
    where: { fcmToken: tokens },
  });
}

module.exports = {
  VALID_PLATFORMS,
  normalizePlatform,
  pickSalesRepCodeFromUser,
  resolveSalesRepCodeForUser,
  upsertDeviceToken,
  removeDeviceToken,
  getFcmTokensForSalesRep,
  removeFcmTokens,
};
