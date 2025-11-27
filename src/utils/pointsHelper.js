// utils/pointsHelper.js
const { User, UserRole } = require('../models');

async function addPointsToUser(userId) {
  const user = await User.findByPk(userId);
  if (!user) return;

  // Get user role
  const role = await UserRole.findOne({ where: { roleName: user.role } });
  if (!role || role.platform !== 'Mobile') return; // skip dashboard roles

  // Accumulate points
  const newPoints = user.points + (role.basePoints || 0);
  await user.update({ points: newPoints });

  return newPoints;
}

module.exports = { addPointsToUser };
