const otpStore = new Map();

function setOtp(phone, otp) {
  const expiresAt = Date.now() + 5 * 60 * 1000;
  otpStore.set(phone, { otp, expiresAt });
}

function verifyOtp(phone, otp) {
  const entry = otpStore.get(phone);

  if (!entry || Date.now() > entry.expiresAt) return false;
  setOtp(phone, 'VERIFIED'); // ✅ set the verification flag

  return entry.otp === otp;
}

function clearOtp(phone) {
  otpStore.delete(phone);
}

module.exports = { setOtp, verifyOtp, clearOtp };
