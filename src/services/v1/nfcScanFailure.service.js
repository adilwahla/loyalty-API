const { Op } = require('sequelize');
const { NfcScanFailure, User } = require('../../models');
const AppError = require('../../utils/appError');

const CLIENT_FAILURE_SOURCES = ['random_visit', 'task_scan', 'activate'];
const RANDOM_VISIT_ALREADY_LOGGED = [
  'CUSTOMER_NOT_FOUND',
  'CUSTOMER_NOT_ACTIVATED',
  'CUSTOMER_LOOKUP_FAILED',
  'OUT_OF_RADIUS',
];
const RANDOM_VISIT_DEDUPE_MS = 60 * 1000;

const MESSAGE_CODES = {
  'scanned_nfc_value is required': 'MISSING_NFC',
  'nfc_value is required': 'MISSING_NFC',
  'rep_lat and rep_lng are required and must be valid numbers': 'INVALID_COORDINATES',
  'Scanned NFC value does not map to a customer': 'CUSTOMER_NOT_FOUND',
  'Customer not found for provided identifier': 'CUSTOMER_NOT_FOUND',
  'Customer does not have bsg_cust_id': 'MISSING_CUST_ID',
  'business_address is required to activate the customer': 'ADDRESS_REQUIRED',
  'nfc_serial_number is required to activate the customer': 'NFC_SERIAL_REQUIRED',
  'This tag does not match the tag registered for this customer.': 'NFC_SERIAL_MISMATCH',
  'Customer must complete activation before a random visit': 'CUSTOMER_NOT_ACTIVATED',
  'This customer is not linked to your sales account': 'REP_NOT_LINKED',
  'Sales rep profile is missing an assignee code': 'REP_CODE_MISSING',
  'Customer not found': 'CUSTOMER_NOT_FOUND',
  'Unauthorized: user not found': 'UNAUTHORIZED',
};

function codeFromMessage(message) {
  return MESSAGE_CODES[message] || 'SCAN_FAILED';
}

async function resolveSalesRepId({ userId, salesRepId }) {
  const direct = salesRepId != null ? String(salesRepId).trim() : '';
  if (direct) return direct;
  if (!userId) return null;

  const user = await User.findByPk(userId, {
    attributes: ['salesRepId', 'branchManagerId'],
  });
  const fromUser = user?.salesRepId || user?.branchManagerId || '';
  const resolved = String(fromUser).trim();
  return resolved || null;
}

async function logNfcScanFailure({ userId, salesRepId, customerId, errorCode, errorMessage, source }) {
  try {
    const message = errorMessage != null ? String(errorMessage).trim() : '';
    const failureSource = source != null ? String(source).trim() : '';
    if (!message || !failureSource) return;

    const repId = await resolveSalesRepId({ userId, salesRepId });
    if (!repId) return;

    const customer = customerId != null ? String(customerId).trim() : '';
    await NfcScanFailure.create({
      salesRepId: repId,
      customerId: customer || null,
      errorCode: String(errorCode || codeFromMessage(message)).slice(0, 64),
      errorMessage: message,
      source: failureSource.slice(0, 32),
    });
  } catch (err) {
    console.error('[error_logs] log failed:', err.message);
  }
}

async function reportClientScanFailure({ userId, customerId, errorCode, errorMessage, source }) {
  const customer = customerId != null ? String(customerId).trim() : '';
  const code = errorCode != null ? String(errorCode).trim() : '';
  const message = errorMessage != null ? String(errorMessage).trim() : '';
  const failureSource = source != null ? String(source).trim() : '';

  if (!customer) throw new AppError('customer_id is required', 400);
  if (!code) throw new AppError('error_code is required', 400);
  if (code.length > 64) throw new AppError('error_code is too long', 400);
  if (!message) throw new AppError('error_message is required', 400);
  if (!CLIENT_FAILURE_SOURCES.includes(failureSource)) {
    throw new AppError('source must be random_visit, task_scan, or activate', 400);
  }

  const repId = await resolveSalesRepId({ userId });
  if (!repId) throw new AppError('Sales rep profile is missing an assignee code', 400);

  if (failureSource === 'random_visit' && RANDOM_VISIT_ALREADY_LOGGED.includes(code)) {
    const existing = await NfcScanFailure.findOne({
      where: {
        salesRepId: repId,
        source: 'random_visit',
        dateTime: { [Op.gte]: new Date(Date.now() - RANDOM_VISIT_DEDUPE_MS) },
      },
      attributes: ['id'],
    });
    if (existing) return existing;
  }

  return NfcScanFailure.create({
    salesRepId: repId,
    customerId: customer,
    errorCode: code,
    errorMessage: message,
    source: failureSource,
  });
}

module.exports = { logNfcScanFailure, reportClientScanFailure };
