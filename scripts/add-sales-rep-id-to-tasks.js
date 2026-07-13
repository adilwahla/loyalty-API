require('dotenv').config();
const { sequelize } = require('../src/models');

(async () => {
  try {
    const [existing] = await sequelize.query(
      "SHOW COLUMNS FROM tasks LIKE 'sales_rep_id'"
    );

    if (!existing.length) {
      await sequelize.query(
        'ALTER TABLE tasks ADD COLUMN sales_rep_id VARCHAR(10) NULL AFTER user_id'
      );
      console.log('✅ Added column tasks.sales_rep_id');
    } else {
      console.log('ℹ️ Column tasks.sales_rep_id already exists');
    }

    const [result] = await sequelize.query(`
      UPDATE tasks t
      INNER JOIN users u ON u.id = t.user_id
      SET t.sales_rep_id = COALESCE(
        NULLIF(TRIM(u.sales_rep_id), ''),
        NULLIF(TRIM(u.branch_manager_id), '')
      )
      WHERE (t.sales_rep_id IS NULL OR t.sales_rep_id = '')
        AND (
          (u.sales_rep_id IS NOT NULL AND TRIM(u.sales_rep_id) <> '')
          OR (u.branch_manager_id IS NOT NULL AND TRIM(u.branch_manager_id) <> '')
        )
    `);
    console.log('✅ Backfilled sales_rep_id rows:', result?.affectedRows ?? result);

    const task = await require('../src/models').Task.findOne();
    console.log('✅ Sample task salesRepId=', task?.salesRepId, 'id=', task?.id);
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
