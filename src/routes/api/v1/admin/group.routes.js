// this is new update for group.
const express = require('express');
const router = express.Router();
const GroupController = require('../../../../controllers/v1/group.controller');
const { authenticate, restrictToRoles } = require('../../../../middleware/auth');

// Get all groups (for filter dropdown in admin panel)
router.get('/', authenticate, restrictToRoles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'), GroupController.getAllGroups);

module.exports = router;
