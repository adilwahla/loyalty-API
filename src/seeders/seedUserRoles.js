const UserRole = require('../models/userRole.model');
const sequelize = require('../../config/database');

const seedUserRoles = async () => {
  await sequelize.sync();

  const roles = [
    {
      roleName: 'CUSTOMER',
      basePoints: 1.0,
      platform: 'Mobile',
      permissions: [],
    },
    {
      roleName: 'TECHNICIAN',
      basePoints: 1.0,
      platform: 'Mobile',
      permissions: [],
    },
    {
      roleName: 'VISITOR',
      basePoints: 1.0,
      platform: 'Mobile',
      permissions: [],
    },
    {
      roleName: 'BUSINESS_OWNER',
      basePoints: 1.0,
      platform: 'Mobile',
      permissions: [],
    },
    {
      roleName: 'ADMIN',
      basePoints: null,
      platform: 'Dashboard',
      permissions: [], // ✅ fixed from ""
    },
    {
      roleName: 'SALES_ADMIN',
      basePoints: null,
      platform: 'Dashboard',
      permissions: ['Rewards'],
    },
    {
      roleName: 'SUPER_ADMIN',
      basePoints: null,
      platform: 'Dashboard',
      permissions: ['ALL'],
    },
  ];

  for (const role of roles) {
    const [record, created] = await UserRole.findOrCreate({
      where: { roleName: role.roleName },
      defaults: role,
    });

    if (created) {
      console.log(`✅ Created role: ${role.roleName}`);
    } else {
      console.log(`⚠️ Role already exists: ${role.roleName}`);
    }
  }

  process.exit();
};

seedUserRoles();
