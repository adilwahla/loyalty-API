const express = require('express');
const router = express.Router();
const controller = require('../../../../controllers/v1/rbac.controller');

// ---------------- PRIVILEGES ----------------
router.post('/privileges', controller.createPrivilege);
router.get('/privileges', controller.getPrivileges);
router.delete('/privileges/:id', controller.deletePrivilege);
router.put('/privileges/:id', controller.updatePrivilege);

// ---------------- DUTIES ----------------
router.post('/duties', controller.createDuty);
router.get('/duties', controller.getDuties);
router.delete('/duties/:id', controller.deleteDuty);
router.post('/duties/:id/privileges', controller.assignPrivilegesToDuty);
router.put('/duties/:id', controller.updateDuty);



// ---------------- ROLES ----------------
router.post('/roles', controller.createRole);
router.get('/roles', controller.getRoles);
router.delete('/roles/:id', controller.deleteRole);
router.post('/roles/:id/duties', controller.assignDutiesToRole);
router.put('/roles/:id', controller.updateRole);

// ---------------- USER ROLES ----------------
// router.post('/users/:id/roles', controller.assignRolesToUser);

module.exports = router;
