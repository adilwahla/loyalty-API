// src/services/v1/warrantyScan.service.js
<<<<<<< HEAD
const { WarrantyScan, sequelize, User, UserRole, BrandMaster, TechnicianBusinessOwnerLink, Task } = require('../../models');
const { Op } = require('sequelize');
const customerActivationSync = require('./customerActivationTaskSync.service');
=======
const { WarrantyScan,sequelize, User,UserRole , BrandMaster ,TechnicianBusinessOwnerLink} = require('../../models');
>>>>>>> d1df119b784f3f9a83adeacd851406e5f080c6c5
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
<<<<<<< HEAD
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

async function resolveCustomerForGroup({ scannedBsgCustId, nfcValue, parentCustId, transaction, lock }) {
  if (parentCustId) {
    const row = await User.findOne({
      where: { parentCustId, role: 'BUSINESS_OWNER' },
      transaction,
      ...(lock ? { lock } : {}),
    });
    if (row) return row;
  }

  const lookup = scannedBsgCustId || nfcValue;
  if (!lookup) return null;

  return User.findOne({
    where: {
      role: 'BUSINESS_OWNER',
      [Op.or]: [{ bsgCustId: lookup }, { parentCustId: lookup }],
    },
    transaction,
    ...(lock ? { lock } : {}),
  });
}

