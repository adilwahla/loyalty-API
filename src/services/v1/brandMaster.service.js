const { BrandMaster } = require('../../models');

const BrandMasterService = {
  createBrand: async (data) => {
    return await BrandMaster.create(data);
  },

  getAllBrands: async () => {
    return await BrandMaster.findAll({ order: [['createdAt', 'DESC']] });
  },

  updateBrand: async (id, data) => {
    const brand = await BrandMaster.findByPk(id);
    if (!brand) throw new Error('Brand not found');
    return await brand.update(data);
  },

  deleteBrand: async (id) => {
    const brand = await BrandMaster.findByPk(id);
    if (!brand) throw new Error('Brand not found');
    await brand.destroy();
    return true;
  }
};

module.exports = BrandMasterService;
