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
      unique: true,
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
    // this is new update
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: 'latitude',
    },
    // this is new update
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: 'longitude',
    },
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
    // this is new update for group.
    groupId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'groupId', // Database uses camelCase
    },

  }, {
    tableName: 'users',
    timestamps: true,
  });
};
