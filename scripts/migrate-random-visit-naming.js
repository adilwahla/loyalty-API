const { sequelize } = require("../src/models");

async function run() {
  try {
    await sequelize.authenticate();

    const [result] = await sequelize.query(`
      UPDATE tasks
      SET taskType = 'Random Visit',
          taskTitle = 'زيارة عشوائية'
      WHERE taskType = 'random_visit'
         OR taskTitle = 'زيارة عفوية'
    `);

    console.log(`✅ Tasks updated: ${result?.affectedRows ?? 0}`);

    await sequelize.query(`
      DELETE FROM task_types
      WHERE code = 'random_visit'
    `).catch(() => {});

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to migrate random visit naming:", err.message);
    process.exit(1);
  }
}

run();
