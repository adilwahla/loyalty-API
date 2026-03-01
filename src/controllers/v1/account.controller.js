// controllers/v1/account.controller.js
// Multi-account endpoints for Business Owners.
// Each "account" is a User row with the same phoneNumber but different bsgCustId / groupId.
// Only the primary row (created at registration) has a password; extra rows have NULL password.

const { Op } = require('sequelize');
const { User, Group } = require('../../models');

/**
 * GET /api/v1/users/me/accounts
 * Returns every BO User row that shares the caller's phone number.
 */
exports.getMyAccounts = async (req, res, next) => {
  try {
    if (req.user.role !== 'BUSINESS_OWNER') {
      return res.status(403).json({ message: 'Only business owners have accounts' });
    }

    // JWT only stores { id, role } — fetch the full user to get phoneNumber
    const me = await User.findByPk(req.user.id, { attributes: ['phoneNumber'] });
    if (!me) return res.status(404).json({ message: 'User not found' });

    const accounts = await User.findAll({
      where: { phoneNumber: me.phoneNumber, role: 'BUSINESS_OWNER' },
      attributes: [
        'id', 'phoneNumber', 'fullName', 'businessName', 'vatNumber',
        'businessAddress', 'latitude', 'longitude', 'bsgCustId',
        'salesRepId', 'email', 'groupId', 'status', 'createdAt',
      ],
      include: [{
        model: Group,
        as: 'group',
        required: false,
        attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex'],
      }],
      order: [['createdAt', 'ASC']],
    });

    // Mark which row is the primary (login) account
    const result = accounts.map((a) => {
      const json = a.toJSON();
      json.isPrimary = a.id === req.user.id;
      return json;
    });

    return res.json({ accounts: result });
  } catch (e) {
    next(e);
  }
};

/**
 * POST /api/v1/users/me/accounts
 * Body: { groupId: <int>, customerId: "<string>" }
 * Creates a new User row with the same phone, NULL password, and the given bsgCustId / groupId.
 */
exports.createMyAccount = async (req, res, next) => {
  try {
    if (req.user.role !== 'BUSINESS_OWNER') {
      return res.status(403).json({ message: 'Only business owners can add accounts' });
    }

    const { groupId, customerId, businessName, vatNumber, businessAddress, latitude, longitude } = req.body || {};

    // Validate groupId
    const groupIdNum = groupId != null ? Number(groupId) : NaN;
    if (!Number.isInteger(groupIdNum)) {
      return res.status(400).json({ message: 'Valid groupId is required' });
    }

    // Validate customerId
    const customerIdStr = typeof customerId === 'string' ? customerId.trim() : '';
    if (!customerIdStr) {
      return res.status(400).json({ message: 'Customer ID is required' });
    }

    // Verify group exists
    const groupExists = await Group.findByPk(groupIdNum);
    if (!groupExists) {
      return res.status(400).json({ message: 'Invalid group' });
    }

    // Fetch primary user to copy shared fields
    const me = await User.findByPk(req.user.id);
    if (!me) return res.status(404).json({ message: 'User not found' });

    // Check for duplicate (same phone + bsgCustId + groupId)
    const existing = await User.findOne({
      where: {
        phoneNumber: me.phoneNumber,
        role: 'BUSINESS_OWNER',
        bsgCustId: customerIdStr,
        groupId: groupIdNum,
      },
    });
    if (existing) {
      return res.status(409).json({ message: 'This account already exists' });
    }

    // Create the new account row — NULL password (not a login row)
    // Per-account fields: use provided values, fall back to primary account values
    const account = await User.create({
      phoneNumber: me.phoneNumber,
      role: 'BUSINESS_OWNER',
      fullName: me.fullName,
      businessName: businessName !== undefined ? (businessName || null) : me.businessName,
      vatNumber: vatNumber !== undefined ? (vatNumber || null) : me.vatNumber,
      businessAddress: businessAddress !== undefined ? (businessAddress || null) : me.businessAddress,
      latitude: latitude !== undefined ? (latitude ? parseFloat(latitude) : null) : me.latitude,
      longitude: longitude !== undefined ? (longitude ? parseFloat(longitude) : null) : me.longitude,
      salesRepId: me.salesRepId,
      email: me.email,
      password: null,
      isOtpVerified: true,
      status: 'APPROVED',
      bsgCustId: customerIdStr,
      groupId: groupIdNum,
    });

    // Reload with Group included
    const withGroup = await User.findByPk(account.id, {
      attributes: [
        'id', 'phoneNumber', 'fullName', 'businessName', 'vatNumber',
        'businessAddress', 'latitude', 'longitude', 'bsgCustId',
        'salesRepId', 'email', 'groupId', 'status', 'createdAt',
      ],
      include: [{
        model: Group,
        as: 'group',
        required: false,
        attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex'],
      }],
    });

    const result = withGroup.toJSON();
    result.isPrimary = false;

    return res.status(201).json({ account: result });
  } catch (e) {
    next(e);
  }
};

