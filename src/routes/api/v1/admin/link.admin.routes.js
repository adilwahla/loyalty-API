const express = require('express');
const router = express.Router();
const { protect, authenticate, restrictToRoles } = require('../../../../middleware/auth');
const ctrl = require('../../../../controllers/v1/link.controller');

// // Admin: list links
// router.get('/links', authenticate, restrictToRoles('SALES_ADMIN'), ctrl.listLinks);

// Admin: update share factor
// router.put('/links/:linkId/share-factor', authenticate, restrictToRoles('SALES_ADMIN'), ctrl.setShareFactor);


// Users for dropdowns
router.get(
    '/users',
    //   authenticate,
    //   restrictToRoles('SALES_ADMIN'),
    ctrl.adminListUsers
); // ?role=BUSINESS_OWNER|TECHNICIAN&q=ahmed&limit=50

// Links table
router.get(
    '/links',
    //   authenticate,
    //   restrictToRoles('SALES_ADMIN'),
    ctrl.listLinks
); // supports ?status=ACTIVE&boId=...&technicianId=...

router.post(
    '/links',
    //   authenticate,
    //   restrictToRoles('SALES_ADMIN'),
    ctrl.adminCreateLink
);

router.put(
    '/links/:linkId/share-factor',
    //   authenticate,
    //   restrictToRoles('SALES_ADMIN'),
    ctrl.setShareFactor
);

router.delete(
    '/links/:linkId',
    //   authenticate,
    //   restrictToRoles('SALES_ADMIN'),
    ctrl.adminDeleteLink
); // ?hard=true for hard delete

module.exports = router;
