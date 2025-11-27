// PointsTransaction.model.js
module.exports = (sequelize, DataTypes) => {
  const PointsTransaction = sequelize.define('PointsTransaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false }, // 'WARRANTY_SCAN'
    sourceId: { type: DataTypes.UUID, allowNull: false }, // request id
    points: { type: DataTypes.INTEGER, allowNull: false }, // +25
    direction: { type: DataTypes.ENUM('CREDIT','DEBIT'), defaultValue: 'CREDIT' },
    note: { type: DataTypes.STRING },
  }, {
    tableName: 'points_transactions',
    underscored: true,
  });
  return PointsTransaction;
};
