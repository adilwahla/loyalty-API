// Standard API response format
exports.success = (message, data = null) => ({
  success: true,
  message,
  data
});

exports.error = (message, data = null) => ({
  success: false,
  message,
  data
});
