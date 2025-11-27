const { v4: uuidv4 } = require("uuid");
const Task = require("../models/task");

const sequelize = require("../../config/database");

const seedTasks = async () => {
  try {
    await sequelize.sync();

    const tasks = [
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Payment collection.",
        taskType: "Collection",
        priority: "High",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-11-01",
        dateTo: "2025-11-20",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-10-31",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "New discount offers-2001",
        taskType: "Promotion",
        priority: "Medium",
        customerId: "CC103",
        customerName: "Al Adwa Est.",
        dateFrom: "2025-10-02",
        dateTo: "2025-10-10",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Salama",
        dateVisit: "2025-10-31",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "New discount offers-5555",
        taskType: "Promotion",
        priority: "High",
        customerId: "CC103",
        customerName: "Al Adwa Est.",
        dateFrom: "2025-11-29",
        dateTo: "2025-12-10",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Salama",
        dateVisit: "2025-10-31",
        comment: "done",
      },
       {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Payment collection-2001.",
        taskType: "Collection",
        priority: "High",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-12-01",
        dateTo: "2025-12-20",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-12-31",
        comment: "done",
      },
       {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Promote new product line",
        taskType: "Collection",
        priority: "Medium",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-12-08",
        dateTo: "2025-12-25",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-12-31",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Cross-sell extended warranty",
        taskType: "Collection",
        priority: "Medium",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-12-06",
        dateTo: "2025-12-23",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-12-30",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Collect outstanding payment INV-0021",
        taskType: "Collection",
        priority: "Low",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-12-13",
        dateTo: "2025-12-22",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-12-31",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Upsell premium subscription",
        taskType: "Collection",
        priority: "Low",
        customerId: "C9999",
        customerName: "Saleh Almalki",
        dateFrom: "2025-12-11",
        dateTo: "2025-12-27",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-Balad",
        dateVisit: "2025-12-31",
        comment: "done",
      },
      {
        id: uuidv4(),
        userId: "19252573-222e-44d0-9793-9f946bb7fe99",
        taskTitle: "Upsell premium subscription-99086",
        taskType: "Collection",
        priority: "High",
        customerId: "C9999",
        customerName: "Batool Mohammed",
        dateFrom: "2025-12-4",
        dateTo: "2025-12-21",
        taskStatus: "Pending",
        dateTime: "2025-09-08 10:25:51",
        location: "Al-zahra",
        dateVisit: "2025-12-31",
        comment: "done batool",
      },
      
      
  
      


    ];

    for (const task of tasks) {
      const [record, created] = await Task.findOrCreate({
        where: {
          userId: task.userId,
          taskTitle: task.taskTitle,
        },
        defaults: task,
      });

      if (created) {
        console.log(`✅ Created task: ${task.taskTitle}`);
      } else {
        console.log(`⚠️ Task already exists: ${task.taskTitle}`);
      }
    }

    console.log("🎉 All tasks seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding tasks:", error);
  } finally {
    process.exit();
  }
};

seedTasks();
