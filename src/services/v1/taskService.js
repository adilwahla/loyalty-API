const { Op } = require("sequelize");
// this is new update for group.
const { Task, User, TaskReassignHistory, Group, sequelize, Sequelize } = require("../../models");
const AppError = require("../../utils/appError");
const { getSelectableTaskTypeCodes } = require("./taskType.service");
const { verifyOrEnrollNfcSerialNumber } = require("../../utils/nfcSerial.util");
const {
  ACTIVATION_TASK_TITLES,
  isActivationTaskType,
} = require("./customerActivationTaskSync.service");
const CREATED_BY_USER_ATTRIBUTES = ["id", "fullName", "email", "role"];

const SYSTEM_CREATOR_USER = {
  id: null,
  fullName: "النظام",
  email: null,
  role: "SYSTEM",
};

const RANDOM_VISIT_TASK_TITLE = "زيارة عشوائية";
const RANDOM_VISIT_TASK_TYPE = "Random Visit";
const RANDOM_VISIT_DESCRIPTION =
  "تم إنشاء مهمة عشوائية للعميل من قبل المندوب";
const RANDOM_VISIT_PRIORITY = "Low";

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

/**
 * Resolve assignee for a task from salesRepId and/or userId.
 * Priority: userId (UUID) if present, else salesRepId / branchManager code.
 * Always returns { userId, salesRepId } — userId is required for FK + sockets.
 */
