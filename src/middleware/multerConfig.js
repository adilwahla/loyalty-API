const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_TYPES = ['products', 'rewards', 'profiles', 'sliders'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Infer type from route path if type param is missing
    const urlPath = req.originalUrl;
    const inferredType = ALLOWED_TYPES.find(type => urlPath.includes(type));
    const type = inferredType || req.query.type || req.body.type;

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return cb(
        new Error(`Invalid or missing upload type: must be one of ${ALLOWED_TYPES.join(', ')}`)
      );
    }

const dir = path.join(__dirname, '../../uploads/products');
fs.mkdirSync(dir, { recursive: true });
cb(null, dir);

  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExt.includes(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed'));
};

module.exports = multer({ storage, fileFilter });
