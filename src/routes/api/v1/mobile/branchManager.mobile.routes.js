// src/routes/api/v1/mobile/branchManager.mobile.routes.js
//
// Mirrors the pattern of salesRep.routes.js exactly.
// Returns BRANCH_MANAGER users for the signup dropdown.
// No auth required — called during self-registration before login.
//
// ── HOW TO WIRE INTO server.js ────────────────────────────────────────────────
// Open:  src/app.js  (or wherever server.js mounts routes)
// Add ONE line alongside the other /api/v1/mobile mounts:
//
//   app.use('/api/v1/mobile', require('./routes/api/v1/mobile/branchManager.mobile.routes'));
//
// That exposes:
//   GET /api/v1/mobile/branch-managers

const router = require('express').Router();
const { User } = require('../../../../models');

// GET /api/v1/mobile/branch-managers
// Response: [ { branchManagerId: "MGR103", fullName: "Manager One" }, ... ]
// Field `branchManagerId` matches the value stored on the SALES_REP user row
// (user.branchManagerId = "MGR103").
router.get('/branch-managers', async (req, res, next) => {
  try {
    const managers = await User.findAll({
      where: { role: 'BRANCH_MANAGER' },
      attributes: ['branchManagerId', 'fullName'],
      order:  [['fullName', 'ASC']],
      raw:    true,
    });

    // Filter out rows with no ID and shape consistently
    const result = managers
      .filter(m => m.branchManagerId)
      .map(m => ({
        branchManagerId: m.branchManagerId,
        fullName:        m.fullName || m.branchManagerId,
      }));

    return res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;