// src/routes/api/v1/appVersion.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../controllers/v1/appVersion.controller');
 
// GET /api/v1/app-version — public (no auth), used by ForceUpdateChecker on Splash screen
// Query: ?packageId=com.binshihon.sales_rep_tracker | com.bsg.rewards (default)
router.get('/app-version', ctrl.getAppVersion);
 
module.exports = router;
 