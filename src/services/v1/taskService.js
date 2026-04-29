const { Op } = require("sequelize");
// this is new update for group.
const { Task, User, TaskReassignHistory, Group, sequelize, Sequelize } = require("../../models");
 
// Valid task type values
const VALID_TASK_TYPES = ["Collection", "Promotion", "Up/Cross sell"];

/** All BO bsg_cust_id values in the same customer group as groupId (for NFC scan matching). */
function linkedBsgCustIdsForActivationGroup(customers, groupId) {
  if (!groupId || !customers?.length) return [];
  const gid = String(groupId).trim();
  const out = new Set();
  customers.forEach((c) => {
    if (String(c.role || '').toUpperCase() !== 'BUSINESS_OWNER') return;
    const pid = c.parentCustId ? String(c.parentCustId).trim() : '';
    const bid = c.bsgCustId ? String(c.bsgCustId).trim() : '';
    if (pid === gid || bid === gid) {
      if (c.bsgCustId) out.add(String(c.bsgCustId).trim());
    }
  });
  return [...out];
}

const ACTIVATION_TASK_TITLE = 'Activate Customer Location';

function isActivationPromotionTaskPayload(t) {
  return (
    !!t &&
    !!t.customerId &&
    String(t.taskTitle || '').trim() === ACTIVATION_TASK_TITLE &&
    String(t.taskType || '').trim().toLowerCase() === 'promotion'
  );
}

/**
 * Writes linkedBsgCustIds / customerGroupKey onto already-serialized task objects.
 * Runs after toJSON so fields are never dropped by Sequelize.
 */
async function applyActivationNfcToSerializedTasks(serializedTasks) {
  if (!Array.isArray(serializedTasks) || !serializedTasks.length) return;
  const needs = serializedTasks.some((t) => isActivationPromotionTaskPayload(t));
  if (!needs) return;

  const customers = await User.findAll({
    where: {
      role: 'BUSINESS_OWNER',
      bsgCustId: { [Op.not]: null },
    },
    attributes: ['role', 'bsgCustId', 'parentCustId'],
  });

  serializedTasks.forEach((t) => {
    if (!isActivationPromotionTaskPayload(t)) return;
    const linked = linkedBsgCustIdsForActivationGroup(customers, t.customerId);
    if (!linked.length) return;
    const gk = String(t.customerId).trim();
    t.customer = t.customer && typeof t.customer === 'object' ? t.customer : {};
    t.customer.linkedBsgCustIds = linked;
    t.customer.customerGroupKey = gk;
    t.linkedBsgCustIds = linked;
    t.customerGroupKey = gk;
  });
}

