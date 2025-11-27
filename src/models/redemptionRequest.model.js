const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('RedemptionRequest', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  rewardId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salesRepId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userRole: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  requestDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pdfUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pointsUsed: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  redemptionType: {
    type: DataTypes.ENUM('warranty', 'product_scan'),
    allowNull: false,
  },
  reviewedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  approvedBy: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  }
}, {
  tableName: 'redemption_requests',
  timestamps: true,
});
}
//module.exports = RedemptionRequest;
