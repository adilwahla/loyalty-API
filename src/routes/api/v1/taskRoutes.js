const express = require("express");
const router = express.Router();
const taskController = require("../../../../src/controllers/v1/taskController");

router.get("/", taskController.getAllTasks);

// Filter endpoints (MUST come before /:id to avoid route conflicts)
router.get("/user/:id", taskController.getTaskByUser);
router.get("/customer/:customerId", taskController.getTasksByCustomer);
router.get("/status/:status", taskController.getTasksByStatus);
router.get("/priority/:priority", taskController.getTasksByPriority);
router.get("/date-range", taskController.getTasksByDateRange);

// Generic routes (must come after specific routes)
router.get("/:id", taskController.getTaskById);

router.post("/", taskController.createTask);
router.put("/:id", taskController.updateTask);
router.put("/:id/reassign", taskController.reassignTask);
router.delete("/:id", taskController.deleteTask);

module.exports = router;
