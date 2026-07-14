const express = require('express');
const router = express.Router();
const { authenticate } = require('../../../../middleware/auth');
const deviceTokenController = require('../../../../controllers/v1/deviceToken.controller');

router.post('/device-token', authenticate, deviceTokenController.registerDeviceToken);
router.post('/device-token/remove', authenticate, deviceTokenController.removeDeviceToken);

module.exports = router;
