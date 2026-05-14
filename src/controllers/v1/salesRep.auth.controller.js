// src/controllers/v1/salesRep.auth.controller.js
//
// Dedicated controller for Sales Rep self-registration.
// Kept separate from auth.controller.js to avoid touching existing logic.
//
// Endpoints served:
//   POST /api/v1/auth/register-sales-rep  → registerSalesRep
//   GET  /api/v1/mobile/branch-managers   → getBranchManagers  (in its own route file)

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const db = require('../../models');
const User = db.User;
const { sendMobishastraSms: sendSms } = require('../../utils/sendMobishastraSms');
const normalizePhone = require('../../utils/normalizePhone');
const { setOtp } = require('../../utils/otpCache');
const ENABLE_OTP = process.env.ENABLE_OTP_VERIFICATION === 'true';

// ── POST /api/v1/auth/register-sales-rep ──────────────────────────────────────
//
// Body:
//   {
//     fullName:        string  required
//     phoneNumber:     string  required  (Saudi format — normalised internally)
//     email:           string  required
//     salesRepId:      string  required  (the rep's own ID, e.g. "3037")
//     branchManagerId: string  required  (manager lookup ID, e.g. "MGR103")
//     password:        string  required  (min 8 chars — hashed before save)
//   }
//
// Response 201: { success: true, message: 'Sales rep registered successfully' }
// Response 409: { success: false, message: 'Phone number already registered' }
// Response 400: { success: false, message: '<validation message>' }
//
// OTP is sent immediately after account creation so the Flutter app can
// navigate directly to OtpVerificationView without a separate API call.
exports.registerSalesRep = async (req, res) => {
  const {
    fullName,
    phoneNumber,
    email,
    salesRepId,
    branchManagerId,
    password,
  } = req.body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!fullName || !phoneNumber || !email || !salesRepId || !branchManagerId || !password) {
    return res.status(400).json({
      success: false,
      message: 'fullName, phoneNumber, email, salesRepId, branchManagerId and password are all required.',
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.',
    });
  }

  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[SALES_REP_REGISTER] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  try {
    // ── Duplicate check ───────────────────────────────────────────────────────
    const existing = await User.findOne({
      where: { phoneNumber: normalizedPhone },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already registered. Please log in or use a different number.',
      });
    }

    // ── Hash password ─────────────────────────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    // ── Create user ───────────────────────────────────────────────────────────
    const user = await User.create({
      fullName:        fullName.trim(),
      phoneNumber:     normalizedPhone,
      email:           email.trim(),
      salesRepId:      salesRepId.trim(),
      branchManagerId: branchManagerId.trim(),
      password:        hashedPassword,
      role:            'SALES_REP',
      isOtpVerified:   false,   // becomes true after OTP screen
      status:          '-',
      shareFactor:     0.5,
      points:          0,
    });

    console.log(`[SALES_REP_REGISTER] Created user ${user.id} (${normalizedPhone})`);

    // ── Send OTP immediately so Flutter can go straight to OTP screen ─────────
    const otp = ENABLE_OTP
      ? Math.floor(1000 + Math.random() * 9000).toString()
      : '1234';

    const sent = await sendSms(phoneNumber, otp);

    if (ENABLE_OTP && !sent) {
      // Account created but OTP failed — still return 201 so Flutter proceeds.
      // Flutter will show "account created, please log in" path.
      console.warn(`[SALES_REP_REGISTER] OTP send failed for ${normalizedPhone}`);
      return res.status(201).json({
        success: true,
        otpSent: false,
        message: 'Sales rep registered successfully. OTP could not be sent.',
      });
    }

    setOtp(normalizedPhone, otp);
    const expiresAt = Date.now() + 5 * 60 * 1000;

    console.log(`[SALES_REP_REGISTER] OTP sent to ${normalizedPhone}: ${otp}`);

    return res.status(201).json({
      success: true,
      otpSent: true,
      message: 'Sales rep registered successfully. OTP sent.',
      expiresAt,
    });
  } catch (err) {
    console.error('[SALES_REP_REGISTER] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration.',
    });
  }
};