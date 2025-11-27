const express = require('express');
const router = express.Router();
const TechnicianController = require('../../../../controllers/v1/technician.controller');

// ✅ Mobile: Only technician can create a link
router.post('/', TechnicianController.create);

module.exports = router;
