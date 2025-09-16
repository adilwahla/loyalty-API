const { Offer } = require('../../models');
const { Op } = require('sequelize');

exports.getPaginated = async ({ page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await Offer.findAndCountAll({ offset: +offset, limit: +limit });
  return { total: count, data: rows };
};

exports.getAll = async () => {
  return await Offer.findAll();
};

exports.create = async (data) => {
  try {
    return await Offer.create(data);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      throw new Error('Offer ID already exists');
    }
    throw error;
  }
};


exports.bulkCreate = async (dataList) => {
  return await Offer.bulkCreate(dataList);
};

exports.update = async (id, data) => {
  const offer = await Offer.findByPk(id);
  if (!offer) throw new Error('Offer not found');
  return await offer.update(data);
};
exports.removeByOfferId = async (offerId) => {
  console.log('Attempting to delete offerId:', offerId);

  const offer = await Offer.findOne({ where: { offerId } });
  if (!offer) {
    throw new AppError(`Offer with ID ${offerId} not found`, 404);
  }
  await offer.destroy();
};
exports.remove = async (id) => {
  const offer = await Offer.findByPk(id);
  if (!offer) throw new Error('Offer not found');
  await offer.destroy();
  return { message: 'Deleted successfully' };
};



