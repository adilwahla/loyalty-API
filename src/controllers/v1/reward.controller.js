const rewardService = require('../../services/v1/reward.service');
const Reward = require('../../models/reward.model');
exports.getAll = async (req, res) => {
  try {
    const rewards = await rewardService.getAll(req.query);
    res.status(200).json({ success: true, message: 'All rewards fetched successfully', rewards });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch all rewards', error: err.message });
  }
};

exports.getPaginated = async (req, res) => {
  try {
    const result = await rewardService.getPaginated(req.query);
    res.status(200).json({ success: true, message: 'Paginated rewards fetched successfully', ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch paginated rewards', error: err.message });
  }
};

exports.create = async (req, res) => {


  try {
    const payload = req.body;
      // console.log('Received fields:', req.body);
// console.log('Received file:', req.file);
req.app.get('io').emit('rewardCreated', payload); 
    if (req.file) {
      payload.image = `/uploads/rewards/${req.file.filename}`;
    }
    delete payload.serialNumber; // prevent DB error
    const newReward = await rewardService.create(payload);
      req.app.get('io').emit('rewardCreated', newReward); // 🔥 Real-time event
    res.status(201).json({ success: true, message: 'Reward created successfully', reward: newReward });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError' || err.message.includes('rewardId already exists')) {
      return res.status(400).json({ success: false, message: 'Reward with this rewardId already exists', field: 'rewardId' });
    }
    res.status(500).json({ success: false, message: 'Reward creation failed', error: err.message });
  }
};

exports.bulkCreate = async (req, res) => {
  try {
    const rewardList = req.body.rewards ? JSON.parse(req.body.rewards) : [];
    if (req.files && req.files.length) {
      req.files.forEach((file, index) => {
        if (rewardList[index]) {
          rewardList[index].image = `/uploads/rewards/${file.filename}`;
        }
      });
    }
    const { inserted, skipped } = await rewardService.bulkCreate(rewardList);
    res.status(201).json({ success: true, message: `${inserted.length} rewards created, ${skipped.length} skipped.`, inserted, skipped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Bulk reward creation failed', error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const rewardData = { ...req.body };
    console.log('Update payload:', rewardData);
    if (req.file) {
      rewardData.image = `/uploads/rewards/${req.file.filename}`;
          //  console.log('Image uploaded:', rewardData.image);
    }
        // console.log('Update payload:', rewardData);
    const updated = await rewardService.update(req.params.id, rewardData);
      req.app.get('io').emit('rewardUpdated', updated); // 🔥 Real-time event
    res.status(200).json({ success: true, message: 'Reward updated successfully', reward: updated });
  } catch (err) {
    if (err.message === 'Reward not found') {
      res.status(404).json({ success: false, message: 'No reward found with the specified ID' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update reward', error: err.message });
    }
  }
};

exports.remove = async (req, res) => {
     const id = req.params.id;
  try {
     const reward = await Reward.findByPk(id);
       if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }
    await rewardService.remove(id);
     req.app.get('io').emit('rewardDeleted', {   rewardId: reward.rewardId  });//🔥 Real-time event
     res.status(200).json({ success: true, message: 'Reward deleted successfully' });
     console.log('Emitting rewardDeleted for:', deletedReward.rewardId);

  } catch (err) {
    if (err.message === 'Reward not found') {
      res.status(404).json({ success: false, message: 'No reward found with the specified ID' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to delete reward', error: err.message });
    }
  }
};

