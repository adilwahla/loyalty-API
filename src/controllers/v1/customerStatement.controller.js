const { success, error } = require('../../utils/response');
const customerStatementService = require('../../services/v1/customerStatement.service');

exports.getCustomerStatement = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { customer_id, from_date, to_date } = req.body || {};
    const data = await customerStatementService.generateStatement({
      userId,
      customerId: customer_id,
      fromDate: from_date,
      toDate: to_date,
    });

    return res.status(200).json(success('Customer statement generated successfully', data));
  } catch (err) {
    const status = err.statusCode || 500;
    if (status === 500) {
      console.error('[customer-statement] failed', err.message);
    }
    const message = err.isOperational ? err.message : 'Failed to generate customer statement';
    return res.status(status).json(error(message));
  }
};
