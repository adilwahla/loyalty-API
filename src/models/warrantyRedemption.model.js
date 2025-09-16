module.exports = (sequelize, DataTypes) => {
  return sequelize.define('WarrantyRedemption', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rewards: {
      type: DataTypes.STRING,
      allowNull: false
    },
    requestDate: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'request_date'
    },
    location: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // in WarrantyRedemption model
    requiredPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      //  defaultValue: 0, // Ensure a default value
      field: 'required_points'
    },

    pointsAccumulated: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'points_accumulated'
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      defaultValue: 'PENDING'
    }
  }, {
    tableName: 'warranty_redemptions',
    timestamps: true,
    underscored: true
  });
};
