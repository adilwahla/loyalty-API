# OTP Implementation Documentation - Flutter App & Server Integration

## 📋 Overview
This document describes the complete OTP (One-Time Password) implementation in the Flutter mobile app for the forgot password flow and identifies the integration issue between the app and server.

## 🔍 **ROOT CAUSE IDENTIFIED**

**Issue**: Flutter app sends phone numbers in format `+966501234567`, but server stores them as `501234567` (9 digits). The server does **exact match** queries without normalization, causing "User not found" errors.

**Problem Location**: `src/controllers/v1/auth.controller.js` - All auth endpoints do exact match without normalization.

**Solution**: Use existing `normalizePhone` utility in all auth endpoints before database queries.

---

## 🔄 Complete OTP Flow

### Step 1: User Enters Phone Number
- **Screen**: `ForgetPasswordView`
- **User Action**: Enters phone number in text field
- **Location**: `lib/screens/Authentication/ForgetPassword/view/forget_view.dart`

### Step 2: Phone Number Formatting
- **Location**: `lib/utils/otp_debug_helper.dart`
- **Function**: `formatSaudiPhoneNumber()`
- **Logic**:
  - Removes all non-digits
  - If starts with `966` → adds `+` prefix → `+966501234567`
  - If starts with `0` → replaces with `+966` → `+966501234567`
  - If 9 digits → adds `+966` prefix → `+966501234567`

**Example Transformations**:
```
Input: "0501234567" → Output: "+966501234567"
Input: "966501234567" → Output: "+966501234567"
Input: "501234567" → Output: "+966501234567"
```

### Step 3: Send OTP Request
- **Endpoint**: `POST /api/v1/auth/forgot-password/send-otp`
- **Location**: `lib/data/services/services/auth_service.dart` → `sendForgotPasswordOtp()`
- **Request Format**:
```json
{
  "phoneNumber": "+966501234567"
}
```

**Full URL Example**:
```
POST http://192.168.4.137:5000/api/v1/auth/forgot-password/send-otp
Content-Type: application/json

{
  "phoneNumber": "+966501234567"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "expiresAt": 1234567890
  }
}
```

**Error Response (Current Issue)**:
```json
{
  "message": "User not found"
}
```
**Status Code**: 404

### Step 4: Multiple Format Retry Logic
- **Location**: `lib/screens/Authentication/ForgetPassword/controller/forget_controller.dart`
- **Function**: `sendOtp()`

**Problem**: Server returns "User not found" even when user exists.

**Solution Implemented**: App tries multiple phone number formats automatically:

1. **First Attempt**: `+966501234567` (with + sign)
2. **Second Attempt**: `966501234567` (without + sign)
3. **Third Attempt**: `0501234567` (with leading 0)
4. **Fourth Attempt**: `501234567` (9 digits only)

**Code Logic**:
```dart
// Get all possible formats
final formatsToTry = OtpDebugHelper.getAlternativeFormats(mobileNumber.value);

// Try each format until one works
for (final format in formatsToTry) {
  result = await AuthService.sendForgotPasswordOtp(
    phoneNumber: format,
    context: Get.context!,
  );
  
  if (result != null && result['success'] == true) {
    mobileNumber.value = format; // Store working format
    break; // Success!
  }
}
```

### Step 5: OTP Verification
- **Endpoint**: `POST /api/v1/auth/forgot-password/verify-otp`
- **Location**: `lib/data/services/services/auth_service.dart` → `verifyForgotPasswordOtp()`
- **Request Format**:
```json
{
  "phoneNumber": "+966501234567",
  "otpCode": "1234"
}
```

**Full URL Example**:
```
POST http://192.168.4.137:5000/api/v1/auth/forgot-password/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+966501234567",
  "otpCode": "1234"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": { ... }
  }
}
```

### Step 6: Reset Password
- **Endpoint**: `POST /api/v1/auth/reset-password`
- **Location**: `lib/data/services/services/auth_service.dart` → `resetPassword()`
- **Request Format**:
```json
{
  "phoneNumber": "+966501234567",
  "newPassword": "newpassword123"
}
```

**Full URL Example**:
```
POST http://192.168.4.137:5000/api/v1/auth/reset-password
Content-Type: application/json

{
  "phoneNumber": "+966501234567",
  "newPassword": "newpassword123"
}
```

**Expected Response**:
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

---

