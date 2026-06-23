# OTP System Explanation

## Overview
The OTP (One-Time Password) system in this codebase is used for phone number verification during user registration and password reset flows. It uses an in-memory storage system with SMS delivery via Mobishastra API.

---

## 1. OTP Storage System (`src/utils/otpCache.js`)

The OTP system uses an in-memory `Map` to store OTPs temporarily:

```javascript
const otpStore = new Map();

function setOtp(phone, otp) {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes from now
  otpStore.set(phone, { otp, expiresAt });
}

function verifyOtp(phone, otp) {
  const entry = otpStore.get(phone);
  
  // Check if OTP exists and hasn't expired
  if (!entry || Date.now() > entry.expiresAt) return false;
  setOtp(phone, 'VERIFIED'); // ✅ set the verification flag
  
  return entry.otp === otp;
}

function clearOtp(phone) {
  otpStore.delete(phone);
}

module.exports = { setOtp, verifyOtp, clearOtp };
```

**Key Points:**
- OTPs are stored in memory (lost on server restart)
- Each OTP expires after 5 minutes
- OTP is cleared after successful verification

---

## 2. Sending OTP (`POST /api/v1/auth/send-otp`)

**Location:** `src/controllers/v1/auth.controller.js` - `sendOtp` function

**Process:**
1. Generates a random 4-digit OTP (1000-9999)
2. Sends OTP via SMS using Mobishastra API (if enabled)
3. Stores OTP in memory with 5-minute expiry
4. Returns success response with expiry timestamp

**Code:**
```javascript
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const sent = await sendSms(phoneNumber, otp);
  
  console.log(`[OTP] Generated OTP for ${phoneNumber}: ${otp}`);
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });

  // Development mode: bypass SMS sending
  if (!ENABLE_OTP) {
    console.log(`[DEV] Skipping OTP send for ${phoneNumber}`);
    setOtp(phoneNumber, '1234');
    return res.status(200).json({
      message: 'OTP sent (bypassed)',
      otp: '1234',
      expiresAt: Date.now() + 5 * 60 * 1000
    });
  }
  
  setOtp(phoneNumber, otp);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  res.json({ message: 'OTP sent', expiresAt });
};
```

**Environment Variables:**
- `ENABLE_OTP_VERIFICATION`: Set to `'true'` to enable real SMS sending, otherwise uses static OTP `'1234'`

---

## 3. Verifying OTP (`POST /api/v1/auth/verify-otp`)

**Location:** `src/controllers/v1/auth.controller.js` - `verifyOtp` function

**Process:**
1. Checks if OTP exists in memory and hasn't expired
2. Compares provided OTP with stored OTP
3. If valid:
   - Updates user's `isOtpVerified` flag to `true` in database
   - Clears OTP from memory
   - Returns success response with user data

**Code:**
```javascript
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;
  console.log(`Verifying OTP for: phoneNumber ${phoneNumber}'  otpCode ${otpCode}`);
  
  if (!verifyOtp(phoneNumber, otpCode)) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const user = await User.findOne({ where: { phoneNumber } });
  if (user) {
    await user.update({ isOtpVerified: true });
  }

  clearOtp(phoneNumber);

  res.json({
    message: 'OTP verified',
    user,
  });
};
```

---

## 4. SMS Delivery (`src/utils/sendMobishastraSms.js`)

The system uses Mobishastra SMS API to send OTP messages:

```javascript
async function sendMobishastraSms(phone, otp) {
  const apiUrl = process.env.MOBIS_URL;
  const user = process.env.MOBIS_USER;
  const pwd = process.env.MOBIS_PWD;
  const senderId = process.env.MOBIS_SENDER;
  const countryCode = process.env.MOBIS_COUNTRY_CODE;
  const APP_HASH = "HdCMaTHtXex"; // For Flutter SMS autofill

  const message = `Your OTP is ${otp}. Please use it to verify your identity.

<#> Bin Shihon Loyalty
${APP_HASH}`;

  const query = querystring.stringify({
    user,
    pwd,
    senderid: senderId,
    CountryCode: countryCode,
    mobileno: phone,
    msgtext: message,
  });

  const fullUrl = `${apiUrl}?${query}`;

  try {
    const response = await axios.get(fullUrl);
    console.log('[Mobishastra] SMS sent → Response:', response.data);
    return true;
  } catch (err) {
    console.error('[Mobishastra] Failed to send SMS:', err.message);
    return false;
  }
}
```

**Required Environment Variables:**
- `MOBIS_URL`: Mobishastra API endpoint
- `MOBIS_USER`: Mobishastra username
- `MOBIS_PWD`: Mobishastra password
- `MOBIS_SENDER`: Approved sender ID
- `MOBIS_COUNTRY_CODE`: Country code (default: '966')

---

## 5. OTP Usage in Authentication

OTP verification is **required** for the following user roles:
- `CUSTOMER`
- `TECHNICIAN`
- `BUSINESS_OWNER`
- `SALES_REP`

During login, these roles must have `isOtpVerified: true`:

```javascript
const otpRequiredRoles = ['CUSTOMER', 'TECHNICIAN', 'BUSINESS_OWNER'];

