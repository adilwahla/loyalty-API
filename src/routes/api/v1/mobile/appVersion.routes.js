// src/routes/api/v1/mobile/appVersion.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../../../controllers/v1/appVersion.controller');
 
// GET /api/v1/mobile/app-version — public (no auth), used by ForceUpdateChecker
router.get('/app-version', ctrl.getAppVersion);
 
module.exports = router;
 