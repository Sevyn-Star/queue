const api = require('../../utils/api');
const { isLocalTemp } = require('../../utils/session');
const app = getApp();

Page({
    data: {
        isHidden: true,
        avatarUrl: '',
        nickName: '',
        userType: '',
        adminPassword: '',
        baseUrl: '',
        version: 'v1.0.0',
        showFeedback: false,
        feedbackText: '',
        features: [{
                id: 'orders',
                name: '我的订单',
                icon: '../../image/my/orderform.png',
            },
            {
                id: 'queue',
                name: '排队/预约',
                icon: '../../image/my/line_up.png',
            },
            {
                id: 'feedback',
                name: '意见反馈',
                icon: '../../image/my/opinion.png',
                color: '#9370DB'
            }
        ],
    },

    formatTime() {
        const date = new Date()
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}/${month}/${day} ${hours}:${minutes}`
    },

    onShow() {
        this.setData({
            baseUrl: (app.globalData && app.globalData.baseUrl) || 'http://127.0.0.1:3001'
        });
        const userInfo = wx.getStorageSync('userinfo')
        if (userInfo) {
            this.setData({
                userInfo,
                avatarUrl: userInfo.avatarUrl,
                nickName: userInfo.nickName,
                userType: userInfo.userType
            })
            this.refreshFeatures(userInfo);
        } else {
            this.refreshFeatures(null);
        }
    },

    requireLogin() {
        if (wx.getStorageSync('userinfo') && wx.getStorageSync('token')) return true;
        wx.showToast({ title: '请先登录', icon: 'none' });
        this.goLogin();
        return false;
    },

    refreshFeatures(userInfo) {
        const features = [{
                id: 'orders',
                name: '我的订单',
                icon: '../../image/my/orderform.png',
            },
            {
                id: 'queue',
                name: '排队/预约',
                icon: '../../image/my/line_up.png',
            },
            {
                id: 'feedback',
                name: '意见反馈',
                icon: '../../image/my/opinion.png',
                color: '#9370DB'
            }
        ];
        if (userInfo && userInfo.isMerchant) {
            features.push({
                id: 'merchant',
                name: '商家中心',
                icon: '../../image/my/orderform.png',
            });
        } else if (userInfo && !userInfo.isAdmin) {
            features.push({
                id: 'apply',
                name: '商家入驻',
                icon: '../../image/my/line_up.png',
            });
        }
        if (userInfo && userInfo.isAdmin) {
            features.push({
                id: 'admin',
                name: '管理后台',
                icon: '../../image/my/collect.png',
            });
        }
        this.setData({ features });
    },

    goToFeaturePage(e) {
        const id = e.currentTarget.dataset.id;
        if (id === 'feedback') {
            this.setData({ showFeedback: true, feedbackText: '' });
            return;
        }
        if (!this.requireLogin()) return;
        if (id === 'orders' || id === 'queue') {
            getApp().openQueuePage({ tab: 'mine' });
            return;
        }
        if (id === 'merchant') {
            const openid = (wx.getStorageSync('userinfo') || {})._openid || '';
            wx.navigateTo({ url: `/pages/merchant/merchant?openid=${openid}` });
            return;
        }
        if (id === 'admin') {
            wx.navigateTo({ url: '/pages/admin/admin' });
            return;
        }
        if (id === 'apply') {
            api.getMerchantStatus()
                .then(res => {
                    if (res.status === 'pending') {
                        wx.navigateTo({ url: '/pages/audit-pending/audit-pending' });
                    } else {
                        wx.navigateTo({ url: '/pages/register/register' });
                    }
                })
                .catch(() => {
                    wx.navigateTo({ url: '/pages/register/register' });
                });
        }
    },

    onFeedbackInput(e) {
        this.setData({ feedbackText: e.detail.value });
    },

    closeFeedback() {
        this.setData({ showFeedback: false, feedbackText: '' });
    },

    submitFeedback() {
        const text = (this.data.feedbackText || '').trim();
        if (!text) {
            wx.showToast({ title: '请填写反馈内容', icon: 'none' });
            return;
        }
        this.setData({ showFeedback: false, feedbackText: '' });
        wx.showToast({ title: '感谢反馈', icon: 'success' });
    },

    async changeAvatar() {
        if (!this.requireLogin()) return;
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: async (res) => {
                const filePath = res.tempFiles[0].tempFilePath;
                wx.showLoading({ title: '上传中...' });
                try {
                    const uploadRes = await api.uploadFile(filePath, 'avatars');
                    await this.updateProfile({ avatarUrl: uploadRes.url || uploadRes.fileID });
                    wx.hideLoading();
                    wx.showToast({ title: '头像已更新', icon: 'success' });
                } catch (err) {
                    wx.hideLoading();
                    wx.showToast({ title: (err && err.message) || '上传失败', icon: 'none' });
                }
            }
        });
    },

    modifyNickName() {
        if (!this.requireLogin()) return;
        wx.showModal({
            title: '修改昵称',
            editable: true,
            placeholderText: '请输入新昵称',
            content: this.data.nickName || '',
            success: async (res) => {
                if (!res.confirm) return;
                const nickName = (res.content || '').trim();
                if (!nickName) {
                    wx.showToast({ title: '昵称不能为空', icon: 'none' });
                    return;
                }
                try {
                    await this.updateProfile({ nickName });
                    wx.showToast({ title: '昵称已更新', icon: 'success' });
                } catch (err) {
                    wx.showToast({ title: (err && err.message) || '更新失败', icon: 'none' });
                }
            }
        });
    },

    async updateProfile(patch) {
        const prev = wx.getStorageSync('userinfo') || {};
        const loginRes = await api.login({
            nickName: patch.nickName || prev.nickName,
            avatarUrl: patch.avatarUrl || prev.avatarUrl || '',
            userId: prev._openid || prev._id || '',
        });
        wx.setStorageSync('token', loginRes.token);
        wx.setStorageSync('userinfo', loginRes.user);
        this.setData({
            userInfo: loginRes.user,
            avatarUrl: loginRes.user.avatarUrl,
            nickName: loginRes.user.nickName,
            userType: loginRes.user.userType
        });
        this.refreshFeatures(loginRes.user);
    },

    goToSettings() {
        wx.showToast({ title: '点击头像或昵称即可修改', icon: 'none' });
    },

    navigateToH5(e) {
        const type = e.currentTarget.dataset.type;
        const map = {
            about: { title: '关于我们', content: '商场排队点餐小程序，支持取号、预约、点餐与商家叫号。' },
            agreement: { title: '用户协议', content: '请合理使用排队与点餐功能，过号请重新取号。本系统仅供课程演示。' },
            privacy: { title: '隐私政策', content: '昵称与头像仅保存在本机后端，用于识别排队身份，不会对外分享。' }
        };
        const item = map[type] || map.about;
        wx.showModal({
            title: item.title,
            content: item.content,
            showCancel: false
        });
    },

    goLogin() {
        this.setData({ isHidden: false })
    },

    chooseAvatar(e) {
        this.setData({ avatarUrl: e.detail.avatarUrl })
    },

    getName(e) {
        this.setData({ nickName: e.detail.value })
    },

    getAdminPassword(e) {
        this.setData({ adminPassword: e.detail.value })
    },

    potNo() {
        this.setData({ isHidden: true })
    },

    async potYes() {
        const { avatarUrl, nickName, adminPassword } = this.data;

        if (!avatarUrl) return wx.showToast({ icon: 'error', title: '请获取头像' })
        if (!nickName) return wx.showToast({ icon: 'error', title: '请输入昵称' })

        wx.showLoading({ title: '登录中...' });
        try {
            const prev = wx.getStorageSync('userinfo') || {};
            const needUpload = isLocalTemp(avatarUrl);
            const loginRes = await api.login({
                nickName,
                avatarUrl: needUpload ? (prev.avatarUrl || '') : avatarUrl,
                adminPassword,
                userId: prev._openid || prev._id || '',
            });
            wx.setStorageSync('token', loginRes.token);
            wx.setStorageSync('userinfo', loginRes.user);
            let userInfo = loginRes.user;
            if (needUpload) {
                const uploadRes = await api.uploadFile(avatarUrl, 'avatars');
                const patched = await api.login({
                    nickName: userInfo.nickName,
                    avatarUrl: uploadRes.url,
                    userId: userInfo._openid || userInfo._id || '',
                });
                wx.setStorageSync('token', patched.token);
                wx.setStorageSync('userinfo', patched.user);
                userInfo = patched.user;
            }
            this.setData({
                isHidden: true,
                userInfo,
                avatarUrl: userInfo.avatarUrl,
                nickName: userInfo.nickName,
                userType: userInfo.userType,
                adminPassword: ''
            });
            this.refreshFeatures(userInfo);
            wx.hideLoading();
        } catch (err) {
            wx.hideLoading();
            console.error('登录失败', err);
            wx.showToast({ icon: 'none', title: (err && err.message) || '登录失败' });
        }
    },

    loginOut() {
        wx.removeStorageSync('userinfo');
        wx.removeStorageSync('token');
        this.setData({ userInfo: null, avatarUrl: '', nickName: '', userType: '', adminPassword: '' });
        this.refreshFeatures(null);
    },

})
