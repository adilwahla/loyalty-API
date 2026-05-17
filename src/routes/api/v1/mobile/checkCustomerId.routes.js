// routes/api/v1/mobile/checkCustomerId.routes.js
// Public customer-id uniqueness check (BO registration, before login)
const express = require('express');
const router = express.Router();
const AccountController = require('../../../../controllers/v1/account.controller');

// GET /api/v1/mobile/check-customer-id?bsgCustId=X[&excludeId=Y]
router.get('/check-customer-id', AccountController.checkCustomerId);

module.exports = router;
