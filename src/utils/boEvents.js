// helpers/socket/boEvents.js
function emitBOCreated(io, user) {
  if (!io || !user) return;
  io.to('admins').emit('bo_created', {
    id: user.id,
    fullName: user.fullName ?? null,
    phoneNumber: user.phoneNumber ?? null,
    bsgCustId: user.bsgCustId ?? null,
    businessName: user.businessName ?? null,
    vatNumber: user.vatNumber ?? null,
    businessAddress: user.businessAddress ?? null,
    salesRepId: user.salesRepId ?? null,
    email: user.email ?? null,
    rawStatus: user.status,                             // expect 'PENDING' from mobile flow
    status: user.status === 'APPROVED' ? 'Approved'
            : user.status === 'PENDING' ? 'Pending'
            : user.status,
    at: new Date().toISOString(),
  });
}

function emitBOUpdated(io, user) {
  if (!io || !user) return;
  io.to('admins').emit('bo_updated', {
    id: user.id,
    fullName: user.fullName ?? null,
    phoneNumber: user.phoneNumber ?? null,
    bsgCustId: user.bsgCustId ?? null,
    businessName: user.businessName ?? null,
    vatNumber: user.vatNumber ?? null,
    businessAddress: user.businessAddress ?? null,
    salesRepId: user.salesRepId ?? null,
    email: user.email ?? null,
    rawStatus: user.status,
    status: user.status === 'APPROVED' ? 'Approved'
            : user.status === 'PENDING' ? 'Pending'
            : user.status,
    at: new Date().toISOString(),
  });
}

function emitBOStatusChanged(io, user, rawStatus) {
  if (!io || !user) return;
  io.to('admins').emit('bo_status_changed', {
    id: user.id,
    fullName: user.fullName ?? null,
    phoneNumber: user.phoneNumber ?? null,
    bsgCustId: user.bsgCustId ?? null,
    businessName: user.businessName ?? null,
    vatNumber: user.vatNumber ?? null,
    businessAddress: user.businessAddress ?? null,
    salesRepId: user.salesRepId ?? null,
    email: user.email ?? null,
    rawStatus,
    status: rawStatus === 'APPROVED' ? 'Approved'
           : rawStatus === 'PENDING' ? 'Pending'
           : rawStatus === 'REJECTED' ? 'Rejected'
           : '-',
    at: new Date().toISOString(),
  });
}

module.exports = { emitBOCreated, emitBOUpdated, emitBOStatusChanged };
