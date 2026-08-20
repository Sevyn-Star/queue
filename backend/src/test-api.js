const BASE = process.env.PUBLIC_URL || 'http://127.0.0.1:3001';

let passed = 0;
let failed = 0;
const results = [];

async function req(method, path, { token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

function assert(name, ok, detail) {
  if (ok) {
    passed += 1;
    results.push({ name, ok: true, detail: detail || '' });
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    results.push({ name, ok: false, detail: String(detail || '') });
    console.log(`FAIL  ${name}  ${detail || ''}`);
  }
}

async function run() {
  console.log(`Testing ${BASE}\n`);

  const health = await req('GET', '/api/health');
  assert('健康检查', health.status === 200 && health.data.ok === true, health.status);

  const restaurants = await req('GET', '/api/restaurants');
  assert('餐厅列表', restaurants.status === 200 && Array.isArray(restaurants.data.data) && restaurants.data.data.length >= 4, restaurants.data.data && restaurants.data.data.length);
  const shop = (restaurants.data.data || []).find((r) => r.name === '云味小馆') || (restaurants.data.data || [])[0];
  assert('餐厅含云味小馆', Boolean(shop && shop._id), shop && shop.name);
  assert('餐厅 logo 为本地 HTTP', Boolean(shop && String(shop.logo).startsWith('http://')), shop && shop.logo);

  const detail = await req('GET', `/api/restaurants/${shop._id}`);
  assert('餐厅详情', detail.status === 200 && detail.data.data && detail.data.data.name === shop.name);

  const menu = await req('GET', `/api/restaurants/${shop._id}/menu`);
  assert('餐厅菜单', menu.status === 200 && menu.data.data.length >= 1, menu.data.data && menu.data.data.length);

  const searchHit = await req('GET', '/api/search?q=寿司');
  assert('搜索寿司有结果', searchHit.status === 200 && searchHit.data.data.length > 0, searchHit.data.data && searchHit.data.data.length);

  const searchMiss = await req('GET', '/api/search?q=不存在的店xyz');
  assert('搜索无结果返回空数组', searchMiss.status === 200 && Array.isArray(searchMiss.data.data) && searchMiss.data.data.length === 0);

  const anns = await req('GET', '/api/announcements');
  assert('公告列表', anns.status === 200 && anns.data.data.length >= 1, anns.data.data && anns.data.data.length);

  const sushi = (restaurants.data.data || []).find((r) => r.name === '稻香寿司');
  const img = await fetch(sushi.logo);
  assert('静态图片可访问', img.status === 200 && Number(img.headers.get('content-length') || 1) > 0, `${img.status} ${sushi && sushi.logo}`);

  const noAuth = await req('POST', '/api/queue', { body: { restaurantId: shop._id, type: 'queue' } });
  assert('未登录取号被拒绝', noAuth.status === 401);

  const fakeAdmin = await req('POST', '/api/auth/login', {
    body: { nickName: '路人甲', userType: 'admin', avatarUrl: '' },
  });
  assert('前端自称管理员无效', fakeAdmin.status === 200 && fakeAdmin.data.user.userType === 'user' && !fakeAdmin.data.user.isAdmin);

  const badAdmin = await req('POST', '/api/auth/login', {
    body: { nickName: '小柒', adminPassword: 'wrong' },
  });
  assert('错误管理员密码拒绝', badAdmin.status === 403);

  const userLogin = await req('POST', '/api/auth/login', {
    body: { nickName: '测试用户', avatarUrl: '' },
  });
  assert('普通用户登录', userLogin.status === 200 && userLogin.data.user.userType === 'user', userLogin.data.message);
  const userToken = userLogin.data.token;

  const presetLogin = await req('POST', '/api/auth/login', {
    body: { nickName: '小柒', adminPassword: 'admin123' },
  });
  assert('预设管理员口令登录', presetLogin.status === 200 && presetLogin.data.user.isAdmin === true);
  assert('预设账号同时是商家', presetLogin.data.user.isMerchant === true, JSON.stringify(presetLogin.data.user));
  const merchantToken = presetLogin.data.token;
  const adminToken = presetLogin.data.token;

  const ticket = await req('POST', '/api/queue', {
    token: userToken,
    body: { restaurantId: shop._id, partySize: 2, type: 'queue' },
  });
  assert('用户取号', ticket.status === 200 && ticket.data._id, ticket.data.message);
  const ticketId = ticket.data._id;
  assert('取号号码递增', ticket.data.data && ticket.data.data.queueNumber >= 1, ticket.data.data && ticket.data.data.queueNumber);

  const reserve = await req('POST', '/api/queue', {
    token: userToken,
    body: { restaurantId: shop._id, partySize: 3, type: 'reserve', reserveDate: '2026/08/15', reserveTime: '18:00' },
  });
  assert('用户预约', reserve.status === 200 && reserve.data.data.status === 'reserved');

  const mine = await req('GET', '/api/queue/mine', { token: userToken });
  assert('我的排队记录', mine.status === 200 && mine.data.data.length >= 2, mine.data.data && mine.data.data.length);

  const progress = await req('GET', `/api/queue/progress/${shop._id}`);
  assert('排队进度', progress.status === 200 && progress.data.data.currentNumber >= 1);

  const order = await req('POST', '/api/orders', {
    token: userToken,
    body: {
      ticketId,
      restaurantId: shop._id,
      restaurantName: shop.name,
      items: [{ id: menu.data.data[0].id, name: menu.data.data[0].name, price: menu.data.data[0].price, quantity: 1 }],
      totalPrice: Number(menu.data.data[0].price),
      queueNumber: ticket.data.data.queueNumber,
    },
  });
  assert('提交订单', order.status === 200 && order.data._id);

  const myOrders = await req('GET', '/api/orders/mine', { token: userToken });
  assert('我的订单', myOrders.status === 200 && myOrders.data.data.length >= 1);

  const arrive = await req('PUT', `/api/queue/${ticketId}/arrive`, { token: userToken });
  assert('确认到店', arrive.status === 200);

  const cancel = await req('PUT', `/api/queue/${reserve.data._id}/cancel`, { token: userToken });
  assert('取消预约', cancel.status === 200);

  const mShop = await req('GET', '/api/merchant/restaurant', { token: merchantToken });
  assert('商家店铺信息', mShop.status === 200 && mShop.data.data.name === '云味小馆');

  const mQueue = await req('GET', '/api/merchant/queue', { token: merchantToken });
  assert('商家排队列表', mQueue.status === 200 && Array.isArray(mQueue.data.data));

  const waiting = (mQueue.data.data || []).find((t) => t.status === 'waiting');
  if (waiting) {
    const call = await req('POST', '/api/merchant/queue/call-next', {
      token: merchantToken,
      body: { nextCallNumber: waiting.queueNumber, ticketId: waiting._id },
    });
    assert('商家叫号', call.status === 200, call.data.message);
  } else {
    assert('商家叫号(当前无 waiting 跳过逻辑)', true, 'no waiting ticket');
  }

  const mOrders = await req('GET', '/api/merchant/orders', { token: merchantToken });
  assert('商家订单列表', mOrders.status === 200 && Array.isArray(mOrders.data.data));

  const dishes = await req('GET', '/api/merchant/dishes', { token: merchantToken });
  assert('商家菜品列表', dishes.status === 200 && dishes.data.data.length >= 1);

  const created = await req('POST', '/api/merchant/dishes', {
    token: merchantToken,
    body: { name: '测试菜', price: 9.9, description: '接口测试', image: shop.logo, quantity: 0, status: 'active' },
  });
  assert('商家新增菜品', created.status === 200 && created.data._id);
  const dishId = created.data._id;

  const updated = await req('PUT', `/api/merchant/dishes/${dishId}`, {
    token: merchantToken,
    body: { status: 'inactive', price: 12 },
  });
  assert('商家更新菜品', updated.status === 200);

  const deleted = await req('DELETE', `/api/merchant/dishes/${dishId}`, { token: merchantToken });
  assert('商家删除菜品', deleted.status === 200);

  const stats = await req('GET', '/api/merchant/stats?filter=today', { token: merchantToken });
  assert('商家今日统计', stats.status === 200 && typeof stats.data.data.todayCustomers === 'number');

  const toggle = await req('PUT', '/api/merchant/restaurant', {
    token: merchantToken,
    body: { announcement: '接口测试公告', open: '1' },
  });
  assert('商家更新店铺', toggle.status === 200 && toggle.data.data.stats.updated === 1);

  const overview = await req('GET', '/api/admin/overview', { token: adminToken });
  assert('管理员看板', overview.status === 200 && overview.data.data.overview.totalUsers >= 1);

  const applies = await req('GET', '/api/admin/applies', { token: adminToken });
  assert('管理员申请列表', applies.status === 200 && Array.isArray(applies.data.data));

  const pending = (applies.data.data || []).find((a) => Number(a.auditStatus) === 0);
  if (pending) {
    const reject = await req('POST', `/api/admin/applies/${pending._id}/reject`, { token: adminToken });
    assert('管理员驳回申请', reject.status === 200);
  } else {
    assert('管理员驳回申请(无待审则跳过)', true);
  }

  const createdAnn = await req('POST', '/api/admin/announcements', {
    token: adminToken,
    body: { title: '测试公告', content: '自动化测试发布', imageUrl: shop.logo, status: 'published' },
  });
  assert('管理员发布公告', createdAnn.status === 200 && createdAnn.data._id);

  const updAnn = await req('PUT', `/api/admin/announcements/${createdAnn.data._id}`, {
    token: adminToken,
    body: { content: '自动化测试更新' },
  });
  assert('管理员更新公告', updAnn.status === 200);

  const delAnn = await req('DELETE', `/api/admin/announcements/${createdAnn.data._id}`, { token: adminToken });
  assert('管理员删除公告', delAnn.status === 200);

  const userAsAdmin = await req('GET', '/api/admin/overview', { token: userToken });
  assert('普通用户不能进管理端', userAsAdmin.status === 403);

  const userAsMerchant = await req('GET', '/api/merchant/restaurant', { token: userToken });
  assert('普通用户不能进商家端', userAsMerchant.status === 403);

  const userStatus = await req('GET', '/api/merchant/status', { token: userToken });
  assert('普通用户可查入驻状态', userStatus.status === 200, userStatus.data && userStatus.data.message);

  const userApply = await req('POST', '/api/merchant/apply', {
    token: userToken,
    body: { type: 'shop', shopName: '测试入驻店', nickName: '测试用户', phone: '13800000000', description: '测试描述' },
  });
  assert('普通用户可提交入驻', userApply.status === 200 && userApply.data._id, userApply.data && userApply.data.message);

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  if (failed) process.exitCode = 1;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
