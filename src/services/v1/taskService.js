const { Op } = require("sequelize");
// this is new update for group.
const { Task, User, TaskReassignHistory, Group, sequelize, Sequelize } = require("../../models");

// Valid task type values
const VALID_TASK_TYPES = ["Collection", "Promotion", "Up/Cross sell"];

// this is new update for group.
// Helper: Load customers with groups for tasks (handles collation mismatch)
async function loadCustomersForTasks(tasks) {
  if (!tasks || tasks.length === 0) return tasks;
  
  const customerIds = [...new Set(tasks.map(t => t.customerId).filter(Boolean))];
  if (customerIds.length === 0) return tasks;

  // Load all customers - fetch all business owners and match in JavaScript
  // This avoids collation issues completely
  const customers = await User.findAll({
    where: {
      role: 'BUSINESS_OWNER',
      bsgCustId: { [Op.not]: null }
    },
    attributes: [
      'id', 'phoneNumber', 'fullName', 'businessName', 'vatNumber',
      'businessAddress',
      // this is new update
      'latitude',
      // this is new update
      'longitude',
      'bsgCustId', 'salesRepId', 'status', 'email',
      // this is new update for group.
      'groupId',
      'createdAt', 'updatedAt'
    ],
    include: [{
      model: Group,
      as: "group",
      required: false,
      attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex']
    }]
  });

  // Create a map for quick lookup (normalize keys to handle any case/collation differences)
  const customerMap = new Map();
  customers.forEach(customer => {
    if (customer.bsgCustId) {
      // Store with multiple key variations for robust matching
      const key = String(customer.bsgCustId).trim();
      customerMap.set(key, customer);
      customerMap.set(key.toLowerCase(), customer);
      customerMap.set(key.toUpperCase(), customer);
      // Store original value as-is
      customerMap.set(customer.bsgCustId, customer);
    }
  });

  // Attach customers to tasks (try multiple lookup strategies)
  tasks.forEach(task => {
    if (task.customerId) {
      const key = String(task.customerId).trim();
      // Try multiple matching strategies
      const customer = customerMap.get(key) || 
                       customerMap.get(key.toLowerCase()) ||
                       customerMap.get(key.toUpperCase()) ||
                       customerMap.get(task.customerId);
      if (customer) {
        // Convert to plain object to ensure it's included in JSON serialization
        const taskData = task.toJSON ? task.toJSON() : task;
        const customerData = customer.toJSON ? customer.toJSON() : customer;
        
        // this is new update
        // Explicitly ensure latitude and longitude are included (handle DECIMAL conversion)
        // Get raw values from Sequelize instance (handles DECIMAL type properly)
        const rawLat = customer.get ? customer.get('latitude') : (customer.latitude || customer.dataValues?.latitude);
        const rawLng = customer.get ? customer.get('longitude') : (customer.longitude || customer.dataValues?.longitude);
        
        // Convert to string format (as expected by frontend) or null
        if (rawLat !== undefined && rawLat !== null && rawLat !== 'null' && rawLat !== '') {
          customerData.latitude = String(rawLat);
        } else {
          customerData.latitude = null;
        }
        
        if (rawLng !== undefined && rawLng !== null && rawLng !== 'null' && rawLng !== '') {
          customerData.longitude = String(rawLng);
        } else {
          customerData.longitude = null;
        }
        
        // Ensure these fields are always present (even if null) for consistent API structure
        if (!('latitude' in customerData)) {
          customerData.latitude = null;
        }
        if (!('longitude' in customerData)) {
          customerData.longitude = null;
        }
        
        taskData.customer = customerData;
        
        // this is new update for group.
        // Debug logging (only in development)
        if (process.env.NODE_ENV !== 'production') {
          if (customerData.group) {
            console.log(`✅ [TaskService] Group data attached for task ${task.id}:`, {
              customerId: task.customerId,
              groupId: customerData.group.groupId,
              groupName: customerData.group.groupName,
              colorHex: customerData.group.colorHex
            });
          }
          // this is new update
          // Debug latitude/longitude
          console.log(`📍 [TaskService] Customer coordinates for task ${task.id}:`, {
            customerId: task.customerId,
            latitude: customerData.latitude,
            longitude: customerData.longitude,
            hasLat: customerData.latitude !== undefined && customerData.latitude !== null,
            hasLng: customerData.longitude !== undefined && customerData.longitude !== null
          });
        }
        
        // Update the task instance
        Object.assign(task, taskData);
        // Also set dataValues for Sequelize to ensure proper serialization
        if (task.dataValues) {
          task.dataValues.customer = customerData;
          // this is new update
          // Explicitly ensure latitude/longitude are in dataValues for serialization
          if (task.dataValues.customer) {
            task.dataValues.customer.latitude = customerData.latitude;
            task.dataValues.customer.longitude = customerData.longitude;
          }
        }
        
        // this is new update
        // Also set directly on task object for multiple access patterns
        if (task.customer) {
          task.customer.latitude = customerData.latitude;
          task.customer.longitude = customerData.longitude;
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️  [TaskService] No customer found for task ${task.id} with customerId: ${task.customerId}`);
      }
    }
  });

  return tasks;
}

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
    const tasks = await Task.findAll({ 
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    return await loadCustomersForTasks(tasks);
  }

  async getTaskById(id) {
    const task = await Task.findByPk(id, { 
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        },
        { 
          model: TaskReassignHistory, 
          as: "reassignHistory",
          include: [
            { model: User, as: "oldUser", attributes: ["id", "fullName", "phoneNumber"] },
            { model: User, as: "newUser", attributes: ["id", "fullName", "phoneNumber"] }
          ],
          order: [["changedAt", "DESC"]]
        }
      ]
    });
    
    // this is new update for group.
    if (task) {
      await loadCustomersForTasks([task]);
    }
    
    return task;
  }

  async getTaskByUser(userId) {
    const tasks = await Task.findAll({ 
      where: { userId },
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    return await loadCustomersForTasks(tasks);
  }

  async getTasksByCustomer(customerId) {
    const tasks = await Task.findAll({ 
      where: { customerId },
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    return await loadCustomersForTasks(tasks);
  }

  async getTasksByStatus(taskStatus) {
    const tasks = await Task.findAll({ 
      where: { taskStatus },
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    return await loadCustomersForTasks(tasks);
  }

  async getTasksByPriority(priority) {
    const tasks = await Task.findAll({ 
      where: { priority },
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    return await loadCustomersForTasks(tasks);
  }


  async getTasksByDateRange(startDate, endDate) {
    const tasks = await Task.findAll({
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
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    return await loadCustomersForTasks(tasks);
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
    const reloadedTask = await Task.findByPk(task.id, { 
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    await loadCustomersForTasks([reloadedTask]);
    return reloadedTask;
  }

  async updateTask(id, data) {
    const task = await Task.findByPk(id, { 
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
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
    await task.reload({ 
      include: [
        { 
          model: User, 
          as: "user" // Sales rep
        }
      ] 
    });
    
    // this is new update for group.
    await loadCustomersForTasks([task]);
    
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

  async reassignTask(taskId, newUserId, newEndDate, reason) {
    const transaction = await sequelize.transaction();
    
    try {
      // Fetch current task to get oldUserId
      const task = await Task.findByPk(taskId, { 
        include: [
          { 
            model: User, 
            as: "user" // Sales rep
          }
        ],
        transaction 
      });
      
      if (!task) {
        throw new Error("Task not found");
      }

      const oldUserId = task.userId;

      // Validate that it's actually a reassignment
      if (oldUserId === newUserId) {
        throw new Error("Cannot reassign task to the same user");
      }

      // Validate newUserId exists
      const newUser = await User.findByPk(newUserId, { transaction });
      if (!newUser) {
        throw new Error("New user not found");
      }

      // Update task with new userId, newEndDate, and updatedAt
      await task.update(
        {
          userId: newUserId,
          dateTo: newEndDate,
          updatedAt: new Date()
        },
        { transaction }
      );

      // Insert record into task_reassign_history
      await TaskReassignHistory.create(
        {
          taskId: taskId,
          oldUserId: oldUserId,
          newUserId: newUserId,
          newEndDate: newEndDate,
          reason: reason,
          changedAt: new Date()
        },
        { transaction }
      );

      // Commit transaction
      await transaction.commit();

      // Reload task with relations for response
      await task.reload({ 
        include: [
          { 
            model: User, 
            as: "user" // Sales rep
          },
          { 
            model: TaskReassignHistory, 
            as: "reassignHistory",
            include: [
              { model: User, as: "oldUser", attributes: ["id", "fullName", "phoneNumber"] },
              { model: User, as: "newUser", attributes: ["id", "fullName", "phoneNumber"] }
            ],
            order: [["changedAt", "DESC"]]
          }
        ]
      });

      // this is new update for group.
      await loadCustomersForTasks([task]);

      // Return task with oldUserId for socket events
      task.oldUserId = oldUserId;
      
      return task;
    } catch (error) {
      // Rollback transaction on error
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new TaskService();
