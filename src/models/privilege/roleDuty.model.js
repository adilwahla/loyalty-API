// src/models/privilege/roleDuty.model.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'RoleDuty',
    {
      roleId: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      dutyId: {
        type: DataTypes.INTEGER,
        primaryKey: true
      }
    },
    {
      tableName: 'role_duties',
      timestamps: false
    }
  );
};

