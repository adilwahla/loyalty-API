module.exports = (sequelize, DataTypes) => {
  return sequelize.define('NfcScanFailure', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    salesRepId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'sales_rep_id',
    },
    customerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'customer_id',
    },
    errorCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'error_code',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'error_message',
    },
    source: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    dateTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'datetime',
    },
  }, {
    tableName: 'error_logs',
    timestamps: false,
  });
};
