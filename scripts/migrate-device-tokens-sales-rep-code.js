require('dotenv').config();
const { sequelize } = require('../src/models');

async function foreignKeyExists(tableName, constraintName) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: [tableName, constraintName] }
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function columnType(tableName, columnName) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE AS columnType
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    { replacements: [tableName, columnName] }
  );
  return rows[0]?.columnType || null;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    const exists = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'device_tokens'`
    );
    if (!Number(exists[0][0]?.count || 0)) {
      console.log('ℹ️  device_tokens table not found — run migrate-device-tokens.js first');
      return;
    }

    if (await foreignKeyExists('device_tokens', 'fk_device_tokens_sales_rep_id')) {
      await sequelize.query('ALTER TABLE device_tokens DROP FOREIGN KEY fk_device_tokens_sales_rep_id');
      console.log('✅ Dropped FK fk_device_tokens_sales_rep_id');
    }

    const [updated] = await sequelize.query(`
      UPDATE device_tokens dt
      INNER JOIN users u ON dt.sales_rep_id = u.id
      SET dt.sales_rep_id = COALESCE(
        NULLIF(TRIM(u.sales_rep_id), ''),
        NULLIF(TRIM(u.branch_manager_id), '')
      )
      WHERE dt.sales_rep_id = u.id
    `);
    console.log('✅ Converted UUID sales_rep_id rows to rep codes:', updated?.affectedRows ?? updated);

    const currentType = await columnType('device_tokens', 'sales_rep_id');
    if (currentType && !String(currentType).toLowerCase().startsWith('varchar')) {
      await sequelize.query(
        'ALTER TABLE device_tokens MODIFY sales_rep_id VARCHAR(255) NOT NULL'
      );
      console.log('✅ Changed device_tokens.sales_rep_id to VARCHAR(255)');
    } else {
      console.log('ℹ️  device_tokens.sales_rep_id already VARCHAR');
    }

    console.log('✅ Sales rep code migration completed');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
