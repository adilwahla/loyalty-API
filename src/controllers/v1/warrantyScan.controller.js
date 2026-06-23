// src/controllers/v1/warrantyScan.controller.js
// ✅ Access socket.io instance
const { fn, col, where: sqlWhere } = require('sequelize');
const ScanService = require('../../services/v1/warrantyScan.service');
const { User } = require('../../models'); // ✅ ADD THIS LINE

const { getWarrantyFromWP , NotFoundError, ExternalServiceError} = require('../../utils/getWarrantyFromWP');
const { emitAnalytics } = require('../../utils/analytics.emit');
const { BrandMaster } = require('../../models');
const { toWarrantyView } = require('../../utils/warrantyTransform'); // ✅ Import
const { LubricantSerialCode, Product } = require('../../models');
let batteryBrand = '-';
let batteryType = '-';


exports.createScan = async (req, res) => {
  const io = req.app.get('io');
  try {
    const userId = req.params.UUID;
    const { timestamp, geolocation, warrantyNumber } = req.body;

    console.log('🔵 Incoming Scan Request:', { userId, timestamp, warrantyNumber, geolocation });

    if (!userId || !timestamp || !warrantyNumber) {
      throw new Error('userId, timestamp, and warrantyNumber are required');
    }

    const code = warrantyNumber;

    let brandType = '-';
    let type = '-';
    let productName = '-';
    let points = '-';
    let scanType = 'warranty';
    let sku = null;

    //--------------------------------------------------
    // 1️⃣ WARRANTY CHECK FIRST (PRIORITY)
    //--------------------------------------------------

    let wp = null;

    try {
      const rawWpData = await getWarrantyFromWP(code);
      console.log('✅ Raw WP Data:', rawWpData);

      wp = toWarrantyView(rawWpData);
      console.log('✅ Transformed WP View:', wp);
    } catch (err) {
      if (err instanceof NotFoundError) {
        console.log('⚠️ Warranty not found → checking lubricant codes');
      } else {
        throw err;
      }
    }

    //--------------------------------------------------
    // 2️⃣ WARRANTY FLOW
    //--------------------------------------------------

    if (wp) {
      if (wp?.Brand) {
        brandType = wp.Brand;

        const brandDoc = await BrandMaster.findOne({
          where: { brand: brandType }
        });

        if (brandDoc) {
          batteryBrand = brandDoc.brand;
          batteryType = String(brandDoc.type || '-');
          type = String(brandDoc.type || '-');
          points = String(brandDoc.basePoints || '-');

          console.log('✅ BrandMaster Match:', { batteryBrand, batteryType, points });
        } else {
          console.warn('⚠️ Brand not found in BrandMaster:', brandType);
        }
      }

      scanType = 'warranty';
    }

    //--------------------------------------------------
    // 3️⃣ LUBRICANT FLOW (IF WARRANTY NOT FOUND)
    //--------------------------------------------------

    else {
      const serial = await LubricantSerialCode.findOne({
        where: { serial_code: code }
      });

      if (!serial) {
        throw new Error('Invalid QR Code');
      }

 if (serial.status === 'scanned') {

  const product = await Product.findOne({
    where: {
      sku: serial.bsg_code,
      status: 'Published'
    }
  });

  return res.status(200).json({
    success: false,
    type: "lubricant",
    message: "Already scanned",
    product: {
      title: product?.title || '',
      nameArabic: product?.nameArabic || ''
    },
    duplicate: true,
    genuine: true
  });
}

      const product = await Product.findOne({
        where: {
          sku: serial.bsg_code,
          status: 'Published'
        }
      });

      if (!product) {
        throw new Error('Product not available');
      }

      productName = product.title;
      batteryBrand = product.title;
      batteryType = product.units || '-';
      brandType = product.units || '-';
      sku = product.sku;
      points = product.basePoints || 0;

      scanType = 'lubricant';

      await serial.update({
        status: 'scanned',
        scanned_by: userId,
        scanned_at: new Date()
      });

      console.log('🟢 Lubricant QR matched:', { sku, productName, points });
    }

    //--------------------------------------------------
    // 4️⃣ SAVE SCAN
    //--------------------------------------------------

    const scan = await ScanService.createScan({
      userId,
      timestamp,
      geolocation,
      warrantyNumber: code,
      brand: batteryBrand,
      brandType: batteryType,
      sku,
      productName,
      points,
      scanType,
    });
//--------------------------------------------------
// 4️⃣.1 AUTO APPROVE LUBRICANT SCANS
//--------------------------------------------------

if (scanType === "lubricant") {
  await ScanService.updateScanStatus(scan.id, "approved", io);
}
    //--------------------------------------------------
    // 5️⃣ SOCKET EVENTS
    //--------------------------------------------------

   // const io = req.app.get('io');

    const owner = await User.findByPk(userId, {
      attributes: ['id', 'salesRepId'],
      raw: true,
    });

    const repKey = owner?.salesRepId;

    const payload = {
      userId,
      warrantyNumber: code,
      brandType,
      productName,
      batteryType,
      batteryBrand,
      sku,
      points,
      scanType,
      timestamp: scan.createdAt || timestamp,
    };

    io.to('role:SUPER_ADMIN').emit('new_scan', payload);
    io.to('role:ADMIN').emit('new_scan', payload);
    if (repKey) io.to(`rep:${repKey}`).emit('new_scan', payload);

    io.to(String(userId)).emit('new_scan', payload);

    console.log('📡 Emitted new_scan:', payload);

    //--------------------------------------------------
    // 6️⃣ RESPONSE
    //--------------------------------------------------

 //--------------------------------------------------
// 6️⃣ RESPONSE
//--------------------------------------------------

if (scanType === 'lubricant') {
  return res.status(201).json({
    success: true,
    type: "lubricant",
    message: "Genuine Product",
    product: {
      title: productName,
      nameArabic: productName
    },
    pointsAwarded: points
  });
}

return res.status(201).json({
  success: true,
  type: "warranty",
  message: "Warranty scan saved.",
  data: scan
});

  } catch (err) {
    console.error('❌ Scan Creation Error:', err.message);

    if (err.code === 'DUPLICATE_SCAN') {
    return res.status(200).json({
      success: false,
      code: "DUPLICATE",
      message: "Duplicate scan not allowed"
    });
    }

    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};



// GUEST SCAN (NO AUTH) - CHECKS
// GET /api/v1/guest/scan/:code
// Public endpoint — no auth required
exports.guestScan = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ success: false, message: 'QR code is required' });
    }

    const serial = await LubricantSerialCode.findOne({
      where: { serial_code: code }
    });

    if (!serial) {
      return res.status(200).json({
        success: true,
        genuine: false,
        message: 'The product is not genuine'
      });
    }

    // Optionally fetch product name to enrich the response
    const product = await Product.findOne({
      where: { sku: serial.bsg_code, status: 'Published' }
    });

    return res.status(200).json({
      success: true,
      genuine: true,
      message: 'Genuine Product',
      product: {
        title: product?.title || '',
        nameArabic: product?.nameArabic || ''
      }
    });

  } catch (err) {
    console.error('❌ guestScan error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
// exports.createScan = async (req, res) => {
//   try {
//     const userId = req.params.UUID;
//     const { timestamp, geolocation, warrantyNumber } = req.body; 

//     console.log('🔵 Incoming Scan Request:', { userId, timestamp, warrantyNumber, geolocation });

//     if (!userId || !timestamp || !warrantyNumber) {
//       throw new Error('userId, timestamp, and warrantyNumber are required');
//     }
//   // ✅ Step 1: Check if warrantyNumber already exists in WarrantyScan
//   // const existing = await WarrantyScan.findOne({
//   //   where: { warrantyNumber },  // or { userId, warrantyNumber } if you want per-user uniqueness
//   // });

//   // if (existing) {
//   //   // ✅ Duplicate found → throw error (controller will return 409)
//   //   const err = new Error('Duplicate scan not allowed');
//   //   err.code = 'DUPLICATE_SCAN';
//   //   err.http = 409;
//   //   throw err;
//   // }
//     let brandType = '-';
//     // let brand='-';
//     let type = '-';
//     let productName = '-';
//     let points = '-';
//     // let batteryBrand = '-';
//     // let batteryType = '-';

//     const rawWpData = await getWarrantyFromWP(warrantyNumber);
//     console.log('✅ Raw WP Data:', rawWpData);

//     const wp = toWarrantyView(rawWpData);
//     console.log('✅ Transformed WP View:', wp);

//     if (wp?.Brand) {
//       brandType = wp.Brand;

//       const brandDoc = await BrandMaster.findOne({ where: { brand: brandType } });
//       if (brandDoc) {
//         //  productName = `${brand.brand} ${brand.type || ''}`.trim();
//         batteryBrand = brandDoc.brand;
//         batteryType = String(brandDoc.type || '-');
//         // brand = `${brand.brand}`;
//         type = String(brandDoc.type || '-');
//         points = String(brandDoc.basePoints || '-');
//         console.log('✅ BrandMaster Match:', { batteryBrand, batteryType, points });
//       } else {
//         console.warn('⚠️ Brand not found in BrandMaster:', brandType);
//       }
//     } else {
//       console.warn('⚠️ No Brand found in WP view.');
//     }

//     const scan = await ScanService.createScan({
//       userId,
//       timestamp,
//       geolocation,
//       warrantyNumber,
//       brand: batteryBrand,      // ✅ store brand (Zoom)
//       brandType: batteryType,   // ✅ store type (EFB)
//       points,
//       // batteryBrand,
//       productName,
//       points,


//     });
//     // ✅ Emit scan created event to admin clients
//     const io = req.app.get('io');
    
//  // get owner details (the one who submitted the scan)
// const owner = await User.findByPk(userId, {
//   attributes: ['id', 'salesRepId'],
//   raw: true,
// });

// // safely extract the repKey
// const repKey = owner?.salesRepId;

// // build the minimal payload you want
// const payload = {
//   userId,
//   warrantyNumber,
//   brandType,
//   productName,
//   batteryType,
//   batteryBrand,
//   points,
//   timestamp: scan.createdAt || timestamp, // ✅ use DB timestamp if available
// };

// // broadcast to all relevant rooms
// io.to('role:SUPER_ADMIN').emit('new_scan', payload);
// io.to('role:ADMIN').emit('new_scan', payload);
// if (repKey) io.to(`rep:${repKey}`).emit('new_scan', payload);

// // optional: send to the user who scanned it (for mobile app real-time update)
// io.to(String(userId)).emit('new_scan', payload);

// console.log('📡 Emitted new_scan:', payload);
//     res.status(201).json({ success: true, message: 'Warranty scan saved.', data: scan });

//   } catch (err) {
//     console.error('❌ Scan Creation Error:', err.message);
//   if (err.code === 'DUPLICATE_SCAN') {
//       return res.status(409).json({ success: false, message: 'Duplicate scan not allowed' });
//     }

//     res.status(400).json({ success: false, message: err.message });
//   }
// };
// exports.createScan = async (req, res) => {
//   try {
//     const userId = req.params.UUID;
//     const { timestamp, geolocation, warrantyNumber } = req.body; 

//     console.log('🔵 Incoming Scan Request:', { userId, timestamp, warrantyNumber, geolocation });

//     if (!userId || !timestamp || !warrantyNumber) {
//       throw new Error('userId, timestamp, and warrantyNumber are required');
//     }

//     let brandType = '-';
//     // let brand='-';
//     let type = '-';
//     let productName = '-';
//     let points = '-';
//     // let batteryBrand = '-';
//     // let batteryType = '-';

//     const rawWpData = await getWarrantyFromWP(warrantyNumber);
//     console.log('✅ Raw WP Data:', rawWpData);

//     const wp = toWarrantyView(rawWpData);
//     console.log('✅ Transformed WP View:', wp);

//     if (wp?.Brand) {
//       brandType = wp.Brand;

//       const brandDoc = await BrandMaster.findOne({ where: { brand: brandType } });
//       if (brandDoc) {
//         //  productName = `${brand.brand} ${brand.type || ''}`.trim();
//         batteryBrand = brandDoc.brand;
//         batteryType = String(brandDoc.type || '-');
//         // brand = `${brand.brand}`;
//         type = String(brandDoc.type || '-');
//         points = String(brandDoc.basePoints || '-');
//         console.log('✅ BrandMaster Match:', { batteryBrand, batteryType, points });
//       } else {
//         console.warn('⚠️ Brand not found in BrandMaster:', brandType);
//       }
//     } else {
//       console.warn('⚠️ No Brand found in WP view.');
//     }

//     const scan = await ScanService.createScan({
//       userId,
//       timestamp,
//       geolocation,
//       warrantyNumber,
//       brand: batteryBrand,      // ✅ store brand (Zoom)
//       brandType: batteryType,   // ✅ store type (EFB)
//       points,
//       // batteryBrand,
//       productName,
//       points,


//     });
//     // ✅ Emit scan created event to admin clients
//     const io = req.app.get('io');
    
//     io.emit('new_scan', {
//       userId,
//       warrantyNumber,
//       brandType,
//       productName,
//       batteryType,
//       batteryBrand,
//       points,
//       timestamp,
//     });
//       //  if (io) emitAnalytics(io);
//     res.status(201).json({ success: true, message: 'Warranty scan saved.', data: scan });

//   } catch (err) {
//     console.error('❌ Scan Creation Error:', err.message);
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// src/controllers/v1/warrantyScan.controller.js
// GET /api/v1/admin/warranty-scans?status=pending
// GET /api/v1/admin/warranty-scans?status=approved


/**
 * 
 * Use the enhanced getAllScans below with Sales Rep scoping
 */
// src/controllers/v1/warrantyScan.controller.js



const VALID = ['pending','approved','rejected'];

exports.getAllScans = async (req, res) => {
  try {
    const s = String(req.query.status || '').toLowerCase();
    const where = {};
    if (VALID.includes(s)) where.status = s;

    // Base include (join the scanning user)
    let include = [{
      model: User,
      as: 'user',
      attributes: ['id','fullName','role','phoneNumber','salesRepId'],
      required: true,
    }];

    // 🔒 Sales Rep scope: compare to the code stored on BO/Tech (e.g., "S1")
    if (req.user.role === 'SALES_REP') {
      // Prefer embedding the rep code in the JWT as salesRepKey
      let repKey = req.user.salesRepKey;

      // Fallback: read SR’s own salesRepId from DB (must be the same value BO/Tech store)
      if (!repKey) {
        const me = await User.findByPk(req.user.id, { attributes: ['salesRepId'], raw: true });
        repKey = me?.salesRepId || '';   // e.g., "S1"
      }
      if (!repKey) return res.json([]);

      // If casing might vary in DB, use LOWER(); otherwise use { salesRepId: repKey } for speed.
       // === Fix A: attribute mapping (preferred) ===
      include = [{ ...include[0], where: { salesRepId: repKey } }];
    }
const limit = Math.min(Number(req.query.limit) || 1000); // max 1000
const offset = Number(req.query.offset || 0);
   const scans = await ScanService.getAllScans({
  where,
  include,
  order: [['createdAt', 'DESC']],
  limit,
  offset,
});

    res.json(scans.map((s) => ({
      id: s.id,
      timestamp: s.createdAt,
      geoLocation: s.geoLocation,
      points: s.points,
      brand: s.brand,
      brandType: s.brandType,
      warrantyNumber: s.warrantyNumber,
      sku: s.sku || '-',
      status: s.status,
      name: s.user?.fullName || '',
      role: s.user?.role || '',
      phone: s.user?.phoneNumber || '',
      pointType: s.pointType || 'direct',
      scanType: s.scanType || 'warranty',
    })));
  } catch (err) {
    console.error('getAllScans error:', err?.name, err?.message);
    res.status(500).json({ message: err?.message || 'Internal error' });
  }
};










// exports.getAllScans = async (req, res) => {
//   try {
//     const { status } = req.query; // ✅ take status from query param

//     let filter = {};
//     if (status && ['pending', 'approved', 'rejected'].includes(status)) {
//       filter.status = status;
//     }

//     const scans = await ScanService.getAllScans(filter);

//     const shaped = scans.map(s => ({
//       id: s.id,
//       timestamp: s.createdAt,
//       geoLocation: s.geoLocation,
//       points: s.points,
//       // productName: s.productName,
//       brand: s.brand,   // ✅ new field
//       brandType: s.brandType, // ✅ new field
//       // brand: s.brand,
//       // type: s.type,
//       // points: s.points,
//       warrantyNumber: s.warrantyNumber,
//       sku: s.sku || '-',
//       brandType: s.brandType,
//       warrantyNumber: s.warrantyNumber,
//       status: s.status,   // ✅ include status
//       createdAt: s.createdAt,
//       updatedAt: s.updatedAt,
//       name: s.user?.fullName || '',
//       role: s.user?.role || '',
//       phone: s.user?.phoneNumber || '',
//       pointType: s.pointType || 'direct',   // ✅ include here
//       scanType: s.scanType || 'warranty',  // ✅ include here
//     }));

//     res.status(200).json(shaped);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };



exports.getUserScans = async (req, res) => {
  try {
    const scans = await ScanService.getUserScans(req.params.UUID);
    res.status(200).json(scans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



// GET /api/v1/admin/warranty-scans/wp/:warrantyNumber
exports.getWarrantyData = async (req, res) => {
  try {
    const { warrantyNumber } = req.params;
    const raw = await getWarrantyFromWP(warrantyNumber);
    const wpData = toWarrantyView(raw);
    return res.status(200).json(wpData);
  } catch (err) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ success: false, code: 'WARRANTY_NOT_FOUND', message: 'No record found for this warranty number.' });
    }
    if (err instanceof ExternalServiceError) {
      return res.status(503).json({ success: false, code: 'UPSTREAM_UNAVAILABLE', message: 'Warranty datasource temporarily unavailable.' });
    }
    console.error('❌ getWarrantyData unexpected:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};




// PUT /api/v1/admin/warranty-scans/:id/status
exports.updateScanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // "approved" | "rejected"
    const io = req.app.get('io');

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const updated = await ScanService.updateScanStatus(id, status , io);

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }

    // Emit socket event so admins/users see the approval in real-time

    // io.emit('scan_status_updated', { id, status });

    res.status(200).json({ success: true, message: `Scan ${status}`, data: updated });
  } catch (err) {
    console.error('❌ updateScanStatus error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};



// GET /api/v1/mobile/:UUID/points
exports.getUserTotalPoints = async (req, res) => {
  try {
    const { UUID } = req.params;
    const result = await ScanService.getUserTotalPoints(UUID);

    res.status(200).json({
      success: true,
      message: 'User points accumulated successfully',
      data: result,
    });
  } catch (err) {
    console.error('❌ getUserTotalPoints error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getLocationStatus = async (req, res) => {
  try {
    const { bsg_cust_id: bsgCustId } = req.params;
    if (!bsgCustId) {
      return res.status(400).json({ success: false, message: 'bsg_cust_id is required' });
    }

    const status = await ScanService.getLocationStatus({ bsgCustId });
    if (!status) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    return res.status(200).json({ success: true, data: status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.activateCustomerLocation = async (req, res) => {
  try {
    const {
      scanned_bsg_cust_id: scannedBsgCustId,
      nfc_value: nfcValue,
      parent_cust_id: parentCustId,
      rep_lat: repLat,
      rep_lng: repLng,
      business_address: businessAddress,
      task_id: taskId,
    } = req.body || {};

    const result = await ScanService.activateCustomerLocation({
      scannedBsgCustId,
      nfcValue,
      parentCustId,
      repLat,
      repLng,
      businessAddress,
      taskId,
      activatedBy: req.user?.id || null,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyActivated ? 'Location already activated' : 'Location activated successfully',
      data: result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.validateNfcScan = async (req, res) => {
  try {
    const { scanned_nfc_value: scannedNfcValue, rep_lat: repLat, rep_lng: repLng } = req.body || {};
    if (!scannedNfcValue) {
      return res.status(400).json({ success: false, message: 'scanned_nfc_value is required' });
    }

    const result = await ScanService.validateNfcScan({
      scannedNfcValue,
      repLat,
      repLng,
      userId: req.user?.id || null,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
