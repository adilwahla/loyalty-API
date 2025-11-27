// services/v1/link.service.js
// Single source of truth for BO <-> TECHNICIAN linking via QR (direct exports)

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');

const {
  sequelize,
  User,
  TechnicianBusinessOwnerLink,
  UsedQrNonce,
} = require('../../models');

const QR_SECRET = process.env.QR_SECRET || 'super-long-random-string-here';

// utils
const nowSec = () => Math.floor(Date.now() / 1000);

// Accept raw JWT or deep link like: bgoil://link?token=<JWT>
function extractCandidateToken(input) {
  const raw = (input ?? '').toString().trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const t = u.searchParams.get('token');
    if (t && t.trim()) return t.trim();
  } catch {
    // not a URL, keep raw
  }
  return raw;
}

/**
 * Generate a short-lived QR token for a BUSINESS_OWNER.
 * The token embeds: typ, boUserId, bsgCustId, nonce, exp
 * We "reserve" the nonce in DB to prevent replay/spoofing.
 */
exports.generateBoLinkQr = async function generateBoLinkQr({ boId, ttlSeconds = 10 * 60 }) {
  const bo = await User.findByPk(boId);
  if (!bo || bo.role !== 'BUSINESS_OWNER') {
    const err = new Error('Business Owner not found');
    err.statusCode = 404;
    throw err;
  }

  const nonce = crypto.randomBytes(16).toString('hex');
  const exp = nowSec() + ttlSeconds;

  const token = jwt.sign(
    {
      typ: 'LINK_BO',
      boUserId: bo.id,
      bsgCustId: bo.bsgCustId || null,
      nonce,
      exp,
    },
    QR_SECRET,
    { algorithm: 'HS256' }
  );

  // Reserve the nonce; add a small grace window beyond exp
  await UsedQrNonce.create({
    nonce,
    purpose: 'LINK_BO',
    expiresAt: new Date((exp + 300) * 1000),
  });

  return { token, exp };
};

/**
 * TECHNICIAN consumes QR to link to a Business Owner.
 * Uses a DB transaction to atomically:
 *  - verify + consume nonce
 *  - create/reactivate link
 */
