// src/models/privilege/privileges.model.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Privilege extends Model {}

  Privilege.init(
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
      },
      controlName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      }
    },
    {
      sequelize,
      modelName: 'Privilege',
      tableName: 'privileges',
      timestamps: true
    }
  );

  return Privilege;
};
