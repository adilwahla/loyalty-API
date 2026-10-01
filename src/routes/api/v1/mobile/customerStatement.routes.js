const express = require('express');
const router = express.Router();
const { protect } = require('../../../../middleware/auth');
const customerStatementController = require('../../../../controllers/v1/customerStatement.controller');

// POST /api/v1/mobile/customers/statement
router.post(
  '/customers/statement',
  protect(['SALES_REP', 'BRANCH_MANAGER']),
  customerStatementController.getCustomerStatement
);

module.exports = router;
