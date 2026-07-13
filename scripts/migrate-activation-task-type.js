const { sequelize } = require('../src/models');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const [result] = await sequelize.query(`
      UPDATE tasks
      SET taskType = 'Customer Activation'
      WHERE taskType = 'Promotion'
        AND taskTitle IN ('Activate Customer Location', 'تفعيل موقع العميل')
    `);

    console.log(`✅ Activation tasks migrated to Customer Activation: ${result?.affectedRows ?? 0}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to migrate activation task types:', err.message);
    process.exit(1);
  }
}

run();