## 📁 File Structure

### API Endpoints Configuration
**File**: `lib/data/provider/api_endpoints.dart`

```dart
// Forgot Password OTP Endpoints
static const String forgotPasswordSendOtp = "/auth/forgot-password/send-otp";
static const String forgotPasswordVerifyOtp = "/auth/forgot-password/verify-otp";
static const String resetPassword = "/auth/reset-password";

// Full URLs
static String get forgotPasswordSendOtpUrl => "$baseUrl$forgotPasswordSendOtp";
static String get forgotPasswordVerifyOtpUrl => "$baseUrl$forgotPasswordVerifyOtp";
static String get resetPasswordUrl => "$baseUrl$resetPassword";
```

**Base URL**: `http://192.168.4.137:5000/api/v1`

### Service Layer
**File**: `lib/data/services/services/auth_service.dart`

**Methods**:
1. `sendForgotPasswordOtp()` - Sends OTP for forgot password
2. `verifyForgotPasswordOtp()` - Verifies OTP code
3. `resetPassword()` - Resets password after OTP verification

### Controller Layer
**File**: `lib/screens/Authentication/ForgetPassword/controller/forget_controller.dart`

**Methods**:
1. `sendOtp()` - Handles OTP sending with format retry logic
2. `verifyOtp()` - Handles OTP verification
3. `resendOtp()` - Handles OTP resending
4. `resetPassword()` - Handles password reset

### View Layer
**File**: `lib/screens/Authentication/ForgetPassword/view/forget_view.dart`
- User interface for entering phone number
- Calls `controller.sendOtp()` on button press

---

## 🔍 Current Issue Details - ROOT CAUSE IDENTIFIED

### Problem
**Error**: `404 - User not found`
**Endpoint**: `POST /api/v1/auth/forgot-password/send-otp`
**URL**: `http://192.168.4.137:5000/api/v1/auth/forgot-password/send-otp`

**Request Being Sent**:
```json
{
  "phoneNumber": "+966501234567"
}
```

**Response Received**:
```json
{
  "message": "User not found"
}
```

### Root Cause Analysis

#### 1. **Phone Number Format in Database**
✅ **CONFIRMED**: Phone numbers are stored as **9 digits** starting with `5` (e.g., `501234567`)

**Evidence from Server Code** (`src/controllers/v1/user.controller.js` lines 10-23):
```javascript
phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove all non-digits

// Normalize to 9-digit starting with 5
if (phoneNumber.startsWith('966') && phoneNumber.length === 12) {
  phoneNumber = phoneNumber.slice(3); // Remove country code → 501234567
} else if (phoneNumber.startsWith('05') && phoneNumber.length === 10) {
  phoneNumber = phoneNumber.slice(1); // Remove leading 0 → 501234567
}

// Validate: must be 9 digits starting with 5
if (!/^5\d{8}$/.test(phoneNumber)) {
  return res.status(400).json({ message: 'Invalid Saudi phone number format' });
}
```

#### 2. **Server Query Logic - THE PROBLEM**
❌ **ISSUE**: Server does **exact match** without normalization!

**Current Server Code** (`src/controllers/v1/auth.controller.js` lines 245-264):
```javascript
exports.forgotPasswordSendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

  // ❌ PROBLEM: Exact match without normalization!
  const user = await User.findOne({ where: { phoneNumber } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  // ... rest of code
};
```

**What Happens**:
- Flutter sends: `"+966501234567"`
- Database has: `"501234567"`
- Query: `WHERE phone_number = '+966501234567'` → **NO MATCH!** ❌

#### 3. **Existing Normalization Utility - NOT BEING USED!**
✅ **SOLUTION EXISTS**: There's a `normalizePhone` utility that's NOT being used!

**Location**: `src/utils/normalizePhone.js`

```javascript
module.exports = function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, ''); // Remove any dashes, spaces, etc.
  // Remove country code if user typed 966 manually
  return digits.startsWith('966') ? digits.slice(3) :
         digits.startsWith('0') ? digits.slice(1) :
         digits;
};
```

**Example Outputs**:
- Input: `"+966501234567"` → Output: `"501234567"` ✅
- Input: `"966501234567"` → Output: `"501234567"` ✅
- Input: `"0501234567"` → Output: `"501234567"` ✅
- Input: `"501234567"` → Output: `"501234567"` ✅

