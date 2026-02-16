// src/services/v1/branchManager.service.js
const { BranchManager, User } = require('../../models');

exports.getAll = () => BranchManager.findAll({
  include: [{
    model: User,
    as: 'manager',
    attributes: ['fullName'],
    where: { role: 'BRANCH_MANAGER' },
    required: false, // LEFT JOIN — return branch even if no matching user
  }],
  order: [['created_at', 'DESC']],
});
exports.getById = id => BranchManager.findByPk(id);
exports.create = data => BranchManager.create(data);
exports.update = (id, updates) => BranchManager.update(updates, { where: { id } });
exports.remove = id => BranchManager.destroy({ where: { id } });

// exports.seed = async () => {
//   await BranchManager.bulkCreate([
//     { branchCode: 'BR100', name: 'Muneera Alzahrani', managerId: 'MGR101' },
//     { branchCode: 'BR101', name: 'Khalid Mansoor', managerId: 'MGR102' },
//     { branchCode: 'BR102', name: 'Lina Saeed', managerId: 'MGR103' },
//     { branchCode: 'BR103', name: 'Tariq Alwan', managerId: 'MGR104' },
//     { branchCode: 'BR104', name: 'Nora Jaber', managerId: 'MGR105' },
//   ]);
// };
