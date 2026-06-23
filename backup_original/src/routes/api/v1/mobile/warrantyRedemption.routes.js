const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/warrantyRedemption.controller');
const { protect,authenticate, restrictToRoles } = require('../../../../middleware/auth');

// Mobile user creates request
router.post('/:UUID/warranty-redemption',authenticate, controller.createRedemption);

// Sales Admin approves or rejects
//router.put('/:UUID/status', protect(['SALES_ADMIN']), controller.approveOrReject);

// inside warrantyRedemption.routes.js
//router.get('/status-ping', (req, res) => res.send('STATUS ENDPOINT READY'));
// Sales Admin approves or rejects
//router.put('/:UUID/status', authenticate, restrictToRoles('SALES_ADMIN'), controller.approveOrReject);
// Admin approves/rejects (you can keep auth if needed)
router.put('/:UUID/status', /* restrictToRoles('SALES_ADMIN'), */ controller.approveOrReject);
// Get all redemption requests (admin panel listing)
//router.get('/warranty-redemptions', authenticate, restrictToRoles('SALES_ADMIN'), controller.getAllRedemptions);
router.get('/warranty-redemptions', controller.getAllRedemptions);

module.exports = router;
