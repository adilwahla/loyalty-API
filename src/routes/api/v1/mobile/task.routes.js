const express = require("express");
const router = express.Router();
const taskController = require("../../../../controllers/v1/taskController");
const { authenticate } = require("../../../../middleware/auth");

router.post("/tasks/random-visit", authenticate, taskController.createRandomVisit);
router.post("/tasks/random-visit/complete", authenticate, taskController.completeRandomVisit);
router.delete("/tasks/:id/random-visit", authenticate, taskController.cancelRandomVisit);
router.put("/tasks/:id", authenticate, taskController.updateTask);
router.put("/tasks", authenticate, taskController.updateTask);

module.exports = router;
