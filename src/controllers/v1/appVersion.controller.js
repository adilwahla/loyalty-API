// src/controllers/v1/appVersion.controller.js

/**
 * App configs per packageId for multi-app support (same server, multiple apps).
 *
 * Each app supports separate Android & iOS package ids so version checks for
 * one platform don't affect the other.
 */

// Loyalty (Rewards) — package ids
const LOYALTY_ANDROID_PACKAGE_ID = 'com.binshihon.loyalty';
const LOYALTY_IOS_PACKAGE_ID = 'com.binshihongroup.loyaltyapp';
const LOYALTY_PACKAGE_IDS = new Set([LOYALTY_ANDROID_PACKAGE_ID, LOYALTY_IOS_PACKAGE_ID]);

// Sales Rep Tracker — package ids
const SALES_REP_ANDROID_PACKAGE_ID = 'com.binshihon.sales_rep_tracker';
const SALES_REP_IOS_PACKAGE_ID = 'com.binshihon.salestracker';
const SALES_REP_IOS_ALT_PACKAGE_ID = 'com.example.salesRepTracker';
const SALES_REP_PACKAGE_IDS = new Set([
  SALES_REP_ANDROID_PACKAGE_ID,
  SALES_REP_IOS_PACKAGE_ID,
  SALES_REP_IOS_ALT_PACKAGE_ID,
]);

const APP_CONFIG_MAP = {
  // Loyalty (Rewards) — Android
  [LOYALTY_ANDROID_PACKAGE_ID]: {
    latestVersion: 'APP_ANDROID_LATEST_VERSION',
    minVersion: 'APP_ANDROID_MIN_VERSION',
    storeUrlAndroid: 'APP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_STORE_URL_IOS',
  },
  // Loyalty (Rewards) — iOS
  [LOYALTY_IOS_PACKAGE_ID]: {
    latestVersion: 'APP_IOS_LATEST_VERSION',
    minVersion: 'APP_IOS_MIN_VERSION',
    storeUrlAndroid: 'APP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_STORE_URL_IOS',
  },
  // Sales Rep Tracker — Android
  [SALES_REP_ANDROID_PACKAGE_ID]: {
    latestVersion: 'APP_SALES_REP_ANDROID_LATEST_VERSION',
    minVersion: 'APP_SALES_REP_ANDROID_MIN_VERSION',
    storeUrlAndroid: 'APP_SALES_REP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_SALES_REP_STORE_URL_IOS',
  },
  // Sales Rep Tracker — iOS
  [SALES_REP_IOS_PACKAGE_ID]: {
    latestVersion: 'APP_SALES_REP_IOS_LATEST_VERSION',
    minVersion: 'APP_SALES_REP_IOS_MIN_VERSION',
    storeUrlAndroid: 'APP_SALES_REP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_SALES_REP_STORE_URL_IOS',
  },
  // Sales Rep Tracker — iOS legacy/live alias
  [SALES_REP_IOS_ALT_PACKAGE_ID]: {
    latestVersion: 'APP_SALES_REP_IOS_LATEST_VERSION',
    minVersion: 'APP_SALES_REP_IOS_MIN_VERSION',
    storeUrlAndroid: 'APP_SALES_REP_STORE_URL_ANDROID',
    storeUrlIos: 'APP_SALES_REP_STORE_URL_IOS',
  },
};

/** Default packageId when none provided (backward compatibility) */
const DEFAULT_PACKAGE_ID = LOYALTY_ANDROID_PACKAGE_ID;

/**
 * Returns the app-version payload for ForceUpdateChecker.
 * Supports multiple apps via query param, e.g.
 *   ?packageId=com.bsg.rewards
 *   ?packageId=com.binshihongroup.loyaltyapp
 *   ?packageId=com.binshihon.sales_rep_tracker
 *   ?packageId=com.binshihon.salestracker
 *
 * Response format as per spec (camelCase). Values come from env vars.
 */
exports.getAppVersion = (req, res) => {
  try {
    const packageId = req.query.packageId || req.query.package_id || DEFAULT_PACKAGE_ID;
    const configKeys = APP_CONFIG_MAP[packageId] || APP_CONFIG_MAP[DEFAULT_PACKAGE_ID];

    // Backward compatibility: if new per-platform vars are missing,
    // fall back to the old shared keys per app.
    const legacyLatest = LOYALTY_PACKAGE_IDS.has(packageId)
      ? process.env.APP_LATEST_VERSION
      : SALES_REP_PACKAGE_IDS.has(packageId)
        ? process.env.APP_SALES_REP_LATEST_VERSION
        : undefined;
    const legacyMin = LOYALTY_PACKAGE_IDS.has(packageId)
      ? process.env.APP_MIN_VERSION
      : SALES_REP_PACKAGE_IDS.has(packageId)
        ? process.env.APP_SALES_REP_MIN_VERSION
        : undefined;

    const latestVersion =
      process.env[configKeys.latestVersion] || legacyLatest || '1.0.0';
    const minVersion =
      process.env[configKeys.minVersion] || legacyMin || '1.0.0';

    const storeUrlAndroid =
      process.env[configKeys.storeUrlAndroid]
      || (SALES_REP_PACKAGE_IDS.has(packageId)
        ? `https://play.google.com/store/apps/details?id=${SALES_REP_ANDROID_PACKAGE_ID}`
        : `https://play.google.com/store/apps/details?id=${LOYALTY_ANDROID_PACKAGE_ID}`);
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
