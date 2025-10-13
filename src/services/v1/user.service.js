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
// exports.update = async (id, data) => {
//   const user = await User.findByPk(id);
//   if (!user) throw new Error('User not found');

//   const updates = {};
//   ['fullName','phone','role','isActive'].forEach((k) => {
//     if (Object.prototype.hasOwnProperty.call(data, k)) {
//       updates[k] = data[k];
//     }
//   });

//   // only set password if provided and non-empty
//   if (typeof data.password === 'string' && data.password.trim() !== '') {
//     updates.password = data.password;
//   }

//   await user.update(updates); // instance.update runs hooks
//   return user; // or return sanitized object
// };

exports.remove = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error('User not found');
  return await user.destroy();
};
