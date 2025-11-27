const service = require('../../services/v1/redemptionRequest.service');

exports.create = async (req, res) => {
  try {
    // Optional: Clean or validate input if needed
    const result = await service.create(req.body);
    res.status(201).json({ success: true, message: 'Redemption request created', request: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Creation failed', error: err.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const result = await service.getAll(req.query);
    res.status(200).json({ success: true, message: 'Requests fetched', requests: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch failed', error: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const result = await service.getById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'Request not found' });
    res.status(200).json({ success: true, request: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Fetch by ID failed', error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewedBy, approvedBy } = req.body;

    const result = await service.updateStatus(id, { status, reviewedBy, approvedBy });
    res.status(200).json({ success: true, message: 'Status updated', request: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Status update failed', error: err.message });
  }
};
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.update(id, req.body);
    res.status(200).json({ success: true, message: 'Request updated', request: result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Update failed', error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await service.remove(req.params.id);
    res.status(200).json({ success: true, message: 'Request deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Delete failed', error: err.message });
  }
};
