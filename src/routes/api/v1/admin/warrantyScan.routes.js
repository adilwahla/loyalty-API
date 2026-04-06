// src/routes/api/v1/admin/warrantyScan.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../../../../controllers/v1/warrantyScan.controller');
const { authenticate, restrictToRoles } = require('../../../../middleware/auth');
// ✅ Only these roles can access warranty scans
//const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN', 'SALES_REP'];

// 🔓 No auth for testing:
router.get('/',authenticate,restrictToRoles('SUPER_ADMIN', 'ADMIN', 'SALES_REP', 'SALES_ADMIN' , 'BRANCH_MANAGER'), ctrl.getAllScans);
//router.get('/',authenticate,restrictToRoles('SUPER_ADMIN', 'ADMIN', 'SALES_REP'), ctrl.getAllScans);
router.get('/wp/:warrantyNumber', ctrl.getWarrantyData); // get warranty data from WordPress by number
// ✅ Approve or Reject a scan (Sales Admin action)
router.put('/:id/status', ctrl.updateScanStatus);
module.exports = router;