const { success, error } = require('../../utils/response');
const deviceTokenService = require('../../services/v1/deviceToken.service');

exports.registerDeviceToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const salesRepId = await deviceTokenService.resolveSalesRepCodeForUser(userId);
    if (!salesRepId) {
      return res.status(400).json(error('Sales rep code not found for this user'));
    }

    const { fcmToken, platform, deviceName } = req.body || {};
    const normalizedToken = String(fcmToken || '').trim();
    const normalizedPlatform = deviceTokenService.normalizePlatform(platform);

    if (!normalizedToken) {
      return res.status(400).json(error('fcmToken is required'));
    }

    if (!normalizedPlatform || !deviceTokenService.VALID_PLATFORMS.has(normalizedPlatform)) {
      return res.status(400).json(error('platform must be android or ios'));
    }

    await deviceTokenService.upsertDeviceToken({
      salesRepId,
      fcmToken: normalizedToken,
      platform: normalizedPlatform,
      deviceName: deviceName ? String(deviceName).trim() : null,
    });

    return res.status(200).json(success('Device token saved'));
  } catch (err) {
    console.error('[device-token] register failed', err);
    return res.status(500).json(error('Failed to save device token'));
  }
};

exports.removeDeviceToken = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const salesRepId = await deviceTokenService.resolveSalesRepCodeForUser(userId);
    if (!salesRepId) {
      return res.status(400).json(error('Sales rep code not found for this user'));
    }

    const { fcmToken } = req.body || {};
    const normalizedToken = String(fcmToken || '').trim();

    if (!normalizedToken) {
      return res.status(400).json(error('fcmToken is required'));
    }

    await deviceTokenService.removeDeviceToken({
      salesRepId,
      fcmToken: normalizedToken,
    });

    return res.status(200).json(success('Device token removed'));
  } catch (err) {
    console.error('[device-token] remove failed', err);
    return res.status(500).json(error('Failed to remove device token'));
  }
};
