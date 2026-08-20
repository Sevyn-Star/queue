const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'app.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(dataDir, { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      avatarUrl TEXT,
      nickName TEXT,
      registerTime TEXT,
      updateTime TEXT,
      userType TEXT
    );
    CREATE TABLE IF NOT EXISTS admins (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      avatarUrl TEXT,
      nickName TEXT,
      updateTime TEXT,
      userType TEXT
    );
    CREATE TABLE IF NOT EXISTS merchants (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      nickName TEXT,
      avatarUrl TEXT,
      shopName TEXT,
      phone TEXT,
      description TEXT,
      logo TEXT,
      type TEXT,
      createTime TEXT
    );
    CREATE TABLE IF NOT EXISTS merchant_applies (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      type TEXT,
      shopName TEXT,
      nickName TEXT,
      logo TEXT,
      businessLicense TEXT,
      phone TEXT,
      tags TEXT,
      description TEXT,
      dishImage TEXT,
      dishName TEXT,
      price TEXT,
      restaurants_id TEXT,
      auditStatus INTEGER,
      applyTime TEXT
    );
    CREATE TABLE IF NOT EXISTS restaurants (
      _id TEXT PRIMARY KEY,
      merchant_openid TEXT,
      merchant_id TEXT,
      name TEXT,
      logo TEXT,
      announcement TEXT,
      avgPrice TEXT,
      tags TEXT,
      businessHours TEXT,
      phone TEXT,
      floor TEXT,
      open TEXT,
      queueCount TEXT,
      rating TEXT,
      description TEXT,
      createTime TEXT,
      updateTime TEXT
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      _id TEXT PRIMARY KEY,
      restaurants_id TEXT,
      name TEXT,
      price TEXT,
      image TEXT,
      description TEXT,
      quantity TEXT,
      status TEXT,
      sales INTEGER DEFAULT 0,
      auditStatus INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS queue_tickets (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      restaurantid TEXT,
      queueNumber REAL,
      status TEXT,
      ticketsId TEXT,
      expireTime TEXT,
      notes TEXT,
      createTime TEXT,
      currentNumber REAL,
      estimatedWaitTime REAL,
      partySize REAL,
      reserveTime TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      userId TEXT,
      ticketId TEXT,
      restaurantId TEXT,
      restaurantName TEXT,
      items TEXT,
      totalPrice REAL,
      queueNumber REAL,
      status TEXT,
      createTime TEXT
    );
    CREATE TABLE IF NOT EXISTS announcements (
      _id TEXT PRIMARY KEY,
      _openid TEXT,
      title TEXT,
      content TEXT,
      imageUrl TEXT,
      status TEXT,
      createTime TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_users_openid ON users(_openid);
  `);
}

module.exports = { getDb, dbPath, dataDir };
