// this is new update for group.
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Group', {
    groupId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      field: 'groupId', // Database uses camelCase
    },
    groupName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'groupName', // Database uses camelCase
    },
    groupNameAR: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'groupNameAR', // Database uses camelCase
    },
    colorHex: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'colorHex', // Database uses camelCase
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
      field: 'createdAt', // Database uses camelCase
    },
  }, {
    tableName: 'groups',
    timestamps: false, // We handle createdAt manually
  });
};
