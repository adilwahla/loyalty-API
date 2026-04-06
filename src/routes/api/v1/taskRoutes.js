const express = require("express");
const router = express.Router();
const taskController = require("../../../../src/controllers/v1/taskController");
 
// ✅ Filter endpoints (must come first to avoid conflicts with /:id)
router.get("/user/:id", taskController.getTaskByUser);
router.get("/customer/:customerId", taskController.getTasksByCustomer);
router.get("/status/:status", taskController.getTasksByStatus);
router.get("/priority/:priority", taskController.getTasksByPriority);
router.get("/date-range", taskController.getTasksByDateRange);
 
// ✅ Generic routes (must come after specific routes)
router.get("/", taskController.getAllTasks);
router.get("/:id", taskController.getTaskById);
 
router.post("/", taskController.createTask);
router.put("/:id", taskController.updateTask);
router.put("/:id/reassign", taskController.reassignTask);
router.delete("/:id", taskController.deleteTask);
 
module.exports = router;