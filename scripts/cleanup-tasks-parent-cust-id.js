const sequelize = require('../config/database');

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column
    `,
    { replacements: { table, column } }
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await sequelize.query(
    `
      SELECT COUNT(*) AS count
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :indexName
    `,
    { replacements: { table, indexName } }
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    if (await indexExists('tasks', 'idx_tasks_parent_cust_id')) {
      await sequelize.query('DROP INDEX idx_tasks_parent_cust_id ON tasks');
      console.log('✅ Dropped idx_tasks_parent_cust_id');
    } else {
      console.log('ℹ️ idx_tasks_parent_cust_id not found, skipping');
    }

    if (await columnExists('tasks', 'parent_cust_id')) {
      await sequelize.query('ALTER TABLE tasks DROP COLUMN parent_cust_id');
      console.log('✅ Dropped tasks.parent_cust_id');
    } else {
      console.log('ℹ️ tasks.parent_cust_id not found, skipping');
    }

    console.log('✅ tasks table cleanup completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ tasks table cleanup failed:', err.message);
    process.exit(1);
  }
}

run();
