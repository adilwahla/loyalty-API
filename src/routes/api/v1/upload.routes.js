const express = require('express');
const router = express.Router();
const multer = require('../../../middleware/multerConfig');
const path = require('path');

router.post('/', multer.single('file'), (req, res) => {
  try {
    const type = req.body.type;

    if (!type) {
      return res.status(400).json({ success: false, message: 'Missing type field (products, rewards, profiles, sliders)' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${type}/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: `Image uploaded to ${type}`,
      fileUrl,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
});

module.exports = router;
