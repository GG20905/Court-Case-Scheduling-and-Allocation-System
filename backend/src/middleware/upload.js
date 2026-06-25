const multer = require('multer');
const path = require('path');
const fs = require('fs');

const isPdfUpload = (file) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  return file.mimetype === 'application/pdf' && ext === '.pdf';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const caseId = req.body.case_id || req.params.caseId || 'general';
    const dir = path.join('uploads', `case_${caseId}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (isPdfUpload(file)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;