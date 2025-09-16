// src/services/v1/salesRep.service.js
const { SalesRep } = require('../../models');

exports.getAll = () => SalesRep.findAll();
exports.getById = id => SalesRep.findByPk(id);
exports.create = data => SalesRep.create(data);
exports.update = (id, updates) => SalesRep.update(updates, { where: { id } });
exports.remove = id => SalesRep.destroy({ where: { id } });


// exports.seed = async () => {
//   await SalesRep.bulkCreate([
//     { bsgId: 'BSG101', branchCode: 'BR100', name: 'Ali Hassan' },
//     { bsgId: 'BSG102', branchCode: 'BR101', name: 'Fatima Noor' },
//     { bsgId: 'BSG103', branchCode: 'BR102', name: 'Mohammed Zaki' },
//     { bsgId: 'BSG104', branchCode: 'BR103', name: 'Sara Qureshi' },
//     { bsgId: 'BSG105', branchCode: 'BR104', name: 'Hassan Rami' },
//   ]);
// };