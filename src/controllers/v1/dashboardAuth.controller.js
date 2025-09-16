const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, UserRole } = require('../../models');

// exports.registerUser = async (req, res) => {
//   try {
//     const {
//       phoneNumber,
//       password = '1234567',
//       role,
//       fullName,
//       email
//     } = req.body;

//     // ✅ Validate role from user_roles (Dashboard only)
//     const validRole = await UserRole.findOne({
//       where: {
//         roleName: role.toUpperCase(),
//         platform: 'Dashboard'
//       }
//     });

//     if (!validRole) {
//       return res.status(400).json({ message: 'Invalid or unauthorized role for Dashboard' });
//     }

//     const existing = await User.findOne({ where: { phoneNumber } });
//     if (existing) return res.status(409).json({ message: 'User already exists' });

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const user = await User.create({
//       phoneNumber,
//       password: hashedPassword,
//       role: role.toUpperCase(),
//       fullName,
//       email,
//       isOtpVerified: true // ✅ Skip OTP
//     });

//     res.status(201).json({ message: 'Dashboard user created', user });
//   } catch (err) {
//     res.status(500).json({ message: 'Failed to register user', error: err.message });
//   }
// };


exports.registerUser = async (req, res) => {
  const {
    phoneNumber, password, role, fullName, email,
    binShihonWorkerId, salesRepId, branchManagerId
  } = req.body;

  try {
    // ✅ Lookup role from DB for platform "Dashboard"
    const roleRecord = await UserRole.findOne({
      where: { roleName: role.toUpperCase(), platform: 'Dashboard' }
    });

    if (!roleRecord) {
      return res.status(400).json({ message: 'Invalid role for Dashboard platform' });
    }

    // ✅ Check for existing user
    const existing = await User.findOne({ where: { phoneNumber } });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    // ✅ Always required
    if (!phoneNumber || !fullName || !email) {
      return res.status(400).json({ message: 'Name, phone, and email are required' });
    }

    // ✅ Role-based custom validation
    switch (role.toUpperCase()) {
      case 'SALES_REP':
        if (!binShihonWorkerId || !salesRepId) {
          return res.status(400).json({ message: 'Sales Rep must have binShihonWorkerId and salesRepId' });
        }
        break;
      case 'BRANCH_MANAGER':
        if (!binShihonWorkerId || !branchManagerId) {
          return res.status(400).json({ message: 'Branch Manager must have binShihonWorkerId and branchManagerId' });
        }
        break;
      // add more case validations as needed
    }

    const hashed = await bcrypt.hash(password || '1234567', 10);

    const user = await User.create({
      phoneNumber,
      password: hashed,
      role: role.toUpperCase(),
      fullName,
      email,
      binShihonWorkerId,
      salesRepId,
      branchManagerId,
      isOtpVerified: true
    });

    return res.status(201).json({ message: 'Dashboard user created', user });

  } catch (err) {
    console.error('Dashboard user registration error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    const user = await User.findOne({ where: { phoneNumber } });
    if (!user) return res.status(403).json({ message: 'Invalid credentials' });

    // ✅ Confirm this user’s role is valid for Dashboard
    const validRole = await UserRole.findOne({
      where: {
        roleName: user.role.toUpperCase(),
        platform: 'Dashboard' 
      }
    });

    if (!validRole) {
      return res.status(403).json({ message: 'Not allowed to access dashboard' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) return res.status(403).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
        fullName: user.fullName,
        email: user.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login failed', error: err.message });
  }
};


exports.updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hashed = await bcrypt.hash(password, 10);
    await user.update({ password: hashed });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Password update failed', error: err.message });
  }
};
