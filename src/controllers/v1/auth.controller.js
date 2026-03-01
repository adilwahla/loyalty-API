const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { success, error } = require('../../utils/response');

// const User = require('../../models/user.model');
// const UserRole = require('../../models/userRole.model');
const db = require('../../models'); // ✅ central model loader

const User = db.User;
const UserRole = db.UserRole;
const Group = db.Group;
// const sendSms = require('../../utils/sendMobishastraSms');
const { sendMobishastraSms: sendSms } = require('../../utils/sendMobishastraSms');
// ELHAM: Import normalizePhone utility to normalize phone numbers before database queries
const normalizePhone = require('../../utils/normalizePhone');
const { setOtp, verifyOtp, clearOtp } = require('../../utils/otpCache');
const { emitBOCreated } = require('../../utils/boEvents');
const ENABLE_OTP = process.env.ENABLE_OTP_VERIFICATION === 'true';
// 1. Send OTP
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  
  // ELHAM: NORMALIZE phone number before storing in OTP cache to fix Flutter app integration issue
  // This ensures phone numbers in any format (+966501234567, 966501234567, 0501234567, 501234567) 
  // are normalized to 9 digits (501234567) for consistent database queries
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[OTP] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);
  
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const sent = await sendSms(phoneNumber, otp); // Use original for SMS
  // ✅ Log OTP + number for debugging
  console.log(`[OTP] Generated OTP for ${phoneNumber} (normalized: ${normalizedPhone}): ${otp}`);
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });
  //    const otp = '1234'; // 🔁 Static OTP for development/testing

  if (!ENABLE_OTP) {
    console.log(`[DEV] Skipping OTP send for ${phoneNumber}`);
    // ELHAM: Use normalized phone for OTP cache to ensure consistency
    setOtp(normalizedPhone, '1234'); // ✅ Use normalized phone for OTP cache
    return res.status(200).json({
      message: 'OTP sent (bypassed)',
      otp: '1234',
      expiresAt: Date.now() + 5 * 60 * 1000
    });
  }
  // Skip Mobishastra sending — simulate success
  //   console.log(`[TEST] OTP for ${phoneNumber} is ${otp}`);
  // ELHAM: Store OTP with normalized phone number for consistent verification
  setOtp(normalizedPhone, otp); // ✅ Use normalized phone for OTP cache
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  res.json({ message: 'OTP sent', expiresAt }); // ✅ Send expiry timestamp

};

// 2. Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;
  
  // ELHAM: NORMALIZE phone number before verifying to match the format used when OTP was stored
  // This fixes the issue where Flutter app sends +966501234567 but OTP was stored with 501234567
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[VERIFY] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);
  console.log(`Verifying OTP for: phoneNumber ${normalizedPhone}'  otpCode ${otpCode}`);
  //  if (!ENABLE_OTP) {
  //     // Skip verification during development
  //     console.log(`[OTP] Bypassed OTP verification for ${phone}`);
  //     return true;
  //   }
  // ELHAM: Verify OTP using normalized phone number to match the stored format
  if (!verifyOtp(normalizedPhone, otpCode)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  // ELHAM: Query user with normalized phone number for consistent database lookup
  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  if (user) {
    await user.update({ isOtpVerified: true }); // ✅ This ensures Sequelize maps field properly
  }

  // ELHAM: Clear OTP from cache using normalized phone number
  clearOtp(normalizedPhone);

  res.json({
    message: 'OTP verified',
    user,
  });
};


// 3. Set Password
exports.setPassword = async (req, res) => {
  const { phoneNumber, password } = req.body;
  
  // ELHAM: NORMALIZE phone number before querying to fix Flutter app integration
  // Ensures phone numbers in any format are normalized to match database storage format
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[SET_PASSWORD] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);
  
  // ELHAM: Query user with normalized phone number for consistent database lookup
  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const hashed = await bcrypt.hash(password, 10);
  await user.update({ password: hashed });
  res.json({ message: 'Password set successfully' });
};

