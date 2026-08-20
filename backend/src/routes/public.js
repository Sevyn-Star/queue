const express = require('express');
const { getDb } = require('../db');
const {
  restaurantRow,
  menuRecord,
  menuDish,
  announcementRow,
  waitMinutes,
} = require('../helpers');

const router = express.Router();

function withQueueCount(row) {
  const db = getDb();
  const count = db.prepare(
    `SELECT COUNT(*) AS n FROM queue_tickets WHERE restaurantid = ? AND status = 'waiting'`
  ).get(row._id).n;
  const data = restaurantRow(row);
  data.queueCount = String(count);
  data.waitTime = waitMinutes(count);
  return data;
}

router.get('/restaurants', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM restaurants').all();
  res.json({ success: true, data: rows.map(withQueueCount) });
});

router.get('/restaurants/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM restaurants WHERE _id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '餐厅不存在' });
  res.json({ success: true, data: withQueueCount(row) });
});

router.get('/restaurants/:id/menu', (req, res) => {
  const rows = getDb().prepare(
    `SELECT * FROM menu_items WHERE restaurants_id = ? AND (status IS NULL OR status != 'inactive') AND IFNULL(auditStatus, 1) = 1`
  ).all(req.params.id);
  res.json({
    success: true,
    data: rows.map(menuDish),
    records: rows.map(menuRecord),
  });
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ success: false, message: '请输入搜索内容' });
  const rows = getDb().prepare('SELECT * FROM restaurants').all();
  const data = rows.filter((row) => {
    const name = (row.name || '').toLowerCase();
    const tags = (row.tags || '').toLowerCase();
    return name.includes(q) || tags.includes(q);
  }).map(withQueueCount);
  res.json({ success: true, data });
});

router.get('/announcements', (req, res) => {
  const rows = getDb().prepare(
    `SELECT * FROM announcements ORDER BY createTime DESC`
  ).all();
  res.json({ success: true, data: rows.map(announcementRow) });
});

router.get('/announcements/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM announcements WHERE _id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '公告不存在' });
  res.json({ success: true, data: announcementRow(row) });
});

module.exports = router;
