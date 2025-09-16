module.exports = (sequelize, DataTypes) => {
  return sequelize.define('BrandMaster', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    basePoints: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'brand_master',
    timestamps: true,
    underscored: true
  });
};
