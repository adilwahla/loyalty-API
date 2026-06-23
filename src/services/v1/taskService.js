const { Op } = require("sequelize");
// this is new update for group.
const { Task, User, TaskReassignHistory, Group, sequelize, Sequelize } = require("../../models");
const AppError = require("../../utils/appError"); 
// Valid task type values
const VALID_TASK_TYPES = ["Collection", "Promotion", "Up/Cross sell"];
const CREATED_BY_USER_ATTRIBUTES = ["id", "fullName", "email", "role"];

const SYSTEM_CREATOR_USER = {
  id: null,
  fullName: "النظام",
  email: null,
  role: "SYSTEM",
};

const CREATED_BY_BODY_KEYS = [
  "createdById",
  "created_by_id",
  "createdByUserId",
  "created_by_user_id",
  "createdByUser",
  "created_by_user",
  "createdBy",
  "creator",
];

function stripCreatedByFromPayload(data) {
  if (!data || typeof data !== "object") return;
  CREATED_BY_BODY_KEYS.forEach((key) => {
    delete data[key];
  });
}

function taskIncludes(extra = []) {
  return [
    { model: User, as: "user" },
    {
      model: User,
      as: "createdByUser",
      attributes: CREATED_BY_USER_ATTRIBUTES,
      required: false,
    },
    ...extra,
  ];
}

function isActivationTask(task) {
  const title = (task?.taskTitle || '').toLowerCase().trim();
  return (
    title.includes('activate customer location') ||
    title.includes('تفعيل موقع العميل')
  );
}

function formatTaskForApi(task) {
  if (!task) return task;
  const json = task.toJSON ? task.toJSON() : { ...task };
  const { oldUserId, ...rest } = json;

  if (!rest.createdById) {
    rest.createdById = null;
    rest.createdByUser = isActivationTask(rest) ? { ...SYSTEM_CREATOR_USER } : null;
  } else if (rest.createdByUser) {
    rest.createdByUser = {
      id: rest.createdByUser.id,
      fullName: rest.createdByUser.fullName,
      email: rest.createdByUser.email,
      role: rest.createdByUser.role,
    };
  }

  return rest;
}

function formatTasksForApi(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  return tasks.map(formatTaskForApi);
}

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
const ACTIVATION_TASK_TITLE_AR = 'تفعيل موقع العميل';
const ACTIVATION_TASK_TITLES = [ACTIVATION_TASK_TITLE, ACTIVATION_TASK_TITLE_AR];

