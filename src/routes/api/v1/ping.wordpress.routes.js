// routes/api/v1/ping.wordpress.routes.js
const express = require('express');
const router = express.Router();
const { wordpressSequelize } = require('../../../../config/wordpress.database');

router.get('/', async (req, res) => {
  try {
    await wordpressSequelize.authenticate();
    return res.status(200).json({
      success: true,
      service: 'WordPress DB',
      status: 'UP',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ WordPress DB check failed:', err.message);
    return res.status(500).json({
      success: false,
      service: 'WordPress DB',
      status: 'DOWN',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
