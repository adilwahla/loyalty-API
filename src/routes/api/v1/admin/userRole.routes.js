const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/userRole.controller');


router.post('/create', controller.createUserRole);

router
  .route('/')
  
  .get(controller.getAllUserRoles);

router
  .route('/:id')
  .get(controller.getUserRoleById)
  .put(controller.updateUserRole)
  .delete(controller.deleteUserRole);

module.exports = router;
