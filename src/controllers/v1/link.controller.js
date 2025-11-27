

// controllers/link.controller.js
const {
  generateBoLinkQr,
  linkTechnicianToBoWithToken,
  updateShareFactor,
  listTechniciansForBo,
  listAllLinks,
  listUsersByRole,
  adminCreateLink,
  adminDeleteLink,
} = require('../../services/v1/link.service');

// ---- MOBILE USE CASES ----
exports.getBusinessOwnerLinkQr = async (req, res) => {
  try {
    const { boId } = req.params;

    // Ensure caller is this BO (mobile)
    if (req.user.role !== 'BUSINESS_OWNER' || req.user.id !== boId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { token, exp } = await generateBoLinkQr({ boId });
    return res.json({ token, exp });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed generating QR' });
  }
};

exports.scanBusinessOwnerLinkQr = async (req, res) => {
  try {
    if (req.user.role !== 'TECHNICIAN') {
      return res.status(403).json({ message: 'Only TECHNICIAN can link via QR' });
    }
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: 'token required' });

    const result = await linkTechnicianToBoWithToken({ technicianId: req.user.id, token });
    return res.json({
      linked: true,
      linkId: result.link.id,
      shareFactor: result.link.shareFactor,
      businessOwner: result.bo,
    });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to link' });
  }
};

exports.listTechniciansForBo = async (req, res) => {
  try {
    const { boId } = req.params;

    // Ensure caller is this BO (mobile)
    if (req.user.role !== 'BUSINESS_OWNER' || req.user.id !== boId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const list = await listTechniciansForBo({ boId });
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to list technicians' });
  }
};

// ---- ADMIN USE CASES ----
exports.setShareFactor = async (req, res) => {
  try {
    const { linkId } = req.params;
    const { shareFactor } = req.body;

    // Role is enforced by route middleware (SALES_ADMIN)
    const link = await updateShareFactor({ linkId, shareFactor });
    return res.json({
      ok: true,
      linkId: link.id,
      shareFactor: link.shareFactor,
      technician: link.technician,
      businessOwner: link.businessOwner,
    });
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to update share factor' });
  }
};

exports.listLinks = async (req, res) => {
  try {
    const { status } = req.query;
    // Role is enforced by route middleware (SALES_ADMIN)
    const links = await listAllLinks({ status });
    return res.json(links);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to list links' });
  }
};


// ---- ADMIN USE CASES ----

// Dropdowns: list BOs / Technicians
exports.adminListUsers = async (req, res) => {
  try {
    const { role, q, limit } = req.query; // role=BUSINESS_OWNER|TECHNICIAN
    if (!role || !['BUSINESS_OWNER', 'TECHNICIAN'].includes(role)) {
      return res.status(400).json({ message: 'role must be BUSINESS_OWNER or TECHNICIAN' });
    }
    const list = await listUsersByRole({ role, q, limit: limit ? Number(limit) : undefined });
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to list users' });
  }
};

// List links with filters (status, boId, technicianId)
exports.listLinks = async (req, res) => {
  try {
    const { status, boId, technicianId } = req.query;
    const links = await listAllLinks({ status, boId, technicianId });
    return res.json(links);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to list links' });
  }
};

// Create/link BO <-> Technician
exports.adminCreateLink = async (req, res) => {
  try {
    const { businessOwnerId, technicianId, shareFactor } = req.body;
    if (!businessOwnerId || !technicianId) {
      return res.status(400).json({ message: 'businessOwnerId and technicianId are required' });
    }
    const sf = shareFactor !== undefined ? Number(shareFactor) : undefined;

    const link = await adminCreateLink({
      adminId: req.user?.id,
      businessOwnerId,
      technicianId,
      shareFactor: sf,
    });

    return res.status(201).json(link);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to create link' });
  }
};

// Delete/unlink (soft by default; ?hard=true to hard delete)
exports.adminDeleteLink = async (req, res) => {
  try {
    const { linkId } = req.params;
    const hard = (req.query.hard || '').toString().toLowerCase() === 'true';
    const result = await adminDeleteLink({ linkId, hard });
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(e.statusCode || 500).json({ message: e.message || 'Failed to delete link' });
  }
};