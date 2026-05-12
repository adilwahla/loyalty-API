// routes/api/v1/account.routes.js
// Multi-account endpoints for Business Owners
const express = require('express');
const router = express.Router();
const AccountController = require('../../../controllers/v1/account.controller');
const { authenticate, restrictToRoles } = require('../../../middleware/auth');
 
// GET  /api/v1/users/me/accounts  — list all accounts for the logged-in BO
router.get('/me/accounts', authenticate, restrictToRoles('BUSINESS_OWNER'), AccountController.getMyAccounts);
 
// POST /api/v1/users/me/accounts  — add a new account (groupId + customerId)
router.post('/me/accounts', authenticate, restrictToRoles('BUSINESS_OWNER'), AccountController.createMyAccount);
 
// PUT /api/v1/users/me/accounts/:accountId  — update customerId and/or groupId
router.put('/me/accounts/:accountId', authenticate, restrictToRoles('BUSINESS_OWNER'), AccountController.updateMyAccount);
 
// DELETE /api/v1/users/me/accounts/:accountId  — delete a non-primary account
router.delete('/me/accounts/:accountId', authenticate, restrictToRoles('BUSINESS_OWNER'), AccountController.deleteMyAccount);

// Inline uniqueness check — called by the Flutter app while the user types
router.get( '/accounts/check-customer-id', authenticate, AccountController.checkCustomerId,);

module.exports = router;