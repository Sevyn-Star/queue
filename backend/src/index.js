const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { port, publicUrl } = require('./env');
const { getDb } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (req, res) => {
  res.json({ success: true, ok: true, publicUrl });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/queue'));
app.use('/api/merchant', require('./routes/merchant'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/upload', require('./routes/upload'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message || '服务器错误' });
});

getDb();
app.listen(port, '0.0.0.0', () => {
  console.log(`Paidui API listening on ${publicUrl}`);
});
