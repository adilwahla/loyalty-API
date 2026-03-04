// routes/api/v1/mobile/group.routes.js
// Groups endpoint for the mobile app (Business Owners use it for the dropdown)
const express = require('express');
const router = express.Router();
const GroupController = require('../../../../controllers/v1/group.controller');
const { authenticate, restrictToRoles } = require('../../../../middleware/auth');
 
// GET /api/v1/mobile/groups — public (no auth), needed for Owner Registration dropdown
router.get('/groups', GroupController.getAllGroups);
 
module.exports = router;
 