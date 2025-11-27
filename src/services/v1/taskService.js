const { Op } = require("sequelize");
const { Task, User } = require("../../models");

// Valid task type values
const VALID_TASK_TYPES = ["Collection", "Promotion", "Up/Cross sell"];

/**
 * Validates taskType string (can be comma-separated)
 * @param {string} taskType - Task type string (e.g., "Collection" or "Collection,Promotion")
 * @returns {string} - Validated and normalized taskType string
 * @throws {Error} - If any value in the comma-separated string is invalid
 */
function validateTaskType(taskType) {
  if (!taskType) return null; // Allow null/undefined
  
  // Split by comma and trim whitespace
  const types = taskType.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  if (types.length === 0) return null;
  
  // Validate each type
  const invalidTypes = types.filter(type => !VALID_TASK_TYPES.includes(type));
  
  if (invalidTypes.length > 0) {
    throw new Error(
      `Invalid task type(s): ${invalidTypes.join(', ')}. Valid values are: ${VALID_TASK_TYPES.join(', ')}`
    );
  }
  
  // Return normalized comma-separated string
  return types.join(',');
}

class TaskService {
  async getAllTasks() {
    return await Task.findAll({ include: [{ model: User, as: "user" }] });
  }

  async getTaskById(id) {
    return await Task.findByPk(id, { include: [{ model: User, as: "user" }] });
  }

  async getTaskByUser(userId) {
    return await Task.findAll({ where: { userId } });
  }

  async getTasksByCustomer(customerId) {
    return await Task.findAll({ where: { customerId } });
  }

  async getTasksByStatus(taskStatus) {
    return await Task.findAll({ where: { taskStatus } });
  }

  async getTasksByPriority(priority) {
    return await Task.findAll({ where: { priority } });
  }


  async getTasksByDateRange(startDate, endDate) {
    return await Task.findAll({
      where: {
        [Op.or]: [
          {
            dateFrom: { [Op.between]: [startDate, endDate] },
          },
          {
            dateTo: { [Op.between]: [startDate, endDate] },
          },
        ],
      },
    });
  }

  async createTask(data) {
    // Validate assignment
    if (!data.userId) throw new Error("Missing assigned sales rep (userId)");
    if (!data.customerId) throw new Error("Missing assigned customer (customerId)");

    // Validate and normalize taskType if provided
    if (data.taskType !== undefined) {
      data.taskType = validateTaskType(data.taskType);
    }

    const task = await Task.create(data);
    // Reload with relations for socket events
    return await Task.findByPk(task.id, { include: [{ model: User, as: "user" }] });
  }

  async updateTask(id, data) {
    const task = await Task.findByPk(id, { include: [{ model: User, as: "user" }] });
    if (!task) return null;
    
    // Store old userId to detect reassignment
    const oldUserId = task.userId;

    // Validate and normalize taskType if provided
    if (data.taskType !== undefined) {
      data.taskType = validateTaskType(data.taskType);
    }

    if (data.taskStatus === "Completed" && !task.completedAt) {
      data.completedAt = new Date();
    }
    await task.update(data);
    // Reload task with relations to get updated data
    await task.reload({ include: [{ model: User, as: "user" }] });
    
    // Return task with oldUserId for socket events
    task.oldUserId = oldUserId;
    
    return task;
  }

  async deleteTask(id) {
    const task = await Task.findByPk(id);
    if (!task) return null;
    await task.destroy();
    return true;
  }
}

module.exports = new TaskService();
