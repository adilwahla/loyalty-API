const { User } = require('../../models');
const AppError = require('../../utils/appError');
const dynamics365Service = require('./dynamics365.service');

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses a strict yyyy-MM-dd string into { year, month, day }, or null if invalid. */
function parseIsoDate(value) {
  const match = ISO_DATE_RE.exec(String(value || '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, time: date.getTime() };
}

function toDynamicsDate({ year, month, day }) {
  return `${month}/${day}/${year}`;
}

function repCodeOf(user) {
  return (
    (user.salesRepId && String(user.salesRepId).trim()) ||
    (user.branchManagerId && String(user.branchManagerId).trim()) ||
    null
  );
}

async function generateStatement({ userId, customerId, fromDate, toDate }) {
  const custAccount = String(customerId || '').trim();
  if (!custAccount) {
    throw new AppError('customer_id is required', 400);
  }
  if (!fromDate || !toDate) {
    throw new AppError('from_date and to_date are required', 400);
  }

  const from = parseIsoDate(fromDate);
  const to = parseIsoDate(toDate);
  if (!from) {
    throw new AppError('from_date must be a valid date in yyyy-MM-dd format', 400);
  }
  if (!to) {
    throw new AppError('to_date must be a valid date in yyyy-MM-dd format', 400);
  }
  if (from.time > to.time) {
    throw new AppError('from_date must be on or before to_date', 400);
  }

  const repUser = await User.findByPk(userId, {
    attributes: ['id', 'role', 'salesRepId', 'branchManagerId'],
  });
  if (!repUser) {
    throw new AppError('Unauthorized: user not found', 401);
  }

  const repCode = repCodeOf(repUser);
  if (!repCode) {
    throw new AppError('Sales rep profile is missing an assignee code', 403);
  }

  const customer = await User.findOne({
    where: { role: 'BUSINESS_OWNER', bsgCustId: custAccount },
    attributes: ['id', 'bsgCustId', 'salesRepId', 'branchManagerId'],
  });
  if (!customer) {
    throw new AppError('Customer not found', 404);
  }

  const customerRep = customer.salesRepId ? String(customer.salesRepId).trim() : '';
  const customerBm = customer.branchManagerId ? String(customer.branchManagerId).trim() : '';
  if (repCode !== customerRep && repCode !== customerBm) {
    throw new AppError('This customer is not linked to your sales account', 403);
  }

  const pdfBase64 = await dynamics365Service.getCustomerStatementPdf({
    custAccount: customer.bsgCustId,
    fromDate: toDynamicsDate(from),
    toDate: toDynamicsDate(to),
  });

  return {
    pdf_base64: pdfBase64,
    file_name: `Statement_${customer.bsgCustId}_${String(fromDate).trim()}_${String(toDate).trim()}.pdf`,
  };
}

module.exports = {
  generateStatement,
};
