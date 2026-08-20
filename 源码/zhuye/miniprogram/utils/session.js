function isLocalTemp(filePath) {
    if (!filePath) return false;
    const path = String(filePath);
    if (path.startsWith('wxfile://') || path.startsWith('file://')) return true;
    if (path.indexOf('://tmp') !== -1 || path.indexOf('/tmp/') !== -1) return true;
    if (path.startsWith('http://') || path.startsWith('https://')) return false;
    return true;
}

function requireLogin() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userinfo');
    if (token && userInfo) return userInfo;
    wx.showToast({ title: '请先登录', icon: 'none' });
    wx.switchTab({ url: '/pages/my/my' });
    return null;
}

function requireAdmin() {
    const userInfo = requireLogin();
    if (!userInfo) return null;
    if (!userInfo.isAdmin) {
        wx.showToast({ title: '无管理员权限', icon: 'none' });
        wx.switchTab({ url: '/pages/my/my' });
        return null;
    }
    return userInfo;
}

function requireMerchant() {
    const userInfo = requireLogin();
    if (!userInfo) return null;
    if (!userInfo.isMerchant && !userInfo.isAdmin) {
        wx.showToast({ title: '无商家权限', icon: 'none' });
        wx.switchTab({ url: '/pages/my/my' });
        return null;
    }
    return userInfo;
}

async function refreshSession() {
    const api = require('./api');
    const res = await api.getMe();
    if (res.token) wx.setStorageSync('token', res.token);
    if (res.user) wx.setStorageSync('userinfo', res.user);
    return res.user;
}

module.exports = {
    isLocalTemp,
    requireLogin,
    requireAdmin,
    requireMerchant,
    refreshSession,
};
