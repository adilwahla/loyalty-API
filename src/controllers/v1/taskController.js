const taskService = require("../../services/v1/taskService");
const { success, error } = require("../../utils/response");
const { emitTaskCreated, emitTaskUpdated, emitTaskCompleted, emitTaskAssigned } = require("../../utils/taskEvents");
 
// ✅ Get all tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();
 
    // Debug logging for development (tasks, customers, groups)
    if (process.env.NODE_ENV !== 'production') {
      const tasksWithCustomers = tasks.filter(t => t.customer).length;
      const tasksWithGroups = tasks.filter(t => t.customer && t.customer.group).length;
      console.log(`📊 [TaskController] getAllTasks: ${tasks.length} total, ${tasksWithCustomers} with customers, ${tasksWithGroups} with groups`);
 
      if (tasks.length > 0) {
        const sampleTask = tasks[0];
        const hasCustomer = !!sampleTask.customer;
        const hasGroup = hasCustomer && !!sampleTask.customer.group;
        console.log(`🔍 [TaskController] Sample task structure:`, {
          taskId: sampleTask.id,
          customerId: sampleTask.customerId,
          hasCustomer,
          hasGroup,
          groupName: hasGroup ? sampleTask.customer.group.groupName : null
        });
      }
    }
 
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
 
    // Debug logging to verify customer coordinates
    if (process.env.NODE_ENV !== 'production' && tasks && tasks.length > 0) {
      const sampleTask = tasks[0];
      if (sampleTask.customer) {
        console.log(`📍 [TaskController] Sample task customer coordinates:`, {
          taskId: sampleTask.id,
          customerId: sampleTask.customerId,
          customerLatitude: sampleTask.customer.latitude,
          customerLongitude: sampleTask.customer.longitude,
          latitudeType: typeof sampleTask.customer.latitude,
          longitudeType: typeof sampleTask.customer.longitude,
          hasCoordinates: !!(sampleTask.customer.latitude && sampleTask.customer.longitude),
          customerKeys: Object.keys(sampleTask.customer),
          customerLatInKeys: 'latitude' in sampleTask.customer,
          customerLngInKeys: 'longitude' in sampleTask.customer
        });
      }
    }
 
    // Ensure all tasks have serialized customer coordinates
    const serializedTasks = tasks.map(task => {
      if (task && task.customer) {
        const serialized = task.toJSON ? task.toJSON() : task;
        if (serialized.customer) {
          serialized.customer.latitude = task.customer.latitude || null;
          serialized.customer.longitude = task.customer.longitude || null;
        }
        return serialized;
      }
      return task.toJSON ? task.toJSON() : task;
    });
 
    res.json(success("Tasks fetched successfully", serializedTasks));
  } catch (err) {
    res.status(500).json(error("Failed to fetch tasks by user", err.message));
  }
};
 
// ✅ Get tasks by customer
exports.getTasksByCustomer = async (req, res) => {
  try {
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
 
// ✅ Create task
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body);
 
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
 
    const io = req.app.get('io');
    if (io && task) {
      if (req.body.taskStatus === 'Completed' || task.taskStatus === 'Completed') {
        emitTaskCompleted(io, task);
      }
 
      if (task.oldUserId && task.oldUserId !== task.userId) {
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
 
    const io = req.app.get('io');
    if (io && task && task.oldUserId && task.oldUserId !== task.userId) {
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
    console.log(req.params);
    const deleted = await taskService.deleteTask(req.params.id);
    if (!deleted) return res.status(404).json(error("Task not found"));
    res.json(success("Task deleted successfully"));
  } catch (err) {
    res.status(500).json(error("Failed to delete task", err.message));
  }
}; 