// Helper: Load customers with groups for tasks (handles collation mismatch)
async function loadCustomersForTasks(tasks) {
  if (!tasks || tasks.length === 0) return tasks;
 
  const customerIds = [...new Set(tasks.map(t => t.customerId).filter(Boolean))];
  if (customerIds.length === 0) return tasks;
 
  const customers = await User.findAll({
    where: {
      role: 'BUSINESS_OWNER',
      bsgCustId: { [Op.not]: null }
    },
    attributes: [
      'id', 'phoneNumber', 'fullName', 'businessName', 'vatNumber',
      'businessAddress', 'latitude', 'longitude', 'bsgCustId',
      'parentCustId',
      'salesRepId', 'status', 'email', 'groupId', 'createdAt', 'updatedAt'
    ],
    include: [{
      model: Group,
      as: "group",
      required: false,
      attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex']
    }]
  });
 
  const customerMap = new Map();
  const parentLocationMap = new Map();
  customers.forEach(customer => {
    if (customer.parentCustId && customer.latitude != null && customer.longitude != null) {
      parentLocationMap.set(String(customer.parentCustId).trim(), customer);
    }
    if (customer.bsgCustId) {
      const key = String(customer.bsgCustId).trim();
      customerMap.set(key, customer);
      customerMap.set(key.toLowerCase(), customer);
      customerMap.set(key.toUpperCase(), customer);
      customerMap.set(customer.bsgCustId, customer);
    }
  });
 
  tasks.forEach(task => {
    if (task.customerId) {
      const key = String(task.customerId).trim();
      const customer = customerMap.get(key) || 
                       customerMap.get(key.toLowerCase()) ||
                       customerMap.get(key.toUpperCase()) ||
                       customerMap.get(task.customerId);
      if (customer) {
        const taskData = task.toJSON ? task.toJSON() : task;
        const customerData = customer.toJSON ? customer.toJSON() : customer;
 
        const sharedLocationCustomer = customer.parentCustId
          ? parentLocationMap.get(String(customer.parentCustId).trim())
          : null;

        const sourceForLocation = sharedLocationCustomer || customer;
        const rawLat = sourceForLocation.get
          ? sourceForLocation.get('latitude')
          : (sourceForLocation.latitude || sourceForLocation.dataValues?.latitude);
        const rawLng = sourceForLocation.get
          ? sourceForLocation.get('longitude')
          : (sourceForLocation.longitude || sourceForLocation.dataValues?.longitude);
 
        customerData.latitude = (rawLat !== undefined && rawLat !== null && rawLat !== 'null' && rawLat !== '') ? String(rawLat) : null;
        customerData.longitude = (rawLng !== undefined && rawLng !== null && rawLng !== 'null' && rawLng !== '') ? String(rawLng) : null;
 
        if (!('latitude' in customerData)) customerData.latitude = null;
        if (!('longitude' in customerData)) customerData.longitude = null;

        // NFC group list for tasks API only (does not toggle warranty/scan behavior — that still uses ENABLE_PARENT_LOCATION_FLOW elsewhere).
        taskData.customer = customerData;
 
        if (process.env.NODE_ENV !== 'production') {
          if (customerData.group) {
            console.log(`✅ [TaskService] Group data attached for task ${task.id}:`, {
              customerId: task.customerId,
              groupId: customerData.group.groupId,
              groupName: customerData.group.groupName,
              colorHex: customerData.group.colorHex
            });
          }
          console.log(`📍 [TaskService] Customer coordinates for task ${task.id}:`, {
            customerId: task.customerId,
            latitude: customerData.latitude,
            longitude: customerData.longitude,
            hasLat: customerData.latitude !== undefined && customerData.latitude !== null,
            hasLng: customerData.longitude !== undefined && customerData.longitude !== null
          });
        }
 
        Object.assign(task, taskData);
        if (task.dataValues) {
          task.dataValues.customer = customerData;
          task.dataValues.customer.latitude = customerData.latitude;
          task.dataValues.customer.longitude = customerData.longitude;
        }
 
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
* @param {string} taskType
* @returns {string}
*/
function validateTaskType(taskType) {
  if (!taskType) return null;
 
  const types = taskType.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (types.length === 0) return null;
 
  const invalidTypes = types.filter(type => !VALID_TASK_TYPES.includes(type));
  if (invalidTypes.length > 0) {
    throw new Error(
      `Invalid task type(s): ${invalidTypes.join(', ')}. Valid values are: ${VALID_TASK_TYPES.join(', ')}`
    );
  }
 
  return types.join(',');
}
 
class TaskService {
  async getTasksAssignedToUser(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return [];
    const tasks = await Task.findAll({
      where: { userId: normalizedUserId },
      include: [{ model: User, as: "user" }],
      order: [["updatedAt", "DESC"], ["dateTime", "DESC"]],
    });
    return await loadCustomersForTasks(tasks);
  }

  async getAllTasks() {
    const tasks = await Task.findAll({ include: [{ model: User, as: "user" }] });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTaskById(id) {
    const task = await Task.findByPk(id, { 
      include: [
        { model: User, as: "user" },
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
    if (task) await loadCustomersForTasks([task]);
    return task;
  }
 
  async getTaskByUser(userId) {
    return await this.getTasksAssignedToUser(userId);
  }
 
  async getTasksByCustomer(customerId) {
    const tasks = await Task.findAll({ where: { customerId }, include: [{ model: User, as: "user" }] });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTasksByStatus(taskStatus) {
    const tasks = await Task.findAll({ where: { taskStatus }, include: [{ model: User, as: "user" }] });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTasksByPriority(priority) {
    const tasks = await Task.findAll({ where: { priority }, include: [{ model: User, as: "user" }] });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTasksByDateRange(startDate, endDate) {
    const tasks = await Task.findAll({
      where: {
        [Op.or]: [
          { dateFrom: { [Op.between]: [startDate, endDate] } },
          { dateTo: { [Op.between]: [startDate, endDate] } },
        ]
      },
      include: [{ model: User, as: "user" }]
    });
    return await loadCustomersForTasks(tasks);
  }
 
  async createTask(data) {
    if (!data.userId) throw new Error("Missing assigned sales rep (userId)");
    if (!data.customerId) throw new Error("Missing assigned customer (customerId)");
    if (data.taskType !== undefined) data.taskType = validateTaskType(data.taskType);
 
    const task = await Task.create(data);
    const reloadedTask = await Task.findByPk(task.id, { include: [{ model: User, as: "user" }] });
    await loadCustomersForTasks([reloadedTask]);
    return reloadedTask;
  }
 
  async updateTask(id, data) {
    const task = await Task.findByPk(id, { include: [{ model: User, as: "user" }] });
    if (!task) return null;
 
    const oldUserId = task.userId;
    if (data.taskType !== undefined) data.taskType = validateTaskType(data.taskType);
    if (data.taskStatus === "Completed" && !task.completedAt) data.completedAt = new Date();
 
    await task.update(data);
    await task.reload({ include: [{ model: User, as: "user" }] });
    await loadCustomersForTasks([task]);
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
      const task = await Task.findByPk(taskId, { include: [{ model: User, as: "user" }], transaction });
      if (!task) throw new Error("Task not found");
 
      const oldUserId = task.userId;
      if (oldUserId === newUserId) throw new Error("Cannot reassign task to the same user");
 
      const newUser = await User.findByPk(newUserId, { transaction });
      if (!newUser) throw new Error("New user not found");
 
      await task.update({ userId: newUserId, dateTo: newEndDate, updatedAt: new Date() }, { transaction });
 
      await TaskReassignHistory.create({ taskId, oldUserId, newUserId, newEndDate, reason, changedAt: new Date() }, { transaction });
      await transaction.commit();
 
      await task.reload({
        include: [
          { model: User, as: "user" },
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
 
      await loadCustomersForTasks([task]);
      task.oldUserId = oldUserId;
      return task;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

const taskService = new TaskService();
taskService.applyActivationNfcToSerializedTasks = applyActivationNfcToSerializedTasks;
module.exports = taskService;