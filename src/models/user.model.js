module.exports = (sequelize, DataTypes) => {
  return sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: false,
      field: 'phone_number',
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    iqamaNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'iqama_number',
    },
    fullName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'full_name',
    },
    businessName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'business_name',
    },
    vatNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'vat_number',
    },
    businessAddress: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'business_address',
    },

    latitude: {
       type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
         field: 'latitude' 
        },

    longitude: { 
      type: DataTypes.DECIMAL(11, 8),
       allowNull: true,
        field: 'longitude' },

    binShihonWorkerId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'bin_shihon_worker_id',
    },
    salesRepId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'sales_rep_id',
    },
    bsgCustId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'bsg_cust_id',
    },
    parentCustId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'parent_cust_id',
    },
    branchManagerId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'branch_manager_id',
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: { isEmail: true },
      field: 'email',
    },
    isOtpVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_otp_verified',
    },
    points: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      field: 'points',
    },

    // 🔹 New field
    shareFactor: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.5, // fallback multiplier
      field: 'share_factor',
    },
    // NEW (non-breaking)
    status: {
      type: DataTypes.STRING, // '-', 'PENDING', 'APPROVED', 'REJECTED'
      allowNull: false,
      defaultValue: '-',      // non-BO users show '-'
      field: 'status',
    },
    deviceToken: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'device_token',
    },
groupId: { 
  type: DataTypes.INTEGER,
   allowNull: true,
    field: 'groupId' 
  },
  nfcSerialNumber: {
  type: DataTypes.STRING(32),
  allowNull: true,
  field: 'nfc_serial_number',
}
  }, {
    tableName: 'users',
    timestamps: true,
    indexes: [
      { fields: ['parent_cust_id'] },
      { fields: ['bsg_cust_id'] },
    ],
    hooks: {
      afterSave(user) {
        const role = String(user.role || '').toUpperCase();
        if (role !== 'BUSINESS_OWNER') return;
        const sync = require('../services/v1/customerActivationTaskSync.service');
        setImmediate(() => {
          sync.syncAfterBusinessOwnerPersist(user.id).catch((err) => {
            console.error('[activation-task-sync] BO afterSave:', err.message);
          });
        });
      },
    },
  });
};
