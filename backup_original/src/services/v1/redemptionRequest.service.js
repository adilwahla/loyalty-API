const RedemptionRequest = require('../../models/redemptionRequest.model.js');

exports.create = async (data) => {
  // Ensure IDs are strings (just in case)
  data.userId = String(data.userId);
  data.rewardId = String(data.rewardId);
  if (data.salesRepId) data.salesRepId = String(data.salesRepId);
  if (data.userRole) data.userRole = String(data.userRole);
  return await RedemptionRequest.create(data);
};

exports.getAll = async (filters = {}) => {
  return await RedemptionRequest.findAll({
    where: filters,
    order: [['createdAt', 'DESC']],
  });
};

exports.getById = async (id) => {
  return await RedemptionRequest.findByPk(id);
};

exports.updateStatus = async (id, updates) => {
  const request = await RedemptionRequest.findByPk(id);
  if (!request) throw new Error('Request not found');
  return await request.update({
    ...updates,
    reviewedBy: updates.reviewedBy || request.reviewedBy,
    approvedBy: updates.approvedBy || request.approvedBy,
  });
};
exports.update = async (id, updates) => {
  const request = await RedemptionRequest.findByPk(id);
  if (!request) throw new Error('Request not found');
  return await request.update(updates);
};

exports.remove = async (id) => {
  const request = await RedemptionRequest.findByPk(id);
  if (!request) throw new Error('Request not found');
  return await request.destroy();
};
