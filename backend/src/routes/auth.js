const express = require('express');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { signToken } = require('../auth');
const { adminPassword, jwtSecret } = require('../env');
const { newId, nowText, rewriteCloudUrl, resolveSession } = require('../helpers');

const router = express.Router();

function findByUserId(db, userId) {
  if (!userId) return null;
  return db.prepare('SELECT * FROM users WHERE _openid = ? OR _id = ?').get(userId, userId) || null;
}

function findPresetAdmin(db, nickName) {
  if (!nickName) return null;
  const byType = db.prepare(`SELECT * FROM users WHERE nickName = ? AND userType = 'admin'`).get(nickName);
  if (byType) return byType;
  const admin = db.prepare('SELECT * FROM admins WHERE nickName = ?').get(nickName);
  if (!admin) return null;
  return db.prepare('SELECT * FROM users WHERE _openid = ? OR _id = ?').get(admin._openid, admin._id) || null;
}

function issue(row, db) {
  const user = resolveSession(db, row);
  const token = signToken({
    userId: user._openid,
    userType: user.userType,
    nickName: user.nickName,
  });
  return { success: true, token, user };
}

router.post('/login', (req, res) => {
  const { nickName, avatarUrl, adminPassword: inputPassword, userId } = req.body || {};
  if (!nickName) return res.status(400).json({ success: false, message: '请输入昵称' });

  const db = getDb();
  const time = nowText();
  const avatar = rewriteCloudUrl(avatarUrl || '');

  if (inputPassword) {
    if (inputPassword !== adminPassword) {
      return res.status(403).json({ success: false, message: '管理员密码错误' });
    }
    const adminUser = findPresetAdmin(db, nickName);
    if (!adminUser) {
      return res.status(403).json({ success: false, message: '该昵称不是预设管理员' });
    }
    db.prepare('UPDATE users SET avatarUrl=?, updateTime=? WHERE _id=?').run(
      avatar || adminUser.avatarUrl, time, adminUser._id
    );
    const row = db.prepare('SELECT * FROM users WHERE _id=?').get(adminUser._id);
    return res.json(issue(row, db));
  }

  let row = findByUserId(db, userId);
  if (row) {
    db.prepare('UPDATE users SET avatarUrl=?, nickName=?, updateTime=? WHERE _id=?').run(
      avatar || row.avatarUrl, nickName, time, row._id
    );
    row = db.prepare('SELECT * FROM users WHERE _id=?').get(row._id);
    return res.json(issue(row, db));
  }

  const id = newId();
  const openid = userId || id;
  db.prepare(`INSERT INTO users (_id,_openid,avatarUrl,nickName,registerTime,updateTime,userType)
    VALUES (?,?,?,?,?,?,?)`).run(id, openid, avatar, nickName, time, time, 'user');
  row = db.prepare('SELECT * FROM users WHERE _id=?').get(id);
  return res.json(issue(row, db));
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ success: false, message: '请先登录' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const db = getDb();
    const row = db.prepare('SELECT * FROM users WHERE _openid = ? OR _id = ?').get(payload.userId, payload.userId);
    if (!row) return res.status(404).json({ success: false, message: '用户不存在' });
    return res.json(issue(row, db));
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
});

module.exports = router;
