const { getDashboardStats } = require('../../services/v1/analytics.service');

exports.getDashboardStats = async (req, res) => {
  try {
    const data = await getDashboardStats();
    res.json({ ok: true, data });
  } catch (e) {
    console.error('Analytics error:', e);
    res.status(500).json({ ok: false, message: 'Error fetching analytics' });
  }
};