#### 4. **Endpoints Affected**
All these endpoints have the same issue:
- ❌ `sendOtp` (line 18): No normalization
- ❌ `verifyOtp` (line 47): No normalization
- ❌ `loginUser` (line 160): No normalization
- ❌ `registerUser` (line 85): No normalization
- ❌ `forgotPasswordSendOtp` (line 245): No normalization
- ❌ `forgotPasswordVerifyOtp` (line 264): No normalization

---

## 🧪 Testing Scenarios

### Test Case 1: Phone Number with + Sign
**Request**:
```json
{
  "phoneNumber": "+966501234567"
}
```
**Expected**: Should find user if stored as `+966501234567`

### Test Case 2: Phone Number without + Sign
**Request**:
```json
{
  "phoneNumber": "966501234567"
}
```
**Expected**: Should find user if stored as `966501234567`

### Test Case 3: Phone Number with Leading 0
**Request**:
```json
{
  "phoneNumber": "0501234567"
}
```
**Expected**: Should find user if stored as `0501234567`

### Test Case 4: Phone Number as 9 Digits
**Request**:
```json
{
  "phoneNumber": "501234567"
}
```
**Expected**: Should find user if stored as `501234567`

---

## ✅ Solution: Fix Server-Side Code

### Option 1: Use Existing `normalizePhone` Utility (RECOMMENDED)

**The server already has a `normalizePhone` utility at `src/utils/normalizePhone.js` - it just needs to be used!**

**Add import at top of `src/controllers/v1/auth.controller.js`**:
```javascript
const normalizePhone = require('../../utils/normalizePhone');
```

**Update `forgotPasswordSendOtp` function**:
```javascript
exports.forgotPasswordSendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ message: 'Phone number is required' });

  // ✅ NORMALIZE phone number before querying
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[FORGOT] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  if (!user) return res.status(404).json({ message: 'User not found' });

  const otp = process.env.NODE_ENV === 'development'
    ? '1234'
    : Math.floor(1000 + Math.random() * 9000).toString();

  // ✅ Use original phone for SMS (SMS provider may need +966 format)
  const sent = await sendSms(phoneNumber, otp); // Keep original for SMS
  if (!sent) return res.status(500).json({ message: 'Failed to send OTP' });

  // ✅ Store OTP with normalized phone number
  setOtp(normalizedPhone, otp);
  const expiresAt = Date.now() + 5 * 60 * 1000;

  console.log(`[FORGOT] OTP sent to ${phoneNumber} (normalized: ${normalizedPhone}): ${otp}`);
  res.json({ message: 'OTP sent', expiresAt });
};
```

**Update `forgotPasswordVerifyOtp` function**:
```javascript
exports.forgotPasswordVerifyOtp = async (req, res) => {
  const { phoneNumber, otpCode } = req.body;

  // ✅ NORMALIZE phone number
  const normalizedPhone = normalizePhone(phoneNumber);
  console.log(`[FORGOT VERIFY] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);
  
  const isValid = verifyOtp(normalizedPhone, otpCode);
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  // ✅ Query with normalized phone
  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  
  if (user) {
    await user.update({ isOtpVerified: true });
  }

  clearOtp(normalizedPhone);
  return res.json({ message: 'OTP verified', user });
};
```

### Option 2: Normalize All Auth Endpoints (Comprehensive Fix - RECOMMENDED)

Apply normalization to **ALL** auth endpoints to prevent future issues:

1. **`sendOtp`** (line 18)
2. **`verifyOtp`** (line 47)
3. **`loginUser`** (line 160)
4. **`registerUser`** (line 85) - Ensure it stores normalized format
5. **`forgotPasswordSendOtp`** (line 245)
6. **`forgotPasswordVerifyOtp`** (line 264)

**Pattern to apply to each function**:
```javascript
const normalizePhone = require('../../utils/normalizePhone');

// At the start of each function that uses phoneNumber:
const normalizedPhone = normalizePhone(phoneNumber);
console.log(`[ENDPOINT] Original: ${phoneNumber}, Normalized: ${normalizedPhone}`);

