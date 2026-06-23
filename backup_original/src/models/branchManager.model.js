// src/models/branchManager.model.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('BranchManager', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    branchCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'branch_code'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    managerId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'manager_id'
    },
  }, {
    tableName: 'branch_managers',
    timestamps: true,
    underscored: true
  });
};
