const Sequelize = require('sequelize');
const sequelize = require('../../config/database');
const DataTypes = Sequelize.DataTypes; // ✅ FIXED HERE

// Models
const ProductModel = require('./product.model');
const OfferModel = require('./offer.model');
const UserModel = require('./user.model');
const UserRole = require('./userRole.model'); // already initialized
const RewardModel = require('./reward.model');
const RedemptionRequestModel = require('./redemptionRequest.model');
const WarrantyRedemptionModel = require('./warrantyRedemption.model');
const SalesRepModel = require('./salesRep.model');
const BranchManagerModel = require('./branchManager.model');
const Task = require("./task");
const TaskReassignHistory = require("./taskReassignHistory.model");
// this is new update for group.
const GroupModel = require("./group.model");


const WarrantyScan  = require('./WarrantyScan.model')(sequelize, DataTypes);
const PointsTransaction = require('./PointsTransaction.model')(sequelize, DataTypes);
const PointsRule = require('./PointsRule.model')(sequelize, DataTypes);
const BrandMaster = require('./brandMaster')(sequelize, DataTypes);
const TechnicianBusinessOwnerLink = require('./TechnicianBusinessOwnerLink')(sequelize, DataTypes);
const UsedQrNonce = require('./UsedQrNonce')(sequelize, DataTypes);


// Initialize Models
const Product = ProductModel(sequelize, DataTypes);
const Offer = OfferModel(sequelize, DataTypes);
const User = UserModel(sequelize, DataTypes);
const Reward = RewardModel(sequelize, DataTypes);
const RedemptionRequest = RedemptionRequestModel(sequelize, DataTypes);
const WarrantyRedemption = WarrantyRedemptionModel(sequelize, DataTypes);
const SalesRep = SalesRepModel(sequelize, DataTypes);
const BranchManager = BranchManagerModel(sequelize, DataTypes);
// this is new update for group.
const Group = GroupModel(sequelize, DataTypes);






// WarrantyScan N:1 User
WarrantyScan.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId',     // attribute name in the model (mapped to column user_id)
});

User.hasMany(WarrantyScan, {
  as: 'warrantyScans',
  foreignKey: 'userId',
});


// Optional reverse links on User if you added them
if (typeof User.associate === 'function') {
  User.associate({ TechnicianBusinessOwnerLink });
}

// IMPORTANT: run TBL associations
if (typeof TechnicianBusinessOwnerLink.associate === 'function') {
  TechnicianBusinessOwnerLink.associate({ User });
}

// WarrantyRedemption N:1 User
WarrantyRedemption.belongsTo(User, {
  as: 'user',
  foreignKey: 'userId', // model attribute (maps to column user_id)
});
User.hasMany(WarrantyRedemption, {
  as: 'warrantyRedemptions',
  foreignKey: 'userId',
});



// // ✅ User has one role
// User.belongsTo(UserRole, {
//   foreignKey: 'role',   // column in User table
//   targetKey: 'roleName', // column in UserRole table
//   as: 'userRole',        // alias to use in include
// });

// // Optional: Role has many users
// UserRole.hasMany(User, {
//   foreignKey: 'role',
//   sourceKey: 'roleName',
//   as: 'users',
// });


//ELHAM----------------
User.hasMany(Task, {
  foreignKey: "userId",
  as: "tasks"
});

Task.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});

// this is new update for group.
// Task belongs to customer (business owner) via customerId -> bsgCustId
Task.belongsTo(User, {
  foreignKey: "customerId",
  targetKey: "bsgCustId",
  as: "customer",
  required: false // Customer might not exist in users table
});

// this is new update for group.
// Group associations
// Note: Only business owners (customers) have groupId, sales reps and other users will have null
User.belongsTo(Group, {
  foreignKey: "groupId",
  as: "group",
  required: false // Allow null groupId (users without groups)
});

// this is new update for group.
Group.hasMany(User, {
  foreignKey: "groupId",
  as: "users"
});

// TaskReassignHistory associations
TaskReassignHistory.belongsTo(Task, {
  foreignKey: "taskId",
  as: "task"
});

Task.hasMany(TaskReassignHistory, {
  foreignKey: "taskId",
  as: "reassignHistory"
});

TaskReassignHistory.belongsTo(User, {
  foreignKey: "oldUserId",
  as: "oldUser"
});

TaskReassignHistory.belongsTo(User, {
  foreignKey: "newUserId",
  as: "newUser"
});



// Export all models
module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  Product,
  Offer,
  User,
  Reward,
  RedemptionRequest,
  WarrantyRedemption,
  UserRole,
  SalesRep,
  BranchManager,

  WarrantyScan,
  PointsTransaction,
  PointsRule,
  BrandMaster,
  TechnicianBusinessOwnerLink,
  UsedQrNonce,
  Task,
  TaskReassignHistory,
  // this is new update for group.
  Group
};
