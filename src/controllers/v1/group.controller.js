// this is new update for group.
// controllers/v1/group.controller.js
const { Group } = require('../../models');

/**
 * Get all groups (for filter dropdown in admin panel)
 */
exports.getAllGroups = async (req, res, next) => {
  try {
    const groups = await Group.findAll({
      attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex'],
      order: [['groupId', 'ASC']],
    });
    res.json(groups);
  } catch (e) {
    next(e);
  }
};
