// src/models/privilege/duty.model.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Duty extends Model {}

  Duty.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      }
    },
    {
      sequelize,
      modelName: 'Duty',
      tableName: 'duties',
      timestamps: true
    }
  );

  return Duty;
};
