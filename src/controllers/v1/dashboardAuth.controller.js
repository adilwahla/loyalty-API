'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { User, UserRole } = require('../../models');
const normalizePhone = require('../../utils/normalizePhone');
const { sendMobishastraSms: sendSms } = require('../../utils/sendMobishastraSms');
const { setOtp, verifyOtp, clearOtp } = require('../../utils/otpCache');

// ---- envs ----
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || '1234567';
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_SETUP_TOKEN = process.env.ADMIN_SETUP_TOKEN || null;
const ENABLE_OTP = process.env.ENABLE_OTP_VERIFICATION === 'true';

// make a few phone variants so we can find legacy rows
function phoneVariants(rawPhone) {
  const n = normalizePhone(rawPhone);        // e.g. '539953058' (your function strips 966 and leading 0)
  const with0 = n.startsWith('0') ? n : '0' + n;             // '0539953058'
  const with966 = n.startsWith('966') ? n : '966' + n;       // '966539953058'
  return Array.from(new Set([n, with0, with966]));
}



async function ensureDashboardRole(roleName) {
  await UserRole.findOrCreate({
    where: { roleName: roleName.toUpperCase(), platform: 'Dashboard' },
    defaults: { roleName: roleName.toUpperCase(), platform: 'Dashboard' },
  });
}

