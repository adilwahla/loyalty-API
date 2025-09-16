const UserRole = require('../../models/userRole.model');

exports.create = async (data) => {
  return await UserRole.create(data);
};

exports.getAll = async () => {
  return await UserRole.findAll();
};

exports.getById = async (id) => {
  return await UserRole.findByPk(id);
};

exports.update = async (id, data) => {
  const role = await UserRole.findByPk(id);
  if (!role) throw new Error('Role not found');
  return await role.update(data);
};

exports.remove = async (id) => {
  const role = await UserRole.findByPk(id);
  if (!role) throw new Error('Role not found');
  return await role.destroy();
};
