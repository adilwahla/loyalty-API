const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/analytics.controller');
//const controller = require('../../../../controllers/v1/analytics.controller');
const { protect, authenticate, restrictToRoles } = require('../../../../middleware/auth');

// Typically admin-only; relax if you want mobile to see
//router.get('/dashboard', authenticate, restrictToRoles('SALES_ADMIN'), controller.getDashboardStats);
router.get('/dashboard',  controller.getDashboardStats);

module.exports = router;
