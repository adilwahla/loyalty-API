const RedemptionService = require('../../services/v1/warrantyRedemption.service');

exports.createRedemption = async (req, res) => {
  try {
    const userId = req.params.UUID;
    const {
      name,
      role,
      phone,
      rewards,
      requestDate,
      location,
      requiredPoints,        // ✅ accept from client (number) OR compute in service
       pointsAccumulated = '0' // ✅ Default to 0 if not provided
    } = req.body;

    if (!name || !role || !phone || !rewards || !requestDate || !location ) {
      throw new Error('All fields are required');
    }

    const io = req.app.get('io'); // ✅ Get socket instance

    const result = await RedemptionService.createRedemption({
      userId,
      name,
      role,
      phone,
      rewards,
      requiredPoints,        // ✅ accept from client (number) OR compute in service
      pointsAccumulated, // ✅ Pass to service,
      requestDate,
      location
    }, io); // ✅ pass io here

    res.status(200).json({
      success: true,
      message: 'Redemption request submitted successfully',
      data: result
    });

  } catch (err) {
    console.error('[CREATE REDEMPTION ERROR]', err.message);
    res.status(400).json({ message: err.message });
  }
};



exports.approveOrReject = async (req, res) => {
  try {
    const redemptionId = req.params.UUID;
    const { status } = req.body; // "APPROVED" | "REJECTED"

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new Error('Invalid status');
    }

    const io = req.app.get('io');

    const updated = await RedemptionService.approveOrReject({
      user: req.user,  // optional; keep for RBAC later
      redemptionId,
      status,
    }, io);

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error('[APPROVE/REJECT ERROR]', err.message);
    res.status(400).json({ message: err.message });
  }
};
exports.getAllRedemptions = async (req, res) => {

  try {
    const list = await RedemptionService.getAllRedemptions();
    res.status(200).json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// exports.createRedemption = async (req, res) => {
//   try {
//     const userId = String(req.params.UUID);
//     const {
//       name, role, phone, rewards,
//       requiredPoints,                // <— sent by app
//       requestDate, location,
//       pointsAccumulated = '0',
//     } = req.body;

//     // quick validation
//     if (!userId || !name || !role || !phone || !rewards || !requestDate || !location) {
//       return res.status(400).json({ success: false, message: 'Missing required fields' });
//     }

//     const io = req.app.get('io');

//     const { redemption, totalPoints } = await service.createRedemption(
//       {
//         userId, name, role, phone, rewards,
//         requiredPoints, requestDate, location, pointsAccumulated,
//       },
//       io
//     );

//     return res.status(200).json({
//       success: true,
//       message: 'Redemption request submitted successfully',
//       data: redemption,
//       totalPoints,       // new user balance
//     });
//   } catch (err) {
//     console.error('[createRedemption]', err);
//     // if you ever throw, make sure to send JSON, not hang → avoids client timeout
//     return res.status(500).json({ success: false, message: err.message || 'Server error' });
//   }
// };

// exports.approveOrReject = async (req, res) => {
//   try {
//     const io = req.app.get('io');                 // ← get socket instance
//     const result = await RedemptionService.approveOrReject({
//       user: req.user,
//       redemptionId,
//       status
//     }, io);                                       // ← pass io

//     return res.status(200).json({ success: true, ...result });
//   } catch (err) { /* ... */ }
// };


// exports.getAllRedemptions = async (req, res) => {

//   try {
//     const list = await RedemptionService.getAllRedemptions();
//     res.status(200).json(list);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };
