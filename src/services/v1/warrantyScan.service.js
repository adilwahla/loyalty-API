// src/services/v1/warrantyScan.service.js
const { WarrantyScan, sequelize, User, UserRole, BrandMaster, TechnicianBusinessOwnerLink, Task } = require('../../models');
const { Op } = require('sequelize');
const customerActivationSync = require('./customerActivationTaskSync.service');
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

function parseCoordinate(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isParentLocationFlowEnabled() {
  return String(process.env.ENABLE_PARENT_LOCATION_FLOW || 'false').toLowerCase() === 'true';
}

function toRad(v) {
  return (v * Math.PI) / 180;
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function resolveBusinessOwnerByBsgCustId({ scannedBsgCustId, nfcValue, transaction, lock }) {
  const lookup = scannedBsgCustId || nfcValue;
  if (!lookup) return null;

  return User.findOne({
    where: {
      role: 'BUSINESS_OWNER',
      bsgCustId: lookup,
    },
    transaction,
    ...(lock ? { lock } : {}),
  });
}

/**
 * Enrolls (first scan, no serial on file) or verifies (serial already on file) the
 * physical tag's hardware serial number against the customer record.
 * Must run inside the same transaction/lock as the rest of the activation logic.
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
    throw err;
  }
}


exports.getLocationStatus = async ({ bsgCustId }) => {
  const customer = await User.findOne({
    where: { role: 'BUSINESS_OWNER', bsgCustId },
    attributes: ['bsgCustId', 'parentCustId', 'latitude', 'longitude', 'businessAddress'],
  });
  if (!customer) return null;

  const hasLocation = customer.latitude != null && customer.longitude != null;
  return {
    bsgCustId,
    parentCustId: customer.parentCustId || null,
    isLocationActivated: hasLocation,
    activatedAt: null,
    latitude: customer.latitude ?? null,
    longitude: customer.longitude ?? null,
    mode: 'legacy',
  };
};

async function completeActivationTask({ taskId, bsgCustId, transaction }) {
  if (taskId) {
    await Task.update(
      { taskStatus: 'Completed', completedAt: new Date(), updatedAt: new Date() },
      { where: { id: taskId }, transaction }
    );
  }

  await customerActivationSync.completePendingActivationTasksForBsgCustId(bsgCustId, transaction);
}

async function loadCompletedActivationTask({ taskId, bsgCustId, transaction }) {
  if (taskId) {
    return Task.findByPk(taskId, { transaction });
  }
  if (!bsgCustId) return null;
  return Task.findOne({
    where: {
      customerId: bsgCustId,
      taskStatus: 'Completed',
      taskTitle: { [Op.in]: customerActivationSync.ACTIVATION_TASK_TITLES },
    },
    order: [['completedAt', 'DESC']],
    transaction,
  });
}

exports.activateCustomerLocation = async ({
  scannedBsgCustId,
  nfcValue,
  nfcSerialNumber,        // ← NEW param
  repLat,
  repLng,
  businessAddress,
  taskId,
  activatedBy,
}) => {
  const latitude = parseCoordinate(repLat);
  const longitude = parseCoordinate(repLng);
  if (latitude == null || longitude == null) {
    throw new Error('rep_lat and rep_lng are required and must be valid numbers');
  }

  return sequelize.transaction(async (transaction) => {
    const customer = await resolveBusinessOwnerByBsgCustId({
      scannedBsgCustId,
      nfcValue,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!customer) throw new Error('Customer not found for provided identifier');
    if (!customer.bsgCustId) throw new Error('Customer does not have bsg_cust_id');

 // ← NEW: enroll-or-verify happens right after we lock the row, before anything else
    await verifyOrEnrollNfcSerialNumber({ customer, scannedSerial: nfcSerialNumber, transaction });


    const alreadyActivated = customer.latitude != null && customer.longitude != null;
    if (alreadyActivated) {
      await completeActivationTask({
        taskId,
        bsgCustId: customer.bsgCustId,
        transaction,
      });

      return {
        alreadyActivated: true,
        bsgCustId: customer.bsgCustId,
        parentCustId: customer.parentCustId || null,
        latitude: customer.latitude,
        longitude: customer.longitude,
        activatedAt: null,
        activatedBy: null,
        taskStatus: 'Completed',
        taskCompleted: true,
        taskId: taskId || null,
      };
    }

    const updates = { latitude, longitude };
    if (businessAddress !== undefined) updates.businessAddress = businessAddress;

    await customer.update(updates, { transaction });

    await completeActivationTask({
      taskId,
      bsgCustId: customer.bsgCustId,
      transaction,
    });

    return {
      alreadyActivated: false,
      bsgCustId: customer.bsgCustId,
      parentCustId: customer.parentCustId || null,
      businessAddress: businessAddress !== undefined ? businessAddress : customer.businessAddress || null,
      latitude,
      longitude,
      activatedBy: activatedBy || null,
      taskStatus: 'Completed',
      taskCompleted: true,
      taskId: taskId || null,
    };
  });
};

exports.loadCompletedActivationTask = loadCompletedActivationTask;

exports.validateNfcScan = async ({ scannedNfcValue, nfcSerialNumber, repLat, repLng, userId, taskId }) => {
  const parentFlowEnabled = isParentLocationFlowEnabled();
  const latitude = parseCoordinate(repLat);
  const longitude = parseCoordinate(repLng);
  if (latitude == null || longitude == null) {
    throw new Error('rep_lat and rep_lng are required and must be valid numbers');
  }

  const customer = await resolveBusinessOwnerByBsgCustId({ nfcValue: scannedNfcValue });
  if (!customer) throw new Error('Scanned NFC value does not map to a customer');

 // ← NEW: lock + enroll/verify before anything else
  await sequelize.transaction(async (transaction) => {
    const locked = await User.findByPk(customer.id, { lock: transaction.LOCK.UPDATE, transaction });
    await verifyOrEnrollNfcSerialNumber({ customer: locked, scannedSerial: nfcSerialNumber, transaction });
  });


  const bsgCustId = customer.bsgCustId;
  const parentCustId = customer.parentCustId || customer.bsgCustId;

  if (!parentFlowEnabled) {
    await sequelize.transaction(async (transaction) => {
      await completeActivationTask({ taskId, bsgCustId, transaction });
    });

    return {
      allowed: true,
      reason: 'LEGACY_FLOW',
      bsgCustId,
      parentCustId,
      enforceDistance: false,
      maxDistanceMeters: 50,
      mode: 'legacy',
      taskStatus: 'Completed',
      taskCompleted: true,
      taskId: taskId || null,
    };
  }

  const hasLocation = customer.latitude != null && customer.longitude != null;

  if (!hasLocation) {
    await sequelize.transaction(async (transaction) => {
      const lockedCustomer = await User.findByPk(customer.id, {
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
      const activatedInTx =
        lockedCustomer?.latitude != null && lockedCustomer?.longitude != null;
      if (!activatedInTx) {
        await customerActivationSync.syncActivationTaskForBusinessOwner(customer.id, {
          fallbackUserId: userId,
          transaction,
        });
      }
    });

    return {
      allowed: true,
      reason: 'NOT_ACTIVATED',
      bsgCustId,
      parentCustId,
      enforceDistance: false,
      maxDistanceMeters: 50,
    };
  }

  const distance = distanceMeters(
    Number(customer.latitude),
    Number(customer.longitude),
    latitude,
    longitude
  );

  const allowed = distance <= 50;

  if (allowed) {
    await sequelize.transaction(async (transaction) => {
      await completeActivationTask({ taskId, bsgCustId, transaction });
    });
  }

  return {
    allowed,
    reason: allowed ? 'WITHIN_RADIUS' : 'OUT_OF_RADIUS',
    bsgCustId,
    parentCustId,
    enforceDistance: true,
    distanceMeters: Number(distance.toFixed(2)),
    maxDistanceMeters: 50,
    targetLocation: {
      latitude: Number(customer.latitude),
      longitude: Number(customer.longitude),
    },
    taskStatus: allowed ? 'Completed' : undefined,
    taskCompleted: allowed,
    taskId: allowed ? (taskId || null) : null,
  };
};
