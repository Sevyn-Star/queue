const express = require('express');
const { getDb } = require('../db');
const { authRequired, requireRole } = require('../auth');
const {
  newId,
  nowText,
  restaurantRow,
  menuRecord,
  ticketRow,
  orderRow,
  applyRow,
  dateRange,
  inDateRange,
} = require('../helpers');

const router = express.Router();
router.use(authRequired);

function merchantRestaurant(db, userId) {
  return db.prepare('SELECT * FROM restaurants WHERE merchant_openid = ?').get(userId);
}

router.get('/restaurant', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const row = merchantRestaurant(db, req.user.userId);
  if (!row) return res.status(404).json({ success: false, message: '未查询到商家信息' });
  const waiting = db.prepare(`SELECT COUNT(*) AS n FROM queue_tickets WHERE restaurantid=? AND status='waiting'`).get(row._id).n;
  const data = restaurantRow(row);
  data.queueCount = String(waiting);
  res.json({ success: true, data });
});

router.put('/restaurant', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const row = merchantRestaurant(db, req.user.userId);
  if (!row) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const body = req.body || {};
  const fields = ['name', 'description', 'businessHours', 'phone', 'announcement', 'avgPrice', 'floor', 'open'];
  const updates = [];
  const values = [];
  for (const key of fields) {
    if (body[key] !== undefined) {
      updates.push(`${key} = ?`);
      values.push(body[key] == null ? '' : String(body[key]));
    }
  }
  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(Array.isArray(body.tags) ? body.tags : []));
  }
  updates.push('updateTime = ?');
  values.push(nowText());
  values.push(row._id);
  db.prepare(`UPDATE restaurants SET ${updates.join(', ')} WHERE _id = ?`).run(...values);
  res.json({ success: true, data: { stats: { updated: 1 } }, message: '更新成功' });
});

router.get('/queue', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const tickets = db.prepare('SELECT * FROM queue_tickets WHERE restaurantid = ?').all(shop._id).map(ticketRow);
  const data = tickets.map((t) => {
    const order = db.prepare('SELECT * FROM orders WHERE ticketId = ?').get(t._id);
    return { ...t, order: order ? orderRow(order) : null };
  });
  res.json({ success: true, data });
});

router.post('/queue/call-next', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const { nextCallNumber, ticketId } = req.body || {};
  if (!nextCallNumber || !ticketId) {
    return res.status(400).json({ success: false, message: '缺少叫号参数' });
  }
  db.prepare(
    `UPDATE queue_tickets SET currentNumber = ? WHERE restaurantid = ? AND status IN ('waiting','calling')`
  ).run(Number(nextCallNumber), shop._id);
  db.prepare(`UPDATE queue_tickets SET status = 'called' WHERE _id = ?`).run(ticketId);
  res.json({ success: true });
});

router.put('/queue/:id/status', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  let status = (req.body || {}).status;
  if (status === 'expired') status = 'overdue';
  const row = db.prepare('SELECT * FROM queue_tickets WHERE _id=? AND restaurantid=?').get(req.params.id, shop._id);
  if (!row) return res.status(404).json({ success: false, message: '记录不存在' });
  db.prepare('UPDATE queue_tickets SET status=? WHERE _id=?').run(status, req.params.id);
  res.json({ success: true });
});

router.delete('/queue', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const info = db.prepare(
    `DELETE FROM queue_tickets WHERE restaurantid = ? AND status IN ('waiting','calling')`
  ).run(shop._id);
  res.json({ success: true, removed: info.changes });
});

router.get('/orders', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const status = req.query.status;
  let tickets = db.prepare('SELECT * FROM queue_tickets WHERE restaurantid = ?').all(shop._id);
  if (status === 'reserved') tickets = tickets.filter((t) => t.status === 'reserved');
  const data = tickets.map((queueItem) => {
    const order = db.prepare('SELECT * FROM orders WHERE ticketId = ?').get(queueItem._id);
    const orderData = order ? orderRow(order) : null;
    return {
      id: queueItem._id,
      orderNo: queueItem.ticketsId || `票据${queueItem._id.slice(-8)}`,
      total: orderData ? orderData.totalPrice || 0 : 0,
      status: queueItem.status,
      items: orderData && orderData.items
        ? (Array.isArray(orderData.items) ? orderData.items : [orderData.items])
        : [],
      createTime: (orderData && orderData.createTime) || queueItem.createTime,
      reserveTime: queueItem.reserveTime || '',
      partySize: queueItem.partySize || 1,
    };
  });
  res.json({ success: true, data });
});

router.delete('/orders/completed', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const info = db.prepare(
    `DELETE FROM queue_tickets WHERE restaurantid = ? AND status != 'reserved'`
  ).run(shop._id);
  res.json({ success: true, removed: info.changes });
});

router.get('/dishes', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const rows = db.prepare(
    `SELECT * FROM menu_items WHERE restaurants_id = ? AND IFNULL(auditStatus, 1) = 1`
  ).all(shop._id);
  res.json({ success: true, data: rows.map(menuRecord) });
});

router.get('/pending-dishes', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const rows = db.prepare(
    `SELECT * FROM merchant_applies WHERE restaurants_id = ? AND type = 'dish' AND auditStatus = 0`
  ).all(shop._id);
  res.json({ success: true, data: rows.map(applyRow) });
});

