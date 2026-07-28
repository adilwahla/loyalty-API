module.exports = (sequelize, DataTypes) => {
  return sequelize.define('AuthSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
    },
    salesRepId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'sales_rep_id',
    },
    refreshTokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false,
      field: 'refresh_token_hash',
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_id',
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_name',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_used_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'revoked_at',
    },
  }, {
    tableName: 'auth_sessions',
    timestamps: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['sales_rep_id'] },
      { fields: ['device_id'] },
      { fields: ['expires_at'] },
      { unique: true, fields: ['refresh_token_hash'] },
    ],
  });
};