async function resolveTaskAssignee({ userId, salesRepId, branchManagerId } = {}, transaction = null) {
  const explicitUserId = userId ? String(userId).trim() : null;
  const repCode = salesRepId ? String(salesRepId).trim() : null;
  const bmCode = branchManagerId ? String(branchManagerId).trim() : null;

  if (explicitUserId) {
    const user = await User.findByPk(explicitUserId, {
      attributes: ['id', 'salesRepId', 'branchManagerId', 'role'],
      transaction,
    });
    if (!user) throw new AppError('Assigned user not found', 400);
    const code =
      (user.salesRepId && String(user.salesRepId).trim()) ||
      (user.branchManagerId && String(user.branchManagerId).trim()) ||
      repCode ||
      null;
    return { userId: user.id, salesRepId: code };
  }

  const code = repCode || bmCode;
  if (!code) {
    throw new AppError('Missing assigned sales rep (provide salesRepId or userId)', 400);
  }

  const salesRepUser = await User.findOne({
    where: { role: 'SALES_REP', salesRepId: code },
    attributes: ['id', 'salesRepId'],
    transaction,
  });
  if (salesRepUser?.id) {
    return {
      userId: salesRepUser.id,
      salesRepId: salesRepUser.salesRepId || code,
    };
  }

  const branchManagerUser = await User.findOne({
    where: {
      role: 'BRANCH_MANAGER',
      [Op.or]: [{ salesRepId: code }, { branchManagerId: code }],
    },
    attributes: ['id', 'salesRepId', 'branchManagerId'],
    transaction,
  });
  if (branchManagerUser?.id) {
    return {
      userId: branchManagerUser.id,
      salesRepId:
        (branchManagerUser.salesRepId && String(branchManagerUser.salesRepId).trim()) ||
        (branchManagerUser.branchManagerId && String(branchManagerUser.branchManagerId).trim()) ||
        code,
    };
  }

  throw new AppError(`No sales rep or branch manager found for code: ${code}`, 400);
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

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

async function resolveBusinessOwnerByNfc(nfcValue) {
  const lookup = String(nfcValue || "").trim();
  if (!lookup) return null;
  return User.findOne({
    where: { role: "BUSINESS_OWNER", bsgCustId: lookup },
    attributes: [
      "id",
      "bsgCustId",
      "fullName",
      "businessName",
      "businessAddress",
      "latitude",
      "longitude",
      "salesRepId",
      "branchManagerId",
      "nfcSerialNumber", // ← NEW
    ],
  });
}

function customerDisplayName(bo) {
  return bo?.fullName || bo?.businessName || bo?.bsgCustId || null;
}

function formatRandomVisitCustomer(bo) {
  const latitude = bo?.latitude ?? null;
  const longitude = bo?.longitude ?? null;
  const businessAddress = bo?.businessAddress ?? null;

  return {
    id: bo.bsgCustId,
    bsgCustId: bo.bsgCustId,
    name: customerDisplayName(bo),
    fullName: bo.fullName || null,
    businessName: bo.businessName || null,
    userId: bo.id,
    latitude,
    longitude,
    businessAddress,
    location: businessAddress,
  };
}

function resolveLocationFromCustomerRecord(bo) {
  if (!bo) return null;
  const address = bo.businessAddress ? String(bo.businessAddress).trim() : "";
  if (address) return address;
  if (bo.latitude != null && bo.longitude != null) {
    return `${bo.latitude},${bo.longitude}`;
  }
  return null;
}

async function resolveTaskLocationFromCustomer(customerId) {
  const lookup = String(customerId || "").trim();
  if (!lookup) return null;

  const bo = await User.findOne({
    where: { role: "BUSINESS_OWNER", bsgCustId: lookup },
    attributes: ["businessAddress", "latitude", "longitude"],
  });

  return resolveLocationFromCustomerRecord(bo);
}

function isRandomVisitTask(task) {
  return String(task?.taskType || "").trim() === RANDOM_VISIT_TASK_TYPE;
}

function validateRandomVisitCompletionPayload({
  comment,
  stockCount,
  dateVisit,
  collectedAmount,
  soldAmount,
}) {
  if (!comment || !String(comment).trim()) {
    throw new AppError("Comment is required when completing a task", 400);
  }
  if (dateVisit === undefined || dateVisit === null || dateVisit === "") {
    throw new AppError("Next visit date is required when completing a task", 400);
  }

  const parsedStockCount = parseStockCount(stockCount);
  if (parsedStockCount === null) {
    throw new AppError("Stock count is required when completing a task", 400);
  }
  if (Number.isNaN(parsedStockCount) || parsedStockCount < 0) {
    throw new AppError("Stock count must be a valid number greater than or equal to 0", 400);
  }

  const parsedCollectedAmount = parseAmount(collectedAmount);
  if (parsedCollectedAmount === null) {
    throw new AppError("Collected amount is required when completing a task", 400);
  }
  if (Number.isNaN(parsedCollectedAmount) || parsedCollectedAmount < 0) {
    throw new AppError("Collected amount must be a valid number greater than or equal to 0", 400);
  }

  const parsedSoldAmount = parseAmount(soldAmount);
  if (parsedSoldAmount === null) {
    throw new AppError("Sold amount is required when completing a task", 400);
  }
  if (Number.isNaN(parsedSoldAmount) || parsedSoldAmount < 0) {
    throw new AppError("Sold amount must be a valid number greater than or equal to 0", 400);
  }

  return {
    comment: String(comment).trim(),
    dateVisit,
    stockCount: parsedStockCount,
    collectedAmount: parsedCollectedAmount,
    soldAmount: parsedSoldAmount,
  };
}

async function prepareRandomVisitContext({ nfcValue, nfcSerialNumber, creatorUserId }) {
  const normalizedNfc = String(nfcValue || "").trim();
  if (!normalizedNfc) {
    throw new AppError("nfc_value is required", 400);
  }
  if (!creatorUserId) {
    throw new AppError("Unauthorized: user not found", 401);
  }

  const repUser = await User.findByPk(creatorUserId, {
    attributes: ["id", "salesRepId", "branchManagerId", "role"],
  });
  if (!repUser) {
    throw new AppError("Unauthorized: user not found", 401);
  }

  const customer = await sequelize.transaction(async (transaction) => {
    const found = await resolveBusinessOwnerByNfc(normalizedNfc, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!found?.bsgCustId) {
      throw new AppError("Scanned NFC value does not map to a customer", 404);
    }

    await verifyOrEnrollNfcSerialNumber({ customer: found, scannedSerial: nfcSerialNumber, transaction });

    return found;
  });

  await assertRepLinkedToCustomer(repUser, customer);
  const assignee = await resolveTaskAssignee({ userId: creatorUserId });

  return { customer, assignee };
}

async function assertRepLinkedToCustomer(repUser, customer) {
  if (!repUser?.id || !customer) {
    throw new AppError("Customer not found", 404);
  }

  const repCode =
    (repUser.salesRepId && String(repUser.salesRepId).trim()) ||
    (repUser.branchManagerId && String(repUser.branchManagerId).trim()) ||
    null;

  if (!repCode) {
    throw new AppError("Sales rep profile is missing an assignee code", 400);
  }

  const customerRep = customer.salesRepId ? String(customer.salesRepId).trim() : "";
  const customerBm = customer.branchManagerId
    ? String(customer.branchManagerId).trim()
    : "";

  const linked =
    (customerRep && customerRep === repCode) ||
    (customerBm && customerBm === repCode);

  if (!linked) {
    throw new AppError("This customer is not linked to your sales account", 403);
  }
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

function isActivationLocationTaskPayload(t) {
  return (
    !!t &&
    !!t.customerId &&
    ACTIVATION_TASK_TITLES.includes(String(t.taskTitle || '').trim()) &&
    isActivationTaskType(t.taskType)
  );
}

/**
 * Writes linkedBsgCustIds / customerGroupKey onto already-serialized task objects.
 * Runs after toJSON so fields are never dropped by Sequelize.
 */
async function applyActivationNfcToSerializedTasks(serializedTasks) {
  if (!Array.isArray(serializedTasks) || !serializedTasks.length) return;
  const needs = serializedTasks.some((t) => isActivationLocationTaskPayload(t));
  if (!needs) return;

  const customers = await User.findAll({
    where: {
      role: 'BUSINESS_OWNER',
      bsgCustId: { [Op.not]: null },
    },
    attributes: ['role', 'bsgCustId', 'parentCustId'],
  });

  serializedTasks.forEach((t) => {
    if (!isActivationLocationTaskPayload(t)) return;
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
async function validateTaskType(taskType) {
  if (!taskType) return null;

  const types = taskType.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (types.length === 0) return null;

  const validTypes = await getSelectableTaskTypeCodes();
  const invalidTypes = types.filter(type => !validTypes.includes(type));
  if (invalidTypes.length > 0) {
    throw new Error(
      `Invalid task type(s): ${invalidTypes.join(', ')}. Valid values are: ${validTypes.join(', ')}`
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

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
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
  if (data.collectedAmount === undefined && data.collected_amount !== undefined) {
    data.collectedAmount = data.collected_amount;
  }
  if (data.soldAmount === undefined && data.sold_amount !== undefined) {
    data.soldAmount = data.sold_amount;
  }
  return data;
}

function validateTaskCompletion(task, data) {
  if (data.taskStatus !== 'Completed') return;
  if (isActivationTask(task)) return;

  const comment = data.comment !== undefined ? data.comment : task.comment;
  const dateVisit = data.dateVisit !== undefined ? data.dateVisit : task.dateVisit;
  const stockCountRaw = data.stockCount !== undefined ? data.stockCount : task.stockCount;
  const collectedAmountRaw =
    data.collectedAmount !== undefined ? data.collectedAmount : task.collectedAmount;
  const soldAmountRaw =
    data.soldAmount !== undefined ? data.soldAmount : task.soldAmount;

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

  const collectedAmount = parseAmount(collectedAmountRaw);
  if (collectedAmount === null) {
    throw new AppError('Collected amount is required when completing a task', 400);
  }
  if (Number.isNaN(collectedAmount) || collectedAmount < 0) {
    throw new AppError('Collected amount must be a valid number greater than or equal to 0', 400);
  }

  const soldAmount = parseAmount(soldAmountRaw);
  if (soldAmount === null) {
    throw new AppError('Sold amount is required when completing a task', 400);
  }
  if (Number.isNaN(soldAmount) || soldAmount < 0) {
    throw new AppError('Sold amount must be a valid number greater than or equal to 0', 400);
  }

  data.stockCount = stockCount;
  data.collectedAmount = collectedAmount;
  data.soldAmount = soldAmount;
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
 /**
   * Returns tasks scoped to the requesting user's role.
   * - Any role other than BRANCH_MANAGER: all tasks, unchanged (delegates to getAllTasks()).
   * - BRANCH_MANAGER: only tasks assigned to their own sales reps (matched via
   *   User.branchManagerId === BM's own salesRepId/branchManagerId code — same
   *   linkage this file already uses in assertRepLinkedToCustomer) plus tasks
   *   assigned to the BM directly.
   *
   * @param {{ id: string, role: string, salesRepId?: string, branchManagerId?: string }} requestingUser
   */
  async getTasksForRequestingUser(requestingUser) {
    if (!requestingUser || requestingUser.role !== "BRANCH_MANAGER") {
      return this.getAllTasks();
    }

    const bmCode =
      (requestingUser.salesRepId && String(requestingUser.salesRepId).trim()) ||
      (requestingUser.branchManagerId && String(requestingUser.branchManagerId).trim()) ||
      null;

    if (!bmCode) {
      // Can't resolve this branch manager's own code — fail closed (empty)
      // rather than accidentally falling through to "show everything".
      return [];
    }

    const teamSalesReps = await User.findAll({
      where: { role: "SALES_REP", branchManagerId: bmCode },
      attributes: ["id", "salesRepId"],
    });

    const scopedUserIds = new Set([requestingUser.id]);
    const scopedSalesRepIds = new Set([bmCode]);
    teamSalesReps.forEach((u) => {
      if (u.id) scopedUserIds.add(u.id);
      if (u.salesRepId) scopedSalesRepIds.add(String(u.salesRepId).trim());
    });

    const tasks = await Task.findAll({
      where: {
        [Op.or]: [
          { userId: { [Op.in]: [...scopedUserIds] } },
          { salesRepId: { [Op.in]: [...scopedSalesRepIds] } },
        ],
      },
      include: taskIncludes(),
    });

    return await loadCustomersForTasks(tasks);
  }
/**  ------------------------------------------------------------------------- */
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

    if (!payload.customerId) throw new Error("Missing assigned customer (customerId)");
    if (payload.taskType !== undefined) payload.taskType = await validateTaskType(payload.taskType);

    const assignee = await resolveTaskAssignee({
      userId: payload.userId,
      salesRepId: payload.salesRepId,
      branchManagerId: payload.branchManagerId,
    });
    payload.userId = assignee.userId;
    payload.salesRepId = assignee.salesRepId;
    delete payload.branchManagerId;

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
    if (data.taskType !== undefined) data.taskType = await validateTaskType(data.taskType);
    validateTaskCompletion(task, data);
    if (data.taskStatus === "Completed" && !task.completedAt) data.completedAt = new Date();

    const locationProvided =
      data.location !== undefined &&
      data.location !== null &&
      String(data.location).trim() !== "";
    const taskLocationEmpty =
      !task.location || String(task.location).trim() === "";

    if (
      data.taskStatus === "Completed" &&
      !locationProvided &&
      taskLocationEmpty &&
      task.customerId
    ) {
      const resolvedLocation = await resolveTaskLocationFromCustomer(task.customerId);
      if (resolvedLocation) data.location = resolvedLocation;
    }

    if (data.taskStatus === "Completed") {
      data.updatedAt = new Date();
    }

    if (data.stockCount !== undefined && data.taskStatus !== 'Completed') {
      const stockCount = parseStockCount(data.stockCount);
      if (data.stockCount !== null && data.stockCount !== '' && (Number.isNaN(stockCount) || stockCount < 0)) {
        throw new AppError('Stock count must be a valid number greater than or equal to 0', 400);
      }
      data.stockCount = stockCount;
    }

    if (data.collectedAmount !== undefined) {
      const collectedAmount = parseAmount(data.collectedAmount);
      if (
        data.collectedAmount !== null &&
        data.collectedAmount !== '' &&
        (Number.isNaN(collectedAmount) || collectedAmount < 0)
      ) {
        throw new AppError('Collected amount must be a valid number greater than or equal to 0', 400);
      }
      data.collectedAmount = collectedAmount;
    }

    if (data.soldAmount !== undefined) {
      const soldAmount = parseAmount(data.soldAmount);
      if (
        data.soldAmount !== null &&
        data.soldAmount !== '' &&
        (Number.isNaN(soldAmount) || soldAmount < 0)
      ) {
        throw new AppError('Sold amount must be a valid number greater than or equal to 0', 400);
      }
      data.soldAmount = soldAmount;
    }

    // Keep userId + salesRepId in sync when either assignee field changes
    if (data.userId !== undefined || data.salesRepId !== undefined || data.branchManagerId !== undefined) {
      const assignee = await resolveTaskAssignee({
        userId: data.userId !== undefined ? data.userId : undefined,
        salesRepId: data.salesRepId !== undefined ? data.salesRepId : undefined,
        branchManagerId: data.branchManagerId,
      });
      data.userId = assignee.userId;
      data.salesRepId = assignee.salesRepId;
      delete data.branchManagerId;
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
 
async resolveRandomVisitCustomerFromNfc({ nfcValue, nfcSerialNumber, creatorUserId }) {
  const { customer } = await prepareRandomVisitContext({ nfcValue, nfcSerialNumber, creatorUserId });
  return {
    customer: formatRandomVisitCustomer(customer),
  };
}

async completeRandomVisitFromNfc({
  nfcValue,
  nfcSerialNumber,
  creatorUserId,
  comment,
  stockCount,
  dateVisit,
  collectedAmount,
  soldAmount,
}) {
  const { customer, assignee } = await prepareRandomVisitContext({
    nfcValue,
    nfcSerialNumber,
    creatorUserId,
  });

    const completion = validateRandomVisitCompletionPayload({
      comment,
      stockCount,
      dateVisit,
      collectedAmount,
      soldAmount,
    });

    const visitDate = todayDateOnly();
    const customerName = customerDisplayName(customer);
    const customerLocation = resolveLocationFromCustomerRecord(customer);
    const now = new Date();

    const task = await Task.create({
      userId: assignee.userId,
      salesRepId: assignee.salesRepId,
      createdById: creatorUserId,
      taskTitle: RANDOM_VISIT_TASK_TITLE,
      taskType: RANDOM_VISIT_TASK_TYPE,
      priority: RANDOM_VISIT_PRIORITY,
      customerId: customer.bsgCustId,
      customerName,
      location: customerLocation,
      taskStatus: "Completed",
      dateFrom: visitDate,
      dateTo: visitDate,
      dateTime: now,
      completedAt: now,
      updatedAt: now,
      description: RANDOM_VISIT_DESCRIPTION,
      comment: completion.comment,
      stockCount: completion.stockCount,
      collectedAmount: completion.collectedAmount,
      soldAmount: completion.soldAmount,
      dateVisit: completion.dateVisit,
    });

    const reloadedTask = await Task.findByPk(task.id, { include: taskIncludes() });
    await loadCustomersForTasks([reloadedTask]);

    return {
      customer: formatRandomVisitCustomer(customer),
      task: reloadedTask,
    };
  }

  async cancelRandomVisitTask({ taskId, userId }) {
    const normalizedTaskId = String(taskId || "").trim();
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedTaskId) {
      throw new AppError("Task id is required", 400);
    }
    if (!normalizedUserId) {
      throw new AppError("Unauthorized: user not found", 401);
    }

    const task = await Task.findByPk(normalizedTaskId);
    if (!task) {
      throw new AppError("Task not found", 404);
    }
    if (!isRandomVisitTask(task)) {
      throw new AppError("Only random visit tasks can be cancelled this way", 400);
    }
    if (task.taskStatus !== "Pending") {
      throw new AppError("Only pending random visit tasks can be cancelled", 400);
    }
    if (String(task.userId) !== normalizedUserId) {
      throw new AppError("You can only cancel your own random visit tasks", 403);
    }

    await task.destroy();
    return true;
  }

  async reassignTask(taskId, { newUserId, newSalesRepId, newEndDate, reason } = {}) {
    const transaction = await sequelize.transaction();
    try {
      const task = await Task.findByPk(taskId, { include: taskIncludes(), transaction });
      if (!task) throw new Error("Task not found");

      const assignee = await resolveTaskAssignee(
        { userId: newUserId, salesRepId: newSalesRepId },
        transaction
      );

      const oldUserId = task.userId;
      if (oldUserId === assignee.userId) throw new Error("Cannot reassign task to the same user");

      await task.update(
        {
          userId: assignee.userId,
          salesRepId: assignee.salesRepId,
          dateTo: newEndDate,
          updatedAt: new Date(),
        },
        { transaction }
      );

      await TaskReassignHistory.create(
        {
          taskId,
          oldUserId,
          newUserId: assignee.userId,
          newEndDate,
          reason,
          changedAt: new Date(),
        },
        { transaction }
      );
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
taskService.isRandomVisitTask = isRandomVisitTask;
taskService.RANDOM_VISIT_TASK_TITLE = RANDOM_VISIT_TASK_TITLE;
taskService.RANDOM_VISIT_TASK_TYPE = RANDOM_VISIT_TASK_TYPE;
module.exports = taskService;
