const express = require("express");
const router = express.Router();
const taskController = require("../../../../src/controllers/v1/taskController");

router.get("/", taskController.getAllTasks);
router.get("/:id", taskController.getTaskById);

router.post("/", taskController.createTask);
router.put("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);


// Filter endpoints
router.get("/user/:id", taskController.getTaskByUser);
router.get("/customer/:customerId", taskController.getTasksByCustomer);
router.get("/status/:status", taskController.getTasksByStatus);
router.get("/priority/:priority", taskController.getTasksByPriority);
router.get("/date-range", taskController.getTasksByDateRange);

module.exports = router;
