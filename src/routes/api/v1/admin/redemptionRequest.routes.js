const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/redemptionRequest.controller');

// 🚀 Admin Routes
router.post('/create', controller.create);
router.get('/', controller.getAll); // Optionally filter by status, userId, etc.
router.get('/:id', controller.getById);
router.put('/:id/status', controller.updateStatus); // Approve, Reject, etc.
// Update a redemption request by ID
router.put('/:id', controller.update); // 👈 Add this line

router.delete('/:id', controller.remove);

module.exports = router;
