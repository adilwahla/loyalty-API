// src/services/v1/warrantyScan.service.js
const { WarrantyScan, User,UserRole , BrandMaster } = require('../../models');
const { toWarrantyView } = require('../../utils/warrantyTransform');
const { getWarrantyFromWP } = require('../../utils/getWarrantyFromWP');
exports.createScan = async ({ userId, timestamp, geolocation, points, productName, sku,brand, brandType, warrantyNumber }) => {
  return WarrantyScan.create({
    userId,
    timestamp,
    geoLocation: geolocation || '',
    points: points ?? '0',
    productName,
    sku: sku || '',
    brandType: brandType || '',
    brand,       // ✅ add brand
    
    warrantyNumber,            // ✅ store it
    pointType: 'direct',       // ✅ default when creating scan
    scanType: 'warranty',      // ✅ default when creating scan
  });
};


exports.getAllScans = async (filter = {}) => {
  return WarrantyScan.findAll({
    where: filter,
    include: [{
      model: User,
      as: 'user',
      attributes: ['fullName', 'role', 'phoneNumber'],
    }],
    order: [['createdAt', 'DESC']],
  });
};


exports.getUserScans = async (userId) => {
  return WarrantyScan.findAll({
    where: { userId },
    include: [{
      model: User,
      as: 'user',
      attributes: ['fullName', 'role', 'phoneNumber'],
    }],
    order: [['createdAt', 'DESC']],
  });
};


// exports.updateScanStatus = async (id, status) => {
//   const scan = await WarrantyScan.findByPk(id);
//   if (!scan) return null;

//   scan.status = status;
//   await scan.save();

//   return scan;
// };
exports.updateScanStatus = async (id, status , io) => {
  const scan = await WarrantyScan.findByPk(id);
  if (!scan) return null;

  scan.status = status;
  await scan.save();

 // 🔹 Only if approved, add points
  if (status === 'approved' && scan.userId) {
    const user = await User.findByPk(scan.userId);
    if (user) {
      const pointsToAdd = parseFloat(scan.points) || 0;

      user.points = (user.points || 0) + pointsToAdd;
      await user.save();



     // 🔹 Emit real-time points update
      io.to(user.id).emit('points_updated', { points: user.points });
      console.log(`✅ Added ${pointsToAdd} points to ${user.fullName}  New total: ${user.points}`);
    }
  }
  // ✅ Always notify the user’s devices about this scan’s new status
  io.to(scan.userId).emit('scan_status_updated', {
    id: scan.id,
    status: scan.status,                 // 'approved' | 'rejected' | 'pending'
    points: scan.points,                 // send the row points so UI can show +50/-50
    brand: scan.brand,
    brandType: scan.brandType,
    productName: scan.productName,
    timestamp: new Date().toISOString(), // for UI time
  });

  // (Optional) if you want admin tables to refresh:
  // io.emit('scan_status_changed_admin', { id: scan.id, status: scan.status });
  return scan;
};

exports.getUserTotalPoints = async (userId) => {
  const scans = await WarrantyScan.findAll({
    where: { userId, status: 'approved' }, // only approved scans count
    attributes: ['points'],
  });

  const totalPoints = scans.reduce((sum, s) => {
    const val = parseFloat(s.points) || 0;
    return sum + val;
  }, 0);

  return { userId, totalPoints, scanCount: scans.length };
};