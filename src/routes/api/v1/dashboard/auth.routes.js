const express = require('express');
const router = express.Router();
const dashboardAuthController = require('../../../../controllers/v1/dashboardAuth.controller');
const { authenticate } = require('../../../../middleware/auth');
 
// ---- Public routes (no auth required) ----
router.post('/register', dashboardAuthController.registerUser);
router.post('/login', dashboardAuthController.loginUser);
router.post('/ensure-super-admin', dashboardAuthController.ensureSuperAdmin);
 
// ---- Forgot Password flow (public - from login page) ----
router.post('/forgot-password/send-otp', dashboardAuthController.forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', dashboardAuthController.forgotPasswordVerifyOtp);
router.post('/forgot-password/reset-password', dashboardAuthController.forgotPasswordResetPassword);
 
// ---- Protected routes (auth required) ----
router.put('/change-password', authenticate, dashboardAuthController.changePassword);
router.put('/update-password/:id', authenticate, dashboardAuthController.updatePassword);
 
module.exports = router;
 