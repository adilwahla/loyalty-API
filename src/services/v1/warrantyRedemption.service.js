// src/services/v1/warrantyRedemption.service.js
const db = require('../../models');
const { sequelize, User, Reward, WarrantyRedemption } = db;  // <-- sequelize is defined now
// const { WarrantyRedemption } = require('../../models');
const { sendEmailToRedemptionStakeholders ,sendApprovalEmail  } = require('../../utils/warrantyRedemptionEmail');
// const { io } = require('../../../config/server'); // Make sure this is correct


exports.createRedemption = async (data, socketIO) => {
  return sequelize.transaction(async (t) => {
    const userId = String(data.userId);

    const requiredPoints = Number(data.requiredPoints);
    if (!Number.isFinite(requiredPoints) || requiredPoints < 0) {
      throw new Error('Invalid requiredPoints');
    }

    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) throw new Error('User not found');

    const current = Number(user.points || 0);
    if (current < requiredPoints) throw new Error('Insufficient points');

    user.points = current - requiredPoints;
    await user.save({ transaction: t });

    const redemption = await WarrantyRedemption.create({
      userId,
      name: data.name,
      role: data.role,
      phone: data.phone,
      rewards: data.rewards,
      requestDate: data.requestDate,
      location: data.location,
      pointsAccumulated: String(data.pointsAccumulated ?? '0'),
      requiredPoints,
      status: 'PENDING',
    }, { transaction: t });

    // ✅ Build a plain payload (don’t emit a Sequelize instance)
    const payload = {
      id: redemption.id,
      userId,
      name: redemption.name,
      role: redemption.role,
      phone: redemption.phone,
      rewards: redemption.rewards,
      requestDate: redemption.requestDate,
      location: redemption.location,
      requiredPoints,
      pointsAccumulated: redemption.pointsAccumulated,
      status: redemption.status,
      createdAt: redemption.createdAt,
      updatedAt: redemption.updatedAt,
    };

    // ✅ Emit **after** commit succeeds
    t.afterCommit(() => {
      if (!socketIO) return;

      // user-specific
      socketIO.to(userId).emit('points_updated', { totalPoints: user.points });
      socketIO.to(userId).emit('redemption_created', {
        id: redemption.id,
        userId,
        title: redemption.rewards,
        requiredPoints,
        status: redemption.status,
        timestamp: redemption.createdAt,
      });

      // 👉 For now: global broadcast so admin receives it without rooms
      socketIO.emit('new_redemption', payload);
    });

    return { redemption, totalPoints: user.points };
  });
};


exports.approveOrReject = async ({ user, redemptionId, status }, io) => {
  // Optional RBAC (enable later)
  // if (!user || user.role !== 'SALES_ADMIN') throw new Error('Only SALES_ADMIN can approve/reject');

  return sequelize.transaction(async (t) => {
    const redemption = await WarrantyRedemption.findByPk(redemptionId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!redemption) throw new Error('Redemption not found');

    const updated = await redemption.update({ status }, { transaction: t });

    const payload = {
      id: updated.id,
      userId: updated.userId,
      name: updated.name,
      role: updated.role,
      phone: updated.phone,
      rewards: updated.rewards,
      requestDate: updated.requestDate,
      location: updated.location,
      requiredPoints: updated.requiredPoints,
      pointsAccumulated: updated.pointsAccumulated,
      status: updated.status,        // "APPROVED" | "REJECTED"
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    t.afterCommit(async () => {
      if (!io) return;

      // Notify the user about final decision
      io.to(String(updated.userId)).emit('redemption_status_updated', payload);

      // ✅ For now, broadcast so any admin UI updates live without rooms
      io.emit('redemption_status_updated', payload);

      // If you want to email on approval later:
      // if (status === 'APPROVED') await sendEmailToRedemptionStakeholders(updated);

      // inside t.afterCommit of approveOrReject
if (status === 'APPROVED') {
  // await sendApprovalEmail(payload);
  // optionally also:
  await sendEmailToRedemptionStakeholders(payload);
}
    });  

    return payload;
  });
};

exports.getAllRedemptions = async () => {
  return await WarrantyRedemption.findAll({ order: [['createdAt', 'DESC']] });
};
