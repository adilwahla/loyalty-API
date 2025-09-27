const userService = require('../../services/v1/user.service');
const bcrypt = require('bcryptjs');
const { User } = require('../../models'); // ✅ ADD THIS LINE


exports.createUser = async (req, res, next) => {
  try {
    let { phoneNumber, role, iqamaNumber, fullName, businessName, vatNumber, businessAddress, binShihonWorkerId, salesRepId, bsgCustId, email, branchManagerId} = req.body;

    // Remove all non-digit characters
    phoneNumber = phoneNumber.replace(/\D/g, '');

    // Normalize to 9-digit starting with 5 (e.g. 539953058)
    if (phoneNumber.startsWith('966') && phoneNumber.length === 12) {
      phoneNumber = phoneNumber.slice(3); // Remove country code
    } else if (phoneNumber.startsWith('05') && phoneNumber.length === 10) {
      phoneNumber = phoneNumber.slice(1); // Remove leading 0
    }

    // Validate length after normalization
    if (!/^5\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({ message: 'Invalid Saudi phone number format' });
    }



    const existing = await User.findOne({ where: { phoneNumber } });
    if (existing) {
      return res.status(409).json({ message: 'User with this phone number already exists' });
    }

    // 🔐 Check if Iqama already exists (for TECHNICIAN)
    if (role.toUpperCase() === 'TECHNICIAN' && iqamaNumber) {
      const existingIqama = await User.findOne({ where: { iqamaNumber } });
      if (existingIqama) {
        return res.status(409).json({ message: 'User with this Iqama number already exists' });
      }
    }
    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '1234567';
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;
    const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
    // const hashed = await bcrypt.hash('1234567', 10);

    const newUser = await User.create({
      phoneNumber,
      role: role.toUpperCase(),
      iqamaNumber,
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      password: hashedPassword,
      isOtpVerified: true,

      binShihonWorkerId,
      salesRepId,
      bsgCustId,
      email,
      branchManagerId,


      // password: hashedPassword,

    });
// // Set status only for BUSINESS_OWNER
// if (userData.role === 'BUSINESS_OWNER') {
//   userData.status = 'pending';
// }
    // 🔹 Emit updated analytics (if io provided)
    //     const io = req.app.get('io');
    //  if (io) emitAnalytics(io);

    res.status(201).json({ message: 'User created', user: newUser });
  } catch (err) {
    next(err);
  }
};


exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (error) {
    next(error);
  }
};

exports.getUserById = async (req, res, next) => {
  try {
    const user = await userService.getById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const updated = await userService.update(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }   
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await userService.remove(id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

/**
 * 
 * Admin: Approve or Reject Business Owner registrations 
 */
exports.approveBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({ status: 'APPROVED' });

    // optional: notify via socket if your app uses it
    const io = req.app.get('io');
    if (io) io.to(String(user.id)).emit('user_status_updated', { status: 'APPROVED' });

    res.json({ message: 'Business Owner approved', userId: user.id });
  } catch (e) { next(e); }
};

exports.rejectBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({ status: 'REJECTED' });
    res.json({ message: 'Business Owner rejected', userId: user.id });
  } catch (e) { next(e); }
};

exports.createBusinessOwner = async (req, res, next) => {
  try {
    let { phoneNumber, fullName, businessName, vatNumber, businessAddress, bsgCustId, salesRepId, email, status } = req.body;

    // normalize phone like your other controllers
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('966') && phoneNumber.length === 12) phoneNumber = phoneNumber.slice(3);
    else if (phoneNumber.startsWith('05') && phoneNumber.length === 10) phoneNumber = phoneNumber.slice(1);

    const existing = await User.findOne({ where: { phoneNumber } });
    if (existing) return res.status(409).json({ message: 'User already registered' });

    const defaultPassword = process.env.DEFAULT_USER_PASSWORD || '1234567';
    const hashed = await bcrypt.hash(defaultPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10);

    const user = await User.create({
      phoneNumber,
      role: 'BUSINESS_OWNER',
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      bsgCustId: bsgCustId || null,
      salesRepId: salesRepId || null,
      email: email || null,
      password: hashed,
      isOtpVerified: true,
      status: status || 'APPROVED', // admin-created are approved by default
    });

    res.status(201).json({ message: 'Business Owner created', user });
  } catch (e) { next(e); }
};

exports.updateBusinessOwner = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { fullName, businessName, vatNumber, businessAddress, bsgCustId, salesRepId, email } = req.body;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'BUSINESS_OWNER') return res.status(400).json({ message: 'Not a Business Owner' });

    await user.update({
      fullName,
      businessName,
      vatNumber,
      businessAddress,
      bsgCustId,
      salesRepId,
      email,
    });

    res.json({ message: 'Business Owner updated', user });
  } catch (e) { next(e); }
};