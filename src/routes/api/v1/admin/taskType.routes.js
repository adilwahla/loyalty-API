const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/taskType.controller');

router.get('/', controller.getTaskTypes);

module.exports = router;
