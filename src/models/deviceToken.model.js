module.exports = (sequelize, DataTypes) => {
  return sequelize.define('DeviceToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    salesRepId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'sales_rep_id',
    },
    fcmToken: {
      type: DataTypes.STRING(512),
      allowNull: false,
      unique: true,
      field: 'fcm_token',
    },
    platform: {
      type: DataTypes.ENUM('android', 'ios'),
      allowNull: false,
    },
    deviceName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'device_name',
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_active_at',
    },
  }, {
    tableName: 'device_tokens',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['sales_rep_id'] },
      { fields: ['last_active_at'] },
      { unique: true, fields: ['fcm_token'] },
    ],
  });
};
