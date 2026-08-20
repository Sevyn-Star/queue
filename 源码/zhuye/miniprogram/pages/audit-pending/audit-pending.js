const api = require('../../utils/api');
const { refreshSession } = require('../../utils/session');

Page({
    data: {
        title: '申请待审核',
        desc: '您的商家注册申请已提交，正在审核中，请耐心等待。',
        shopName: '',
        applyTime: ''
    },

    onShow() {
        this.refreshStatus();
    },

    refreshStatus() {
        const token = wx.getStorageSync('token');
        if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            wx.switchTab({ url: '/pages/my/my' });
            return;
        }
        wx.showLoading({ title: '查询中...' });
        api.getMerchantStatus()
            .then(res => {
                wx.hideLoading();
                const apply = res.apply || {};
                this.setData({
                    shopName: apply.shopName || '',
                    applyTime: apply.applyTime || ''
                });
                if (res.status === 'ready' || res.status === 'approved') {
                    wx.showToast({ title: '审核已通过', icon: 'success' });
                    refreshSession()
                        .catch(() => null)
                        .then((user) => {
                            const openid = (user && user._openid) || (wx.getStorageSync('userinfo') || {})._openid || '';
                            wx.redirectTo({
                                url: `/pages/merchant/merchant?openid=${openid}`
                            });
                        });
                    return;
                }
                if (res.status === 'rejected') {
                    wx.showModal({
                        title: '审核未通过',
                        content: '申请已被驳回，请修改资料后重新提交。',
                        showCancel: false,
                        success: () => {
                            wx.redirectTo({ url: '/pages/register/register' });
                        }
                    });
                    return;
                }
                if (res.status === 'none') {
                    wx.redirectTo({ url: '/pages/register/register' });
                    return;
                }
                this.setData({
                    title: '申请待审核',
                    desc: '您的商家注册申请已提交，正在审核中，请耐心等待。'
                });
            })
            .catch(err => {
                wx.hideLoading();
                wx.showToast({
                    title: (err && err.message) || '查询失败',
                    icon: 'none'
                });
            });
    },

    goHome() {
        wx.switchTab({ url: '/pages/index/index' });
    }
});
