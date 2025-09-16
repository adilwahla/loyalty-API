// src/routes/api/v1/admin/warrantyScan.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../../controllers/v1/warrantyScan.controller');



// 🔓 No auth for testing:
router.get('/', ctrl.getAllScans);
router.get('/wp/:warrantyNumber', ctrl.getWarrantyData); // get warranty data from WordPress by number
// ✅ Approve or Reject a scan (Sales Admin action)
router.put('/:id/status', ctrl.updateScanStatus);
module.exports = router;