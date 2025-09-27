const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/user.controller');
const boController = require('../../../../controllers/v1/business_owner.controller');
const { authenticate, restrictToRoles } = require('../../../../middleware/auth');

// router.put('/:userId/approve', authenticate, restrictToRoles('SALES_ADMIN','ADMIN'), controller.approveBusinessOwner);
// router.put('/:userId/reject',  authenticate, restrictToRoles('SALES_ADMIN','ADMIN'), controller.rejectBusinessOwner);

// -------- Business Owner–specific endpoints (PUT/POST/GET) --------
router.get('/business-owners', boController.listBusinessOwners);               // ?status=&q=&limit=&offset=
router.get('/business-owners/pending', boController.listPendingBusinessOwners);
router.get('/business-owners/approved', boController.listApprovedBusinessOwners);

router.put('/business-owners/:userId/approve', boController.approveBusinessOwner);
router.put('/business-owners/:userId/reject',  boController.rejectBusinessOwner);

router.post('/business-owners', boController.createBusinessOwner);             // admin creates BO
router.put('/business-owners/:userId', boController.updateBusinessOwner);

// router.put('/:userId/approve',  bo_controller.approveBusinessOwner);
// router.put('/:userId/reject',  bo_controller.rejectBusinessOwner);
// router.post('/', bo_controller.createBusinessOwner);
// router.put('/:userId', bo_controller.updateBusinessOwner);

router
  .route('/')
  .post(controller.createUser)
  .get(controller.getAllUsers);

router
  .route('/:id')
  .get(controller.getUserById)
  .put(controller.updateUser)
  .delete(controller.deleteUser);

module.exports = router;
