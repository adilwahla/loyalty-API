module.exports = (sequelize, DataTypes) => {
  return sequelize.define('LubricantSerialCode', {

    id: {
      type: DataTypes.INTEGER,
      primaryKey: true
    },

    serial_code: {
      type: DataTypes.STRING(8),
      unique: true
    },

    bsg_code: {
      type: DataTypes.STRING
    },

    status: {
      type: DataTypes.ENUM('unused','scanned'),
      defaultValue: 'unused'
    },

    scanned_by: {
      type: DataTypes.UUID,
      allowNull: true
    },

    scanned_at: {
      type: DataTypes.DATE
    }

  },{
    tableName: 'lubricant_serial_codes',
    timestamps: false
  });
};