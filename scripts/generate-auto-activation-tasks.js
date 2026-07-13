const { Op } = require('sequelize');
const { sequelize, Task } = require('../src/models');
const {
  syncActivationTaskForBusinessOwner,
  ACTIVATION_TASK_TITLES,
  ACTIVATION_TASK_TYPES,
} = require('../src/services/v1/customerActivationTaskSync.service');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const [rows] = await sequelize.query(`
      SELECT id, bsg_cust_id
      FROM users
      WHERE role = 'BUSINESS_OWNER'
        AND bsg_cust_id IS NOT NULL
        AND (latitude IS NULL OR longitude IS NULL)
    `);

    let created = 0;
    let skippedExisting = 0;
    let skippedNoAssignee = 0;

    for (const row of rows) {
      const bsgCustId = row.bsg_cust_id;
      if (!bsgCustId) continue;

      const existing = await Task.findOne({
        where: {
          taskTitle: { [Op.in]: ACTIVATION_TASK_TITLES },
          taskType: { [Op.in]: ACTIVATION_TASK_TYPES },
          taskStatus: 'Pending',
          customerId: bsgCustId,
        },
      });

      await syncActivationTaskForBusinessOwner(row.id, {});

      const after = await Task.findOne({
        where: {
          taskTitle: { [Op.in]: ACTIVATION_TASK_TITLES },
          taskType: { [Op.in]: ACTIVATION_TASK_TYPES },
          taskStatus: 'Pending',
          customerId: bsgCustId,
        },
      });

      if (existing && after) skippedExisting += 1;
      else if (!existing && after) created += 1;
      else if (!after) skippedNoAssignee += 1;
    }

    console.log(`✅ Auto activation tasks created (new): ${created}`);
    console.log(`ℹ️ Customers already had pending activation task: ${skippedExisting}`);
    console.log(`ℹ️ Customers with no assignable sales rep (no task): ${skippedNoAssignee}`);

    const [, syncMeta] = await sequelize.query(`
      UPDATE tasks t
      INNER JOIN users u ON u.id = t.user_id
      SET t.sales_rep_id = u.sales_rep_id
      WHERE u.sales_rep_id IS NOT NULL
        AND (t.sales_rep_id IS NULL OR t.sales_rep_id <> u.sales_rep_id)
    `);
    console.log(`✅ Tasks sales_rep_id synced from assignee: ${syncMeta?.affectedRows ?? 0}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to generate activation tasks:', err.message);
    process.exit(1);
  }
}

run();
