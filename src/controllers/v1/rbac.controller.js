const { Role, Duty, Privilege, User } = require('../../models');

// ---------------- PRIVILEGES ----------------

exports.createPrivilege = async (req, res) => {
  try {
    const { name, controlName } = req.body;

    const [privilege, created] = await Privilege.findOrCreate({
      where: { controlName },
      defaults: { name, controlName }
    });

    return res.status(created ? 201 : 200).json({
      privilege,
      created
    });

  } catch (error) {
    console.error("❌ Create Privilege Error:", error);
    return res.status(500).json({ message: error.message });
  }
};



exports.getPrivileges = async (req, res) => {
  const privileges = await Privilege.findAll();
  res.json(privileges);
};

exports.deletePrivilege = async (req, res) => {
  await Privilege.destroy({
    where: { id: req.params.id }
  });

  res.json({ message: "Privilege deleted" });
};

exports.updatePrivilege = async (req, res) => {
  try {
    const { name, controlName } = req.body;

    const privilege = await Privilege.findByPk(req.params.id);
    if (!privilege) {
      return res.status(404).json({ message: "Privilege not found" });
    }

    privilege.name = name ?? privilege.name;
    privilege.controlName = controlName ?? privilege.controlName;

    await privilege.save();

    return res.json(privilege);

  } catch (error) {
    console.error("❌ Update Privilege Error:", error);
    return res.status(500).json({ message: error.message });
  }
};


// ---------------- DUTIES ----------------

exports.createDuty = async (req, res) => {
  const { name } = req.body;

  const duty = await Duty.create({ name });

  res.status(201).json(duty);
};

exports.getDuties = async (req, res) => {
  const duties = await Duty.findAll({
    include: {
      model: Privilege,
      as: 'dutyPrivileges'
    }
  });

  res.json(duties);
};

exports.deleteDuty = async (req, res) => {
  await Duty.destroy({
    where: { id: req.params.id }
  });

  res.json({ message: "Duty deleted" });
};

exports.assignPrivilegesToDuty = async (req, res) => {
  const duty = await Duty.findByPk(req.params.id);
  const { privilegeIds } = req.body;

  const privileges = await Privilege.findAll({
    where: { id: privilegeIds }
  });

  await duty.setDutyPrivileges(privileges);

  res.json({ message: "Privileges assigned" });
};
exports.updateDuty = async (req, res) => {
  try {
    const { name } = req.body;

    const duty = await Duty.findByPk(req.params.id);
    if (!duty) {
      return res.status(404).json({ message: "Duty not found" });
    }

    duty.name = name;
    await duty.save();

    return res.json(duty);

  } catch (error) {
    console.error("❌ Update Duty Error:", error);
    return res.status(500).json({ message: error.message });
  }
};


// ---------------- ROLES ----------------

exports.createRole = async (req, res) => {
  const { name } = req.body;

  const role = await Role.create({ name });

  res.status(201).json(role);
};

exports.getRoles = async (req, res) => {
  const roles = await Role.findAll({
    include: {
      model: Duty,
      as: 'roleDuties',
      include: {
        model: Privilege,
        as: 'dutyPrivileges'
      }
    }
  });

  res.json(roles);
};

exports.deleteRole = async (req, res) => {
  await Role.destroy({
    where: { id: req.params.id }
  });

  res.json({ message: "Role deleted" });
};

exports.assignDutiesToRole = async (req, res) => {
  const role = await Role.findByPk(req.params.id);
  const { dutyIds } = req.body;

  const duties = await Duty.findAll({
    where: { id: dutyIds }
  });

  await role.setRoleDuties(duties);

  res.json({ message: "Duties assigned" });
};

exports.updateRole = async (req, res) => {
  try {
    const { name } = req.body;

    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    role.name = name;
    await role.save();

    return res.json(role);

  } catch (error) {
    console.error("❌ Update Role Error:", error);
    return res.status(500).json({ message: error.message });
  }
};




// ---------------- USER ROLES ----------------

// exports.assignRolesToUser = async (req, res) => {
//   const user = await User.findByPk(req.params.id);
//   const { roleIds } = req.body;

//   const roles = await Role.findAll({
//     where: { id: roleIds }
//   });

//   await user.setUserRoles(roles);

//   res.json({ message: "Roles assigned to user" });
// };
// ---------------- USER ROLE (SINGLE ROLE) ----------------

// exports.assignRoleToUser = async (req, res) => {
//   try {
//     const { roleId } = req.body;

//     const user = await User.findByPk(req.params.id);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     const role = await Role.findByPk(roleId);
//     if (!role) {
//       return res.status(404).json({ message: "Role not found" });
//     }

//     user.role = roleId.toString(); // since your column is STRING
//     await user.save();

//     return res.json({ message: "Role assigned successfully" });

//   } catch (error) {
//     console.error("❌ Assign Role Error:", error);
//     return res.status(500).json({ message: error.message });
//   }
// };