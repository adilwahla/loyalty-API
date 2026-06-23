// models/TechnicianBusinessOwnerLink.js
// const { DataTypes } = require('sequelize');
// const sequelize = require('../../config/database');

module.exports = (sequelize, DataTypes) => {
  const TechnicianBusinessOwnerLink = sequelize.define('TechnicianBusinessOwnerLink', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    technicianId: { type: DataTypes.UUID, allowNull: false, field: 'technician_id' },
    businessOwnerId: { type: DataTypes.UUID, allowNull: false, field: 'business_owner_id' },
    shareFactor: { type: DataTypes.DECIMAL(5, 4), allowNull: false, defaultValue: 0.20 }, // 0.0 - 1.0
    status: { type: DataTypes.ENUM('ACTIVE', 'INACTIVE'), defaultValue: 'ACTIVE' },
    createdByAdminId: { type: DataTypes.UUID, allowNull: true, field: 'created_by_admin_id' },
  }, {
    tableName: 'technician_bo_links',
    indexes: [
      { unique: true, fields: ['technician_id', 'business_owner_id'] }
    ]
  });

  TechnicianBusinessOwnerLink.associate = (models) => {
    TechnicianBusinessOwnerLink.belongsTo(models.User, { as: 'technician', foreignKey: 'technicianId' });
    TechnicianBusinessOwnerLink.belongsTo(models.User, { as: 'businessOwner', foreignKey: 'businessOwnerId' });
  };

  return TechnicianBusinessOwnerLink;
};
