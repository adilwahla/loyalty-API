// controllers/v1/business_owner.controller.js
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { User } = require('../../models');
const { sendApprovalSms } = require('../../utils/sendMobishastraSms'); // <-- add this

// ✅ Feature flag (default OFF)
const APPROVAL_SMS_ENABLED = String(process.env.APPROVAL_SMS_ENABLED || 'false').toLowerCase() === 'true';

// helper: normalize KSA phone to 5xxxxxxxx
function normalizePhone(raw = '') {
  let p = String(raw).replace(/\D/g, '');
  if (p.startsWith('966') && p.length === 12) p = p.slice(3);
  else if (p.startsWith('05') && p.length === 10) p = p.slice(1);
  return p; // 5xxxxxxxx
}
const isValidKsaMobile = (p) => /^5\d{8}$/.test(p); // simple KSA check

/**
 * Admin: Approve Business Owner
 */
exports.approveBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({ status: 'APPROVED' });

    const io = req.app.get('io');
    if (io) {
      // optional: notify the owner
      io.to(String(user.id)).emit('user_status_updated', { userId: user.id, status: 'APPROVED' });

      // ✅ notify all admins so Pending/Approved tables update live
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
        rawStatus: 'APPROVED',
        status: 'Approved',
        at: new Date().toISOString(),
      });
    }

    

    res.json({ message: 'Business Owner approved', userId: user.id });

    
        // 🔔 after response, best-effort SMS in background
 if (APPROVAL_SMS_ENABLED) {
      res.on('finish', () => {
        const mobile = normalizePhone(user.phoneNumber || '');
        if (!isValidKsaMobile(mobile)) return;
        sendApprovalSms(mobile)
          .then((ok) => { if (!ok) console.warn('[SMS] approval SMS failed for', user.id, mobile); })
          .catch((e) => console.error('[SMS] unexpected error for', user.id, e.message));
      });
    }

  } catch (e) { next(e); }
};

/**
 * Admin: Reject Business Owner
 */
exports.rejectBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({ status: 'REJECTED' });

    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('bo_status_changed', {
        id: user.id,
        fullName: user.fullName ?? null,
        rawStatus: 'REJECTED',
        status: 'Rejected',
        at: new Date().toISOString(),
      });
    }

    res.json({ message: 'Business Owner rejected', userId: user.id });
  } catch (e) { next(e); }
};

/**
 * Admin: Create Business Owner
 */
exports.createBusinessOwner = async (req, res, next) => {
  try {
    let {
      phoneNumber,
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      bsgCustId,
      salesRepId,
      email,
      status,
    } = req.body;

    phoneNumber = normalizePhone(phoneNumber);
    const existing = await User.findOne({ where: { phoneNumber } });
    if (existing) return res.status(409).json({ message: 'User already registered' });

    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '1234567';
    const hashed = await bcrypt.hash(defaultPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);

    const user = await User.create({
      phoneNumber,
      role: 'BUSINESS_OWNER',
      fullName: fullName || null,
      businessName: businessName || null,
      vatNumber: vatNumber || null,
      businessAddress: businessAddress || null,
      bsgCustId: bsgCustId || null,
      salesRepId: salesRepId || null,
      email: email || null,
      password: hashed,
      isOtpVerified: true,
      status: (status ? String(status).toUpperCase() : 'APPROVED'),
    });

    const io = req.app.get('io');
    if (io) {
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
        rawStatus: user.status,
        status: user.status === 'APPROVED' ? 'Approved' : (user.status === 'PENDING' ? 'Pending' : user.status),
        at: new Date().toISOString(),
      });
    }

    res.status(201).json({ message: 'Business Owner created', user });
  } catch (e) { next(e); }
};

/**
 * Admin: Update Business Owner
 */
exports.updateBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { fullName, businessName, vatNumber, businessAddress, bsgCustId, salesRepId, email } = req.body;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({
      fullName: fullName ?? user.fullName,
      businessName: businessName ?? user.businessName,
      vatNumber: vatNumber ?? user.vatNumber,
      businessAddress: businessAddress ?? user.businessAddress,
      bsgCustId: bsgCustId ?? user.bsgCustId,
      salesRepId: salesRepId ?? user.salesRepId,
      email: email ?? user.email,
    });

    const io = req.app.get('io');
    if (io) {
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
        status: user.status === 'APPROVED' ? 'Approved' : (user.status === 'PENDING' ? 'Pending' : user.status),
        at: new Date().toISOString(),
      });
    }

    res.json({ message: 'Business Owner updated', user });
  } catch (e) { next(e); }
};

// shared list builder
function buildListOptions({ status, q, limit, offset } = {}) {
  const where = { role: 'BUSINESS_OWNER' };
  if (status) where.status = String(status).toUpperCase();

  if (q) {
    where[Op.or] = [
      { fullName:     { [Op.like]: `%${q}%` } },
      { businessName: { [Op.like]: `%${q}%` } },
      { phoneNumber:  { [Op.like]: `%${q}%` } },
      { bsgCustId:    { [Op.like]: `%${q}%` } },
      { email:        { [Op.like]: `%${q}%` } }, // only if column exists
    ];
  }

  const findOptions = {
    where,
    attributes: [
      'id','phoneNumber','fullName','businessName','vatNumber',
      'businessAddress','bsgCustId','salesRepId','status','email',
      'createdAt','updatedAt'
    ],
    order: [['createdAt', 'DESC']],
  };

  if (limit)  findOptions.limit  = parseInt(limit, 10);
  if (offset) findOptions.offset = parseInt(offset, 10);

  return findOptions;
}

exports.listBusinessOwners = async (req, res, next) => {
  try {
    const { status, q, limit, offset } = req.query;
    const opts = buildListOptions({ status, q, limit, offset });
    const users = await User.findAll(opts);
    res.json(users);
  } catch (e) { next(e); }
};

exports.listPendingBusinessOwners = async (req, res, next) => {
  try {
    const opts = buildListOptions({ status: 'PENDING', ...req.query });
    const users = await User.findAll(opts);
    res.json(users);
  } catch (e) { next(e); }
};

exports.listApprovedBusinessOwners = async (req, res, next) => {
  try {
    const opts = buildListOptions({ status: 'APPROVED', ...req.query });
    const users = await User.findAll(opts);
    res.json(users);
  } catch (e) { next(e); }
};



