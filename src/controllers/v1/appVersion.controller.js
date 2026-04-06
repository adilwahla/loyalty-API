// src/controllers/v1/appVersion.controller.js

/**
 * App configs per packageId for multi-app support (same server, multiple apps).
 * Add new entries when onboarding a new app.
 */
const APP_CONFIG_MAP = {
  // Rewards / Loyalty app
  'com.bsg.rewards': {
    latestVersion: 'APP_LATEST_VERSION',
    minVersion: 'APP_MIN_VERSION',
    storeUrlAndroid: 'APP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_STORE_URL_IOS',
  },
  // Sales Rep Tracker app
  'com.binshihon.sales_rep_tracker': {
    latestVersion: 'APP_SALES_REP_LATEST_VERSION',
    minVersion: 'APP_SALES_REP_MIN_VERSION',
    storeUrlAndroid: 'APP_SALES_REP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_SALES_REP_STORE_URL_IOS',
  },
};

/** Default packageId when none provided (backward compatibility) */
const DEFAULT_PACKAGE_ID = 'com.bsg.rewards';

/**
 * Returns the app-version payload for ForceUpdateChecker.
 * Supports multiple apps via query param: ?packageId=com.binshihon.sales_rep_tracker
 *
 * Response format as per spec (camelCase). Values from env vars.
 */
exports.getAppVersion = (req, res) => {
  try {
    const packageId = req.query.packageId || req.query.package_id || DEFAULT_PACKAGE_ID;
    const configKeys = APP_CONFIG_MAP[packageId] || APP_CONFIG_MAP[DEFAULT_PACKAGE_ID];

    const latestVersion =
      process.env[configKeys.latestVersion] || '1.0.0';
    const minVersion =
      process.env[configKeys.minVersion] || '1.0.0';
    const storeUrlAndroid =
      process.env[configKeys.storeUrlAndroid]
      || (packageId === 'com.binshihon.sales_rep_tracker'
        ? 'https://play.google.com/store/apps/details?id=com.binshihon.sales_rep_tracker'
        : 'https://play.google.com/store/apps/details?id=com.bsg.rewards');
    const storeUrlIos =
      process.env[configKeys.storeUrlIos]
      || 'https://apps.apple.com/app/idXXXXXX';

    return res.status(200).json({
      latestVersion,
      minVersion,
      storeUrlAndroid,
      storeUrlIos,
      message: 'A new version is available. Please update to continue.',
    });
  } catch (err) {
    console.error('appVersion error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
