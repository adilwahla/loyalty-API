function isCustomerFieldActivated(customer) {
  if (!customer) return false;
  if (String(customer.status || '').toUpperCase() === 'ACTIVATED') return true;
  const lat = customer.latitude;
  const lng = customer.longitude;
  return lat != null && lat !== '' && lng != null && lng !== '';
}

function mobileFieldStatus(customer) {
  return isCustomerFieldActivated(customer) ? 'Activated' : 'Approved';
}

module.exports = {
  isCustomerFieldActivated,
  mobileFieldStatus,
};
