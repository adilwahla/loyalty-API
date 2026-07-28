const Sequelize = require('sequelize');
const sequelize = require('../../config/database');
const DataTypes = Sequelize.DataTypes; // ✅ FIXED HERE
 
// Models
const ProductModel = require('./product.model');
const LubricantSerialCodeModel = require('./lubricantSerialCode.model');
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
const TaskType = require("./taskType.model");
const DeviceTokenModel = require("./deviceToken.model");
const AuthSessionModel = require("./authSession.model");
// this is new update for group.
const GroupModel = require("./group.model");
 
// Other models
const WarrantyScan = require('./WarrantyScan.model')(sequelize, DataTypes);
const PointsTransaction = require('./PointsTransaction.model')(sequelize, DataTypes);
const PointsRule = require('./PointsRule.model')(sequelize, DataTypes);
const BrandMaster = require('./brandMaster')(sequelize, DataTypes);
const TechnicianBusinessOwnerLink = require('./TechnicianBusinessOwnerLink')(sequelize, DataTypes);
const UsedQrNonce = require('./UsedQrNonce')(sequelize, DataTypes);
 
// Privilege Models (RBAC)
const RoleModel = require('./privilege/role.model');
const DutyModel = require('./privilege/duty.model');
const PrivilegeModel = require('./privilege/privileges.model');
const RoleDutyModel = require('./privilege/roleDuty.model');
const DutyPrivilegeModel = require('./privilege/dutyPrivilege.model');

 
/** -------------------------------------------------------- */
 
// Initialize Models
const Product = ProductModel(sequelize, DataTypes);
const LubricantSerialCode = LubricantSerialCodeModel(sequelize, DataTypes);
const Offer = OfferModel(sequelize, DataTypes);
const User = UserModel(sequelize, DataTypes);
const Reward = RewardModel(sequelize, DataTypes);
const RedemptionRequest = RedemptionRequestModel(sequelize, DataTypes);
const WarrantyRedemption = WarrantyRedemptionModel(sequelize, DataTypes);
const SalesRep = SalesRepModel(sequelize, DataTypes);
const BranchManager = BranchManagerModel(sequelize, DataTypes);
const Group = GroupModel(sequelize, DataTypes);
const DeviceToken = DeviceTokenModel(sequelize, DataTypes);
const AuthSession = AuthSessionModel(sequelize, DataTypes);
 
// RBAC models
const Role = RoleModel(sequelize, DataTypes);
const Duty = DutyModel(sequelize, DataTypes);
const Privilege = PrivilegeModel(sequelize, DataTypes);
const RoleDuty = RoleDutyModel(sequelize, DataTypes);
const DutyPrivilege = DutyPrivilegeModel(sequelize, DataTypes);
 
/** -------------------- Associations -------------------- **/
 
// WarrantyScan N:1 User
WarrantyScan.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(WarrantyScan, { as: 'warrantyScans', foreignKey: 'userId' });
 
// TechnicianBusinessOwnerLink optional associations
if (typeof User.associate === 'function') User.associate({ TechnicianBusinessOwnerLink });
if (typeof TechnicianBusinessOwnerLink.associate === 'function') TechnicianBusinessOwnerLink.associate({ User });
 
// WarrantyRedemption N:1 User
WarrantyRedemption.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(WarrantyRedemption, { as: 'warrantyRedemptions', foreignKey: 'userId' });
 
// RBAC associations
// Role ↔ Duty
Role.belongsToMany(Duty, { through: RoleDuty, foreignKey: 'roleId', otherKey: 'dutyId', as: 'roleDuties' });
Duty.belongsToMany(Role, { through: RoleDuty, foreignKey: 'dutyId', otherKey: 'roleId', as: 'dutyRoles' });
 
// Duty ↔ Privilege
Duty.belongsToMany(Privilege, { through: DutyPrivilege, foreignKey: 'dutyId', otherKey: 'privilegeId', as: 'dutyPrivileges' });
Privilege.belongsToMany(Duty, { through: DutyPrivilege, foreignKey: 'privilegeId', otherKey: 'dutyId', as: 'privilegeDuties' });
 
// User ↔ Role
User.belongsTo(Role, { foreignKey: 'role', targetKey: 'name', as: 'userRole' });
Role.hasMany(User, { foreignKey: 'role', sourceKey: 'name', as: 'roleUsers' });
 
