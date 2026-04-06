const { Op } = require('sequelize');
//const Reward = require('../../models/reward.model');
const db = require('../../models'); // ✅ central model loader
const Reward = db.Reward; // ✅ single source of truth
exports.getAll = async (filters = {}) => {
  const where = {}; 
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.points) where.points = filters.points;

  const allRewards = await Reward.findAll({ where, order: [['dateCreated', 'DESC']] });

  // Manual role-based filtering
  if (filters.role) {
    return allRewards.filter(r => r.users.includes(filters.role));
  }

  return allRewards;
};


exports.getPaginated = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'dateCreated',   
    sortOrder = 'DESC',
    isActive,
    points
  } = filters;

  const offset = (page - 1) * limit;
  const where = {};

  if (isActive !== undefined) where.isActive = isActive;
  if (points) where.points = points;

  const result = await Reward.findAndCountAll({
    where,
    order: [[sortBy, sortOrder]],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    total: result.count,
    page: parseInt(page),
    pageSize: parseInt(limit),
    rewards: result.rows
  };
};

exports.create = async (data) => {
  const exists = await Reward.findOne({ where: { rewardId: data.rewardId } });
  if (exists) throw new Error('rewardId already exists');
  delete data.id;
  return await Reward.create(data);
};

exports.bulkCreate = async (rewardList) => {
  const inserted = [];
  const skipped = [];
  const incomingIDs = new Set();
  const duplicatesInPayload = new Set();

  for (const reward of rewardList) {
    if (incomingIDs.has(reward.rewardId)) {
      duplicatesInPayload.add(reward.rewardId);
    } else {
      incomingIDs.add(reward.rewardId);
    }
  }

  const existingRewards = await Reward.findAll({
    where: { rewardId: { [Op.in]: Array.from(incomingIDs) } },
    attributes: ['rewardId']
  });

  const existingSet = new Set(existingRewards.map(r => r.rewardId));

  for (const reward of rewardList) {
    if (existingSet.has(reward.rewardId)) {
      skipped.push({ rewardId: reward.rewardId, reason: 'Already exists in database' });
    } else if (duplicatesInPayload.has(reward.rewardId)) {
      skipped.push({ rewardId: reward.rewardId, reason: 'Duplicate in request' });
    } else {
      try {
        const newReward = await Reward.create(reward);
        inserted.push(newReward);
      } catch (err) {
        skipped.push({ rewardId: reward.rewardId, reason: `Insertion failed: ${err.message}` });
      }
    }
  }

  return { inserted, skipped };
};

exports.update = async (id, updates) => {
  const reward = await Reward.findByPk(id);
  if (!reward) throw new Error('Reward not found');
  return await reward.update(updates);
};

exports.remove = async (id) => {
  const reward = await Reward.findByPk(id);
  if (!reward) throw new Error('Reward not found');
  return await reward.destroy();
};
