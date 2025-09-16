// PointsRule.model.js
module.exports = (sequelize, DataTypes) => {
  const PointsRule = sequelize.define('PointsRule', {
    key: { type: DataTypes.STRING, primaryKey: true }, // 'WARRANTY_SCAN'
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 25 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, {
    tableName: 'points_rules',
    underscored: true,
    timestamps: true,
  });
  return PointsRule;
};
