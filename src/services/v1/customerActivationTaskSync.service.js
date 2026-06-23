const { Op } = require('sequelize');
const { User, Task, sequelize } = require('../../models');

const ACTIVATION_TASK_TITLE = 'تفعيل موقع العميل';
const ACTIVATION_TASK_TITLE_LEGACY = 'Activate Customer Location';
const ACTIVATION_TASK_TITLES = [ACTIVATION_TASK_TITLE, ACTIVATION_TASK_TITLE_LEGACY];

function activationTaskTitleWhere() {
  return { [Op.in]: ACTIVATION_TASK_TITLES };
}

async function findBranchManagerUserByCode(code, transaction) {
  const trimmed = String(code || '').trim();
  if (!trimmed) return null;
  const row = await User.findOne({
    where: {
      role: 'BRANCH_MANAGER',
      [Op.or]: [{ salesRepId: trimmed }, { branchManagerId: trimmed }],
    },
    attributes: ['id'],
    transaction,
  });
  return row?.id || null;
}

async function resolveActivationTaskAssignee(boRow, fallbackUserId, transaction) {
  if (boRow?.salesRepId) {
    const salesRepUser = await User.findOne({
      where: { role: 'SALES_REP', salesRepId: boRow.salesRepId },
      attributes: ['id'],
      transaction,
    });
    if (salesRepUser?.id) return salesRepUser.id;

    const branchManagerFromRepCode = await findBranchManagerUserByCode(boRow.salesRepId, transaction);
    if (branchManagerFromRepCode) return branchManagerFromRepCode;
  }

  if (boRow?.branchManagerId) {
    const branchManagerUser = await findBranchManagerUserByCode(boRow.branchManagerId, transaction);
    if (branchManagerUser) return branchManagerUser;
  }

  return fallbackUserId || null;
}

async function ensureActivationTaskForCustomer({ bsgCustId, customerName, userId, transaction }) {
  if (!bsgCustId || !userId) return null;

  const existing = await Task.findOne({
    where: {
      customerId: bsgCustId,
      taskType: 'Promotion',
      taskTitle: activationTaskTitleWhere(),
      taskStatus: 'Pending',
    },
    transaction,
  });
  if (existing) return existing;

  return Task.create(
    {
      userId,
      taskTitle: ACTIVATION_TASK_TITLE,
      taskType: 'Promotion',
      priority: 'High',
      customerId: bsgCustId,
      customerName: customerName || bsgCustId,
      taskStatus: 'Pending',
      dateTime: new Date(),
      description: 'Auto-generated task for customer first-time location activation.',
    },
    { transaction }
  );
}

async function completePendingActivationTasksForBsgCustId(bsgCustId, transaction) {
  if (!bsgCustId) return;
  await Task.update(
    {
      taskStatus: 'Completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      where: {
        customerId: bsgCustId,
        taskTitle: activationTaskTitleWhere(),
        taskStatus: 'Pending',
      },
      transaction,
    }
  );
}

function boHasLocation(bo) {
  return bo?.latitude != null && bo?.longitude != null;
}

/**
 * One pending activation task per BO (customerId = bsg_cust_id).
 * Creates task when that BO has no lat/lng; completes pending when that BO gains location.
 * @param {string} boUserId
 * @param {{ fallbackUserId?: string|null, transaction?: object }} [opts]
 */
async function syncActivationTaskForBusinessOwner(boUserId, opts = {}) {
  if (!boUserId) return;

  const { fallbackUserId = null, transaction: outerTx } = opts;

  const run = async (transaction) => {
    const bo = await User.findOne({
      where: { id: boUserId, role: 'BUSINESS_OWNER' },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!bo?.bsgCustId) return;

    if (boHasLocation(bo)) {
      await completePendingActivationTasksForBsgCustId(bo.bsgCustId, transaction);
      return;
    }

    const assignee = await resolveActivationTaskAssignee(bo, fallbackUserId, transaction);
    if (!assignee) return;

    await ensureActivationTaskForCustomer({
      bsgCustId: bo.bsgCustId,
      customerName: bo.businessName || bo.fullName || bo.bsgCustId,
      userId: assignee,
      transaction,
    });
  };

  if (outerTx) {
    await run(outerTx);
    return;
  }

  return sequelize.transaction(run);
}

async function syncAfterBusinessOwnerPersist(userId) {
  if (!userId) return;

  const user = await User.findByPk(userId, {
    attributes: ['id', 'role'],
  });
  if (!user || String(user.role || '').toUpperCase() !== 'BUSINESS_OWNER') return;

  await syncActivationTaskForBusinessOwner(userId, { fallbackUserId: null });
}

/** Back-compat alias — syncs activation task for one BO (by user id or bsg_cust_id). */
async function syncActivationTaskForCustomerGroup(customerKey, opts = {}) {
  if (!customerKey) return;

  const { fallbackUserId = null, transaction: outerTx } = opts;

  const run = async (transaction) => {
    const bo =
      (await User.findOne({
        where: { id: customerKey, role: 'BUSINESS_OWNER' },
        attributes: ['id'],
        transaction,
      })) ||
      (await User.findOne({
        where: { bsgCustId: customerKey, role: 'BUSINESS_OWNER' },
        attributes: ['id'],
        transaction,
      }));

    if (!bo?.id) return;
    await syncActivationTaskForBusinessOwner(bo.id, { fallbackUserId, transaction });
  };

  if (outerTx) {
    await run(outerTx);
    return;
  }

  return sequelize.transaction(run);
}

/** Back-compat alias — completes only the given customerId (bsg_cust_id). */
async function completePendingActivationTasksForGroup(customerId, transaction) {
  await completePendingActivationTasksForBsgCustId(customerId, transaction);
}

module.exports = {
  ACTIVATION_TASK_TITLE,
  ACTIVATION_TASK_TITLE_LEGACY,
  ACTIVATION_TASK_TITLES,
  resolveActivationTaskAssignee,
  ensureActivationTaskForCustomer,
  ensureActivationTaskForParent: ensureActivationTaskForCustomer,
  completePendingActivationTasksForBsgCustId,
  completePendingActivationTasksForGroup,
  syncActivationTaskForBusinessOwner,
  syncActivationTaskForCustomerGroup,
  syncAfterBusinessOwnerPersist,
  boHasLocation,
};

