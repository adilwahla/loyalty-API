const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const TaskType = sequelize.define(
  'TaskType',
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    englishTitle: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'english_title',
    },
    arabicTitle: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'arabic_title',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
    isSelectable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_selectable',
    },
  },
  {
    tableName: 'task_types',
    timestamps: false,
  }
);

module.exports = TaskType;
