const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");
 
const TaskReassignHistory = sequelize.define(
  "TaskReassignHistory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    taskId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'task_id',
      references: {
        model: 'tasks',
        key: 'id'
      },
      onDelete: 'CASCADE', // ← مضافة من النسخة الأولى
      onUpdate: 'CASCADE'  // ← مضافة من النسخة الأولى
    },
    oldUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'old_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    newUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'new_user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    newEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'new_end_date'
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    changedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
      field: 'changed_at'
    },
  },
  {
    tableName: "task_reassign_history",
    timestamps: false
  }
);
 
module.exports = TaskReassignHistory;