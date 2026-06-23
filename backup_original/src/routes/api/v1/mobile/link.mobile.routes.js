const router = require('express').Router();
const { authenticate } = require('../../../../middleware/auth');
const ctrl = require('../../../../controllers/v1/link.controller');

// BO: generate a QR to link technicians
router.get('/bo/:boId/link-qr', authenticate, ctrl.getBusinessOwnerLinkQr);

// TECHNICIAN: scan QR to link to BO
router.post('/link/scan', authenticate, ctrl.scanBusinessOwnerLinkQr);

// BO: list linked technicians
router.get('/bo/:boId/technicians', authenticate, ctrl.listTechniciansForBo);

module.exports = router;