router.post('/dishes', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const body = req.body || {};
  const id = newId();
  const time = nowText();
  db.prepare(`INSERT INTO menu_items
    (_id,restaurants_id,name,price,image,description,quantity,status,sales,auditStatus,createdAt,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, shop._id, body.name || '', String(body.price || ''), body.image || '',
    body.description || '', String(body.quantity || '0'), body.status || 'active',
    0, 0, time, time
  );
  db.prepare(`INSERT INTO merchant_applies
    (_id,_openid,type,shopName,nickName,logo,businessLicense,phone,tags,description,dishImage,dishName,price,restaurants_id,auditStatus,applyTime)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    newId(),
    req.user.userId,
    'dish',
    shop.name || '',
    req.user.nickName || '',
    '',
    '',
    shop.phone || '',
    '[]',
    body.description || '',
    body.image || '',
    body.name || '',
    String(body.price || ''),
    shop._id,
    0,
    time
  );
  res.json({ success: true, _id: id });
});

router.put('/dishes/:id', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const row = db.prepare('SELECT * FROM menu_items WHERE _id=? AND restaurants_id=?').get(req.params.id, shop._id);
  if (!row) return res.status(404).json({ success: false, message: '菜品不存在' });
  const body = req.body || {};
  db.prepare(`UPDATE menu_items SET
    name=COALESCE(?, name),
    price=COALESCE(?, price),
    image=COALESCE(?, image),
    description=COALESCE(?, description),
    quantity=COALESCE(?, quantity),
    status=COALESCE(?, status),
    updatedAt=?
    WHERE _id=?`).run(
    body.name == null ? null : body.name,
    body.price == null ? null : String(body.price),
    body.image == null ? null : body.image,
    body.description == null ? null : body.description,
    body.quantity == null ? null : String(body.quantity),
    body.status == null ? null : body.status,
    nowText(),
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/dishes/:id', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  db.prepare('DELETE FROM menu_items WHERE _id=? AND restaurants_id=?').run(req.params.id, shop._id);
  res.json({ success: true });
});

router.get('/stats', requireRole('merchant', 'admin'), (req, res) => {
  const db = getDb();
  const shop = merchantRestaurant(db, req.user.userId);
  if (!shop) return res.status(404).json({ success: false, message: '未找到商家信息' });
  const filter = req.query.filter || 'today';
  const { start, end } = dateRange(filter);
  const tickets = db.prepare('SELECT * FROM queue_tickets WHERE restaurantid = ?').all(shop._id)
    .filter((t) => inDateRange(t.createTime, start, end));
  const orders = db.prepare('SELECT * FROM orders WHERE restaurantId = ?').all(shop._id)
    .filter((o) => inDateRange(o.createTime, start, end));
  let revenue = 0;
  const salesMap = {};
  const dishes = db.prepare('SELECT * FROM menu_items WHERE restaurants_id = ?').all(shop._id);
  dishes.forEach((d) => {
    salesMap[d._id] = { id: d._id, name: d.name, sales: 0 };
  });
  orders.forEach((o) => {
    revenue += Number(o.totalPrice || 0);
    const items = JSON.parse(o.items || '[]');
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (salesMap[item.id]) salesMap[item.id].sales += Number(item.quantity || 0);
      });
    }
  });
  const popularDishes = Object.values(salesMap).sort((a, b) => b.sales - a.sales);
  res.json({
    success: true,
    data: {
      todayCustomers: tickets.length,
      todayRevenue: revenue,
      popularDishes,
    },
  });
});

router.get('/status', (req, res) => {
  const db = getDb();
  const merchant = db.prepare('SELECT * FROM merchants WHERE _openid = ?').get(req.user.userId);
  if (merchant) return res.json({ success: true, status: 'ready', merchant });
  const apply = db.prepare(
    `SELECT * FROM merchant_applies WHERE _openid = ? AND type = 'shop' ORDER BY applyTime DESC`
  ).get(req.user.userId);
  if (!apply) return res.json({ success: true, status: 'none' });
  if (Number(apply.auditStatus) === 0) return res.json({ success: true, status: 'pending', apply: applyRow(apply) });
  if (Number(apply.auditStatus) === 1) return res.json({ success: true, status: 'approved', apply: applyRow(apply) });
  return res.json({ success: true, status: 'rejected', apply: applyRow(apply) });
});

router.post('/apply', (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const id = newId();
  db.prepare(`INSERT INTO merchant_applies
    (_id,_openid,type,shopName,nickName,logo,businessLicense,phone,tags,description,dishImage,dishName,price,restaurants_id,auditStatus,applyTime)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id,
    req.user.userId,
    body.type || 'shop',
    body.shopName || '',
    body.nickName || req.user.nickName || '',
    body.logo || '',
    body.businessLicense || '',
    body.phone || '',
    JSON.stringify(body.tags || []),
    body.description || '',
    body.dishImage || '',
    body.dishName || '',
    body.price == null ? '' : String(body.price),
    body.restaurants_id || '',
    0,
    nowText()
  );
  res.json({ success: true, _id: id });
});

module.exports = router;
