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

 WarrantyScan ,
  PointsTransaction,
  PointsRule,
  BrandMaster,
  TechnicianBusinessOwnerLink,
  UsedQrNonce
};