exports.ensureSuperAdmin = async (req, res) => {
  try {
    // Optional protection: header gate
    if (ADMIN_SETUP_TOKEN) {
      const key = req.header('x-setup-key');
      if (key !== ADMIN_SETUP_TOKEN) return res.status(403).json({ message: 'Forbidden' });
    }

    const existing = await User.findOne({ where: { role: 'SUPER_ADMIN' } });
    if (existing) {
      return res.status(409).json({ message: 'SUPER_ADMIN already exists', superAdmin: existing });
    }

    const { fullName, email, phoneNumber, password } = req.body || {};
    if (!fullName || !email || !phoneNumber) {
      return res.status(400).json({ message: 'fullName, email, phoneNumber are required' });
    }

    await ensureDashboardRole('SUPER_ADMIN');

    const norm = normalizePhone(phoneNumber);     // <- your canonical phone
    const taken = await User.findOne({ where: { phoneNumber: norm } });
    if (taken) return res.status(409).json({ message: 'Phone already in use' });

    const hashed = await bcrypt.hash(password || DEFAULT_USER_PASSWORD, BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      fullName, email,
      phoneNumber: norm,
      password: hashed,
      role: 'SUPER_ADMIN',
      isOtpVerified: true
    });

    return res.status(201).json({
      message: 'SUPER_ADMIN created',
      user: { id: user.id, fullName: user.fullName, email: user.email, phoneNumber: user.phoneNumber, role: user.role }
    });
  } catch (err) {
    console.error('ensure-super-admin error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

async function roleAllowedOnDashboard(roleName) {
  const rec = await UserRole.findOne({
    where: { roleName: String(roleName || '').toUpperCase(), platform: 'Dashboard' }
  });
  return !!rec;
}

// ---------------- REGISTER ----------------
exports.registerUser = async (req, res) => {
  try {
    let {
      phoneNumber, password, role, fullName, email,
      binShihonWorkerId, salesRepId, branchManagerId
    } = req.body;

    const roleUp = String(role || '').toUpperCase();
    const norm = normalizePhone(phoneNumber);

    if (!norm || !fullName || !email || !roleUp) {
      return res.status(400).json({ message: 'Name, phone, email, and role are required' });
    }

    const allowed = await roleAllowedOnDashboard(roleUp);
    if (!allowed) {
      return res.status(400).json({ message: 'Invalid role for Dashboard platform' });
    }

    // check duplicates across common formats
    const existing = await User.findOne({ where: { phoneNumber: { [Op.in]: phoneVariants(norm) } } });
    if (existing) return res.status(409).json({ message: 'User already exists' });

    // role-specific checks
    switch (roleUp) {
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
      default:
        // ADMIN / SUPER_ADMIN etc. no extras
        break;
    }

    const hashed = await bcrypt.hash(password || DEFAULT_USER_PASSWORD, BCRYPT_SALT_ROUNDS);

    const user = await User.create({
      phoneNumber: norm,      // store in canonical format per your normalizePhone
      password: hashed,
      role: roleUp,
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

// ---------------- LOGIN ----------------
exports.loginUser = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    const variants = phoneVariants(phoneNumber);

    const user = await User.findOne({ where: { phoneNumber: { [Op.in]: variants } } });
    if (!user) {
      return res.status(403).json({ message: 'Invalid credentials' });
    }

    const allowed = await roleAllowedOnDashboard(user.role);
    if (!allowed) {
      return res.status(403).json({ message: 'Not allowed to access dashboard' });
    }

    const isMatch = await bcrypt.compare(password, user.password || 'Aa102030');
    if (!isMatch) {
      return res.status(403).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
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
    console.error('Dashboard login error:', err);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
};

// ---------------- UPDATE PASSWORD (Admin resets another user's password) ----------------
exports.updatePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    await user.update({ password: hashed });

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Dashboard updatePassword error:', err);
    return res.status(500).json({ message: 'Password update failed', error: err.message });
  }
};

// ---------------- CHANGE PASSWORD (Authenticated user changes own password) ----------------
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id; // from JWT (authenticate middleware)
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password must be different from current password' });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Verify the current password
    const isMatch = await bcrypt.compare(currentPassword, user.password || '');
    if (!isMatch) {
      return res.status(403).json({ message: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.update({ password: hashed });

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Dashboard changePassword error:', err);
    return res.status(500).json({ message: 'Password change failed', error: err.message });
  }
};

// ============================================================
//  FORGOT PASSWORD FLOW (from Admin Panel login page)
// ============================================================

// Step 1: Send OTP to admin user's phone number
exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const variants = phoneVariants(phoneNumber);
    console.log(`[DASHBOARD FORGOT] Phone variants: ${JSON.stringify(variants)}`);

    // Find user with any phone format variant
    const user = await User.findOne({ where: { phoneNumber: { [Op.in]: variants } } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure this user has a dashboard-allowed role
    const allowed = await roleAllowedOnDashboard(user.role);
    if (!allowed) {
      return res.status(403).json({ message: 'This account is not authorized for the Admin Panel' });
    }

    // Generate OTP
    const otp = ENABLE_OTP
      ? Math.floor(1000 + Math.random() * 9000).toString()
      : '1234';

    // Send SMS (use original phone for SMS delivery)
    const sent = await sendSms(phoneNumber, otp);
    if (!sent) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    // Store OTP with normalized phone
    const normalizedPhone = normalizePhone(phoneNumber);
    setOtp(normalizedPhone, otp);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    console.log(`[DASHBOARD FORGOT] OTP sent to ${phoneNumber} (normalized: ${normalizedPhone}): ${otp}`);

    return res.json({
      success: true,
      message: 'OTP sent',
      expiresAt,
      ...(ENABLE_OTP ? {} : { otp }) // expose OTP only when OTP verification is disabled (dev mode)
    });
  } catch (err) {
    console.error('Dashboard forgotPasswordSendOtp error:', err);
    return res.status(500).json({ message: 'Failed to send OTP', error: err.message });
  }
};

// Step 2: Verify OTP
exports.forgotPasswordVerifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otpCode } = req.body;
    if (!phoneNumber || !otpCode) {
      return res.status(400).json({ message: 'Phone number and OTP code are required' });
    }

    const normalizedPhone = normalizePhone(phoneNumber);
    console.log(`[DASHBOARD FORGOT VERIFY] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

    // Verify OTP from cache
    const isValid = verifyOtp(normalizedPhone, otpCode);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Find the user using phone variants (handles legacy formats)
    const variants = phoneVariants(phoneNumber);
    const user = await User.findOne({ where: { phoneNumber: { [Op.in]: variants } } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark OTP as verified on the user record
    await user.update({ isOtpVerified: true });

    // Clear OTP from cache after successful verification
    clearOtp(normalizedPhone);

    console.log(`[DASHBOARD FORGOT VERIFY] OTP verified for ${normalizedPhone}`);

    return res.json({
      success: true,
      message: 'OTP verified',
      userId: user.id
    });
  } catch (err) {
    console.error('Dashboard forgotPasswordVerifyOtp error:', err);
    return res.status(500).json({ message: 'OTP verification failed', error: err.message });
  }
};

// Step 3: Reset password (after OTP verified)
exports.forgotPasswordResetPassword = async (req, res) => {
  try {
    const { phoneNumber, newPassword } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    // Find user using phone variants
    const variants = phoneVariants(phoneNumber);
    const user = await User.findOne({ where: { phoneNumber: { [Op.in]: variants } } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Ensure this user has a dashboard-allowed role
    const allowed = await roleAllowedOnDashboard(user.role);
    if (!allowed) {
      return res.status(403).json({ message: 'This account is not authorized for the Admin Panel' });
    }

    // Security check: OTP must have been verified first
    if (!user.isOtpVerified) {
      return res.status(400).json({ message: 'Please verify OTP first' });
    }

    // Hash and update password
    const hashed = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await user.update({ password: hashed });

    console.log(`[DASHBOARD FORGOT RESET] Password reset successfully for user ${user.id}`);

    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('Dashboard forgotPasswordResetPassword error:', err);
    return res.status(500).json({ message: 'Password reset failed', error: err.message });
  }
};