// 4. Register User
exports.registerUser = async (req, res) => {
  const {
    phoneNumber, role, name,
    iqamaNumber, fullName, businessName,
    vatNumber, businessAddress,
    // this is new update
    latitude, longitude,
    bsgCustId, salesRepId, deviceToken, email,
    groupId
  } = req.body;

  try {
    // ELHAM: NORMALIZE phone number before storing to ensure consistent format in database
    // This fixes the issue where Flutter app sends +966501234567 but database stores 501234567
    const normalizedPhone = normalizePhone(phoneNumber);
    console.log(`[REGISTER] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);
    
    // 1. Validate role
    const validRole = await UserRole.findOne({
      where: { roleName: role.toUpperCase(), platform: 'Mobile' }
    });

    if (!validRole) {
      return res.status(400).json({ message: 'Invalid role for Mobile platform' });
    }

    // 2. Prevent duplicate registration
    // For BUSINESS_OWNER: allow duplicate phone numbers (multi-account feature).
    // For all other roles: keep strict phone uniqueness.
    const normalizedRole = role.toUpperCase();
    const existing = await User.findOne({ where: { phoneNumber: normalizedPhone } });
    if (existing) {
      if (normalizedRole !== 'BUSINESS_OWNER' || existing.role !== 'BUSINESS_OWNER') {
        return res.status(409).json({ message: 'User already registered' });
      }
      // BO registering with a phone that already has a BO row — allowed
    }
    // 3) Create user (OTP was verified earlier)
    const status = normalizedRole === 'BUSINESS_OWNER' ? 'PENDING' : '-';
    // 3. Create the user — OTP was already verified in previous step
    // ELHAM: Store normalized phone number in database for consistency
    const user = await User.create({
      phoneNumber: normalizedPhone, // ✅ Store normalized phone number
      role: role.toUpperCase(),
      name,
      iqamaNumber,
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      // this is new update
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      bsgCustId,       // ✅ Now added
      salesRepId,      // ✅ Now added
      isOtpVerified: true, // ✅ Trust that verify-otp was already done
      status,
      email,            // 👈 new
      deviceToken: deviceToken || null, // 👈 new (optional)
      groupId: groupId ? parseInt(groupId, 10) : null,
    });

    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('bo_created', {
        id: user.id,
        fullName: user.fullName ?? null,
        phoneNumber: user.phoneNumber ?? null,
        bsgCustId: user.bsgCustId ?? null,
        businessName: user.businessName ?? null,
        vatNumber: user.vatNumber ?? null,
        businessAddress: user.businessAddress ?? null,
        salesRepId: user.salesRepId ?? null,
        email: user.email ?? null,
        rawStatus: user.status,
        status: user.status === 'APPROVED' ? 'Approved' : (user.status === 'PENDING' ? 'Pending' : user.status),
        at: new Date().toISOString(),
      });
    }
    // if BO, notify admins dashboard
    // if (user.role === 'BUSINESS_OWNER') {
    //   const io = req.app.get('io');
    //   emitBOCreated(io, user);       // 🔔
    // }
    return res.status(201).json({ message: 'User registered', user });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// 5. Login
exports.loginUser = async (req, res) => {
  //  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  const { phoneNumber, password } = req.body;

  // ELHAM: NORMALIZE phone number before querying to fix Flutter app integration
  // Ensures login works regardless of phone number format sent by Flutter app
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[LOGIN] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  // Query user with normalized phone number; only match rows that have a password.
  // BO accounts added from the app have NULL password, so this always finds the
  // primary (login-capable) row and skips additional account-only rows.
  // Include Group so the login response contains groupName/groupNameAR/colorHex.
  const user = await User.findOne({
    where: {
      phoneNumber: normalizedPhone,
      password: { [Op.ne]: null },
    },
    include: [{
      model: Group,
      as: 'group',
      required: false,
      attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex'],
    }],
  });

  if (!user) {
    return res.status(403).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const otpRequiredRoles = ['CUSTOMER', 'TECHNICIAN', 'BUSINESS_OWNER'];

  if (otpRequiredRoles.includes(user.role.toUpperCase()) && !user.isOtpVerified) {
    return res.status(401).json({
      success: false,
      message: 'Please verify your phone number first'
    });
  }


  if (!user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(403).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  // 👇 NEW: BO approval gate
  if (user.role === 'BUSINESS_OWNER' && user.status !== 'APPROVED') {
    return res.status(403).json({
      success: false,
      code: 'BO_APPROVAL_REQUIRED',
      message: 'Your account is pending admin approval.',
      status: user.status, // 'PENDING' | 'REJECTED'
    });
  }

  // ✅ Use JWT_EXPIRES_IN from environment variables
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn
  });

  const userSafe = { ...user.toJSON() };
  delete userSafe.password;

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    user: userSafe,
  });
};

// 0. Forgot Password
// Reuse sendOtp for forgot password flow
// exports.forgotPassword = async (req, res) => {

//   const { phoneNumber } = req.body;
//   console.log('Forgot password for:', phoneNumber);
// //const normalized = normalizePhone(phoneNumber);
//   if (!phoneNumber) {
//     return res.status(400).json({ message: 'Phone number is required' });
//   }

//   // Check if user exists before sending OTP
//   const user = await User.findOne({ where: { phoneNumber } });
//   if (!user) {
//     return res.status(404).json({ message: 'User not found' });
//   }

//   // Reuse the existing OTP sending logic
//   return exports.sendOtp(req, res);   
// };



exports.forgotPasswordSendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

  // ELHAM: NORMALIZE phone number before querying to fix "User not found" error from Flutter app
  // This is the main fix for the integration issue where Flutter sends +966501234567 but DB has 501234567
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[FORGOT] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  // Find the primary (login-capable) user row — the one with a password.
  const user = await User.findOne({
    where: { phoneNumber: normalizedPhone, password: { [Op.ne]: null } },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = process.env.NODE_ENV === 'development'
    ? '1234'
    : Math.floor(1000 + Math.random() * 9000).toString();

  // ELHAM: Use original phone for SMS (SMS provider may need +966 format for international delivery)
  const sent = await sendSms(phoneNumber, otp);
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });

  // ELHAM: Store OTP with normalized phone number for consistent verification later
  setOtp(normalizedPhone, otp);
  const expiresAt = Date.now() + 5 * 60 * 1000;

  console.log(`[FORGOT] OTP sent to ${phoneNumber} (normalized: ${normalizedPhone}): ${otp}`);

  res.json({ message: 'OTP sent', expiresAt });
};

exports.forgotPasswordVerifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;

  // ELHAM: NORMALIZE phone number before verifying to match the format used when OTP was stored
  // This ensures OTP verification works correctly regardless of phone number format from Flutter app
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[FORGOT VERIFY] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  // ELHAM: Verify OTP using normalized phone number to match the stored format in OTP cache
  const isValid = verifyOtp(normalizedPhone, otpCode); // ✅ Check cache/memory with normalized phone
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  // ELHAM: Query user with normalized phone number for consistent database lookup
  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (user) {
    await user.update({ isOtpVerified: true }); // ✅ This ensures Sequelize maps field properly
  }

  // ELHAM: Clear OTP from cache using normalized phone number after successful verification
  clearOtp(normalizedPhone); // ✅ only clear after successful verification
  return res.json({ message: 'OTP verified', user });
};

// ELHAM: Reset Password after OTP verification - New endpoint for Flutter app forgot password flow
// This endpoint allows users to reset their password after verifying OTP
exports.forgotPasswordResetPassword = async (req, res) => {
  const { phoneNumber, newPassword } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required' });
  }

  // ELHAM: NORMALIZE phone number before querying to fix Flutter app integration
  // Ensures password reset works regardless of phone number format sent by Flutter app
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[FORGOT RESET] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  // Find the primary (login-capable) user row — the one with a password.
  const user = await User.findOne({
    where: { phoneNumber: normalizedPhone, password: { [Op.ne]: null } },
  });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Verify OTP was verified before allowing password reset (security check)
  if (!user.isOtpVerified) {
    return res.status(400).json({ message: 'Please verify OTP first' });
  }

  // ELHAM: Update password with hashed value
  const hashed = await bcrypt.hash(newPassword, 10);
  await user.update({ password: hashed });

  // Reset OTP verification flag after password reset (optional, for security)
  // await user.update({ isOtpVerified: false });

  console.log(`[FORGOT RESET] Password reset successfully for ${normalizedPhone}`);
  return res.json({ message: 'Password reset successfully' });
};

// 5. Login
exports.loginSalesRep = async (req, res) => {
  //  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  const { salesRepId, password } = req.body;
  
  console.log(`[LOGIN] SalesRep login attempt for ID: ${salesRepId}`);
  
  // ✅ Get ALL users with this salesRepId (ordered deterministically)
  // This approach is more reliable than relying on database WHERE clause for role filtering
  const allUsers = await User.findAll({ 
    where: { 
      salesRepId: salesRepId
    },
    order: [['createdAt', 'ASC']] // Makes it deterministic
  });
  
  console.log(`[LOGIN] Found ${allUsers.length} user(s) with salesRepId: ${salesRepId}`);
  allUsers.forEach(u => {
    console.log(`[LOGIN]   - User ID: ${u.id}, Role: ${u.role}, SalesRepId: ${u.salesRepId}`);
  });
  
  // ✅ Filter for SALES_REP role in JavaScript (case-insensitive, handles whitespace)
  // This ensures we get the correct user even if database WHERE clause has issues
  const user = allUsers.find(u => 
    u.role && u.role.toUpperCase().trim() === 'SALES_REP'
  );
  
  if (!user) {
    console.log(`[LOGIN] ❌ User not found - No SALES_REP user found with salesRepId: ${salesRepId}`);
    return res.status(403).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // ✅ Double-check role (defense in depth) - CRITICAL: Reject if not SALES_REP
  const allowedRoles = ['SALES_REP'];
  console.log(`[LOGIN] ✅ Selected SALES_REP user - ID: ${user.id}, Role: ${user.role}, Status: ${user.status}, SalesRepId: ${user.salesRepId}`);
  
  // This check should never fail now, but keeping it for safety
  if (!allowedRoles.includes(user.role.toUpperCase().trim())) {
    console.log(`[LOGIN] ❌ REJECTED - User role "${user.role}" is not allowed. Only SALES_REP can use this endpoint.`);
    return res.status(403).json({
      success: false,
      message: 'This login endpoint is only for Sales Rep accounts. Please use the correct login method.'
    });
  }
  
  console.log(`[LOGIN] ✅ Role check passed - User is SALES_REP`);
  
  // if (!user.isOtpVerified) {
  //   return res.status(401).json({
  //     success: false,
  //     message: 'Please verify your phone number first'
  //   });
  // }

  const otpRequiredRoles = ['SALES_REP'];

  if (otpRequiredRoles.includes(user.role.toUpperCase()) && !user.isOtpVerified) {
    return res.status(401).json({
      success: false,
      message: 'Please verify your phone number first'
    });
  }



  if (!user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(403).json({
      success: false,
      message: 'Invalid credentials p'
    });
  }

  // ✅ SALES_REP role: Skip approval check - allow login regardless of status
 

  // ✅ Use JWT_EXPIRES_IN from environment variables
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn
  });

  // ✅ Convert to JSON-safe object
  const userSafe = { ...user.toJSON() };
  delete userSafe.password;

  // ✅ Add the apiToken field to the response
  userSafe.apiToken = token;

  return res.status(200).json(success('Login successful', userSafe));

};