// ELHAM: Tasks
User.hasMany(Task, { foreignKey: "userId", as: "tasks" });
Task.belongsTo(User, { foreignKey: "userId", as: "user" });
Task.belongsTo(User, { foreignKey: "createdById", as: "createdByUser" });
 
// TaskReassignHistory associations
TaskReassignHistory.belongsTo(Task, { foreignKey: "taskId", as: "task" });
Task.hasMany(TaskReassignHistory, { foreignKey: "taskId", as: "reassignHistory" });
TaskReassignHistory.belongsTo(User, { foreignKey: "oldUserId", as: "oldUser" });
TaskReassignHistory.belongsTo(User, { foreignKey: "newUserId", as: "newUser" });
 
// BranchManager belongs to User (resolve manager name)
BranchManager.belongsTo(User, { foreignKey: 'managerId', targetKey: 'branchManagerId', as: 'manager' });
 
// Group associations (from first code)
User.belongsTo(Group, { foreignKey: "groupId", as: "group", required: false });
Group.hasMany(User, { foreignKey: "groupId", as: "users" });

User.hasMany(AuthSession, { foreignKey: 'userId', as: 'authSessions' });
AuthSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });
 
// Task belongs to customer (business owner) via customerId -> bsgCustId
Task.belongsTo(User, { foreignKey: "customerId", targetKey: "bsgCustId", as: "customer", required: false });
 
// Optional: Role has many users (already handled above)
 
// Optional reverse links on User if needed
// if (typeof User.associate === 'function') { User.associate({ TechnicianBusinessOwnerLink }); }
 
/** -------------------- Export -------------------- **/
module.exports = {
  sequelize,
  Sequelize,
  DataTypes,
  Product,
  LubricantSerialCode,
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
  TaskType,
  Group,
  DeviceToken,
  AuthSession,
  // RBAC
  Role,
  Duty,
  Privilege,
  RoleDuty,
  DutyPrivilege,
};




// const Sequelize = require('sequelize');
// const sequelize = require('../../config/database');
// const DataTypes = Sequelize.DataTypes; // ✅ FIXED HERE

// // Models
// const ProductModel = require('./product.model');
// const OfferModel = require('./offer.model');
// const UserModel = require('./user.model');
// const UserRole = require('./userRole.model'); // already initialized
// const RewardModel = require('./reward.model');
// const RedemptionRequestModel = require('./redemptionRequest.model');
// const WarrantyRedemptionModel = require('./warrantyRedemption.model');
// const SalesRepModel = require('./salesRep.model');
// const BranchManagerModel = require('./branchManager.model');
// const Task = require("./task");
// const TaskReassignHistory = require("./taskReassignHistory.model");





// const WarrantyScan = require('./WarrantyScan.model')(sequelize, DataTypes);
// const PointsTransaction = require('./PointsTransaction.model')(sequelize, DataTypes);
// const PointsRule = require('./PointsRule.model')(sequelize, DataTypes);
// const BrandMaster = require('./brandMaster')(sequelize, DataTypes);
// const TechnicianBusinessOwnerLink = require('./TechnicianBusinessOwnerLink')(sequelize, DataTypes);
// const UsedQrNonce = require('./UsedQrNonce')(sequelize, DataTypes);


// // Privilege Models
// const RoleModel = require('./privilege/role.model');
// const DutyModel = require('./privilege/duty.model');
// const PrivilegeModel = require('./privilege/privileges.model');
// const RoleDutyModel = require('./privilege/roleDuty.model');
// const DutyPrivilegeModel = require('./privilege/dutyPrivilege.model');




// /** -------------------------------------------------------- */

// // Initialize Models
// const Product = ProductModel(sequelize, DataTypes);
// const Offer = OfferModel(sequelize, DataTypes);
// const User = UserModel(sequelize, DataTypes);
// const Reward = RewardModel(sequelize, DataTypes);
// const RedemptionRequest = RedemptionRequestModel(sequelize, DataTypes);
// const WarrantyRedemption = WarrantyRedemptionModel(sequelize, DataTypes);
// const SalesRep = SalesRepModel(sequelize, DataTypes);
// const BranchManager = BranchManagerModel(sequelize, DataTypes);
// // const Role = RoleModel(sequelize, DataTypes);
// // const Duty = DutyModel(sequelize, DataTypes);