if (otpRequiredRoles.includes(user.role.toUpperCase()) && !user.isOtpVerified) {
  return res.status(401).json({
    success: false,
    message: 'Please verify your phone number first'
  });
}
```

**Login Flow:**
1. User must call `POST /api/v1/auth/send-otp` first
2. User receives OTP via SMS
3. User calls `POST /api/v1/auth/verify-otp` with the OTP
4. User's `isOtpVerified` flag is set to `true`
5. User can now login with password

---

## 6. Forgot Password Flow

The same OTP system is used for password reset:

**Endpoints:**
- `POST /api/v1/auth/forgot-password/send-otp` - Sends OTP to user's phone
- `POST /api/v1/auth/forgot-password/verify-otp` - Verifies OTP before allowing password reset

**Code:**
```javascript
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

  const isValid = verifyOtp(phoneNumber, otpCode);
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  const user = await User.findOne({ where: { phoneNumber } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (user) {
    await user.update({ isOtpVerified: true });
  }

  clearOtp(phoneNumber);
  return res.json({ message: 'OTP verified', user });
};
```

---

## 7. API Routes

**Location:** `src/routes/api/v1/auth.routes.js`

```javascript
router.post('/send-otp', controller.sendOtp);
router.post('/verify-otp', controller.verifyOtp);
router.post('/forgot-password/send-otp', controller.forgotPasswordSendOtp);
router.post('/forgot-password/verify-otp', controller.forgotPasswordVerifyOtp);
```

---

## 8. Complete Flow Diagram

### Registration Flow:
```
1. User → POST /send-otp (phoneNumber)
   ↓
2. Server generates 4-digit OTP
   ↓
3. Server sends OTP via SMS (Mobishastra)
   ↓
4. Server stores OTP in memory (5 min expiry)
   ↓
5. User → POST /verify-otp (phoneNumber, otpCode)
   ↓
6. Server validates OTP
   ↓
7. Server sets isOtpVerified = true
   ↓
8. Server clears OTP from memory
   ↓
9. User → POST /register (user details)
   ↓
10. User → POST /set-password (phoneNumber, password)
   ↓
11. User → POST /login (phoneNumber, password)
```

### Forgot Password Flow:
```
1. User → POST /forgot-password/send-otp (phoneNumber)
   ↓
2. Server generates and sends OTP
   ↓
3. User → POST /forgot-password/verify-otp (phoneNumber, otpCode)
   ↓
4. Server validates OTP
   ↓
5. User can now reset password
```

---

## Important Notes

1. **In-Memory Storage**: OTPs are stored in a `Map` object, so they are lost on server restart
2. **5-Minute Expiry**: All OTPs expire after 5 minutes
3. **Development Mode**: When `ENABLE_OTP_VERIFICATION=false`, uses static OTP `'1234'` and skips SMS
4. **One-Time Use**: OTP is cleared immediately after successful verification
5. **Role-Based**: OTP verification is enforced for specific roles (CUSTOMER, TECHNICIAN, BUSINESS_OWNER, SALES_REP)
6. **SMS Provider**: Uses Mobishastra SMS API with configurable credentials via environment variables

---

## Files Involved

- `src/utils/otpCache.js` - OTP storage and verification logic
- `src/controllers/v1/auth.controller.js` - OTP endpoints (send, verify, forgot password)
- `src/utils/sendMobishastraSms.js` - SMS delivery via Mobishastra API
- `src/routes/api/v1/auth.routes.js` - API route definitions
- `src/models/user.model.js` - User model with `isOtpVerified` field

