// src/models/offer.model.js
module.exports = (sequelize, DataTypes) => {
  const Offer = sequelize.define('Offer', {
    userRole: { type: DataTypes.STRING, allowNull: false },
    fromDate: { type: DataTypes.DATE, allowNull: false },
    toDate: { type: DataTypes.DATE, allowNull: false },
    offerId: { type: DataTypes.STRING, allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    pointsFactor: { type: DataTypes.FLOAT, allowNull: false },
    imageUrl: { type: DataTypes.STRING },
    type: { type: DataTypes.ENUM('offer', 'banner'), defaultValue: 'offer' }
  }, {
    tableName: 'offers',
    timestamps: true
  });

  return Offer;
};
