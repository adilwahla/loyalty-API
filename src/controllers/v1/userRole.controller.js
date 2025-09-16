const userRoleService = require('../../services/v1/userRole.service');

exports.createUserRole = async (req, res, next) => {
  try {
    const role = await userRoleService.create(req.body);
     console.log('[GET] /user-roles/all →', role);
    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
};

exports.getAllUserRoles = async (req, res, next) => {
  try {
    const roles = await userRoleService.getAll();
    res.json(roles);
  } catch (error) {
    next(error);
  }
};

exports.getUserRoleById = async (req, res, next) => {
  try {
    const role = await userRoleService.getById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });
    res.json(role);
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const updated = await userRoleService.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteUserRole = async (req, res, next) => {
  try {
    await userRoleService.remove(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
