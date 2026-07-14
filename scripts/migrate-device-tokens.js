require('dotenv').config();
const { sequelize } = require('../src/models');

async function tableExists(name) {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [name] }
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    const exists = await tableExists('device_tokens');
    if (!exists) {
      await sequelize.query(`
        CREATE TABLE device_tokens (
          id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
          sales_rep_id VARCHAR(255) NOT NULL,
          fcm_token VARCHAR(512) NOT NULL,
          platform ENUM('android', 'ios') NOT NULL,
          device_name VARCHAR(255) NULL,
          last_active_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_device_tokens_fcm_token (fcm_token),
          KEY idx_device_tokens_sales_rep_id (sales_rep_id),
          KEY idx_device_tokens_last_active_at (last_active_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ Created table device_tokens');
    } else {
      console.log('ℹ️  Table device_tokens already exists');
    }

    const [columnRows] = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'users'
         AND COLUMN_NAME = 'device_token'`
    );

    if (Number(columnRows[0]?.count || 0) > 0) {
      const [result] = await sequelize.query(`
        INSERT INTO device_tokens (id, sales_rep_id, fcm_token, platform, last_active_at, created_at, updated_at)
        SELECT
          UUID(),
          COALESCE(NULLIF(TRIM(u.sales_rep_id), ''), NULLIF(TRIM(u.branch_manager_id), '')),
          u.device_token,
          'android',
          NOW(),
          NOW(),
          NOW()
        FROM users u
        WHERE u.device_token IS NOT NULL
          AND TRIM(u.device_token) <> ''
          AND COALESCE(NULLIF(TRIM(u.sales_rep_id), ''), NULLIF(TRIM(u.branch_manager_id), '')) IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM device_tokens dt WHERE dt.fcm_token = u.device_token
          )
      `);
      console.log('✅ Migrated legacy users.device_token rows:', result?.affectedRows ?? result);
    } else {
      console.log('ℹ️  Column users.device_token not found — skip legacy migration');
    }

    console.log('✅ Device tokens migration completed');
  } catch (err) {
    if (err.message?.includes('already exists')) {
      console.log('⚠️  Migration partially applied (already exists) — OK');
      return;
    }
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
