module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Product', {
    sku: { type: DataTypes.STRING, allowNull: false , unique: true  },
    image: { type: DataTypes.STRING },
    title: { type: DataTypes.STRING, allowNull: false },
    nameArabic: { type: DataTypes.STRING },
    units: { type: DataTypes.STRING },
    unitQuantity: { type: DataTypes.INTEGER },
    basePoints: { type: DataTypes.FLOAT },
    colorCode: { type: DataTypes.STRING },
    mCode: { type: DataTypes.STRING },
    status: {
      type: DataTypes.ENUM('Published', 'Draft', 'Archived'),
      defaultValue: 'Published'
    },
    createdDate: { type: DataTypes.DATEONLY }
  });
};
