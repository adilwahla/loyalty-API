const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define upload directory for rewards
const REWARDS_UPLOAD_DIR = path.join(__dirname, '../../uploads/rewards');

// Ensure directory exists
fs.mkdirSync(REWARDS_UPLOAD_DIR, { recursive: true });

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, REWARDS_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `reward-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  },
});

// File type validation
const fileFilter = (req, file, cb) => {
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExt.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

// Multer instance for rewards only
const uploadReward = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Optional: 5MB limit
});

module.exports = uploadReward;
