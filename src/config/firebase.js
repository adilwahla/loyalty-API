const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');

let firebaseReady = false;
let firebaseDisabled = false;

function resolveServiceAccountPath(pathEnv) {
  const candidates = [];
  if (pathEnv) {
    candidates.push(
      path.isAbsolute(pathEnv) ? pathEnv : path.join(process.cwd(), pathEnv)
    );
  }
  candidates.push(path.join(process.cwd(), 'config', 'firebase-service-account.json'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadServiceAccount() {
  const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (jsonEnv) {
    return JSON.parse(jsonEnv);
  }

  const resolved = resolveServiceAccountPath(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (!resolved) {
    console.warn(
      '[Firebase] Service account not found. Set FIREBASE_SERVICE_ACCOUNT_PATH or place file at config/firebase-service-account.json'
    );
    return null;
  }

  console.log('[Firebase] Loading service account from', resolved);
  return JSON.parse(fs.readFileSync(resolved, 'utf8'));
}

function getFirebaseAdmin() {
  if (firebaseDisabled) return null;
  if (firebaseReady) return admin;

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      firebaseDisabled = true;
      console.warn('[Firebase] Not configured — push notifications disabled');
      return null;
    }

    const apps = typeof admin.getApps === 'function' ? admin.getApps() : (admin.apps || []);
    if (!apps.length) {
      const credential =
        typeof admin.cert === 'function'
          ? admin.cert(serviceAccount)
          : admin.credential.cert(serviceAccount);

      admin.initializeApp({ credential });
    }

    firebaseReady = true;
    console.log('[Firebase] Ready — push notifications enabled');
    return admin;
  } catch (err) {
    firebaseDisabled = true;
    console.error('[Firebase] Initialization failed:', err.message);
    return null;
  }
}

function getFirebaseMessaging() {
  if (!getFirebaseAdmin()) return null;
  return getMessaging();
}

function isFirebaseConfigured() {
  return Boolean(getFirebaseAdmin());
}

module.exports = { getFirebaseAdmin, getFirebaseMessaging, isFirebaseConfigured };
