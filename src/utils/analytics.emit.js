const { getDashboardStats } = require('../services/v1/analytics.service');

async function emitAnalytics(io) {
  try {
    const snapshot = await getDashboardStats();
    io.emit('analytics_updated', snapshot); // broadcast to all
    console.log('📊 emitted analytics_updated');
  } catch (e) {
    console.error('emitAnalytics error:', e);
  }
}

module.exports = { emitAnalytics };
