const express = require('express');
const router = express.Router();
const BrandMasterController = require('../../../../controllers/v1/brandMaster.controller');

// Create
router.post('/', BrandMasterController.create);

// Read
router.get('/', BrandMasterController.getAll);

// Update
router.put('/:id', BrandMasterController.update);

// Delete
router.delete('/:id', BrandMasterController.delete);

module.exports = router;
