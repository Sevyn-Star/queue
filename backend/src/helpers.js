const { v4: uuidv4 } = require('uuid');
const { publicUrl } = require('./env');

function newId() {
  return uuidv4().replace(/-/g, '');
}

function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function todayPrefix() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rewriteCloudUrl(value) {
  if (typeof value !== 'string' || !value) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/uploads/')) return `${publicUrl}${value}`;
  const m = value.match(/^cloud:\/\/[^/]+\/(.+)$/);
  if (m) {
    let rel = m[1];
    rel = rel.replace('image/menuItems/yunweixiaoguan/', 'image/menuItems/yuanweixiaoguan/');
    return `${publicUrl}/uploads/${rel}`;
  }
  return value;
}

function rewriteDeep(input) {
  if (Array.isArray(input)) return input.map(rewriteDeep);
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = rewriteDeep(v);
    return out;
  }
  return rewriteCloudUrl(input);
}

function parseTags(value) {
  const parsed = parseJson(value, null);
  if (Array.isArray(parsed)) return parsed;
  if (typeof value === 'string' && value && !value.startsWith('[')) return [value];
  return [];
}

function restaurantRow(row) {
  if (!row) return null;
  return rewriteDeep({
    _id: row._id,
    merchant_openid: row.merchant_openid || '',
    merchant_id: row.merchant_id || '',
    name: row.name,
    logo: row.logo,
    announcement: row.announcement || '',
    avgPrice: row.avgPrice,
    tags: parseTags(row.tags),
    businessHours: row.businessHours || '',
    phone: row.phone || '',
    floor: row.floor || '',
    open: row.open || '0',
    queueCount: row.queueCount || '',
    rating: row.rating || '',
    description: row.description || '',
    createTime: row.createTime || '',
    updateTime: row.updateTime || '',
  });
}

function menuRecord(row) {
  if (!row) return null;
  return rewriteDeep({
    id: row._id,
    _id: row._id,
    restaurants_id: row.restaurants_id,
    status: row.status || 'active',
    auditStatus: row.auditStatus,
    menuItems: {
      name: row.name,
      price: row.price,
      image: row.image,
      description: row.description || '',
      quantity: row.quantity || '0',
      sales: row.sales || 0,
    },
  });
}

function menuDish(row) {
  if (!row) return null;
  return rewriteDeep({
    id: row._id,
    _id: row._id,
    name: row.name,
    price: row.price,
    image: row.image,
    description: row.description || '',
    quantity: 0,
  });
}

function ticketRow(row) {
  if (!row) return null;
  return {
    id: row._id,
    _id: row._id,
    _openid: row._openid,
    restaurantid: row.restaurantid,
    queueNumber: row.queueNumber,
    status: row.status,
    ticketsId: row.ticketsId,
    expireTime: row.expireTime || '',
    notes: row.notes || '',
    createTime: row.createTime,
    currentNumber: row.currentNumber,
    estimatedWaitTime: row.estimatedWaitTime,
    partySize: row.partySize,
    reserveTime: row.reserveTime || '',
  };
}

function orderRow(row) {
  if (!row) return null;
  return {
    _id: row._id,
    _openid: row._openid,
    userId: row.userId,
    ticketId: row.ticketId,
    restaurantId: row.restaurantId,
    restaurantName: row.restaurantName,
    items: parseJson(row.items, []),
    totalPrice: row.totalPrice,
    queueNumber: row.queueNumber,
    status: row.status,
    createTime: row.createTime,
  };
}

function applyRow(row) {
  if (!row) return null;
  return rewriteDeep({
    _id: row._id,
    _openid: row._openid,
    type: row.type,
    shopName: row.shopName,
    nickName: row.nickName,
    logo: row.logo,
    businessLicense: row.businessLicense,
    phone: row.phone,
    tags: parseTags(row.tags),
    description: row.description || parseTags(row.tags)[0] || '',
    dishImage: row.dishImage,
    dishName: row.dishName,
    price: row.price,
    restaurants_id: row.restaurants_id,
    auditStatus: row.auditStatus,
    applyTime: row.applyTime,
  });
}

function announcementRow(row) {
  if (!row) return null;
  return rewriteDeep({
    _id: row._id,
    _openid: row._openid,
    title: row.title,
    content: row.content,
    imageUrl: row.imageUrl,
    status: row.status,
    createTime: row.createTime,
    updatedAt: row.updatedAt,
  });
}

function userPublic(row) {
  if (!row) return null;
  return rewriteDeep({
    _id: row._id,
    _openid: row._openid || row._id,
    avatarUrl: row.avatarUrl,
    nickName: row.nickName,
    userType: row.userType,
    registerTime: row.registerTime,
    updateTime: row.updateTime,
    isAdmin: !!row.isAdmin,
    isMerchant: !!row.isMerchant,
    roleLabel: row.roleLabel || '普通会员',
  });
}

function resolveSession(db, row) {
  if (!row) return null;
  const openid = row._openid || row._id;
  const adminHit = db.prepare('SELECT 1 AS n FROM admins WHERE _openid = ? OR _id = ?').get(openid, row._id);
  const merchantHit = db.prepare('SELECT 1 AS n FROM merchants WHERE _openid = ?').get(openid);
  const isAdmin = row.userType === 'admin' || Boolean(adminHit);
  const isMerchant = row.userType === 'merchant' || Boolean(merchantHit);
  const userType = isAdmin ? 'admin' : (isMerchant ? 'merchant' : (row.userType || 'user'));
  const roleLabel = isAdmin && isMerchant ? '管理员·商家' : (isAdmin ? '管理员' : (isMerchant ? '商家' : '普通会员'));
  return userPublic({ ...row, userType, isAdmin, isMerchant, roleLabel });
}

function dateRange(filter) {
  const format = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
  };
  const date = new Date();
  if (filter === 'week') {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + diff);
    const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
    return { start: format(start), end: format(end) };
  }
  if (filter === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: format(start), end: format(end) };
  }
  const t = format(date);
  return { start: t, end: t };
}

function inDateRange(createTime, start, end) {
  if (!createTime) return false;
  const day = String(createTime).split(' ')[0];
  return day >= start && day <= end;
}

function waitMinutes(diff) {
  if (diff <= 0) return 0;
  if (diff <= 5) return 0;
  if (diff <= 10) return 8;
  if (diff <= 15) return 16;
  return 24;
}

module.exports = {
  newId,
  nowText,
  todayPrefix,
  parseJson,
  rewriteCloudUrl,
  rewriteDeep,
  parseTags,
  restaurantRow,
  menuRecord,
  menuDish,
  ticketRow,
  orderRow,
  applyRow,
  announcementRow,
  userPublic,
  resolveSession,
  dateRange,
  inDateRange,
  waitMinutes,
};
