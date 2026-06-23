// src/routes/api/v1/mobile/warrantyScan.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../../controllers/v1/warrantyScan.controller');
const { authenticate } = require('../../../../middleware/auth');

// Location activation (specific paths before /:UUID)
router.get('/customers/:bsg_cust_id/location-status', authenticate, ctrl.getLocationStatus);
router.post('/customers/location/activate', authenticate, ctrl.activateCustomerLocation);
router.post('/nfc/validate-scan', authenticate, ctrl.validateNfcScan);

router.post('/:UUID/warranty-scan', ctrl.createScan);
router.get('/:UUID/warranty-scans', ctrl.getUserScans);
router.get('/:UUID/points', ctrl.getUserTotalPoints);

// Guest scan — no auth, read-only
router.get('/guest/scan/:code', ctrl.guestScan);
router.get('/scan-ping', (_req, res) => res.send('mobile warrantyScan OK'));

module.exports = router;
