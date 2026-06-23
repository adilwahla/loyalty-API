const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
// const User = require('../../models/user.model');
// const UserRole = require('../../models/userRole.model');
const db = require('../../models'); // ✅ central model loader

const User = db.User;
const UserRole = db.UserRole;
// const sendSms = require('../../utils/sendMobishastraSms');
const { sendMobishastraSms: sendSms } = require('../../utils/sendMobishastraSms');
const normalizePhone = require('../../utils/normalizePhone');
const { setOtp, verifyOtp, clearOtp } = require('../../utils/otpCache');
const { emitBOCreated } = require('../../utils/boEvents');
const ENABLE_OTP = process.env.ENABLE_OTP_VERIFICATION === 'true';
// 1. Send OTP
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const sent = await sendSms(phoneNumber, otp);
    // ✅ Log OTP + number for debugging
  console.log(`[OTP] Generated OTP for ${phoneNumber}: ${otp}`);
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });
  //    const otp = '1234'; // 🔁 Static OTP for development/testing

  if (!ENABLE_OTP) {
    console.log(`[DEV] Skipping OTP send for ${phoneNumber}`);
    setOtp(phoneNumber, '1234'); // Set a static test OTP or 'VERIFIED' if you want to skip verification entirely
    return res.status(200).json({
      message: 'OTP sent (bypassed)',
      otp: '1234',
      expiresAt: Date.now() + 5 * 60 * 1000
    });
  }
  // Skip Mobishastra sending — simulate success
  //   console.log(`[TEST] OTP for ${phoneNumber} is ${otp}`);
  setOtp(phoneNumber, otp);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  setOtp(phoneNumber, otp); // This already stores it with expiresAt

  res.json({ message: 'OTP sent', expiresAt }); // ✅ Send expiry timestamp

};

// 2. Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;
  console.log(`Verifying OTP for: phoneNumber ${phoneNumber}'  otpCode ${otpCode}`);
  //  if (!ENABLE_OTP) {
  //     // Skip verification during development
  //     console.log(`[OTP] Bypassed OTP verification for ${phone}`);
  //     return true;
  //   }
  if (!verifyOtp(phoneNumber, otpCode)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const user = await User.findOne({ where: { phoneNumber } });
  if (user) {
    await user.update({ isOtpVerified: true }); // ✅ This ensures Sequelize maps field properly
  }

  clearOtp(phoneNumber);

  res.json({
    message: 'OTP verified',
    user,
  });
};


// 3. Set Password
exports.setPassword = async (req, res) => {
  const { phoneNumber, password } = req.body;
  const user = await User.findOne({ where: { phoneNumber } });
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
    vatNumber, businessAddress, bsgCustId, salesRepId, deviceToken,email
  } = req.body;

  try {
    // 1. Validate role
    const validRole = await UserRole.findOne({
      where: { roleName: role.toUpperCase(), platform: 'Mobile' }
    });

    if (!validRole) {
      return res.status(400).json({ message: 'Invalid role for Mobile platform' });
    }

    // 2. Prevent duplicate registration
    const existing = await User.findOne({ where: { phoneNumber } });
    if (existing) {
      return res.status(409).json({ message: 'User already registered' });
    }
    // 3) Create user (OTP was verified earlier)
    const normalizedRole = role.toUpperCase();
    const status = normalizedRole === 'BUSINESS_OWNER' ? 'PENDING' : '-';
    // 3. Create the user — OTP was already verified in previous step
    const user = await User.create({
      phoneNumber,
      role: role.toUpperCase(),
      name,
      iqamaNumber,
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      bsgCustId,       // ✅ Now added
      salesRepId,      // ✅ Now added
      isOtpVerified: true, // ✅ Trust that verify-otp was already done
      status,    
      email,            // 👈 new
      deviceToken: deviceToken || null, // 👈 new (optional)
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

  const user = await User.findOne({ where: { phoneNumber } });

  if (!user) {
    return res.status(403).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // if (!user.isOtpVerified) {
  //   return res.status(401).json({
  //     success: false,
  //     message: 'Please verify your phone number first'
  //   });
  // }
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

  const user = await User.findOne({ where: { phoneNumber } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = process.env.NODE_ENV === 'development'
    ? '1234'
    : Math.floor(1000 + Math.random() * 9000).toString();

  const sent = await sendSms(phoneNumber, otp);
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });

  setOtp(phoneNumber, otp);
  const expiresAt = Date.now() + 5 * 60 * 1000;

  console.log(`[FORGOT] OTP sent to ${phoneNumber}: ${otp}`);

  res.json({ message: 'OTP sent', expiresAt });
};

exports.forgotPasswordVerifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;

  const isValid = verifyOtp(phoneNumber, otpCode); // ✅ Check cache/memory
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const user = await User.findOne({ where: { phoneNumber } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  if (user) {
    await user.update({ isOtpVerified: true }); // ✅ This ensures Sequelize maps field properly
  }

  clearOtp(phoneNumber); // ✅ only clear after successful verification
  return res.json({ message: 'OTP verified', user });
};



