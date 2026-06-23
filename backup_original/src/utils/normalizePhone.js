module.exports = function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, ''); // Remove any dashes, spaces, etc.
  // Remove country code if user typed 966 manually
  return digits.startsWith('966') ? digits.slice(3) :
         digits.startsWith('0') ? digits.slice(1) :
         digits;
};
