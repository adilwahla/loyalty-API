const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/user.controller');

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
