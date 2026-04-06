// src/models/salesRep.model.js
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('SalesRep', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bsgId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'bsg_id'
    },
    branchCode: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'branch_code'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
  }, {
    tableName: 'sales_reps',
    timestamps: true,
    underscored: true
  });
};