const taskService = require("../../services/v1/taskService");
const { Task } = require("../../models");
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

    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks", err.message));
  }
};

// ✅ Get task by ID
exports.getTaskById = async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json(error("Task not found"));

    res.json(success("Task fetched successfully", taskService.formatTaskForApi(task)));
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

    res.json(success("My tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch my tasks", err.message));
  }
};

// ✅ Get tasks by user
exports.getTaskByUser = async (req, res) => {
  try {
    const tasks = await taskService.getTaskByUser(req.params.id);
    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by user", err.message));
  }
};

// ✅ Get tasks by customer
exports.getTasksByCustomer = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByCustomer(req.params.customerId);
    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by customer", err.message));
  }
};

// ✅ Get tasks by status
exports.getTasksByStatus = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByStatus(req.params.status);
    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by status", err.message));
  }
};

// ✅ Get tasks by priority
exports.getTasksByPriority = async (req, res) => {
  try {
    const tasks = await taskService.getTasksByPriority(req.params.priority);
    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
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

    res.json(success("Tasks fetched successfully", taskService.formatTasksForApi(tasks)));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by date range", err.message));
  }
};

// ✅ Create task
exports.createTask = async (req, res) => {
  try {
    const creatorUserId = req.user?.id || null;
    const task = await taskService.createTask(req.body, creatorUserId);

    const io = req.app.get("io");
    if (io) emitTaskCreated(io, task);

    res.status(201).json(success("Task created successfully", taskService.formatTaskForApi(task)));
  } catch (err) {
    res.status(500).json(error("Failed to create task", err.message));
  }
};

// ✅ Update task
exports.updateTask = async (req, res) => {
  try {
    const { taskStatus, comment, stockCount, dateVisit } = req.body || {};

    if (taskStatus === 'Completed') {
      const existing = await Task.findByPk(req.params.id);
      if (!existing) return res.status(404).json(error("Task not found"));

      if (!taskService.isActivationTask(existing)) {
        if (!comment?.trim()) {
          return res.status(400).json(error('Comment is required when completing a task'));
        }
        if (stockCount === undefined || stockCount === null || Number(stockCount) < 0) {
          return res.status(400).json(error('Stock count is required when completing a task'));
        }
        if (!dateVisit) {
          return res.status(400).json(error('Next visit date is required when completing a task'));
        }
      }
    }

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

    const taskData = taskService.formatTaskForApi(task);

    res.json(success("Task updated successfully", taskData));
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Failed to update task" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
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

    const taskData = taskService.formatTaskForApi(task);

    res.json(success("Task reassigned successfully", taskData));
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
