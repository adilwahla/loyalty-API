// src/routes/api/v1/mobile/warrantyScan.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../../controllers/v1/warrantyScan.controller');
const { authenticate, authenticateOptional } = require('../../../../middleware/auth');

router.post('/guest/warranty-scan', authenticateOptional, ctrl.createScan); // guest scan route
router.post('/:UUID/warranty-scan', authenticate, ctrl.createScan);         // authenticated scan route
router.get('/:UUID/warranty-scans', ctrl.getUserScans);    // list user scans
router.get('/:UUID/points', ctrl.getUserTotalPoints);   // ✅ new: accumulated points
router.get('/customers/:bsg_cust_id/location-status', authenticate, ctrl.getLocationStatus);
router.post('/customers/location/activate', authenticate, ctrl.activateCustomerLocation);
router.post('/nfc/validate-scan', authenticate, ctrl.validateNfcScan);

// quick ping
router.get('/scan-ping', (_req, res) => res.send('mobile warrantyScan OK'));

module.exports = router;
