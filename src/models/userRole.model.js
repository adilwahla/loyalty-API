const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const UserRole = sequelize.define('UserRole', {
  roleName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  basePoints: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  platform: {
    type: DataTypes.ENUM('Mobile', 'Dashboard'),
    allowNull: false,
  },
permissions: {
  type: DataTypes.TEXT, // safer fallback than JSON
  get() {
    const raw = this.getDataValue('permissions');
    return raw ? JSON.parse(raw) : [];
  },
  set(value) {
    this.setDataValue('permissions', JSON.stringify(value));
  }
}

}, {
  tableName: 'user_roles',
  timestamps: true,
});

module.exports = UserRole;
