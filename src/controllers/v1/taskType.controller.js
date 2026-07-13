const taskTypeService = require('../../services/v1/taskType.service');

exports.getTaskTypes = async (req, res, next) => {
  try {
    const data = await taskTypeService.getSelectableTaskTypes();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
