const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const sequelize = require('../config/database');
// const { swaggerUi, swaggerSpec } = require('./docs/swagger');
const path = require('path');
const cors = require('cors');
const { app, server } = require('../config/server');
const multer = require('multer');
// const { testWordpressConnection } = require('../config/wordpress.database');
// Access io that was set in server.js
const io = app.get('io');

dotenv.config();
// const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// testWordpressConnection();

// Serve static files from /uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// ✅ Add this directly after middleware and before all route mounts
app.get('/api/v1/ping', require('./routes/api/v1/ping.wordpress.routes'));

app.use('/api/v1/wordpress-db', require('./routes/api/v1/ping.wordpress.routes'));

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : err.message;
    return res.status(413).json({ ok: false, code: err.code, message: msg });
  }
  return res.status(500).json({ ok: false, message: err.message || 'Server error' });
});
// Swagger docs
//app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// ✅ Health check ping
app.use('/api/v1/ping', require('./routes/api/v1/ping.routes'));

// App version (Force Update) — no auth, used by Splash before login
app.use('/api/v1', require('./routes/api/v1/appVersion.routes.js'));

// ✅ Admin Routes
app.use('/api/v1/admin/products', require('./routes/api/v1/admin/product.routes'));
app.use('/api/v1/admin/rewards', require('./routes/api/v1/admin/reward.routes')); // ✅ Added Reward Routes

// ✅ File Upload API (used for direct uploads if needed)
app.use('/api/v1/upload', require('./routes/api/v1/upload.routes'));
//app.use('/api/v1/upload', require('./routes/api/v1/upload.routes'));


// ✅ Offer Routes
app.use('/api/v1/admin/offers', require('./routes/api/v1/admin/offer.routes')); // ✅ Added Offer Routes


// ✅ UserROLE Routes
// ✅ Correct: matches /api/v1/admin/user-roles
app.use('/api/v1/admin/user-roles', require('./routes/api/v1/admin/userRole.routes'));

// ✅ User Routes
app.use('/api/v1/admin/users', require('./routes/api/v1/admin/user.routes'));


// this is new update for group.
// ✅ Groups Routes (for filtering business owners by group)
app.use('/api/v1/admin/groups', require('./routes/api/v1/admin/group.routes'));

app.use('/api/v1/auth', require('./routes/api/v1/auth.routes'));

// Multi-account endpoints for Business Owners (GET/POST /api/v1/users/me/accounts)
app.use('/api/v1/users', require('./routes/api/v1/account.routes'));

// ✅ Dashboard Auth Routes 


// ✅ This mounts /api/v1/dashboard/auth/login etc.
app.use('/api/v1/dashboard/auth', require('./routes/api/v1/dashboard/auth.routes'));



// ✅ Redemption Request Routes
//app.use('/api/v1/admin/redemption-requests', require('./routes/api/v1/admin/redemptionRequest.routes'));

// ✅ Redemption Request Routes
app.use('/api/v1/admin/redemption-requests', require('./routes/api/v1/admin/redemptionRequest.routes'));

// ✅ Mobile Redemption Request Routes (Business Owner)
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/warrantyRedemption.routes'));

// Mobile groups endpoint (BO dropdown for multi-account)
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/group.routes'));

// Public customer-id check (BO registration, before login)
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/checkCustomerId.routes'));

// Mobile app-version endpoint (ForceUpdateChecker)
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/appVersion.routes'));

// Mobile sales-reps endpoint (BO registration dropdown)
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/salesRep.routes'));
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/branchManager.mobile.routes'));


app.use('/api/v1/admin/sales-reps', require('./routes/api/v1/admin/salesRep.routes'));
app.use('/api/v1/admin/branch-managers', require('./routes/api/v1/admin/branchManager.routes'));


// ✅ Warranty SCAN Routes
app.use('/api/v1/mobile', require('./routes/api/v1/mobile/warrantyScan.routes'));
app.use('/api/v1/admin/warranty-scans', require('./routes/api/v1/admin/warrantyScan.routes'));

// ✅ Brand Master Routes
const brandMasterRoutes = require('./routes/api/v1/admin/brandMaster.routes');
app.use('/api/v1/admin/brand-master', brandMasterRoutes);

// ✅ Technician Routes
// app.use('/api/v1/technicians', require('./routes/api/v1/technician.routes'));
// ✅ Technician Mobile Routes (Technician scan QR)
// app.use('/api/v1/mobile/technicians', require('./routes/api/v1/mobile/technician.routes'));

// // ✅ Technician Admin Routes (Admin management)
// app.use('/api/v1/admin/technicians', require('./routes/api/v1/admin/technician.routes'));
const mobileLinkRoutes = require('./routes/api/v1/mobile/link.mobile.routes');
const adminLinkRoutes = require('./routes/api/v1/admin/link.admin.routes');

app.use('/api/v1/mobile', mobileLinkRoutes);
app.use('/api/v1/admin', adminLinkRoutes);

const analyticsRoutes = require('./routes/api/v1/admin/analytics.routes');

// ✅ Prefix with /api/v1/analytics
app.use('/api/v1/analytics', analyticsRoutes);

app.get('/mem', (req, res) => {
  const m = process.memoryUsage();
  res.json({
    rssMB: (m.rss / 1024 / 1024).toFixed(1),
    heapUsedMB: (m.heapUsed / 1024 / 1024).toFixed(1),
    heapTotalMB: (m.heapTotal / 1024 / 1024).toFixed(1),
    externalMB: (m.external / 1024 / 1024).toFixed(1),
    arrayBuffersMB: (m.arrayBuffers / 1024 / 1024).toFixed(1),
    uptimeSec: process.uptime().toFixed(0),
    nodeVersion: process.version,
  });
});



/* Elham  Endpoints(Routes)*/

const taskRoutes = require("./routes/api/v1/taskRoutes");


app.use("/api/v1/tasks", taskRoutes);

// ✅ RBAC Routes (Roles, Duties, Privileges)
app.use('/api/v1/admin/rbac', require('./routes/api/v1/admin/rbac.routes'));


// Sync DB and start server (simple, reliable path now that migrations are done)
sequelize.sync()
  .then(() => {
    console.log('✅ Database synced');
    startServer();
  })
  .catch((err) => {
    console.error('❌ Failed to sync database:', err);
    startServer(); // Start server anyway
  });

function startServer() {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📚 Swagger docs at http://localhost:${PORT}/api-docs`);
  });
}

app.get('/socket-health', (req, res) => {
  res.json({ ok: true, path: io && io._opts && io._opts.path });
});

// setInterval(() => {
//   const m = process.memoryUsage();
//   console.log(`[MEM] rss: ${(m.rss/1024/1024).toFixed(1)}MB, heapUsed: ${(m.heapUsed/1024/1024).toFixed(1)}MB`);
// }, 100000);
