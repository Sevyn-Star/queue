// pages/publish-announcement/publish-announcement.js
const api = require('../../utils/api');
const { requireAdmin } = require('../../utils/session');
Page({

    /**
     * 页面的初始数据
     */
    data: {
        id: null, // 公告ID，用于编辑模式
        title: '',
        content: '',
        currentDate: '',
        imageUrl: '' // 活动照片URL
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        if (!requireAdmin()) return;
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const currentDate = `${year}/${month}/${day}`;

        this.setData({
            currentDate: currentDate
        });

        // 检查是否是编辑模式
        if (options.id) {
            this.setData({
                id: options.id
            });
            // 获取公告详情
            this.getAnnouncementDetail(options.id);
        }
    },

    // 处理标题输入
    onTitleInput: function (e) {
        this.setData({
            title: e.detail.value
        });
    },

    // 处理内容输入
    onContentInput: function (e) {
        this.setData({
            content: e.detail.value
        });
    },

    // 返回上一页
    onBack: function () {
        wx.navigateBack();
    },

    // 选择图片
    onChooseImage: function () {
        const that = this;
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: function (res) {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                that.uploadImage(tempFilePath);
            },
            fail: function (err) {
                console.error('选择图片失败:', err);
            }
        });
    },

    // 修改 uploadImage 函数，直接存 FileID，不调用 getTempFileURL
    uploadImage: function (tempFilePath) {
        const that = this;
        wx.showLoading({
            title: '上传中...'
        });

        api.uploadFile(tempFilePath, 'announcement')
            .then(function (res) {
                wx.hideLoading();
                that.setData({
                    imageUrl: res.fileID || res.url
                });
                wx.showToast({
                    title: '上传成功'
                });
            })
            .catch(function (err) {
                wx.hideLoading();
                wx.showToast({
                    title: '上传失败',
                    icon: 'none'
                });
                console.error('上传图片失败:', err);
            });
    },

    // 获取公告详情
    getAnnouncementDetail: function (id) {
        wx.showLoading({
            title: '加载中...',
        });

        api.getAnnouncement(id)
            .then(res => {
                wx.hideLoading();
                if (res.data) {
                    this.setData({
                        title: res.data.title,
                        content: res.data.content,
                        imageUrl: res.data.imageUrl || ''
                    });
                }
            })
            .catch(err => {
                wx.hideLoading();
                wx.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
                console.error('获取公告详情失败:', err);
            });
    },

    // 提交公告
    onSubmit: function () {
        const {
            id,
            title,
            content,
            currentDate,
            imageUrl
        } = this.data;

        // 验证输入
        if (!title.trim()) {
            wx.showToast({
                title: '请输入公告标题',
                icon: 'none'
            });
            return;
        }

        if (!content.trim()) {
            wx.showToast({
                title: '请输入公告内容',
                icon: 'none'
            });
            return;
        }

        // 显示加载提示
        wx.showLoading({
            title: id ? '更新中...' : '发布中...',
        });

        const announcementData = {
            title: title.trim(),
            content: content.trim(),
            imageUrl: imageUrl
        };

        if (id) {
            // 编辑模式：更新公告
            api.updateAnnouncement(id, {
                    ...announcementData,
                    updatedAt: currentDate
                })
                .then(() => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '更新成功',
                        icon: 'success'
                    });
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                })
                .catch(err => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '更新失败',
                        icon: 'none'
                    });
                    console.error('更新公告失败:', err);
                });
        } else {
            // 发布模式：添加新公告
            api.createAnnouncement({
                    ...announcementData,
                    createTime: currentDate,
                    status: 'published',
                    updatedAt: currentDate
                })
                .then(() => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '发布成功',
                        icon: 'success'
                    });
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                })
                .catch(err => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '发布失败',
                        icon: 'none'
                    });
                    console.error('发布公告失败:', err);
                });
        }
    }
});