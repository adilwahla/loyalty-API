const taskService = require("../../services/v1/taskService");
const { success, error } = require("../../utils/response");
const {
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskCompleted,
  emitTaskAssigned
} = require("../../utils/taskEvents");

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

// ✅ Get my tasks (NEW FIX)
exports.getMyTasks = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json(error("Unauthorized: user not found"));
    }

    const tasks = await taskService.getTaskByUser(userId);

    res.json(success("My tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch my tasks", err.message));
  }
};

// ✅ Get tasks by user
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
    const tasks = await taskService.getTasksByCustomer(req.params.customerId);
    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
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

    if (!startDate || !endDate) {
      return res.status(400).json(error("Missing startDate or endDate"));
    }

    const tasks = await taskService.getTasksByDateRange(startDate, endDate);

    res.json(success("Tasks fetched successfully", tasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by date range", err.message));
  }
};

// ✅ Create task
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);

    const io = req.app.get("io");
    if (io) emitTaskCreated(io, task);

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

    const io = req.app.get("io");

    if (io) {
      if (req.body.taskStatus === "Completed") {
        emitTaskCompleted(io, task);
      } else if (task.oldUserId && task.oldUserId !== task.userId) {
        emitTaskAssigned(io, task, task.oldUserId);
      } else {
        emitTaskUpdated(io, task);
      }
    }

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

    if (!newUserId) return res.status(400).json(error("Missing newUserId"));
    if (!newEndDate) return res.status(400).json(error("Missing newEndDate"));

    const task = await taskService.reassignTask(id, newUserId, newEndDate, reason);
    if (!task) return res.status(404).json(error("Task not found"));

    const io = req.app.get("io");

    if (io && task.oldUserId && task.oldUserId !== task.userId) {
      emitTaskAssigned(io, task, task.oldUserId);
    }

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
    const deleted = await taskService.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json(error("Task not found"));

    res.json(success("Task deleted successfully"));
  } catch (err) {
    res.status(500).json(error("Failed to delete task", err.message));
  }
};