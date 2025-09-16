module.exports = (sequelize, DataTypes) => {
  return sequelize.define('WarrantyScan', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },

    timestamp: { type: DataTypes.STRING, allowNull: false },

    geoLocation: { type: DataTypes.STRING, allowNull: true, field: 'geo_location' },

    points: { type: DataTypes.STRING, allowNull: true },

    productName: { type: DataTypes.STRING, allowNull: true, field: 'product_name' },

    sku: { type: DataTypes.STRING, allowNull: true },

    brandType: { type: DataTypes.STRING, allowNull: true, field: 'brand_type' },
    brand: { type: DataTypes.STRING, allowNull: true, field: 'brand' },


    pointType: { type: DataTypes.STRING, allowNull: true, field: 'point_type' }, // Corrected field name

    scanType: { type: DataTypes.STRING, allowNull: true, field: 'scan_type' }, // Corrected field name



    // ✅ NEW
    warrantyNumber: { type: DataTypes.STRING, allowNull: false, field: 'warranty_number' },

    // ✅ NEW: Approval status
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
  }, {
    tableName: 'warranty_scans',
    timestamps: true,
    underscored: true,
  });
};
