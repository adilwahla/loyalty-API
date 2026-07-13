const { sequelize, TaskType } = require("../src/models");

async function run() {
  try {
    await sequelize.authenticate();
    console.log("✅ Connected to database");

    const [row, created] = await TaskType.findOrCreate({
      where: { code: "Random Visit" },
      defaults: {
        code: "Random Visit",
        englishTitle: "Random Visit",
        arabicTitle: "زيارة عشوائية",
        isActive: true,
        isSelectable: false,
      },
    });

    if (!created) {
      await row.update({
        englishTitle: "Random Visit",
        arabicTitle: "زيارة عشوائية",
        isActive: true,
        isSelectable: false,
      });
      console.log("✅ Random Visit task type updated");
    } else {
      console.log("✅ Random Visit task type created");
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to seed Random Visit task type:", err.message);
    process.exit(1);
  }
}

run();
