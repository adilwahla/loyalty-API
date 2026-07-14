const taskService = require("../../services/v1/taskService");
const { Task } = require("../../models");
const { success, error } = require("../../utils/response");
const {
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskCompleted,
  emitTaskAssigned
} = require("../../utils/taskEvents");
const { sendTaskAssignedNotification } = require("../../services/v1/pushNotification.service");

function notifyTaskAssignedPush(task) {
  const salesRepId = String(task?.salesRepId || '').trim();
  if (!salesRepId || !task?.id) return;
  sendTaskAssignedNotification({
    salesRepId,
    taskId: task.id,
    customerName: task.customerName,
  }).catch((err) => console.error("[PUSH] task assigned failed", err));
}

function resolveTaskId(req) {
  const fromParams = String(req.params.id || "").trim();
  if (fromParams) return fromParams;
  const fromBody = req.body?.id ?? req.body?.taskId ?? req.body?.task_id;
  const normalized = String(fromBody || "").trim();
  return normalized || null;
}

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

// ✅ Resolve customer from NFC scan (random visit — no task saved yet)
exports.createRandomVisit = async (req, res) => {
  try {
    const creatorUserId = req.user?.id || null;
    const nfcValue =
      req.body?.nfc_value ?? req.body?.nfcValue ?? req.body?.scanned_nfc_value;
    const nfcSerialNumber =
      req.body?.nfc_serial_number ?? req.body?.nfcSerialNumber;   // ← NEW

    const result = await taskService.resolveRandomVisitCustomerFromNfc({
      nfcValue,
      nfcSerialNumber,   // ← NEW
      creatorUserId,
    });

    res.json(success("Customer resolved successfully", result));
  } catch (err) {
    const status = err.statusCode || err.http || 500;
    const message = status === 500 ? "Failed to resolve customer from NFC scan" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
  }
};

// ✅ Complete random visit — task is saved only when the rep submits completion
exports.completeRandomVisit = async (req, res) => {
  try {
    const creatorUserId = req.user?.id || null;
    const nfcValue =
      req.body?.nfc_value ?? req.body?.nfcValue ?? req.body?.scanned_nfc_value;
    const nfcSerialNumber =
      req.body?.nfc_serial_number ?? req.body?.nfcSerialNumber;   // ← NEW
    const { comment, stockCount, dateVisit, date_visit, nextVisitDate } = req.body || {};

    const result = await taskService.completeRandomVisitFromNfc({
      nfcValue,
      nfcSerialNumber,   // ← NEW
      creatorUserId,
      comment,
      stockCount,
      dateVisit: dateVisit ?? date_visit ?? nextVisitDate,
    });

    const io = req.app.get("io");
    if (io) emitTaskCompleted(io, result.task);

    const formattedTask = taskService.formatTaskForApi(result.task);
    res.status(201).json(
      success("Random visit task completed successfully", {
        ...formattedTask,
        customer: result.customer,
        task: formattedTask,
      })
    );
  } catch (err) {
    const status = err.statusCode || err.http || 500;
    const message = status === 500 ? "Failed to complete random visit task" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
  }
};

// ✅ Cancel a pending random visit task (legacy flow / if task was created before submit)
exports.cancelRandomVisit = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const taskId = req.params.id ?? req.body?.id ?? req.body?.taskId;

    await taskService.cancelRandomVisitTask({ taskId, userId });
    res.json(success("Random visit task cancelled successfully"));
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Failed to cancel random visit task" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
  }
};

// ✅ Create task
exports.createTask = async (req, res) => {
  try {
    const creatorUserId = req.user?.id || null;
    const task = await taskService.createTask(req.body, creatorUserId);

    const io = req.app.get("io");
    if (io) emitTaskCreated(io, task);
    notifyTaskAssignedPush(task);

    res.status(201).json(success("Task created successfully", taskService.formatTaskForApi(task)));
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Failed to create task" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
  }
};

// ✅ Update task
exports.updateTask = async (req, res) => {
  try {
    const taskId = resolveTaskId(req);
    if (!taskId) {
      return res.status(400).json(error("Task id is required"));
    }

    const { taskStatus, comment, stockCount, dateVisit } = req.body || {};

    if (taskStatus === 'Completed') {
      const existing = await Task.findByPk(taskId);
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

    const task = await taskService.updateTask(taskId, req.body);
    if (!task) return res.status(404).json(error("Task not found"));

    const io = req.app.get("io");
    const assigneeChanged = task.oldUserId && task.oldUserId !== task.userId;

    if (io) {
      if (req.body.taskStatus === "Completed") {
        emitTaskCompleted(io, task);
      } else if (assigneeChanged) {
        emitTaskAssigned(io, task, task.oldUserId);
      } else {
        emitTaskUpdated(io, task);
      }
    }

    if (assigneeChanged) {
      notifyTaskAssignedPush(task);
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
    const { newUserId, newSalesRepId, salesRepId, newEndDate, reason } = req.body;

    const repCode = newSalesRepId || salesRepId;
    if (!newUserId && !repCode) {
      return res.status(400).json(error("Missing newUserId or newSalesRepId"));
    }
    if (!newEndDate) return res.status(400).json(error("Missing newEndDate"));

    const task = await taskService.reassignTask(id, {
      newUserId,
      newSalesRepId: repCode,
      newEndDate,
      reason,
    });
    if (!task) return res.status(404).json(error("Task not found"));

    const io = req.app.get("io");

    if (io && task.oldUserId && task.oldUserId !== task.userId) {
      emitTaskAssigned(io, task, task.oldUserId);
    }
    if (task.oldUserId && task.oldUserId !== task.userId) {
      notifyTaskAssignedPush(task);
    }

    const taskData = taskService.formatTaskForApi(task);

    res.json(success("Task reassigned successfully", taskData));
  } catch (err) {
    const status = err.statusCode || 500;
    const message = status === 500 ? "Failed to reassign task" : err.message;
    res.status(status).json(error(message, status === 500 ? err.message : null));
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