exports.linkTechnicianToBoWithToken = async function linkTechnicianToBoWithToken({ technicianId, token }) {
  return await sequelize.transaction(async (t) => {
    // 0) sanitize token (trim and extract ?token= for deep links)
    const candidate = extractCandidateToken(token);

    // 1) Verify JWT with a tiny clock tolerance
    let payload;
    try {
      payload = jwt.verify(candidate, QR_SECRET, {
        algorithms: ['HS256'],
        clockTolerance: 5, // seconds
      });
    } catch (e) {
      const err = new Error(e?.name === 'TokenExpiredError' ? 'QR token expired' : 'Invalid QR token');
      err.statusCode = 400;
      throw err;
    }

    if (payload.typ !== 'LINK_BO') {
      const err = new Error('Wrong QR type');
      err.statusCode = 400;
      throw err;
    }

    // 2) Check nonce exists & valid, then consume it (delete row)
    const used = await UsedQrNonce.findOne({
      where: {
        nonce: payload.nonce,
        purpose: 'LINK_BO',
        expiresAt: { [Op.gt]: new Date() },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!used) {
      const err = new Error('Invalid or consumed nonce');
      err.statusCode = 400;
      throw err;
    }

    const tech = await User.findByPk(technicianId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!tech || tech.role !== 'TECHNICIAN') {
      const err = new Error('Only TECHNICIAN can link via QR');
      err.statusCode = 403;
      throw err;
    }

    const bo = await User.findByPk(payload.boUserId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!bo || bo.role !== 'BUSINESS_OWNER') {
      const err = new Error('Business Owner not found');
      err.statusCode = 404;
      throw err;
    }

    // ✅ Enforce "one technician → one ACTIVE BO"
    const existingActive = await TechnicianBusinessOwnerLink.findOne({
      where: { technicianId: tech.id, status: 'ACTIVE' },
      include: [{ association: 'businessOwner', attributes: ['id', 'fullName'] }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Already ACTIVE with some BO
    if (existingActive) {
      // Same BO? idempotent success
      if (existingActive.businessOwnerId === bo.id) {
        await used.destroy({ transaction: t }); // consume nonce on success path
        return {
          link: existingActive,
          bo: { id: bo.id, fullName: bo.fullName, bsgCustId: bo.bsgCustId ?? null },
        };
      }
      // Different BO → reject with friendly message
      const err = new Error(`you are already linked with ${existingActive.businessOwner?.fullName || 'another Business Owner'}`);
      err.statusCode = 409;
      throw err;
    }

    const [link, created] = await TechnicianBusinessOwnerLink.findOrCreate({
      where: { technicianId, businessOwnerId: bo.id },
      defaults: { shareFactor: 0.50, status: 'ACTIVE' },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!created && link.status !== 'ACTIVE') {
      link.status = 'ACTIVE';
      await link.save({ transaction: t });
    }

    // consume nonce
    await used.destroy({ transaction: t });

    return {
      link,
      bo: { id: bo.id, fullName: bo.fullName, bsgCustId: bo.bsgCustId ?? null },
    };
  });
};

/**
 * Admin updates share factor on a link (0..1).
 */
exports.updateShareFactor = async function updateShareFactor({ linkId, shareFactor }) {
  if (!(shareFactor >= 0 && shareFactor <= 1)) {
    const err = new Error('shareFactor must be between 0 and 1');
    err.statusCode = 400;
    throw err;
  }

  const link = await TechnicianBusinessOwnerLink.findByPk(linkId, {
    include: [
      { association: 'technician', attributes: ['id', 'fullName', 'phoneNumber'] },  // ✅ by alias
      { association: 'businessOwner', attributes: ['id', 'fullName', 'bsgCustId'] }, // ✅ by alias
    ],
  });

  if (!link) {
    const err = new Error('Link not found');
    err.statusCode = 404;
    throw err;
  }

  link.shareFactor = shareFactor;
  await link.save();
  return link;
};

/**
 * For a BO, list ACTIVE linked technicians.
 */
exports.listTechniciansForBo = async function listTechniciansForBo({ boId }) {
  const bo = await User.findByPk(boId);
  if (!bo || bo.role !== 'BUSINESS_OWNER') {
    const err = new Error('Business Owner not found');
    err.statusCode = 404;
    throw err;
  }

  const links = await TechnicianBusinessOwnerLink.findAll({
    where: { businessOwnerId: boId, status: 'ACTIVE' },
    include: [{ association: 'technician', attributes: ['id', 'fullName', 'phoneNumber'] }], // ✅ by alias
    order: [['createdAt', 'DESC']],
  });

  return links.map((l) => ({
    linkId: l.id,
    shareFactor: l.shareFactor,
    technician: l.technician,
  }));
};

/**
 * Admin list links (optionally by status).
 */
exports.listAllLinks = async function listAllLinks({ status }) {
  const where = {};
  if (status) where.status = status;

  const links = await TechnicianBusinessOwnerLink.findAll({
    where,
    include: [
      { association: 'technician', attributes: ['id', 'fullName', 'phoneNumber'] },   // ✅ by alias
      { association: 'businessOwner', attributes: ['id', 'fullName', 'bsgCustId'] },  // ✅ by alias
    ],
    order: [['createdAt', 'DESC']],
  });

  return links;
};



/**
 * Admin: list users by role (to populate dropdowns)
 */
exports.listUsersByRole = async function listUsersByRole({ role, q, limit = 50 }) {
  const where = { role };
  if (q && q.trim()) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${q.trim()}%` } },
      { phoneNumber: { [Op.like]: `%${q.trim()}%` } },
      { bsgCustId: { [Op.like]: `%${q.trim()}%` } }, // useful for BO
    ];
  }

  const attrs =
    role === 'BUSINESS_OWNER'
      ? ['id', 'fullName', 'bsgCustId', 'phoneNumber']
      : ['id', 'fullName', 'phoneNumber'];

  return await User.findAll({
    where,
    attributes: attrs,
    order: [['fullName', 'ASC']],
    limit,
  });
};

/**
 * Admin: create/link Technician <-> BusinessOwner
 */
exports.adminCreateLink = async function adminCreateLink({
  adminId,
  businessOwnerId,
  technicianId,
  shareFactor = 0.2,
}) {
  if (!(shareFactor >= 0 && shareFactor <= 1)) {
    const err = new Error('shareFactor must be between 0 and 1');
    err.statusCode = 400;
    throw err;
  }

  return await sequelize.transaction(async (t) => {
    const bo = await User.findByPk(businessOwnerId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!bo || bo.role !== 'BUSINESS_OWNER') {
      const err = new Error('Business Owner not found');
      err.statusCode = 404;
      throw err;
    }

    const tech = await User.findByPk(technicianId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!tech || tech.role !== 'TECHNICIAN') {
      const err = new Error('Technician not found');
      err.statusCode = 404;
      throw err;
    }

    try {
      const [link, created] = await TechnicianBusinessOwnerLink.findOrCreate({
        where: { businessOwnerId: bo.id, technicianId: tech.id },
        defaults: {
          businessOwnerId: bo.id,
          technicianId: tech.id,
          shareFactor,
          status: 'ACTIVE',
          createdByAdminId: adminId ?? null,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!created) {
        // If exists, just reactivate & update shareFactor
        link.status = 'ACTIVE';
        link.shareFactor = shareFactor;
        if (adminId) link.createdByAdminId = adminId;
        await link.save({ transaction: t });
      }

      // Return with includes for table row
      const full = await TechnicianBusinessOwnerLink.findByPk(link.id, {
        transaction: t,
        include: [
          { association: 'businessOwner', attributes: ['id', 'fullName', 'bsgCustId'] },
          { association: 'technician', attributes: ['id', 'fullName', 'phoneNumber'] },
        ],
      });

      return full;
    } catch (e) {
      // unique constraint
      if (e?.name === 'SequelizeUniqueConstraintError') {
        const err = new Error('Link already exists for this BO and Technician');
        err.statusCode = 409;
        throw err;
      }
      throw e;
    }
  });
};

/**
 * Admin: delete/unlink
 * - soft (default): status = INACTIVE
 * - hard=true: destroy row
 */
exports.adminDeleteLink = async function adminDeleteLink({ linkId, hard = false }) {
  const link = await TechnicianBusinessOwnerLink.findByPk(linkId);
  if (!link) {
    const err = new Error('Link not found');
    err.statusCode = 404;
    throw err;
  }

  if (hard) {
    await link.destroy();
    return { ok: true, deleted: true };
  }

  link.status = 'INACTIVE';
  await link.save();
  return { ok: true, deleted: false, status: 'INACTIVE' };
};

/**
 * Enhance listAllLinks: allow filters boId / technicianId / status
 */
exports.listAllLinks = async function listAllLinks({ status, boId, technicianId }) {
  const where = {};
  if (status) where.status = status;
  if (boId) where.businessOwnerId = boId;
  if (technicianId) where.technicianId = technicianId;

  const links = await TechnicianBusinessOwnerLink.findAll({
    where,
    include: [
      { association: 'technician', attributes: ['id', 'fullName', 'phoneNumber'] },
      { association: 'businessOwner', attributes: ['id', 'fullName', 'bsgCustId'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  return links;
};