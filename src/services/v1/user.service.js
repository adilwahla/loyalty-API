//const User = require('../../models/user.model');
const db = require('../../models');
const User = db.User; // ✅ This is the actual Sequelize model instance

exports.create = async (data) => {
  return await User.create(data);
};

exports.getAll = async () => {
  return await User.findAll();
};

exports.getById = async (id) => {
  return await User.findByPk(id);
};

exports.update = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return await user.update(data);
};

exports.remove = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return await user.destroy();
};
