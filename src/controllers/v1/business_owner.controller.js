// controllers/v1/business_owner.controller.js

const { Op } = require('sequelize');

const bcrypt = require('bcryptjs');

// دمج النسختين: دعم Group و scopeBusinessOwners

const { User, Group } = require('../../models');

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

      io.to(String(user.id)).emit('user_status_updated', { userId: user.id, status: 'APPROVED' });

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

      latitude,

      longitude,

      bsgCustId,

      salesRepId,

      email,

      status,

      groupId,

    } = req.body;
 
    phoneNumber = normalizePhone(phoneNumber);
 
    const parsedGroupId = groupId ? parseInt(groupId, 10) : null;
 
    // Allow duplicate phone numbers for BUSINESS_OWNER role with different bsgCustId/groupId

    const existingExact = await User.findOne({

      where: {

        phoneNumber,

        role: 'BUSINESS_OWNER',

        bsgCustId: bsgCustId || null,

        groupId: parsedGroupId,

      },

    });

    if (existingExact) {

      return res.status(409).json({ message: 'Business Owner with this phone, customer ID and group already exists' });

    }
 
    // Block if the phone is taken by a non-BO role

    const existingNonBo = await User.findOne({ where: { phoneNumber, role: { [Op.ne]: 'BUSINESS_OWNER' } } });

    if (existingNonBo) return res.status(409).json({ message: 'Phone number already in use by another role' });
 
    // Check if primary BO exists

    const existingPrimary = await User.findOne({ where: { phoneNumber, role: 'BUSINESS_OWNER', password: { [Op.ne]: null } } });

    let hashed = null;

    if (!existingPrimary) {

      const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '1234567';

      hashed = await bcrypt.hash(defaultPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);

    }
 
    const user = await User.create({

      phoneNumber,

      role: 'BUSINESS_OWNER',

      fullName: fullName || null,

      businessName: businessName || null,

      vatNumber: vatNumber || null,

      businessAddress: businessAddress || null,

      latitude: latitude ? parseFloat(latitude) : null,

      longitude: longitude ? parseFloat(longitude) : null,

      bsgCustId: bsgCustId || null,

      salesRepId: salesRepId || null,

      email: email || null,

      groupId: parsedGroupId,

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

        groupId: user.groupId,

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

    const { fullName, businessName, vatNumber, businessAddress, latitude, longitude, bsgCustId, salesRepId, email, groupId } = req.body;
 
    const user = await User.findByPk(userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });
 
    await user.update({

      fullName: fullName ?? user.fullName,

      businessName: businessName ?? user.businessName,

      vatNumber: vatNumber ?? user.vatNumber,

      businessAddress: businessAddress ?? user.businessAddress,

      latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : user.latitude,

      longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : user.longitude,

      bsgCustId: bsgCustId ?? user.bsgCustId,

      salesRepId: salesRepId ?? user.salesRepId,

      email: email ?? user.email,

      groupId: groupId !== undefined ? (groupId ? parseInt(groupId, 10) : null) : user.groupId,

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

        groupId: user.groupId,

        at: new Date().toISOString(),

      });

    }
 
    res.json({ message: 'Business Owner updated', user });

  } catch (e) { next(e); }

};
 
// -------------------------

// Helper: buildListOptions with Group support

// -------------------------

function buildListOptions({ status, q, limit, offset, groupId } = {}) {

  const where = { role: 'BUSINESS_OWNER' };

  if (status) where.status = String(status).toUpperCase();

  if (groupId !== undefined && groupId !== null && groupId !== '') where.groupId = parseInt(groupId, 10);

  if (q) {

    where[Op.or] = [

      { fullName: { [Op.like]: `%${q}%` } },

      { businessName: { [Op.like]: `%${q}%` } },

      { phoneNumber: { [Op.like]: `%${q}%` } },

      { bsgCustId: { [Op.like]: `%${q}%` } },

      { email: { [Op.like]: `%${q}%` } },

    ];

  }
 
  const opts = {

    where,

    attributes: [

      'id','phoneNumber','fullName','businessName','vatNumber','businessAddress',

      'latitude','longitude','bsgCustId','salesRepId','status','email','groupId','createdAt','updatedAt'

    ],

    include: [{

      model: Group,

      as: 'group',

      required: false,

      attributes: ['groupId','groupName','groupNameAR','colorHex']

    }],

    order: [['createdAt','DESC']],

  };
 
  if (limit) opts.limit = parseInt(limit, 10);

  if (offset) opts.offset = parseInt(offset, 10);
 
  return opts;

}
 
// -------------------------

// Scope for Branch Manager / Sales Rep

// -------------------------

async function scopeBusinessOwners(req, opts) {

  const role = req.user.role;
 
  // BRANCH MANAGER

  if (role === 'BRANCH_MANAGER') {

    const me = await User.findByPk(req.user.id, { attributes: ['branchManagerId'], raw: true });

    const managerCode = (me?.branchManagerId || '').trim();

    if (!managerCode) { opts.where.salesRepId = { [Op.in]: ['__none__'] }; return opts; }
 
    const reps = await User.findAll({

      where: { role: 'SALES_REP', branchManagerId: managerCode },

      attributes: ['salesRepId'], raw: true

    });
 
    const repCodes = reps.map(r => (r.salesRepId || '').trim()).filter(Boolean);

    if (!repCodes.length) { opts.where.salesRepId = { [Op.in]: ['__none__'] }; return opts; }
 
    opts.where.salesRepId = { [Op.in]: repCodes };

    console.log(`👔 BM(${managerCode}) sees reps:`, repCodes);

    return opts;

  }
 
  // SALES REP

  if (role === 'SALES_REP') {

    const me = await User.findByPk(req.user.id, { attributes: ['salesRepId'], raw: true });

    const mySalesRepCode = (me?.salesRepId || '').trim();

    if (!mySalesRepCode) { opts.where.salesRepId = { [Op.in]: ['__none__'] }; return opts; }
 
    opts.where.salesRepId = mySalesRepCode;

    console.log(`🧑‍💼 SALES_REP(${mySalesRepCode}) scoped`);

    return opts;

  }
 
  // ALL OTHER ROLES

  return opts;

}
 
// -------------------------

// Export: list endpoints

// -------------------------

exports.listBusinessOwners = async (req, res, next) => {

  try {

    const { status, q, limit, offset, groupId } = req.query;

    let opts = buildListOptions({ status, q, limit, offset, groupId });

    opts = await scopeBusinessOwners(req, opts);

    const users = await User.findAll(opts);

    res.json(users);

  } catch (e) { next(e); }

};
 
exports.listPendingBusinessOwners = async (req, res, next) => {

  try {

    const { q, limit, offset, groupId } = req.query;

    let opts = buildListOptions({ status: 'PENDING', q, limit, offset, groupId });

    opts = await scopeBusinessOwners(req, opts);

    const users = await User.findAll(opts);

    res.json(users);

  } catch (e) { next(e); }

};
 
exports.listApprovedBusinessOwners = async (req, res, next) => {

  try {

    const { q, limit, offset, groupId } = req.query;

    let opts = buildListOptions({ status: 'APPROVED', q, limit, offset, groupId });

    opts = await scopeBusinessOwners(req, opts);

    const users = await User.findAll(opts);

    res.json(users);

  } catch (e) { next(e); }

};
 