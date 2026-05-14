// src/routes/api/v1/salesRep.auth.routes.js
//
// Dedicated route file for Sales Rep self-registration endpoints.
// Mount this in auth.routes.js with ONE additional line (see bottom of file).
//
// ── HOW TO WIRE INTO auth.routes.js ──────────────────────────────────────────
// Open:  src/routes/api/v1/auth.routes.js
// Add ONE line anywhere after the existing routes:
//
//   router.use('/', require('./salesRep.auth.routes'));
//
// That exposes:
//   POST /api/v1/auth/register-sales-rep

const router = require('express').Router();
const controller = require('../../../../src/controllers/v1/salesRep.auth.controller');

// POST /api/v1/auth/register-sales-rep
// Self-registration for SALES_REP role.
// No auth middleware — user is not logged in.
router.post('/register-sales-rep', controller.registerSalesRep);

module.exports = router;