# 商场排队点餐

面向商场餐饮场景的微信小程序：顾客可浏览餐厅、搜索、取号、预约和点餐；商家管理排队、订单和菜品；管理员审核入驻并发布公告。后端为自建 Node.js API，数据存在本地 SQLite，不再依赖微信云开发。

---

## 能做什么

| 角色 | 能力 |
|------|------|
| **顾客** | 看首页轮播与热门店、按楼层看排队、搜餐厅、进店看菜单、立即取号 / 预约 / 点餐取号、查看与取消排队、确认到店 |
| **商家** | 看营业状态与今日客流/营收、叫号、处理订单、增删改菜品、改店铺公告与信息、提交入驻申请 |
| **管理员** | 看用户数与商家数看板、通过/驳回入驻、发布/编辑/删除公告 |

登录不选身份：角色由数据库决定。普通用户留空口令即可注册；预设管理员用固定昵称 + 口令进入。

---

## 技术栈

- **前端**：微信小程序（原生 WXML / WXSS / JS），入口 `源码/zhuye`
- **后端**：Express + JWT + Multer，默认监听 `3001`
- **数据库**：SQLite（`better-sqlite3`），文件在 `backend/data/app.db`
- **静态资源**：种子图片来自 `存储数据/`，运行时由 `backend/uploads/` 提供

---

## 目录结构

```
排队/
├── README.md                 # 本说明
├── 测试内容.md               # 接口与手工测试清单
├── 源码/zhuye/               # 微信小程序工程
│   └── miniprogram/
│       ├── app.js            # 全局配置（含后端 baseUrl）
│       ├── pages/            # 页面
│       └── utils/            # api / request / session
├── backend/                  # Node API
│   ├── src/                  # 路由、鉴权、建表、种子、测试
│   ├── data/                 # SQLite 库
│   └── uploads/              # 图片静态目录
├── 数据库/                   # 种子 JSON（按行一条记录）
└── 存储数据/                 # 种子图片（公告、菜品、店铺等）
```

小程序主要页面：

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `pages/index` | 公告轮播、热门餐厅、楼层排队概览 |
| 搜索 | `pages/search` | 按店名搜索 |
| 餐厅详情 | `pages/restaurant` | 菜单、取号/点餐入口 |
| 排队 | `pages/orderform` | 取号、预约、当前排队 |
| 我的 | `pages/my` | 登录、我的号码/订单、入口 |
| 商家入驻 | `pages/register` | 提交入驻资料 |
| 审核中 | `pages/audit-pending` | 入驻待审提示 |
| 商家中心 | `pages/merchant` | 排队、订单、菜品、店铺、统计 |
| 加菜 | `pages/add-dish` | 新增/编辑菜品 |
| 管理后台 | `pages/admin` | 看板、申请、公告 |
| 发公告 | `pages/publish-announcement` | 新建/编辑公告 |

底部 Tab：首页、排队、我的。

---

## 架构

```
微信开发者工具（小程序）
        │  HTTP + JWT
        ▼
Express  /api/*
        ├── /api/auth          登录、当前用户
        ├── /api/restaurants   列表、详情、菜单、搜索、公告
        ├── /api/queue         取号、预约、到店、取消
        ├── /api/orders        提交订单、我的订单
        ├── /api/merchant      店铺、排队叫号、菜品、统计、入驻
        ├── /api/admin         看板、审核、公告管理
        └── /api/upload        图片上传
        │
        ▼
SQLite  +  /uploads 静态文件
```

原先云存储地址（`cloud://...`）在接口返回时会改写成 `PUBLIC_URL/uploads/...`。

---

## 快速开始

需要：Node.js、[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。

### 1. 启动后端

```bash
cd backend
cp .env.example .env   # 若还没有 .env
npm install
npm run seed           # 导入演示餐厅、菜品、公告和图片
npm start              # http://127.0.0.1:3001
```

开发时可用 `npm run dev`（文件变更自动重启）。

`.env` 常用项：

| 变量 | 默认 | 含义 |
|------|------|------|
| `PORT` | `3001` | 监听端口 |
| `PUBLIC_URL` | `http://127.0.0.1:3001` | 图片与接口对外地址 |
| `JWT_SECRET` | 示例值 | 签发登录 token |
| `ADMIN_PASSWORD` | `admin123` | 管理员口令 |

### 2. 打开小程序

1. 微信开发者工具导入目录：`源码/zhuye`
2. 详情 → 本地设置：勾选 **不校验合法域名、web-view、TLS 版本以及 HTTPS 证书**
3. 模拟器可直接访问 `127.0.0.1`。真机预览需把两端都改成电脑局域网 IP：
   - `源码/zhuye/miniprogram/app.js` 里的 `baseUrl`
   - `backend/.env` 里的 `PUBLIC_URL`
   - 改完后重新 `npm run seed` 并重启后端

### 3. 演示账号

| 怎么进 | 身份 | 能进哪些页 |
|--------|------|------------|
| 头像 + 任意昵称，口令留空 | 普通会员 | 逛店、排队、点餐、申请入驻 |
| 昵称 **小柒**，口令 **admin123** | 管理员 · 商家（云味小馆） | 「我的」里出现商家中心、管理后台 |

`npm run seed` 会写入约 4 家餐厅（稻香寿司、海底捞、麦门汉堡、云味小馆）、16 道菜、3 条公告。种子会清空现有排队和订单。

---

## 数据表（SQLite）

`users` / `admins` / `merchants` / `merchant_applies` / `restaurants` / `menu_items` / `queue_tickets` / `orders` / `announcements`

建表逻辑在 `backend/src/db.js`，JSON 种子在 `数据库/`。

---

## 测试

```bash
cd backend
npm start    # 另开终端
npm test     # 约 42 条接口用例
```

手工用例、已知缺口（未接微信支付、短信验证码等）见 [测试内容.md](./测试内容.md)。

---

## 后端源码对照

| 文件 | 职责 |
|------|------|
| `src/index.js` | 入口、静态目录、挂载路由 |
| `src/env.js` | 读取 `.env` |
| `src/db.js` | SQLite 与表结构 |
| `src/auth.js` | JWT、登录校验、角色 |
| `src/helpers.js` | ID、时间、云路径改写 |
| `src/seed.js` | 从 `数据库/`、`存储数据/` 灌库 |
| `src/routes/*.js` | 各业务接口 |
| `src/test-api.js` | 自动化接口测试 |
