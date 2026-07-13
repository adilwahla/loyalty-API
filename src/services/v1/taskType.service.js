const { TaskType } = require('../../models');

async function getSelectableTaskTypes() {
  const rows = await TaskType.findAll({
    where: { isActive: true, isSelectable: true },
    attributes: ['id', 'code', 'englishTitle', 'arabicTitle'],
    order: [['id', 'ASC']],
  });
  return rows.map((row) => row.toJSON());
}

async function getSelectableTaskTypeCodes() {
  const rows = await TaskType.findAll({
    where: { isActive: true, isSelectable: true },
    attributes: ['code'],
    order: [['id', 'ASC']],
  });
  return rows.map((row) => row.code);
}

module.exports = {
  getSelectableTaskTypes,
  getSelectableTaskTypeCodes,
};
