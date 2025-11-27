const express = require('express');
const router = express.Router(); // ✅ THIS IS MISSING
const controller = require('../../../../src/controllers/v1/auth.controller');

router.post('/send-otp', controller.sendOtp);
router.post('/verify-otp', controller.verifyOtp);
router.post('/register', controller.registerUser);
router.post('/set-password', controller.setPassword);
router.post('/login', controller.loginUser);


//router.post('/forgot-password', controller.forgotPassword);
router.post('/forgot-password/send-otp', controller.forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', controller.forgotPasswordVerifyOtp);
router.post('/forgot-password/reset-password', controller.forgotPasswordResetPassword);

// Elham-endpoint
router.post('/login-sales-rep', controller.loginSalesRep);



module.exports = router;     