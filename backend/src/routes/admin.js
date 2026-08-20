const express = require('express');
const { getDb } = require('../db');
const { authRequired, requireRole } = require('../auth');
const { newId, nowText, applyRow, announcementRow, orderRow, restaurantRow } = require('../helpers');

const router = express.Router();
router.use(authRequired);
router.use(requireRole('admin'));

router.get('/overview', (req, res) => {
  const db = getDb();
  const orders = db.prepare('SELECT * FROM orders').all().map(orderRow);
  const restaurants = db.prepare('SELECT * FROM restaurants').all();
  const users = db.prepare('SELECT * FROM users').all();
  const merchants = db.prepare('SELECT * FROM merchants').all();
  const today = nowText().split(' ')[0];
  const todayOrders = orders.filter((o) => (o.createTime || '').split(' ')[0] === today);

  let todayTotalOrders = 0;
  let todayTotalRevenue = 0;
  const merchantStats = {};
  const merchantMap = {};
  restaurants.forEach((m) => { merchantMap[m._id] = m; });

  todayOrders.forEach((order) => {
    const restaurantId = order.restaurantId;
    if (!restaurantId) return;
    let orderQuantity = 0;
    let orderRevenue = 0;
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const quantity = parseInt(item.quantity, 10) || 0;
        const price = parseFloat(item.price) || 0;
        orderQuantity += quantity;
        orderRevenue += price * quantity;
      });
    }
    if (orderQuantity === 0 && order.totalPrice) {
      orderQuantity = 1;
      orderRevenue = parseFloat(order.totalPrice) || 0;
    }
    todayTotalOrders += orderQuantity;
    todayTotalRevenue += orderRevenue;
    if (!merchantStats[restaurantId]) {
      const merchant = merchantMap[restaurantId];
      merchantStats[restaurantId] = {
        orders: 0,
        revenue: 0,
        name: merchant ? merchant.name : (order.restaurantName || '未知商家'),
      };
    }
    merchantStats[restaurantId].orders += orderQuantity;
    merchantStats[restaurantId].revenue += orderRevenue;
  });

  const topMerchants = Object.keys(merchantStats)
    .map((key) => ({
      name: merchantStats[key].name,
      orders: merchantStats[key].orders,
      revenue: Math.round(merchantStats[key].revenue),
    }))
    .filter((m) => m.orders > 0)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 3);

  res.json({
    success: true,
    data: {
      overview: {
        totalUsers: users.length,
        totalMerchants: merchants.length,
        todayOrders: todayTotalOrders,
        totalRevenue: Math.round(todayTotalRevenue),
      },
      topMerchants,
      restaurants: restaurants.map(restaurantRow),
    },
  });
});

router.get('/applies', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM merchant_applies ORDER BY applyTime DESC').all();
  res.json({ success: true, data: rows.map(applyRow) });
});

router.post('/applies/:id/approve', (req, res) => {
  const db = getDb();
  const apply = db.prepare('SELECT * FROM merchant_applies WHERE _id = ?').get(req.params.id);
  if (!apply) return res.status(404).json({ success: false, message: '申请不存在' });

  if (apply.type === 'dish') {
    const existing = db.prepare(
      `SELECT * FROM menu_items WHERE restaurants_id = ? AND name = ? AND IFNULL(auditStatus, 0) = 0 ORDER BY createdAt DESC`
    ).get(apply.restaurants_id || '', apply.dishName || '');
    if (existing) {
      db.prepare('UPDATE menu_items SET auditStatus = 1, updatedAt = ? WHERE _id = ?').run(nowText(), existing._id);
    } else {
      const menuId = newId();
      db.prepare(`INSERT INTO menu_items
        (_id,restaurants_id,name,price,image,description,quantity,status,sales,auditStatus,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        menuId, apply.restaurants_id || '', apply.dishName || '', String(apply.price || ''),
        apply.dishImage || '', apply.description || '', '0', 'active', 0, 1, nowText(), nowText()
      );
    }
    db.prepare('UPDATE merchant_applies SET auditStatus = 1 WHERE _id = ?').run(apply._id);
    return res.json({ success: true, message: '菜品审核通过' });
  }

  let tags = [];
  try { tags = JSON.parse(apply.tags || '[]'); } catch { tags = []; }
  const description = apply.description || (Array.isArray(tags) ? tags[0] : '') || '';

  const merchantId = newId();
  db.prepare(`INSERT INTO merchants (_id,_openid,nickName,avatarUrl,shopName,phone,description,logo,type,createTime)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    merchantId,
    apply._openid || '',
    apply.nickName || '',
    apply.businessLicense || '',
    apply.shopName || '',
    apply.phone || '',
    description,
    apply.logo || '',
    apply.type || 'shop',
    apply.applyTime || nowText()
  );

  const restaurantId = newId();
  db.prepare(`INSERT INTO restaurants
    (_id,merchant_openid,merchant_id,name,logo,announcement,avgPrice,tags,businessHours,phone,floor,open,queueCount,rating,description,createTime,updateTime)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    restaurantId,
    apply._openid || '',
    merchantId,
    apply.shopName || '',
    apply.logo || '',
    '',
    '',
    JSON.stringify(tags),
    '',
    apply.phone || '',
    '',
    '1',
    '',
    '',
    description,
    apply.applyTime || nowText(),
    nowText()
  );

  db.prepare('UPDATE merchant_applies SET auditStatus = 1 WHERE _id = ?').run(apply._id);
  if (apply._openid) {
    db.prepare(`UPDATE users SET userType = 'merchant' WHERE (_openid = ? OR _id = ?) AND userType != 'admin'`).run(
      apply._openid, apply._openid
    );
  }
  res.json({ success: true, message: '商家数据同步成功' });
});

router.post('/applies/:id/reject', (req, res) => {
  const db = getDb();
  const apply = db.prepare('SELECT * FROM merchant_applies WHERE _id = ?').get(req.params.id);
  if (!apply) return res.status(404).json({ success: false, message: '申请不存在' });
  db.prepare('UPDATE merchant_applies SET auditStatus = 2 WHERE _id = ?').run(apply._id);
  res.json({ success: true });
});

router.post('/announcements', (req, res) => {
  const body = req.body || {};
  const id = newId();
  const t = nowText().split(' ')[0];
  getDb().prepare(`INSERT INTO announcements
    (_id,_openid,title,content,imageUrl,status,createTime,updatedAt)
    VALUES (?,?,?,?,?,?,?,?)`).run(
    id, req.user.userId, body.title || '', body.content || '', body.imageUrl || '',
    body.status || 'published', t, t
  );
  res.json({ success: true, _id: id });
});

router.put('/announcements/:id', (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM announcements WHERE _id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, message: '公告不存在' });
  const body = req.body || {};
  db.prepare(`UPDATE announcements SET
    title=COALESCE(?, title),
    content=COALESCE(?, content),
    imageUrl=COALESCE(?, imageUrl),
    status=COALESCE(?, status),
    updatedAt=?
    WHERE _id=?`).run(
    body.title == null ? null : body.title,
    body.content == null ? null : body.content,
    body.imageUrl == null ? null : body.imageUrl,
    body.status == null ? null : body.status,
    nowText().split(' ')[0],
    req.params.id
  );
  res.json({ success: true });
});

router.delete('/announcements/:id', (req, res) => {
  getDb().prepare('DELETE FROM announcements WHERE _id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/announcements', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM announcements ORDER BY createTime DESC').all();
  res.json({ success: true, data: rows.map(announcementRow) });
});

module.exports = router;
