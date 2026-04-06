const BrandMasterService = require('../../services/v1/brandMaster.service');

const BrandMasterController = {
  create: async (req, res) => {
    try {
      const newBrand = await BrandMasterService.createBrand(req.body);
      res.status(201).json({ success: true, data: newBrand });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const brands = await BrandMasterService.getAllBrands();
      res.status(200).json({ success: true, data: brands });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const updated = await BrandMasterService.updateBrand(req.params.id, req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      await BrandMasterService.deleteBrand(req.params.id);
      res.status(200).json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = BrandMasterController;
