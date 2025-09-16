// src/controllers/v1/warrantyScan.controller.js
// ✅ Access socket.io instance
const ScanService = require('../../services/v1/warrantyScan.service');

const { getWarrantyFromWP , NotFoundError, ExternalServiceError} = require('../../utils/getWarrantyFromWP');
const { BrandMaster } = require('../../models');
const { toWarrantyView } = require('../../utils/warrantyTransform'); // ✅ Import
let batteryBrand = '-';
let batteryType = '-';
// exports.createScan = async (req, res) => {
//   try {
//     const userId = req.params.UUID;
//     const { timestamp, geolocation, points, productName, sku, brandType, warrantyNumber } = req.body;

//     if (!userId || !timestamp  || !warrantyNumber) {
//       throw new Error('userId, timestamp, warrantyNumber are required');
//     }

//     const scan = await ScanService.createScan({
//       userId, timestamp, geolocation, points, productName, sku, brandType, warrantyNumber
//     });

//     res.status(201).json({ success: true, message: 'Scan stored', data: scan });
//   } catch (err) {
//     res.status(400).json({ message: err.message });
//   }  
// };
exports.createScan = async (req, res) => {
  try {
    const userId = req.params.UUID;
    const { timestamp, geolocation, warrantyNumber } = req.body;

    console.log('🔵 Incoming Scan Request:', { userId, timestamp, warrantyNumber, geolocation });

    if (!userId || !timestamp || !warrantyNumber) {
      throw new Error('userId, timestamp, and warrantyNumber are required');
    }

    let brandType = '-';
    // let brand='-';
    let type = '-';
    let productName = '-';
    let points = '-';
    // let batteryBrand = '-';
    // let batteryType = '-';

    const rawWpData = await getWarrantyFromWP(warrantyNumber);
    console.log('✅ Raw WP Data:', rawWpData);

    const wp = toWarrantyView(rawWpData);
    console.log('✅ Transformed WP View:', wp);

    if (wp?.Brand) {
      brandType = wp.Brand;

      const brandDoc = await BrandMaster.findOne({ where: { brand: brandType } });
      if (brandDoc) {
        //  productName = `${brand.brand} ${brand.type || ''}`.trim();
        batteryBrand = brandDoc.brand;
        batteryType = String(brandDoc.type || '-');
        // brand = `${brand.brand}`;
        type = String(brandDoc.type || '-');
        points = String(brandDoc.basePoints || '-');
        console.log('✅ BrandMaster Match:', { batteryBrand, batteryType, points });
      } else {
        console.warn('⚠️ Brand not found in BrandMaster:', brandType);
      }
    } else {
      console.warn('⚠️ No Brand found in WP view.');
    }

    const scan = await ScanService.createScan({
      userId,
      timestamp,
      geolocation,
      warrantyNumber,
      brand: batteryBrand,      // ✅ store brand (Zoom)
      brandType: batteryType,   // ✅ store type (EFB)
      points,
      // batteryBrand,
      productName,
      points,


    });
    // ✅ Emit scan created event to admin clients
    const io = req.app.get('io');
    io.emit('new_scan', {
      userId,
      warrantyNumber,
      brandType,
      productName,
      batteryType,
      batteryBrand,
      points,
      timestamp,
    });
    res.status(201).json({ success: true, message: 'Warranty scan saved.', data: scan });

  } catch (err) {
    console.error('❌ Scan Creation Error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
};

// src/controllers/v1/warrantyScan.controller.js
// GET /api/v1/admin/warranty-scans?status=pending
// GET /api/v1/admin/warranty-scans?status=approved
exports.getAllScans = async (req, res) => {
  try {
    const { status } = req.query; // ✅ take status from query param

    let filter = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const scans = await ScanService.getAllScans(filter);

    const shaped = scans.map(s => ({
      id: s.id,
      timestamp: s.createdAt,
      geoLocation: s.geoLocation,
      points: s.points,
      // productName: s.productName,
      brand: s.brand,   // ✅ new field
      brandType: s.brandType, // ✅ new field
      // brand: s.brand,
      // type: s.type,
      // points: s.points,
      warrantyNumber: s.warrantyNumber,
      sku: s.sku || '-',
      brandType: s.brandType,
      warrantyNumber: s.warrantyNumber,
      status: s.status,   // ✅ include status
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      name: s.user?.fullName || '',
      role: s.user?.role || '',
      phone: s.user?.phoneNumber || '',
      pointType: s.pointType || 'direct',   // ✅ include here
      scanType: s.scanType || 'warranty',  // ✅ include here
    }));

    res.status(200).json(shaped);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};



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

    io.emit('scan_status_updated', { id, status });

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
