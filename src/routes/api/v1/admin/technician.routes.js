const express = require('express');
const router = express.Router();
const TechnicianController = require('../../../../controllers/v1/technician.controller');

// ✅ Admin: manage all technician links
router.get('/', TechnicianController.getAll);
router.put('/:id', TechnicianController.update);
router.delete('/:id', TechnicianController.remove);

module.exports = router;
