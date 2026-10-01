const axios = require('axios');
const AppError = require('../../utils/appError');

const COMPANY_ID = 'BSG';
const TOKEN_TIMEOUT_MS = 15000;
const STATEMENT_TIMEOUT_MS = 60000;
// Refresh slightly before real expiry so a token never expires mid-request.
const TOKEN_EXPIRY_SKEW_MS = 60 * 1000;
const CUST_STATEMENT_PATH =
  '/api/services/BSGApiServiceCustStatPdf/BSGApiServiceCustStatPdf/custStatementPdf';

let cachedToken = null;
let cachedTokenExpiresAt = 0;
let pendingTokenRequest = null;

function getConfig() {
  const tenantId = String(process.env.D365_TENANT_ID || '').trim();
  const clientId = String(process.env.D365_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.D365_CLIENT_SECRET || '').trim();
  const baseUrl = String(process.env.D365_BASE_URL || '').trim().replace(/\/+$/, '');

  if (!tenantId || !clientId || !clientSecret || !baseUrl) {
    console.error('[D365] Missing D365_TENANT_ID / D365_CLIENT_ID / D365_CLIENT_SECRET / D365_BASE_URL');
    throw new AppError('Dynamics 365 integration is not configured on the server', 500);
  }

  return { tenantId, clientId, clientSecret, baseUrl };
}

function isNetworkError(err) {
  return !err.response;
}

function isTimeoutError(err) {
  return err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
}

function clearTokenCache() {
  cachedToken = null;
  cachedTokenExpiresAt = 0;
}

async function requestAccessToken() {
  const { tenantId, clientId, clientSecret, baseUrl } = getConfig();
  const url = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: `${baseUrl}/.default`,
  });

  try {
    const { data } = await axios.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: TOKEN_TIMEOUT_MS,
    });

    if (!data?.access_token) {
      throw new AppError('Failed to authenticate with Dynamics 365', 502);
    }

    const expiresInMs = Number(data.expires_in || 0) * 1000;
    cachedToken = data.access_token;
    cachedTokenExpiresAt = Date.now() + Math.max(expiresInMs - TOKEN_EXPIRY_SKEW_MS, 0);
    return cachedToken;
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('[D365] Token request failed:', err.response?.status || err.code, err.response?.data?.error || err.message);
    if (isNetworkError(err)) {
      throw new AppError('Dynamics 365 is not reachable, please try again later', 503);
    }
    throw new AppError('Failed to authenticate with Dynamics 365', 502);
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  if (!pendingTokenRequest) {
    pendingTokenRequest = requestAccessToken().finally(() => {
      pendingTokenRequest = null;
    });
  }
  return pendingTokenRequest;
}

function extractDynamicsErrorMessage(data) {
  if (!data || typeof data !== 'object') return null;
  return (
    data.Message ||
    data.message ||
    data.ErrorMessage ||
    data.errorMessage ||
    data.error?.message ||
    data.Error ||
    null
  );
}

async function postCustStatement(contract, accessToken) {
  const { baseUrl } = getConfig();
  return axios.post(
    `${baseUrl}${CUST_STATEMENT_PATH}`,
    { _contract: contract },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: STATEMENT_TIMEOUT_MS,
    }
  );
}

/**
 * Fetches a customer account statement PDF from Dynamics 365.
 * `fromDate` / `toDate` must already be in Dynamics format (M/d/yyyy).
 * Returns the PDF as a Base64 string.
 */
async function getCustomerStatementPdf({ custAccount, fromDate, toDate }) {
  const contract = {
    CustAccount: custAccount,
    FromDate: fromDate,
    ToDate: toDate,
    CompanyId: COMPANY_ID,
  };

  let response;
  try {
    let accessToken = await getAccessToken();
    try {
      response = await postCustStatement(contract, accessToken);
    } catch (err) {
      if (err.response?.status !== 401) throw err;
      clearTokenCache();
      accessToken = await getAccessToken();
      response = await postCustStatement(contract, accessToken);
    }
  } catch (err) {
    if (err instanceof AppError) throw err;

    const status = err.response?.status;
    const dynamicsMessage = extractDynamicsErrorMessage(err.response?.data);
    console.error('[D365] custStatementPdf failed:', status || err.code, dynamicsMessage || err.message);

    if (isTimeoutError(err)) {
      throw new AppError('Dynamics 365 took too long to generate the statement, please try again', 504);
    }
    if (isNetworkError(err)) {
      throw new AppError('Dynamics 365 is not reachable, please try again later', 503);
    }
    throw new AppError(
      dynamicsMessage
        ? `Dynamics 365 error: ${dynamicsMessage}`
        : 'Failed to generate the customer statement in Dynamics 365',
      502
    );
  }

  const pdfBase64 = response.data?.PdfBase64String;
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    const dynamicsMessage = extractDynamicsErrorMessage(response.data);
    console.error('[D365] custStatementPdf returned no PdfBase64String:', dynamicsMessage || '(no message)');
    throw new AppError(
      dynamicsMessage
        ? `Dynamics 365 error: ${dynamicsMessage}`
        : 'Dynamics 365 did not return a statement for this customer and period',
      502
    );
  }

  return pdfBase64;
}

module.exports = {
  getCustomerStatementPdf,
};
