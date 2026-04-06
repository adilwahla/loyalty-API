// src/models/privilege/dutyPrivilege.model.js
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'DutyPrivilege',
    {
      dutyId: {
        type: DataTypes.INTEGER,
        primaryKey: true
      },
      privilegeId: {
        type: DataTypes.INTEGER,
        primaryKey: true
      }
    },
    {
      tableName: 'duty_privileges',
      timestamps: false
    }
  );
};

