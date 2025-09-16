// models/UsedQrNonce.js

module.exports = (sequelize, DataTypes) => {
  const UsedQrNonce = sequelize.define('UsedQrNonce', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nonce: { type: DataTypes.STRING, allowNull: false, unique: true },
    purpose: { type: DataTypes.STRING, allowNull: false, defaultValue: 'LINK_BO' },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'used_qr_nonces' });

  return UsedQrNonce;
};
