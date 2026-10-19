function normalizeSerial(value) {
  if (value == null) return null;
  const serial = String(value).trim().toUpperCase();
  return serial || null;
}

function serialMismatchError() {
  const err = new Error('This tag does not match the tag registered for this customer.');
  err.code = 'NFC_SERIAL_MISMATCH';
  err.http = 409;
  err.statusCode = 409;
  return err;
}

/**
 * Compare a scanned tag serial with the value stored on the customer.
 * Never writes. Other task types (random visit, validate-scan) use this only.
 */
function verifyNfcSerialNumber({ customer, scannedSerial }) {
  const serial = normalizeSerial(scannedSerial);
  if (!serial) return;

  const stored = normalizeSerial(customer?.nfcSerialNumber);
  if (!stored) return;
  if (stored !== serial) throw serialMismatchError();
}

/**
 * First activation only. Writes nfc_serial_number when the customer has none.
 */
async function enrollNfcSerialNumber({ customer, scannedSerial, transaction }) {
  const serial = normalizeSerial(scannedSerial);
  if (!serial) {
    const err = new Error('nfc_serial_number is required to activate the customer');
    err.code = 'NFC_SERIAL_REQUIRED';
    err.http = 400;
    err.statusCode = 400;
    throw err;
  }

  const stored = normalizeSerial(customer?.nfcSerialNumber);
  if (!stored) {
    await customer.update({ nfcSerialNumber: serial }, { transaction });
    return;
  }
  if (stored !== serial) throw serialMismatchError();
}

module.exports = { verifyNfcSerialNumber, enrollNfcSerialNumber };
