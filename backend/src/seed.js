const fs = require('fs');
const path = require('path');
const { getDb } = require('./db');
const { rewriteCloudUrl } = require('./helpers');

const root = path.join(__dirname, '..', '..');
const jsonDir = path.join(root, '数据库');
const storageDir = path.join(root, '存储数据');
const uploadsDir = path.join(__dirname, '..', 'uploads');

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function stringifyField(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function cloudToStored(value) {
  if (typeof value !== 'string') return value == null ? '' : String(value);
  return rewriteCloudUrl(value);
}

function run() {
  copyDir(storageDir, uploadsDir);

  const db = getDb();
  db.exec(`
    DELETE FROM users;
    DELETE FROM admins;
    DELETE FROM merchants;
    DELETE FROM merchant_applies;
    DELETE FROM restaurants;
    DELETE FROM menu_items;
    DELETE FROM queue_tickets;
    DELETE FROM orders;
    DELETE FROM announcements;
  `);

  const insertUser = db.prepare(`INSERT INTO users (_id,_openid,avatarUrl,nickName,registerTime,updateTime,userType)
    VALUES (@_id,@_openid,@avatarUrl,@nickName,@registerTime,@updateTime,@userType)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_user.json'))) {
    insertUser.run({
      _id: row._id,
      _openid: row._openid || row._id,
      avatarUrl: cloudToStored(row.avatarUrl),
      nickName: row.nickName || '',
      registerTime: row.registerTime || '',
      updateTime: row.updateTime || '',
      userType: row.userType || 'user',
    });
  }

  const insertAdmin = db.prepare(`INSERT INTO admins (_id,_openid,avatarUrl,nickName,updateTime,userType)
    VALUES (@_id,@_openid,@avatarUrl,@nickName,@updateTime,@userType)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_admin.json'))) {
    insertAdmin.run({
      _id: row._id,
      _openid: row._openid || row._id,
      avatarUrl: cloudToStored(row.avatarUrl),
      nickName: row.nickName || '',
      updateTime: row.updateTime || '',
      userType: row.userType || 'admin',
    });
    const exists = db.prepare('SELECT 1 AS n FROM users WHERE _openid = ? OR _id = ?').get(row._openid || row._id, row._id);
    if (!exists) {
      insertUser.run({
        _id: row._id,
        _openid: row._openid || row._id,
        avatarUrl: cloudToStored(row.avatarUrl),
        nickName: row.nickName || '',
        registerTime: row.updateTime || '',
        updateTime: row.updateTime || '',
        userType: 'admin',
      });
    }
  }

  const insertMerchant = db.prepare(`INSERT INTO merchants (_id,_openid,nickName,avatarUrl,shopName,phone,description,logo,type,createTime)
    VALUES (@_id,@_openid,@nickName,@avatarUrl,@shopName,@phone,@description,@logo,@type,@createTime)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_merchant.json'))) {
    insertMerchant.run({
      _id: row._id,
      _openid: row._openid || '',
      nickName: row.nickName || '',
      avatarUrl: cloudToStored(row.avatarUrl),
      shopName: row.shopName || '',
      phone: row.phone || '',
      description: row.description || '',
      logo: cloudToStored(row.logo),
      type: row.type || 'shop',
      createTime: row.createTime || '',
    });
  }

  const insertApply = db.prepare(`INSERT INTO merchant_applies
    (_id,_openid,type,shopName,nickName,logo,businessLicense,phone,tags,description,dishImage,dishName,price,restaurants_id,auditStatus,applyTime)
    VALUES (@_id,@_openid,@type,@shopName,@nickName,@logo,@businessLicense,@phone,@tags,@description,@dishImage,@dishName,@price,@restaurants_id,@auditStatus,@applyTime)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_merchant_apply.json'))) {
    insertApply.run({
      _id: row._id,
      _openid: row._openid || '',
      type: row.type || 'shop',
      shopName: row.shopName || '',
      nickName: row.nickName || '',
      logo: cloudToStored(row.logo),
      businessLicense: cloudToStored(row.businessLicense),
      phone: row.phone || '',
      tags: stringifyField(row.tags || []),
      description: row.description || '',
      dishImage: cloudToStored(row.dishImage),
      dishName: row.dishName || '',
      price: row.price == null ? '' : String(row.price),
      restaurants_id: row.restaurants_id || '',
      auditStatus: Number(row.auditStatus || 0),
      applyTime: row.applyTime || '',
    });
  }

  const insertRestaurant = db.prepare(`INSERT INTO restaurants
    (_id,merchant_openid,merchant_id,name,logo,announcement,avgPrice,tags,businessHours,phone,floor,open,queueCount,rating,description,createTime,updateTime)
    VALUES (@_id,@merchant_openid,@merchant_id,@name,@logo,@announcement,@avgPrice,@tags,@businessHours,@phone,@floor,@open,@queueCount,@rating,@description,@createTime,@updateTime)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_restaurants.json'))) {
    let updateTime = row.updateTime || '';
    if (updateTime && typeof updateTime === 'object') {
      updateTime = updateTime.$date || JSON.stringify(updateTime);
    }
    insertRestaurant.run({
      _id: row._id,
      merchant_openid: row.merchant_openid || '',
      merchant_id: row.merchant_id || '',
      name: row.name || '',
      logo: cloudToStored(row.logo),
      announcement: row.announcement || '',
      avgPrice: row.avgPrice == null ? '' : String(row.avgPrice),
      tags: stringifyField(row.tags || []),
      businessHours: row.businessHours || '',
      phone: row.phone || '',
      floor: row.floor || '',
      open: row.open == null ? '' : String(row.open),
      queueCount: row.queueCount == null ? '' : String(row.queueCount),
      rating: row.rating == null ? '' : String(row.rating),
      description: row.description || '',
      createTime: row.createTime || '',
      updateTime,
    });
  }

  const insertMenu = db.prepare(`INSERT INTO menu_items
    (_id,restaurants_id,name,price,image,description,quantity,status,sales,auditStatus,createdAt,updatedAt)
    VALUES (@_id,@restaurants_id,@name,@price,@image,@description,@quantity,@status,@sales,@auditStatus,@createdAt,@updatedAt)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_menultems.json'))) {
    const item = row.menuItems || {};
    insertMenu.run({
      _id: row._id,
      restaurants_id: row.restaurants_id || '',
      name: item.name || '',
      price: item.price == null ? '' : String(item.price),
      image: cloudToStored(item.image),
      description: item.description || '',
      quantity: item.quantity == null ? '0' : String(item.quantity),
      status: row.status || 'active',
      sales: Number(item.sales || 0),
      auditStatus: row.auditStatus == null ? 1 : Number(row.auditStatus),
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
    });
  }

  const insertTicket = db.prepare(`INSERT INTO queue_tickets
    (_id,_openid,restaurantid,queueNumber,status,ticketsId,expireTime,notes,createTime,currentNumber,estimatedWaitTime,partySize,reserveTime)
    VALUES (@_id,@_openid,@restaurantid,@queueNumber,@status,@ticketsId,@expireTime,@notes,@createTime,@currentNumber,@estimatedWaitTime,@partySize,@reserveTime)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_queueTickets.json'))) {
    insertTicket.run({
      _id: row._id,
      _openid: row._openid || '',
      restaurantid: row.restaurantid || '',
      queueNumber: Number(row.queueNumber || 0),
      status: row.status || 'waiting',
      ticketsId: row.ticketsId || '',
      expireTime: row.expireTime || '',
      notes: row.notes || '',
      createTime: row.createTime || '',
      currentNumber: Number(row.currentNumber || 1),
      estimatedWaitTime: Number(row.estimatedWaitTime || 0),
      partySize: Number(row.partySize || 1),
      reserveTime: row.reserveTime || '',
    });
  }

  const insertOrder = db.prepare(`INSERT INTO orders
    (_id,_openid,userId,ticketId,restaurantId,restaurantName,items,totalPrice,queueNumber,status,createTime)
    VALUES (@_id,@_openid,@userId,@ticketId,@restaurantId,@restaurantName,@items,@totalPrice,@queueNumber,@status,@createTime)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_orderform.json'))) {
    insertOrder.run({
      _id: row._id,
      _openid: row._openid || '',
      userId: row.userId || row._openid || '',
      ticketId: row.ticketId || '',
      restaurantId: row.restaurantId || '',
      restaurantName: row.restaurantName || '',
      items: stringifyField(row.items || []),
      totalPrice: Number(row.totalPrice || 0),
      queueNumber: Number(row.queueNumber || 0),
      status: row.status || 'pending',
      createTime: row.createTime || '',
    });
  }

  const insertAnn = db.prepare(`INSERT INTO announcements
    (_id,_openid,title,content,imageUrl,status,createTime,updatedAt)
    VALUES (@_id,@_openid,@title,@content,@imageUrl,@status,@createTime,@updatedAt)`);
  for (const row of readJsonLines(path.join(jsonDir, 'database_announcement.json'))) {
    insertAnn.run({
      _id: row._id,
      _openid: row._openid || '',
      title: row.title || '',
      content: row.content || '',
      imageUrl: cloudToStored(row.imageUrl),
      status: row.status || 'published',
      createTime: row.createTime || '',
      updatedAt: row.updatedAt || '',
    });
  }

  console.log('Seed completed. DB:', path.join(__dirname, '..', 'data', 'app.db'));
}

run();
