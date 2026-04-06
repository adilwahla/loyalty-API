const { User, WarrantyScan, WarrantyRedemption } = require('../../models');
const { fn, col, literal } = require('sequelize');

async function getDashboardStats() {
  // users by role
  const usersByRoleRows = await User.findAll({
    attributes: ['role', [fn('COUNT', col('id')), 'count']],
    group: ['role'],
    raw: true,
  });
  const usersByRole = {
    CUSTOMER: 0, TECHNICIAN: 0, BUSINESS_OWNER: 0,
    ...usersByRoleRows.reduce((a, r) => ({ ...a, [r.role]: Number(r.count) }), {})
  };

  // scans approved
  const scansApproved = await WarrantyScan.count({ where: { status: 'approved' } }); // <- if WarrantyScan.status is lowercase; change to 'APPROVED' if uppercase in that table

  // total points (approved)
  const totalPoints = (await WarrantyScan.sum('points', { where: { status: 'approved' } })) || 0;

  // redemptions totals
  const totalRedemptions = await WarrantyRedemption.count();

  // by status (UPPERCASE)
  const byStatusRows = await WarrantyRedemption.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'count']],
    group: ['status'],
    raw: true,
  });
  const redemptionsByStatus = byStatusRows.reduce((acc, r) => {
    acc[r.status] = Number(r.count); return acc;
  }, { PENDING: 0, APPROVED: 0, REJECTED: 0 });

  // by role using association alias 'user'
  const redemptionsByRoleRows = await WarrantyRedemption.findAll({
    attributes: [
      [literal('`user`.`role`'), 'role'],
      [fn('COUNT', col('WarrantyRedemption.id')), 'count'],
    ],
    include: [{ model: User, as: 'user', attributes: [] }],
    group: ['user.role'],
    raw: true,
  });

  const byRoleCounts = redemptionsByRoleRows.reduce((acc, r) => {
    acc[r.role] = Number(r.count); return acc;
  }, { CUSTOMER: 0, TECHNICIAN: 0, BUSINESS_OWNER: 0 });

  const totalForPct = Object.values(byRoleCounts).reduce((a, b) => a + b, 0) || 1;
  const byRolePercent = Object.fromEntries(
    Object.entries(byRoleCounts).map(([k, v]) => [k, Number(((v / totalForPct) * 100).toFixed(2))])
  );

  return {
    usersByRole,
    scansApproved,
    totalPoints,
    redemptions: {
      total: totalRedemptions,
      byStatus: {
        pending: redemptionsByStatus.PENDING || 0,
        approved: redemptionsByStatus.APPROVED || 0,
        rejected: redemptionsByStatus.REJECTED || 0,
      },
      byRolePercent: byRolePercent,
      byRoleCounts,
    },
  };
}

module.exports = { getDashboardStats };
