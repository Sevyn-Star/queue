const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { authRequired } = require('../auth');
const { publicUrl } = require('../env');
const { newId } = require('../helpers');

const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = String(req.body.folder || req.query.folder || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '');
    const dest = path.join(uploadsRoot, folder);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.png';
    cb(null, `${Date.now()}-${newId().slice(0, 8)}${ext}`);
  },
});

const upload = multer({ storage });
const router = express.Router();

router.post('/', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '未收到文件' });
  const rel = path.relative(uploadsRoot, req.file.path).split(path.sep).join('/');
  const url = `${publicUrl}/uploads/${rel}`;
  res.json({ success: true, url, fileID: url });
});

module.exports = router;