exports.getLocationStatus = async ({ bsgCustId }) => {
  const parentFlowEnabled = isParentLocationFlowEnabled();
  if (!parentFlowEnabled) {
    const legacyCustomer = await User.findOne({
      where: { role: 'BUSINESS_OWNER', bsgCustId },
      attributes: ['bsgCustId', 'parentCustId', 'latitude', 'longitude', 'businessAddress'],
    });
    if (!legacyCustomer) return null;
    const hasLocation = legacyCustomer.latitude != null && legacyCustomer.longitude != null;
    return {
      bsgCustId,
      parentCustId: legacyCustomer.parentCustId || legacyCustomer.bsgCustId || null,
      isLocationActivated: hasLocation,
      activatedAt: null,
      latitude: legacyCustomer.latitude ?? null,
      longitude: legacyCustomer.longitude ?? null,
      mode: 'legacy',
    };
  }

  const customer = await resolveCustomerForGroup({ scannedBsgCustId: bsgCustId });
  if (!customer) return null;

  const parentCustId = customer.parentCustId || customer.bsgCustId;
  const groupAnchor = await User.findOne({
    where: {
      role: 'BUSINESS_OWNER',
      [Op.or]: [{ parentCustId }, { bsgCustId: parentCustId }],
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });

  const activated = Boolean(groupAnchor);
  return {
    bsgCustId,
    parentCustId,
    isLocationActivated: activated,
    activatedAt: null,
    latitude: groupAnchor?.latitude ?? null,
    longitude: groupAnchor?.longitude ?? null,
  };
};

exports.activateCustomerLocation = async ({
  scannedBsgCustId,
  nfcValue,
  parentCustId,
  repLat,
  repLng,
  businessAddress,
  taskId,
  activatedBy,
}) => {
  const parentFlowEnabled = isParentLocationFlowEnabled();
  const latitude = parseCoordinate(repLat);
  const longitude = parseCoordinate(repLng);
  if (latitude == null || longitude == null) {
    throw new Error('rep_lat and rep_lng are required and must be valid numbers');
  }

  return sequelize.transaction(async (transaction) => {
    if (!parentFlowEnabled) {
      const legacyCustomer = await resolveCustomerForGroup({
        scannedBsgCustId,
        nfcValue,
        parentCustId,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!legacyCustomer) throw new Error('Customer not found for provided identifier');

      const updates = { latitude, longitude };
      if (businessAddress !== undefined) updates.businessAddress = businessAddress;

      await legacyCustomer.update(updates, { transaction });

      if (taskId) {
        await Task.update(
          { taskStatus: 'Completed', completedAt: new Date(), updatedAt: new Date() },
          { where: { id: taskId }, transaction }
        );
      }

      const legacyGroupId = legacyCustomer.parentCustId || legacyCustomer.bsgCustId;
      if (legacyGroupId) {
        await customerActivationSync.completePendingActivationTasksForGroup(legacyGroupId, transaction);
      }

      return {
        alreadyActivated: false,
        parentCustId: legacyCustomer.parentCustId || legacyCustomer.bsgCustId || null,
        businessAddress: businessAddress !== undefined ? businessAddress : legacyCustomer.businessAddress || null,
        latitude,
        longitude,
        activatedBy: null,
        mode: 'legacy',
      };
    }

    const customer = await resolveCustomerForGroup({
      scannedBsgCustId,
      nfcValue,
      parentCustId,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!customer) throw new Error('Customer group not found for provided identifier');

    const groupId = customer.parentCustId || customer.bsgCustId;
    if (!groupId) throw new Error('Customer does not have bsg_cust_id/parent_cust_id');

    const groupRows = await User.findAll({
      where: {
        role: 'BUSINESS_OWNER',
        [Op.or]: [{ parentCustId: groupId }, { bsgCustId: groupId }],
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!groupRows.length) throw new Error('No accounts found under the customer group');

    const alreadyActivated = groupRows.some((row) => row.latitude != null && row.longitude != null);
    if (alreadyActivated) {
      const anchor = groupRows.find((r) => r.latitude != null && r.longitude != null) || groupRows[0];
      return {
        alreadyActivated: true,
        parentCustId: groupId,
        latitude: anchor.latitude,
        longitude: anchor.longitude,
        activatedAt: null,
        activatedBy: null,
      };
    }

    const updatePayload = {
      latitude,
      longitude,
    };
    if (businessAddress !== undefined) {
      updatePayload.businessAddress = businessAddress;
    }

    await User.update(
      updatePayload,
      {
        where: {
          role: 'BUSINESS_OWNER',
          [Op.or]: [{ parentCustId: groupId }, { bsgCustId: groupId }],
        },
        transaction,
      }
    );

    if (taskId) {
      await Task.update(
        { taskStatus: 'Completed', completedAt: new Date(), updatedAt: new Date() },
        { where: { id: taskId }, transaction }
      );
    }

    await customerActivationSync.completePendingActivationTasksForGroup(groupId, transaction);

    return {
      alreadyActivated: false,
      parentCustId: groupId,
      businessAddress: businessAddress || null,
      latitude,
      longitude,
      activatedBy: activatedBy || null,
    };
  });
};

exports.validateNfcScan = async ({ scannedNfcValue, repLat, repLng, userId }) => {
  const parentFlowEnabled = isParentLocationFlowEnabled();
  const latitude = parseCoordinate(repLat);
  const longitude = parseCoordinate(repLng);
  if (latitude == null || longitude == null) {
    throw new Error('rep_lat and rep_lng are required and must be valid numbers');
  }

  const customer = await resolveCustomerForGroup({ nfcValue: scannedNfcValue });
  if (!customer) throw new Error('Scanned NFC value does not map to a customer');

  const parentCustId = customer.parentCustId || customer.bsgCustId;
  if (!parentCustId) throw new Error('Target customer has no parent_cust_id or bsg_cust_id');

  if (!parentFlowEnabled) {
    return {
      allowed: true,
      reason: 'LEGACY_FLOW',
      parentCustId,
      enforceDistance: false,
      maxDistanceMeters: 50,
      mode: 'legacy',
    };
  }

  const anchor = await User.findOne({
    where: {
      role: 'BUSINESS_OWNER',
      [Op.or]: [{ parentCustId }, { bsgCustId: parentCustId }],
      latitude: { [Op.ne]: null },
      longitude: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });

  if (!anchor) {
    await sequelize.transaction(async (transaction) => {
      const lockedRows = await User.findAll({
        where: {
          role: 'BUSINESS_OWNER',
          [Op.or]: [{ parentCustId }, { bsgCustId: parentCustId }],
        },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
      const activatedInTx = lockedRows.some((row) => row.latitude != null && row.longitude != null);
      if (!activatedInTx) {
        await customerActivationSync.syncActivationTaskForCustomerGroup(parentCustId, {
          fallbackUserId: userId,
          transaction,
        });
      }
    });

    return {
      allowed: true,
      reason: 'NOT_ACTIVATED',
      parentCustId,
      enforceDistance: false,
      maxDistanceMeters: 50,
    };
  }

  if (anchor.latitude == null || anchor.longitude == null) {
    throw new Error('Activated customer group has no stored location');
  }

  const distance = distanceMeters(
    Number(anchor.latitude),
    Number(anchor.longitude),
    latitude,
    longitude
  );

  return {
    allowed: distance <= 50,
    reason: distance <= 50 ? 'WITHIN_RADIUS' : 'OUT_OF_RADIUS',
    parentCustId,
    enforceDistance: true,
    distanceMeters: Number(distance.toFixed(2)),
    maxDistanceMeters: 50,
    targetLocation: {
      latitude: Number(anchor.latitude),
      longitude: Number(anchor.longitude),
    },
  };
};
=======
};
>>>>>>> d1df119b784f3f9a83adeacd851406e5f080c6c5
