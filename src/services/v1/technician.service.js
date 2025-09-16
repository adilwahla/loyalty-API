// const Technician = require('../../models');
const {User ,Technician ,TechnicianBusinessOwnerLink } = require('../../models'); // Must exist with "role" field
/**
 * Create a Technician link
 * @param {Object} data - { tech_user_id, bin_shihon_worker_id, share_factor }
 */
async function create(data) {
  const { tech_user_id, bin_shihon_worker_id, share_factor } = data;

  if (!tech_user_id || !bin_shihon_worker_id) {
    throw new Error('tech_user_id and bin_shihon_worker_id are required');
  }

  // ✅ Verify Technician exists
  const techUser = await User.findByPk(tech_user_id);
  if (!techUser || techUser.role !== 'TECHNICIAN') {
    throw new Error('Only users with Technician role can be linked.');
  }

  // ✅ Find Business Owner by bin_shihon_worker_id
  const boUser = await User.findOne({ where: { binShihonWorkerId: bin_shihon_worker_id } });
  if (!boUser || boUser.role !== 'BUSINESS_OWNER') {
    throw new Error('Business Owner not found.');
  }

  // ✅ Check if Technician is already linked to any BO
  const existingLink = await Technician.findOne({ where: { tech_user_id } });
  if (existingLink) {
    if (existingLink.bo_user_id === boUser.id) {
      throw new Error('Technician is already linked with this Business Owner.');
    } else {
      throw new Error('Technician is already linked with another Business Owner.');
    }
  }

  // ✅ Create new link
  const technicianLink = await Technician.create({
    tech_user_id,
    bo_user_id: boUser.id,
    share_factor
  });

  return technicianLink;
}



const links = await TechnicianBusinessOwnerLink.findAll({
  where: { businessOwnerId: boId, status: 'ACTIVE' },
  include: [
    { association: 'technician', attributes: ['id','fullName','phoneNumber'] },
  ],
  order: [['createdAt','DESC']],
});
console.log('TBL associations:', Object.keys(TechnicianBusinessOwnerLink.associations));

// ✅ Get all Technician links
async function getAll() {
  return Technician.findAll();
}

// ✅ Get Technician by ID
async function getById(id) {
  return Technician.findByPk(id);
}

// ✅ Update Technician link
async function update(id, data) {
  const technician = await Technician.findByPk(id);
  if (!technician) throw new Error('Technician link not found');
  return technician.update(data);
}

// ✅ Delete Technician link
async function remove(id) {
  const technician = await Technician.findByPk(id);
  if (!technician) throw new Error('Technician link not found');
  await technician.destroy();
  return true;
}

module.exports = { create, getAll, getById, update, remove };