/**
 * PUT /api/v1/users/me/accounts/:accountId
 * Body: { groupId?, customerId?, businessName?, vatNumber?, businessAddress?, latitude?, longitude? }
 * Updates fields on an existing account row.
 */
exports.updateMyAccount = async (req, res, next) => {
  try {
    if (req.user.role !== 'BUSINESS_OWNER') {
      return res.status(403).json({ message: 'Only business owners can update accounts' });
    }

    const { accountId } = req.params;
    const { groupId, customerId, businessName, vatNumber, businessAddress, latitude, longitude } = req.body || {};

    // Fetch the primary user to verify ownership
    const me = await User.findByPk(req.user.id, { attributes: ['phoneNumber'] });
    if (!me) return res.status(404).json({ message: 'User not found' });

    // Find the account row and verify it belongs to this BO
    const account = await User.findOne({
      where: { id: accountId, phoneNumber: me.phoneNumber, role: 'BUSINESS_OWNER' },
    });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Build update payload
    const updates = {};

    if (groupId !== undefined) {
      const groupIdNum = Number(groupId);
      if (!Number.isInteger(groupIdNum)) {
        return res.status(400).json({ message: 'Valid groupId is required' });
      }
      const groupExists = await Group.findByPk(groupIdNum);
      if (!groupExists) {
        return res.status(400).json({ message: 'Invalid group' });
      }
      updates.groupId = groupIdNum;
    }

    if (customerId !== undefined) {
      const customerIdStr = typeof customerId === 'string' ? customerId.trim() : '';
      if (!customerIdStr) {
        return res.status(400).json({ message: 'Customer ID is required' });
      }
      updates.bsgCustId = customerIdStr;
    }

    // Per-account business fields
    if (businessName !== undefined)    updates.businessName    = businessName || null;
    if (vatNumber !== undefined)       updates.vatNumber       = vatNumber || null;
    if (businessAddress !== undefined) updates.businessAddress = businessAddress || null;
    if (latitude !== undefined)        updates.latitude        = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined)       updates.longitude       = longitude ? parseFloat(longitude) : null;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    // Check for duplicate with the new values (only if groupId or customerId changed)
    if (updates.groupId !== undefined || updates.bsgCustId !== undefined) {
      const newGroupId = updates.groupId !== undefined ? updates.groupId : account.groupId;
      const newCustId = updates.bsgCustId !== undefined ? updates.bsgCustId : account.bsgCustId;
      const duplicate = await User.findOne({
        where: {
          phoneNumber: me.phoneNumber,
          role: 'BUSINESS_OWNER',
          groupId: newGroupId,
          bsgCustId: newCustId,
          id: { [Op.ne]: accountId },
        },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'An account with this group and customer ID already exists' });
      }
    }

    await account.update(updates);

    // Reload with Group included
    const updated = await User.findByPk(account.id, {
      attributes: [
        'id', 'phoneNumber', 'fullName', 'businessName', 'vatNumber',
        'businessAddress', 'latitude', 'longitude', 'bsgCustId',
        'salesRepId', 'email', 'groupId', 'status', 'createdAt',
      ],
      include: [{
        model: Group,
        as: 'group',
        required: false,
        attributes: ['groupId', 'groupName', 'groupNameAR', 'colorHex'],
      }],
    });

    const result = updated.toJSON();
    result.isPrimary = account.id === req.user.id;

    return res.json({ account: result });
  } catch (e) {
    next(e);
  }
};

/**
 * DELETE /api/v1/users/me/accounts/:accountId
 * Deletes a non-primary account row. The primary (login) row cannot be deleted.
 */
exports.deleteMyAccount = async (req, res, next) => {
  try {
    if (req.user.role !== 'BUSINESS_OWNER') {
      return res.status(403).json({ message: 'Only business owners can delete accounts' });
    }

    const { accountId } = req.params;

    // Cannot delete your own primary (login) account
    if (accountId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your primary account' });
    }

    // Fetch the primary user to verify ownership
    const me = await User.findByPk(req.user.id, { attributes: ['phoneNumber'] });
    if (!me) return res.status(404).json({ message: 'User not found' });

    // Find the account row and verify it belongs to this BO and has no password (non-primary)
    const account = await User.findOne({
      where: {
        id: accountId,
        phoneNumber: me.phoneNumber,
        role: 'BUSINESS_OWNER',
        password: null,
      },
    });
    if (!account) {
      return res.status(404).json({ message: 'Account not found or cannot be deleted' });
    }

    await account.destroy();

    return res.json({ message: 'Account deleted' });
  } catch (e) {
    next(e);
  }
};
