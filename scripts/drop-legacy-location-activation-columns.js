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

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const drops = [
      'is_location_activated',
      'location_activated_at',
      'location_activated_by',
    ];

    for (const column of drops) {
      if (await columnExists('users', column)) {
        await sequelize.query(`ALTER TABLE users DROP COLUMN ${column}`);
        console.log(`✅ Dropped users.${column}`);
      } else {
        console.log(`ℹ️ users.${column} not found, skipping`);
      }
    }

    console.log('✅ Legacy activation columns cleanup completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup failed:', err.message);
    process.exit(1);
  }
}

run();