// Use normalizedPhone for database queries
// Use original phoneNumber for SMS sending (if SMS provider needs specific format)
```

**Example for `sendOtp`**:
```javascript
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;
  const normalizedPhone = normalizePhone(phoneNumber);
  
  // ... rest of code using normalizedPhone for DB queries
  const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
  // ...
};
```

**Example for `loginUser`**:
```javascript
exports.loginUser = async (req, res) => {
  const { phoneNumber, password } = req.body;
  const normalizedPhone = normalizePhone(phoneNumber);
  
  const user = await User.findOne({ 
    where: { phoneNumber: normalizedPhone } 
  });
  // ... rest of login logic
};
```

---

## 📊 Request/Response Examples

### Successful OTP Send
**Request**:
```http
POST /api/v1/auth/forgot-password/send-otp HTTP/1.1
Host: 192.168.4.137:5000
Content-Type: application/json

{
  "phoneNumber": "+966501234567"
}
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "expiresAt": 1704067200000
  }
}
```

### Failed OTP Send (Current Issue)
**Request**:
```http
POST /api/v1/auth/forgot-password/send-otp HTTP/1.1
Host: 192.168.4.137:5000
Content-Type: application/json

{
  "phoneNumber": "+966501234567"
}
```

**Response**:
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "message": "User not found"
}
```

---

## 🐛 Debugging Information

### App-Side Debug Logs
The app logs the following information:

```
📱 Sending forgot password OTP to: +966501234567
🌐 API Endpoint: http://192.168.4.137:5000/api/v1/auth/forgot-password/send-otp
📦 Request Body: {phoneNumber: +966501234567}
📱 Trying phone number formats: [+966501234567, 966501234567, 0501234567, 501234567]
🔄 Trying format: +966501234567
❌ User not found with format: +966501234567
🔄 Trying format: 966501234567
❌ User not found with format: 966501234567
...
```

### Server-Side Debugging Needed
1. **Log the received phone number**:
   ```javascript
   console.log('Received phoneNumber:', phoneNumber);
   console.log('Phone number type:', typeof phoneNumber);
   console.log('Phone number length:', phoneNumber.length);
   ```

2. **Log database query**:
   ```javascript
   console.log('Querying user with phoneNumber:', phoneNumber);
   const user = await User.findOne({ where: { phoneNumber } });
   console.log('User found:', user ? 'YES' : 'NO');
   if (user) {
     console.log('User phoneNumber in DB:', user.phoneNumber);
   }
   ```

3. **Check all phone number formats in database**:
   ```sql
   SELECT id, phoneNumber, LENGTH(phoneNumber) as length 
   FROM users 
   WHERE phoneNumber LIKE '%501234567%';
   ```

---

## ✅ Implementation Checklist

### Server-Side Fixes Needed (HIGH PRIORITY)

- [ ] **Import `normalizePhone` utility** in `src/controllers/v1/auth.controller.js`
- [ ] **Update `forgotPasswordSendOtp`** to normalize phone number before query
- [ ] **Update `forgotPasswordVerifyOtp`** to normalize phone number before query
- [ ] **Update `sendOtp`** to normalize phone number (for consistency)
- [ ] **Update `verifyOtp`** to normalize phone number (for consistency)
- [ ] **Update `loginUser`** to normalize phone number (for consistency)
- [ ] **Update `registerUser`** to normalize phone number before storing (ensure consistency)
- [ ] **Update OTP cache** to use normalized phone numbers (`setOtp`, `verifyOtp`, `clearOtp`)
- [ ] **Add logging** to track normalization process for debugging
- [ ] **Test with all phone number formats** from Flutter app:
  - `+966501234567`
  - `966501234567`
  - `0501234567`
  - `501234567`
- [ ] **Verify SMS sending** still works with original phone format (if SMS provider needs it)

### Flutter App Side (Already Implemented ✅)

- [x] Phone number formatting utility
- [x] Multiple format retry logic
- [x] Error handling for "User not found"
- [x] OTP sending endpoint integration
- [x] OTP verification endpoint integration
- [x] Password reset endpoint integration

---

## 📝 Additional Notes

1. **Phone Number Validation**: The app validates Saudi phone numbers using regex: `^\+966[0-9]{9}$`

2. **Error Handling**: The app handles the following errors:
   - Network errors
   - 404 (User not found)
   - 500 (Server errors)
   - Invalid phone number format

3. **Retry Logic**: The app automatically tries multiple phone number formats if "User not found" error occurs

4. **OTP Expiry**: The app expects an `expiresAt` timestamp in the response (5 minutes from now)

5. **Resend OTP**: Uses the same endpoint as send OTP, just called again

---