// const Role = RoleModel(sequelize, DataTypes);
// const Duty = DutyModel(sequelize, DataTypes);
// const Privilege = PrivilegeModel(sequelize, DataTypes);
// const RoleDuty = RoleDutyModel(sequelize, DataTypes);
// const DutyPrivilege = DutyPrivilegeModel(sequelize, DataTypes);





// // WarrantyScan N:1 User
// WarrantyScan.belongsTo(User, {
//   as: 'user',
//   foreignKey: 'userId',     // attribute name in the model (mapped to column user_id)
// });

// User.hasMany(WarrantyScan, {
//   as: 'warrantyScans',
//   foreignKey: 'userId',
// });


// // Optional reverse links on User if you added them
// if (typeof User.associate === 'function') {
//   User.associate({ TechnicianBusinessOwnerLink });
// }

// // IMPORTANT: run TBL associations
// if (typeof TechnicianBusinessOwnerLink.associate === 'function') {
//   TechnicianBusinessOwnerLink.associate({ User });
// }

// // WarrantyRedemption N:1 User
// WarrantyRedemption.belongsTo(User, {
//   as: 'user',
//   foreignKey: 'userId', // model attribute (maps to column user_id)
// });
// User.hasMany(WarrantyRedemption, {
//   as: 'warrantyRedemptions',
//   foreignKey: 'userId',
// });



// // // ✅ privilege associations
// /// Role ↔ Duty
// Role.belongsToMany(Duty, {
//   through: RoleDuty,
//   foreignKey: 'roleId',
//   otherKey: 'dutyId',
//   as: 'roleDuties'
// });

// Duty.belongsToMany(Role, {
//   through: RoleDuty,
//   foreignKey: 'dutyId',
//   otherKey: 'roleId',
//   as: 'dutyRoles'
// });

// // Duty ↔ Privilege
// Duty.belongsToMany(Privilege, {
//   through: DutyPrivilege,
//   foreignKey: 'dutyId',
//   otherKey: 'privilegeId',
//   as: 'dutyPrivileges'
// });

// Privilege.belongsToMany(Duty, {
//   through: DutyPrivilege,
//   foreignKey: 'privilegeId',
//   otherKey: 'dutyId',
//   as: 'privilegeDuties'
// });

// User.belongsTo(Role, {
//   foreignKey: 'role',     // column in users table
//   targetKey: 'name',      // column in roles table
//   as: 'userRole'
// });

// Role.hasMany(User, {
//   foreignKey: 'role',
//   sourceKey: 'name',
//   as: 'roleUsers'
// });


// //ELHAM----------------
// User.hasMany(Task, {
//   foreignKey: "userId",
//   as: "tasks"
// });

// Task.belongsTo(User, {
//   foreignKey: "userId",
//   as: "user"
// });

// // TaskReassignHistory associations
// TaskReassignHistory.belongsTo(Task, {
//   foreignKey: "taskId",
//   as: "task"
// });

// Task.hasMany(TaskReassignHistory, {
//   foreignKey: "taskId",
//   as: "reassignHistory"
// });

// TaskReassignHistory.belongsTo(User, {
//   foreignKey: "oldUserId",
//   as: "oldUser"
// });

// TaskReassignHistory.belongsTo(User, {
//   foreignKey: "newUserId",
//   as: "newUser"
// });

// // Object.keys(db).forEach(modelName => {
// //   if (db[modelName].associate) {
// //     db[modelName].associate(db);
// //   }
// // });
// // Role.belongsToMany(Duty, {
// //   through: RoleDuty,
// //   foreignKey: 'roleId',
// //   otherKey: 'dutyId',
// //   as: 'duties'
// // });

// // Duty.belongsToMany(Privilege, {
// //   through: DutyPrivilege,
// //   foreignKey: 'dutyId',
// //   otherKey: 'privilegeId',
// //   as: 'privileges'
// // });


// // Export all models
// module.exports = {
//   sequelize,
//   Sequelize,
//   DataTypes,
//   Product,
//   Offer,
//   User,
//   Reward,
//   RedemptionRequest,
//   WarrantyRedemption,
//   UserRole,
//   SalesRep,
//   BranchManager,

//   WarrantyScan,
//   PointsTransaction,
//   PointsRule,
//   BrandMaster,
//   TechnicianBusinessOwnerLink,
//   UsedQrNonce,
//   Task,
//   TaskReassignHistory,
//   // RBAC
//   Role,
//   Duty,
//   Privilege,
//   RoleDuty,
//   DutyPrivilege,


// };
