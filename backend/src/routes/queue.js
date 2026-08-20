const express = require('express');
const { getDb } = require('../db');
const { authRequired } = require('../auth');
const {
  newId,
  nowText,
  ticketRow,
  orderRow,
  waitMinutes,
} = require('../helpers');

const router = express.Router();

function currentCallNumber(db, restaurantId) {
  const row = db.prepare(
    `SELECT currentNumber FROM queue_tickets WHERE restaurantid = ? ORDER BY createTime DESC LIMIT 1`
  ).get(restaurantId);
  return row && row.currentNumber ? Number(row.currentNumber) : 1;
}

function maxQueueNumber(db, restaurantId) {
  const row = db.prepare(
    `SELECT MAX(queueNumber) AS n FROM queue_tickets WHERE restaurantid = ? AND status = 'waiting'`
  ).get(restaurantId);
  return Number(row && row.n ? row.n : 0);
}

router.get('/queue/progress/:restaurantId', (req, res) => {
  const db = getDb();
  const currentNumber = currentCallNumber(db, req.params.restaurantId);
  res.json({ success: true, data: { currentNumber } });
});

router.get('/queue/mine', authRequired, (req, res) => {
  const db = getDb();
  const tickets = db.prepare(
    `SELECT * FROM queue_tickets WHERE _openid = ? ORDER BY createTime DESC`
  ).all(req.user.userId).map(ticketRow);

  const ids = tickets.map((t) => t._id);
  let orders = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    orders = db.prepare(`SELECT * FROM orders WHERE ticketId IN (${placeholders})`).all(...ids).map(orderRow);
  }
  const orderMap = {};
  orders.forEach((o) => { orderMap[o.ticketId] = o; });

  const restaurants = db.prepare('SELECT _id, name FROM restaurants').all();
  const nameMap = {};
  restaurants.forEach((r) => { nameMap[r._id] = r.name; });

  const data = tickets.map((ticket) => ({
    ...ticket,
    id: ticket._id,
    type: String(ticket.status || '').includes('reserved') ? 'reserve' : 'queue',
    restaurantId: ticket.restaurantid,
    restaurantName: nameMap[ticket.restaurantid] || '',
    partySize: ticket.partySize,
    number: ticket.queueNumber || 0,
    estimatedTime: ticket.estimatedWaitTime || 0,
    statusText: ticket.status,
    order: orderMap[ticket._id] || null,
  }));

  res.json({ success: true, data });
});

router.post('/queue', authRequired, (req, res) => {
  const { restaurantId, partySize, type, reserveTime, reserveDate } = req.body || {};
  if (!restaurantId) return res.status(400).json({ success: false, message: '请选择餐厅' });
  const db = getDb();
  const id = newId();
  const ticketsId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const createTime = nowText();
  const now = new Date();
  const expire = type === 'reserve'
    ? ''
    : `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours() + 2).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let queueNumber = 0;
  let estimatedWaitTime = 0;
  let currentNumber = 1;
  let status = 'waiting';
  let reserve = '';

  if (type === 'reserve') {
    status = 'reserved';
    reserve = reserveDate ? `${reserveDate} ${reserveTime || ''}`.trim() : (reserveTime || '');
  } else {
    currentNumber = currentCallNumber(db, restaurantId);
    queueNumber = maxQueueNumber(db, restaurantId) + 1;
    estimatedWaitTime = waitMinutes(queueNumber - currentNumber);
    currentNumber = 1;
  }

  db.prepare(`INSERT INTO queue_tickets
    (_id,_openid,restaurantid,queueNumber,status,ticketsId,expireTime,notes,createTime,currentNumber,estimatedWaitTime,partySize,reserveTime)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.user.userId, restaurantId, queueNumber, status, ticketsId, expire, '',
    createTime, currentNumber, estimatedWaitTime, Number(partySize || 2), reserve
  );

  res.json({ success: true, _id: id, data: ticketRow(db.prepare('SELECT * FROM queue_tickets WHERE _id=?').get(id)) });
});

router.put('/queue/:id/cancel', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM queue_tickets WHERE _id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '记录不存在' });
  if (row._openid !== req.user.userId && req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  db.prepare(`UPDATE queue_tickets SET status='cancelled' WHERE _id=?`).run(req.params.id);
  res.json({ success: true });
});

router.put('/queue/:id/arrive', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM queue_tickets WHERE _id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '记录不存在' });
  db.prepare(`UPDATE queue_tickets SET status='arrived' WHERE _id=?`).run(req.params.id);
  res.json({ success: true });
});

router.delete('/queue/:id', authRequired, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM queue_tickets WHERE _id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '记录不存在' });
  if (row._openid !== req.user.userId && req.user.userType !== 'admin') {
    return res.status(403).json({ success: false, message: '无权限' });
  }
  db.prepare('DELETE FROM queue_tickets WHERE _id=?').run(req.params.id);
  res.json({ success: true });
});

router.post('/orders', authRequired, (req, res) => {
  const { ticketId, restaurantId, restaurantName, items, totalPrice, queueNumber } = req.body || {};
  if (!restaurantId) return res.status(400).json({ success: false, message: '请选择餐厅' });
  if (!items || !items.length) return res.status(400).json({ success: false, message: '购物车为空' });
  const db = getDb();
  const id = newId();
  db.prepare(`INSERT INTO orders
    (_id,_openid,userId,ticketId,restaurantId,restaurantName,items,totalPrice,queueNumber,status,createTime)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.user.userId, req.user.userId, ticketId || '', restaurantId, restaurantName || '',
    JSON.stringify(items), Number(totalPrice || 0), Number(queueNumber || 0), 'pending', nowText()
  );
  res.json({ success: true, _id: id });
});

router.get('/orders/mine', authRequired, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM orders WHERE userId = ? OR _openid = ? ORDER BY createTime DESC')
    .all(req.user.userId, req.user.userId).map(orderRow);
  res.json({ success: true, data: rows });
});

module.exports = router;