## 🔗 Related Files

- **API Endpoints**: `lib/data/provider/api_endpoints.dart`
- **Auth Service**: `lib/data/services/services/auth_service.dart`
- **Forget Controller**: `lib/screens/Authentication/ForgetPassword/controller/forget_controller.dart`
- **Forget View**: `lib/screens/Authentication/ForgetPassword/view/forget_view.dart`
- **OTP Helper**: `lib/utils/otp_debug_helper.dart`

---

## 🔄 Complete Fixed Flow (After Server Fix)

### Forgot Password Flow

```
1. Flutter App → POST /forgot-password/send-otp
   Request: { "phoneNumber": "+966501234567" }
   ↓
2. Server receives: "+966501234567"
   ↓
3. Server normalizes: normalizePhone("+966501234567") → "501234567"
   ↓
4. Server queries: User.findOne({ where: { phoneNumber: "501234567" } })
   ↓
5. User found ✅
   ↓
6. Server generates OTP: "1234"
   ↓
7. Server sends SMS to: "+966501234567" (original format for SMS)
   ↓
8. Server stores OTP: setOtp("501234567", "1234") (normalized for cache)
   ↓
9. Server responds: { "message": "OTP sent", "expiresAt": ... }
   ↓
10. Flutter App → POST /forgot-password/verify-otp
    Request: { "phoneNumber": "+966501234567", "otpCode": "1234" }
    ↓
11. Server normalizes: normalizePhone("+966501234567") → "501234567"
    ↓
12. Server verifies: verifyOtp("501234567", "1234")
    ↓
13. OTP valid ✅
    ↓
14. Server updates: user.isOtpVerified = true
    ↓
15. Server clears OTP: clearOtp("501234567")
    ↓
16. Server responds: { "message": "OTP verified", "user": {...} }
    ↓
17. Flutter App → POST /reset-password
    Request: { "phoneNumber": "+966501234567", "newPassword": "..." }
    ↓
18. Server normalizes: normalizePhone("+966501234567") → "501234567"
    ↓
19. Server updates password for user with phoneNumber: "501234567"
    ↓
20. Success ✅
```

## 🎯 Expected Behavior After Fix

1. **Flutter app sends**: `"+966501234567"`
2. **Server normalizes**: `"501234567"`
3. **Server finds user**: ✅
4. **Server sends OTP**: ✅
5. **Flutter app verifies**: ✅
6. **Password reset works**: ✅

## 📞 Summary

**Root Cause**: Server stores phone numbers as 9 digits (`501234567`), but queries them without normalization when Flutter app sends `+966501234567`.

**Solution**: Use the existing `normalizePhone` utility in all auth endpoints to normalize phone numbers before database queries.

**Impact**: 
- ✅ Fixes "User not found" errors
- ✅ Eliminates the need for Flutter app's retry logic (though keeping it is still good for robustness)
- ✅ Ensures consistency across all auth endpoints

**Priority**: 🔴 **HIGH** - Blocking forgot password flow

**Files to Modify**:
- `src/controllers/v1/auth.controller.js` - Add normalization to all endpoints
- `src/utils/normalizePhone.js` - Already exists, just needs to be used

**Last Updated**: 2024-01-XX
**Status**: ⚠️ Server-side fix needed
**Server URL**: `http://192.168.4.137:5000`

---

## 📝 Quick Summary for Server Team

### The Problem
- Flutter app sends: `"+966501234567"`
- Database stores: `"501234567"` (9 digits)
- Server queries: `WHERE phone_number = '+966501234567'` → **NO MATCH** ❌

### The Solution
1. **Import** `normalizePhone` utility (already exists at `src/utils/normalizePhone.js`)
2. **Normalize** phone number before database queries
3. **Use** normalized phone for DB queries, original phone for SMS

### Code Change (Minimal)
```javascript
// Add at top of auth.controller.js
const normalizePhone = require('../../utils/normalizePhone');

// In each function, before querying:
const normalizedPhone = normalizePhone(phoneNumber);
const user = await User.findOne({ where: { phoneNumber: normalizedPhone } });
```

### Files to Modify
- `src/controllers/v1/auth.controller.js` - Add normalization to all endpoints

### Testing
Test with these formats (all should work after fix):
- `+966501234567`
- `966501234567`
- `0501234567`
- `501234567`

All should normalize to `501234567` and find the user ✅
