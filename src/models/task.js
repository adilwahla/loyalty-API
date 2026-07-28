const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
// task1ID,userId,comment,
//
// task_history={"userId":"id1","comment":"Initial task created."},
//              {"userId":"id2","comment":"Task updated with new details."}

const Task = sequelize.define(
  "Task",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // task_history:{ type: DataTypes.JSON, allowNull: true, field: 'task_history' },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id'},
    salesRepId: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'sales_rep_id',
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by_id',
    },
    taskTitle: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    taskType: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    priority: {
      type: DataTypes.ENUM("High", "Medium", "Low"),
      allowNull: true
    },
    customerId: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    customerName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // check
    dateFrom: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    dateTo: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    taskStatus: {
      type: DataTypes.ENUM("Pending","Completed"),
      allowNull: true
    },
    dateTime: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    completedAt:{type: DataTypes.DATE, allowNull: true},
    
    location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
      dateVisit: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
     comment: {
      type: DataTypes.STRING(1000),
      allowNull: true
    },
    stockCount: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'stock_count',
    },
    collectedAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'collected_amount',
    },
    soldAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: 'sold_amount',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'updated_at'
    },
  },
  {
    tableName: "tasks",
    timestamps: false
  }
);

module.exports = Task;
