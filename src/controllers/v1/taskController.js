const taskService = require("../../services/v1/taskService");
const { success, error } = require("../../utils/response");
const { emitTaskCreated, emitTaskUpdated, emitTaskCompleted, emitTaskAssigned } = require("../../utils/taskEvents");

// ✅ Get all tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks", err.message));
  }
};

// ✅ Get task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json(error("Task not found"));
    res.json(success("Task fetched successfully", task));
  } catch (err) {
    res.status(500).json(error("Failed to fetch task", err.message));
  }
};

// ✅ Get tasks by sales rep (userId)
exports.getTaskByUser = async (req, res) => {
  try {
    const tasks = await taskService.getTaskByUser(req.params.id);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by user", err.message));
  }
};


// ✅ Get tasks by customer
exports.getTasksByCustomer = async (req, res) => {
  try {
    // const customer = userService.findById(req.params.customerId)
    const tasks = await taskService.getTasksByCustomer(req.params.customerId);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err){
    res.status(500).json(error("Failed to fetch tasks by customer", err.message));
  }
};

// ✅ Get tasks by status
exports.getTasksByStatus = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByStatus(req.params.status);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by status", err.message));
  }
};

// ✅ Get tasks by priority
exports.getTasksByPriority = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByPriority(req.params.priority);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by priority", err.message));
  }
};

// ✅ Get tasks by date range
exports.getTasksByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json(error("Missing startDate or endDate query params"));
    const tasks = await taskService.getTasksByDateRange(startDate, endDate);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by date range", err.message));
  }
};

// ✅ Create task (assign to sales rep & customer)
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);
    
    // Emit socket event for task creation
    const io = req.app.get('io');
    if (io && task) {
      emitTaskCreated(io, task);
    }
    
    res.status(201).json(success("Task created successfully", task));
  } catch (err) {
    res.status(500).json(error("Failed to create task", err.message));
  }
};

// ✅ Update task
exports.updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);
    if (!task) return res.status(404).json(error("Task not found"));
    
    // Get socket instance
    const io = req.app.get('io');
    
    if (io && task) {
      // Check if task was completed
      if (req.body.taskStatus === 'Completed' || task.taskStatus === 'Completed') {
        emitTaskCompleted(io, task);
      }
      
      // Check if task was reassigned (userId changed)
      if (task.oldUserId && task.oldUserId !== task.userId) {
        emitTaskAssigned(io, task, task.oldUserId);
      } else {
        // Regular update
        emitTaskUpdated(io, task);
      }
    }
    
    // Remove oldUserId from response (it was only for internal use)
    const taskData = task.toJSON ? task.toJSON() : task;
    const { oldUserId, ...taskResponse } = taskData;
    
    res.json(success("Task updated successfully", taskResponse));
  } catch (err) {
    res.status(500).json(error("Failed to update task", err.message));
  }
};

// ✅ Reassign task
exports.reassignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { newUserId, newEndDate, reason } = req.body;

    // Validate required fields
    if (!newUserId) {
      return res.status(400).json(error("Missing newUserId"));
    }
    if (!newEndDate) {
      return res.status(400).json(error("Missing newEndDate"));
    }

    const task = await taskService.reassignTask(id, newUserId, newEndDate, reason);
    if (!task) return res.status(404).json(error("Task not found"));

    // Get socket instance
    const io = req.app.get('io');
    if (io && task) {
      // Emit task assigned event for reassignment
      if (task.oldUserId && task.oldUserId !== task.userId) {
        emitTaskAssigned(io, task, task.oldUserId);
      }
    }

    // Remove oldUserId from response (it was only for internal use)
    const taskData = task.toJSON ? task.toJSON() : task;
    const { oldUserId, ...taskResponse } = taskData;

    res.json(success("Task reassigned successfully", taskResponse));
  } catch (err) {
    res.status(500).json(error("Failed to reassign task", err.message));
  }
};

// ✅ Delete task
exports.deleteTask = async (req, res) => {
  try {
    console.log(req.params);
    const deleted = await taskService.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json(error("Task not found"));
    res.json(success("Task deleted successfully"));
  } catch (err) {
    res.status(500).json(error("Failed to delete task", err.message));
  }
};
