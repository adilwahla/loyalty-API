const path = require('path');

exports.uploadSingleImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No image provided',
    });
  }

  const imagePath = `/uploads/${req.params.type}/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    message: 'Image uploaded successfully',
    imageUrl: imagePath,
  });
};
