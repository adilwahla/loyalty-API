process.env.UNDICI_NO_WASM = '1';
// ===== 1) Load env FIRST =====
require('dotenv').config();

const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const express = require('express'); // for express.static

// Your app/server wrapper (exports: { app, server })
const { app, server } = require('../config/server');

// DB + Swagger
const sequelize = require('../config/database');
// const { swaggerUi, swaggerSpec } = require('./docs/swagger');

// ===== 2) Core middleware =====
app.set('trust proxy', 1); // behind Apache proxy
app.use(cors());
app.use(bodyParser.json());

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ===== 3) Root & health =====
app.get('/', (_req, res) => res.send('✅ Loyalty API is running'));
app.get('/api/v1/ping', (_req, res) => res.json({ ok: true, ts: Date.now(), v: process.version }));
app.get('/mem', (_req, res) => {
  const m = process.memoryUsage();
  res.json({
    rssMB: (m.rss / 1048576).toFixed(1),
    heapUsedMB: (m.heapUsed / 1048576).toFixed(1),
    heapTotalMB: (m.heapTotal / 1048576).toFixed(1),
    externalMB: (m.external / 1048576).toFixed(1),
    arrayBuffersMB: (m.arrayBuffers / 1048576).toFixed(1),
    uptimeSec: process.uptime().toFixed(0),
    nodeVersion: process.version,
  });
});

// ===== 4) Routers (mount once each; use app.use for routers) =====
// Keep WordPress connection checks on their own prefix (NOT /api/v1/ping)
app.use('/api/v1/wordpress-db', require('./routes/api/v1/ping.wordpress.routes'));

// Admin
app.use('/api/v1/admin/products', require('./routes/api/v1/admin/product.routes'));
app.use('/api/v1/admin/rewards', require('./routes/api/v1/admin/reward.routes'));
app.use('/api/v1/admin/offers', require('./routes/api/v1/admin/offer.routes'));
app.use('/api/v1/admin/user-roles', require('./routes/api/v1/admin/userRole.routes'));
app.use('/api/v1/admin/users', require('./routes/api/v1/admin/user.routes'));
app.use('/api/v1/admin/redemption-requests', require('./routes/api/v1/admin/redemptionRequest.routes'));
app.use('/api/v1/admin/sales-reps', require('./routes/api/v1/admin/salesRep.routes'));
app.use('/api/v1/admin/branch-managers', require('./routes/api/v1/admin/branchManager.routes'));
app.use('/api/v1/admin/warranty-scans', require('./routes/api/v1/admin/warrantyScan.routes'));
app.use('/api/v1/admin/brand-master', require('./routes/api/v1/admin/brandMaster.routes'));
app.use('/api/v1/admin', require('./routes/api/v1/admin/link.admin.routes'));

// Mobile
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/warrantyRedemption.routes'));
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/warrantyScan.routes'));
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/link.mobile.routes'));

// Auth
app.use('/api/v1/auth', require('./routes/api/v1/auth.routes'));
app.use('/api/v1/dashboard/auth', require('./routes/api/v1/dashboard/auth.routes'));

// Uploads (mount once)
app.use('/api/v1/upload', require('./routes/api/v1/upload.routes'));

// Analytics
app.use('/api/v1/analytics', require('./routes/api/v1/admin/analytics.routes'));

// Swagger
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== 5) Error handler LAST =====
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    return res.status(413).json({ ok: false, code: err.code, message: msg });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ ok: false, message: err?.message || 'Server error' });
});

// ===== 6) Boot =====
sequelize.sync()
  .then(() => {
    console.log('✅ Database synced');
    const PORT = process.env.PORT || 3000; // Apache/PM2 will set this
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  //    console.log('📚 Swagger docs at /api-docs');
    });
  })
  .catch((err) => {
    console.error('❌ Failed to sync database:', err);
  });
app.get('/socket-health', (req, res) => {
  res.json({ ok: true, path: io && io._opts && io._opts.path });
});
