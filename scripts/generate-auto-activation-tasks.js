const { sequelize, Task } = require('../src/models');
const {
  syncActivationTaskForCustomerGroup,
  isParentLocationFlowEnabled,
} = require('../src/services/v1/customerActivationTaskSync.service');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    if (!isParentLocationFlowEnabled()) {
      console.log('⚠️ ENABLE_PARENT_LOCATION_FLOW is not true — sync skipped. Set it to true and retry.');
      process.exit(0);
    }

    const [groups] = await sequelize.query(`
      SELECT
        COALESCE(parent_cust_id, bsg_cust_id) AS group_id
      FROM users
      WHERE role = 'BUSINESS_OWNER'
        AND bsg_cust_id IS NOT NULL
      GROUP BY COALESCE(parent_cust_id, bsg_cust_id)
      HAVING SUM(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 ELSE 0 END) = 0
    `);

    let created = 0;
    let skippedExisting = 0;
    let skippedNoAssignee = 0;

    for (const g of groups) {
      const groupId = g.group_id;
      if (!groupId) continue;

      const existing = await Task.findOne({
        where: {
          taskTitle: 'Activate Customer Location',
          taskType: 'Promotion',
          taskStatus: 'Pending',
          customerId: groupId,
        },
      });

      await syncActivationTaskForCustomerGroup(groupId, {});

      const after = await Task.findOne({
        where: {
          taskTitle: 'Activate Customer Location',
          taskType: 'Promotion',
          taskStatus: 'Pending',
          customerId: groupId,
        },
      });

      if (existing && after) skippedExisting += 1;
      else if (!existing && after) created += 1;
      else if (!after) skippedNoAssignee += 1;
    }

    console.log(`✅ Auto activation tasks created (new): ${created}`);
    console.log(`ℹ️ Groups already had pending activation task: ${skippedExisting}`);
    console.log(`ℹ️ Groups with no assignable sales rep (no task): ${skippedNoAssignee}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to generate activation tasks:', err.message);
    process.exit(1);
  }
}

run();