function isActivationPromotionTaskPayload(t) {
  return (
    !!t &&
    !!t.customerId &&
    ACTIVATION_TASK_TITLES.includes(String(t.taskTitle || '').trim()) &&
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
      bsgCustId: { [Op.in]: customerIds },
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
  customers.forEach(customer => {
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
 
        const rawLat = customer.get
          ? customer.get('latitude')
          : (customer.latitude || customer.dataValues?.latitude);
        const rawLng = customer.get
          ? customer.get('longitude')
          : (customer.longitude || customer.dataValues?.longitude);
 
        customerData.latitude = (rawLat !== undefined && rawLat !== null && rawLat !== 'null' && rawLat !== '') ? String(rawLat) : null;
        customerData.longitude = (rawLng !== undefined && rawLng !== null && rawLng !== 'null' && rawLng !== '') ? String(rawLng) : null;
 
        if (!('latitude' in customerData)) customerData.latitude = null;
        if (!('longitude' in customerData)) customerData.longitude = null;

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

function parseStockCount(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return NaN;
  return parsed;
}

function normalizeTaskUpdateData(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.dateVisit === undefined && data.date_visit !== undefined) {
    data.dateVisit = data.date_visit;
  }
  if (data.nextVisitDate !== undefined && data.dateVisit === undefined) {
    data.dateVisit = data.nextVisitDate;
  }
  if (data.stockCount === undefined && data.stock_count !== undefined) {
    data.stockCount = data.stock_count;
  }
  return data;
}

function validateTaskCompletion(task, data) {
  if (data.taskStatus !== 'Completed') return;
  if (isActivationTask(task)) return;

  const comment = data.comment !== undefined ? data.comment : task.comment;
  const dateVisit = data.dateVisit !== undefined ? data.dateVisit : task.dateVisit;
  const stockCountRaw = data.stockCount !== undefined ? data.stockCount : task.stockCount;

  if (!comment || !String(comment).trim()) {
    throw new AppError('Comment is required when completing a task', 400);
  }

  if (dateVisit === undefined || dateVisit === null || dateVisit === '') {
    throw new AppError('Next visit date is required when completing a task', 400);
  }

  const stockCount = parseStockCount(stockCountRaw);
  if (stockCount === null) {
    throw new AppError('Stock count is required when completing a task', 400);
  }
  if (Number.isNaN(stockCount) || stockCount < 0) {
    throw new AppError('Stock count must be a valid number greater than or equal to 0', 400);
  }

  data.stockCount = stockCount;
}
 
class TaskService {
  async getTasksAssignedToUser(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return [];
    const tasks = await Task.findAll({
      where: { userId: normalizedUserId },
      include: taskIncludes(),
      order: [["updatedAt", "DESC"], ["dateTime", "DESC"]],
    });
    return await loadCustomersForTasks(tasks);
  }

  async getAllTasks() {
    const tasks = await Task.findAll({ include: taskIncludes() });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTaskById(id) {
    const task = await Task.findByPk(id, { 
      include: taskIncludes([
        { 
          model: TaskReassignHistory, 
          as: "reassignHistory",
          include: [
            { model: User, as: "oldUser", attributes: ["id", "fullName", "phoneNumber"] },
            { model: User, as: "newUser", attributes: ["id", "fullName", "phoneNumber"] }
          ],
          order: [["changedAt", "DESC"]]
        }
      ])
    });
    if (task) await loadCustomersForTasks([task]);
    return task;
  }
 
  async getTaskByUser(userId) {
    return await this.getTasksAssignedToUser(userId);
  }
 
  async getTasksByCustomer(customerId) {
    const tasks = await Task.findAll({ where: { customerId }, include: taskIncludes() });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTasksByStatus(taskStatus) {
    const tasks = await Task.findAll({ where: { taskStatus }, include: taskIncludes() });
    return await loadCustomersForTasks(tasks);
  }
 
  async getTasksByPriority(priority) {
    const tasks = await Task.findAll({ where: { priority }, include: taskIncludes() });
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
      include: taskIncludes()
    });
    return await loadCustomersForTasks(tasks);
  }
 
  async createTask(data, creatorUserId = null) {
    const payload = { ...data };
    stripCreatedByFromPayload(payload);

    if (!payload.userId) throw new Error("Missing assigned sales rep (userId)");
    if (!payload.customerId) throw new Error("Missing assigned customer (customerId)");
    if (payload.taskType !== undefined) payload.taskType = validateTaskType(payload.taskType);

    if (creatorUserId) {
      payload.createdById = creatorUserId;
    }
 
    const task = await Task.create(payload);
    const reloadedTask = await Task.findByPk(task.id, { include: taskIncludes() });
    await loadCustomersForTasks([reloadedTask]);
    return reloadedTask;
  }
 
  async updateTask(id, data) {
    normalizeTaskUpdateData(data);
    stripCreatedByFromPayload(data);
    const task = await Task.findByPk(id, { include: taskIncludes() });
    if (!task) return null;

    const oldUserId = task.userId;
    if (data.taskType !== undefined) data.taskType = validateTaskType(data.taskType);
    validateTaskCompletion(task, data);
    if (data.taskStatus === "Completed" && !task.completedAt) data.completedAt = new Date();
    if (data.stockCount !== undefined && data.taskStatus !== 'Completed') {
      const stockCount = parseStockCount(data.stockCount);
      if (data.stockCount !== null && data.stockCount !== '' && (Number.isNaN(stockCount) || stockCount < 0)) {
        throw new AppError('Stock count must be a valid number greater than or equal to 0', 400);
      }
      data.stockCount = stockCount;
    }

    await task.update(data);
    await task.reload({ include: taskIncludes() });
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
      const task = await Task.findByPk(taskId, { include: taskIncludes(), transaction });
      if (!task) throw new Error("Task not found");
 
      const oldUserId = task.userId;
      if (oldUserId === newUserId) throw new Error("Cannot reassign task to the same user");
 
      const newUser = await User.findByPk(newUserId, { transaction });
      if (!newUser) throw new Error("New user not found");
 
      await task.update({ userId: newUserId, dateTo: newEndDate, updatedAt: new Date() }, { transaction });
 
      await TaskReassignHistory.create({ taskId, oldUserId, newUserId, newEndDate, reason, changedAt: new Date() }, { transaction });
      await transaction.commit();
 
      await task.reload({
        include: taskIncludes([
          { 
            model: TaskReassignHistory, 
            as: "reassignHistory",
            include: [
              { model: User, as: "oldUser", attributes: ["id", "fullName", "phoneNumber"] },
              { model: User, as: "newUser", attributes: ["id", "fullName", "phoneNumber"] }
            ],
            order: [["changedAt", "DESC"]]
          }
        ])
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
taskService.isActivationTask = isActivationTask;
taskService.formatTaskForApi = formatTaskForApi;
taskService.formatTasksForApi = formatTasksForApi;
module.exports = taskService;
