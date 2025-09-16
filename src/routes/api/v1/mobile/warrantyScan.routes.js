// src/routes/api/v1/mobile/warrantyScan.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../../controllers/v1/warrantyScan.controller');

// 🔓 No auth for testing:
router.post('/:UUID/warranty-scan', ctrl.createScan);      // create a scan for a user
router.get('/:UUID/warranty-scans', ctrl.getUserScans);    // list user scans
router.get('/:UUID/points', ctrl.getUserTotalPoints);   // ✅ new: accumulated points

// quick ping
router.get('/scan-ping', (_req, res) => res.send('mobile warrantyScan OK'));

module.exports = router;