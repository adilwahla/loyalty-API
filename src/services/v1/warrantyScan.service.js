// src/services/v1/warrantyScan.service.js
const { WarrantyScan,sequelize, User,UserRole , BrandMaster ,TechnicianBusinessOwnerLink} = require('../../models');
const { toWarrantyView } = require('../../utils/warrantyTransform');
const { getWarrantyFromWP } = require('../../utils/getWarrantyFromWP');
const { emitAnalytics } = require('../../utils/analytics.emit');
class DuplicateScanError extends Error {
  constructor(msg = 'Duplicate scan not allowed') {
    super(msg);
    this.name = 'DuplicateScanError';
    this.code = 'DUPLICATE';
    this.http = 409;
  }
}
exports.DuplicateScanError = DuplicateScanError;



exports.createScan = async ({ userId, timestamp, geolocation, points, productName, sku,brand, brandType, warrantyNumber }) => {

  // 🔒 Check duplicate warranty number (GLOBAL uniqueness)
  const existing = await WarrantyScan.findOne({ where: { warrantyNumber } });
  if (existing) {
    const err = new Error('Duplicate scan not allowed');
    err.code = 'DUPLICATE_SCAN';
    err.http = 409;
    throw err;
  }


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


exports.getAllScans = (opts = {}) => {
  const {
    where = {},
    include = [{
      model: User,
      as: 'user',
      attributes: ['fullName','role','phoneNumber','salesRepId'],
      required: true,
    }],
    order = [['createdAt','DESC']],
    limit,
    offset,
  } = opts;

  return WarrantyScan.findAll({
    where,
    include,
    order,
    ...(limit ? { limit } : {}),
    ...(offset ? { offset } : {}),
  });
};


// // src/services/v1/warrantyScan.service.js
// exports.getAllScansPaginated = async ({ where, include, order, limit, offset }) => {
//   return WarrantyScan.findAndCountAll({
//     where,
//     include,
//     order,
//     limit,
//     offset,
//   });
// };


exports.findByIdWithUser = (id) =>
  WarrantyScan.findByPk(id, {
    include: [{ model: User, as: 'user', attributes: ['id','salesRepId'] }],
  });



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
    var pointsToAdd ; // default
  const scan = await WarrantyScan.findByPk(id);
  if (!scan) return null;

  scan.status = status;
  await scan.save();

 // 🔹 Only if approved, add points
  if (status === 'approved' && scan.userId) {
    const user = await User.findByPk(scan.userId);
    if (user) {
       pointsToAdd = parseFloat(scan.points) || 0;

      user.points = (user.points || 0) + pointsToAdd;
      await user.save();



     // 🔹 Emit real-time points update
      io.to(user.id).emit('points_updated', { points: user.points });
       // ... update status to APPROVED/REJECTED ...
      // if (io) emitAnalytics(io);
      console.log(`✅ Added ${pointsToAdd} points to ${user.fullName}  New total: ${user.points}`);
    }



  // 🔻 NEW: if the scan owner is a TECHNICIAN and has an ACTIVE link,
      // credit the linked Business Owner with techPoints × shareFactor
  // 🔻 If scan owner is a TECHNICIAN and has an ACTIVE link, credit linked Business Owner
      if (user.role === 'TECHNICIAN') {
        const link = await TechnicianBusinessOwnerLink.findOne({
          where: { technicianId: user.id, status: 'ACTIVE' },
        });

        if (link && link.businessOwnerId) {
          const owner = await User.findByPk(link.businessOwnerId);
          if (owner) {
            const shareFactor = Number(link.shareFactor) || 0; // e.g., 0.20 = 20%
            const boShare = Math.round(pointsToAdd * shareFactor); // policy: round to int

            if (boShare > 0) {
              owner.points = (Number(owner.points) || 0) + boShare;
              await owner.save();

              // 🔊 Live update for the linked Business Owner
              io.to(`${owner.id}`).emit('points_updated', {
                userId: owner.id,
                points: owner.points,
                fromTechnicianId: user.id,
                share: boShare,
              });

              console.log(
                `🏢 BO share: +${boShare} to ${owner.fullName} (factor ${shareFactor} × tech ${pointsToAdd}) → total ${owner.points}`
              );
            }
          }
        }
      }
      // 🔺 END NEW

  }
  // ✅ Always notify the user’s devices about this scan’s new status
  // ✅ Targeted event, now includes userId and explicit scanId


  
  if (scan.userId) {
    io.to(`${scan.userId}`).emit('scan_status_updated', {
    userId: scan.userId,            // <-- add this so client filter passes
     scanId: scan.id,                // <-- explicit
      id: scan.id,                    // keep for backward compatibility
      status: scan.status,
      points: scan.points,
      brand: scan.brand,
      brandType: scan.brandType,
      productName: scan.productName,
      timestamp: new Date().toISOString(),
    });
  }
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
