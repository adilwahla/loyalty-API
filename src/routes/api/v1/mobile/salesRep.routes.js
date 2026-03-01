const express = require('express');
const router = express.Router();
const { User } = require('../../../../models');

router.get('/sales-reps', async (req, res, next) => {
  try {
    const reps = await User.findAll({
      where: { role: 'SALES_REP' },
      attributes: ['salesRepId', 'fullName'],
      order: [['fullName', 'ASC']],
      raw: true,
    });

    const result = reps
      .filter(r => r.salesRepId)
      .map(r => ({
        salesRepId: r.salesRepId,
        name: r.fullName || r.salesRepId,
        nameAR: r.fullName || r.salesRepId,
      }));

    res.json(result);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
