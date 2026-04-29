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

    if (process.env.NODE_ENV !== 'production') {
      const requestPath = req.originalUrl || req.url;
      const actorRole = req.user?.role || 'GUEST';
      console.log(
        `[GROUPS] loadGroups success | path=${requestPath} | role=${actorRole} | count=${groups.length} | status=200`
      );
    }

    res.json(groups);
  } catch (e) {
    const requestPath = req.originalUrl || req.url;
    console.error(`[GROUPS] loadGroups failed | path=${requestPath} | error=${e.message}`);
    next(e);
  }
};