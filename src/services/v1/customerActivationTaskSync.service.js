const { Op } = require('sequelize');
const { User, Task, sequelize } = require('../../models');

function isParentLocationFlowEnabled() {
  return String(process.env.ENABLE_PARENT_LOCATION_FLOW || 'false').toLowerCase() === 'true';
}

function groupKeyFromBoRow(row) {
  if (!row) return null;
  return row.parentCustId || row.bsgCustId || null;
}

async function loadGroupBoRows(groupId, transaction) {
  if (!groupId) return [];
  return User.findAll({
    where: {
      role: 'BUSINESS_OWNER',
      [Op.or]: [{ parentCustId: groupId }, { bsgCustId: groupId }],
    },
    attributes: ['id', 'salesRepId', 'latitude', 'longitude', 'bsgCustId', 'parentCustId'],
    transaction,
  });
}

function groupHasLocation(rows) {
  return rows.some((r) => r.latitude != null && r.longitude != null);
}

async function resolveActivationTaskAssignee({ groupRows, fallbackUserId, transaction }) {
  const repCode = groupRows.find((r) => r.salesRepId)?.salesRepId;
  if (repCode) {
    const salesRepUser = await User.findOne({
      where: { role: 'SALES_REP', salesRepId: repCode },
      attributes: ['id'],
      transaction,
    });
    if (salesRepUser?.id) return salesRepUser.id;
  }
  return fallbackUserId || null;
}

async function ensureActivationTaskForParent({ parentCustId, userId, transaction }) {
  if (!parentCustId || !userId) return null;

  const existing = await Task.findOne({
    where: {
      customerId: parentCustId,
      taskType: 'Promotion',
      taskTitle: 'Activate Customer Location',
      taskStatus: 'Pending',
    },
    transaction,
  });
  if (existing) return existing;

  return Task.create(
    {
      userId,
      taskTitle: 'Activate Customer Location',
      taskType: 'Promotion',
      priority: 'High',
      customerId: parentCustId,
      customerName: parentCustId,
      taskStatus: 'Pending',
      dateTime: new Date(),
      description: 'Auto-generated task for customer group first-time location activation.',
    },
    { transaction }
  );
}

async function completePendingActivationTasksForGroup(groupId, transaction) {
  if (!groupId) return;
  await Task.update(
    {
      taskStatus: 'Completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    },
    {
      where: {
        customerId: groupId,
        taskTitle: 'Activate Customer Location',
        taskStatus: 'Pending',
      },
      transaction,
    }
  );
}

/**
 * One pending "Activate Customer Location" per customer group (customerId = group key).
 * Creates task when group has no lat/lng; completes pending when group gains location.
 * @param {string} groupId
 * @param {{ fallbackUserId?: string|null, transaction?: object }} [opts]
 */
async function syncActivationTaskForCustomerGroup(groupId, opts = {}) {
  if (!isParentLocationFlowEnabled() || !groupId) return;

  const { fallbackUserId = null, transaction: outerTx } = opts;

  const run = async (transaction) => {
    const lockedRows = await User.findAll({
      where: {
        role: 'BUSINESS_OWNER',
        [Op.or]: [{ parentCustId: groupId }, { bsgCustId: groupId }],
      },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!lockedRows.length) return;

    if (groupHasLocation(lockedRows)) {
      await completePendingActivationTasksForGroup(groupId, transaction);
      return;
    }

    const assignee = await resolveActivationTaskAssignee({
      groupRows: lockedRows,
      fallbackUserId,
      transaction,
    });
    if (!assignee) return;

    await ensureActivationTaskForParent({
      parentCustId: groupId,
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
  if (!isParentLocationFlowEnabled() || !userId) return;

  const user = await User.findByPk(userId, {
    attributes: ['id', 'role', 'bsgCustId', 'parentCustId'],
  });
  if (!user || String(user.role || '').toUpperCase() !== 'BUSINESS_OWNER') return;

  const groupId = groupKeyFromBoRow(user);
  if (!groupId) return;

  await syncActivationTaskForCustomerGroup(groupId, { fallbackUserId: null });
}

module.exports = {
  isParentLocationFlowEnabled,
  resolveActivationTaskAssignee,
  ensureActivationTaskForParent,
  completePendingActivationTasksForGroup,
  syncActivationTaskForCustomerGroup,
  syncAfterBusinessOwnerPersist,
  loadGroupBoRows,
  groupHasLocation,
};
