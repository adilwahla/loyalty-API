/**
 * Enrolls (first scan, no serial on file) or verifies (serial already on file) the
 * physical tag's hardware serial number against a customer (User) record.
 * `customer` must be the row loaded inside `transaction` with a row lock,
 * so concurrent scans on the same customer can't race past this check.
 */
async function verifyOrEnrollNfcSerialNumber({ customer, scannedSerial, transaction }) {
  if (!scannedSerial) return; // no serial sent — old app version, skip silently for now

  const serial = String(scannedSerial).trim().toUpperCase();
  const storedSerial = customer.nfcSerialNumber
    ? String(customer.nfcSerialNumber).trim().toUpperCase()
    : null;

  if (!storedSerial) {
    await customer.update({ nfcSerialNumber: serial }, { transaction });
    return;
  }

  if (storedSerial !== serial) {
    const err = new Error('This tag does not match the tag registered for this customer.');
    err.code = 'NFC_SERIAL_MISMATCH';
    err.http = 409;
    err.statusCode = 409; // taskService's error handling reads statusCode; warrantyScan's reads http
    throw err;
  }
}

module.exports = { verifyOrEnrollNfcSerialNumber };