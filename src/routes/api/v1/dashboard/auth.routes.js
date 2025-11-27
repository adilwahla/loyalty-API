const express = require('express');
const router = express.Router();
const dashboardAuthController = require('../../../../controllers/v1/dashboardAuth.controller');

router.post('/register', dashboardAuthController.registerUser);
router.post('/login', dashboardAuthController.loginUser);
router.put('/update-password/:id', dashboardAuthController.updatePassword);
router.post('/ensure-super-admin', dashboardAuthController.ensureSuperAdmin);


module.exports = router;
