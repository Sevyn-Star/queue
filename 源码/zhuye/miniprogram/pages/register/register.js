// pages/register/register.js
const api = require('../../utils/api');
const { requireLogin } = require('../../utils/session');

Page({

    /**
     * 页面的初始数据
     */
    data: {
        avatarUrl: '', // 头像URL
        nickname: '', // 商家昵称
        shopAvatarUrl: '', // 店铺头像URL
        shopName: '', // 店铺名称
        shopDescription: '', // 店铺描述（用于输入框绑定）
        phone: '', // 联系方式
        licenseUrl: '', // 营业执照URL
        showModal: false, // 弹窗显示状态
        modalTitle: '', // 弹窗标题
        modalMessage: '', // 弹窗消息
        modalButtonText: '确定' ,// 弹窗按钮文字
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        if (!requireLogin()) return;
        const userInfo = wx.getStorageSync('userinfo');
        if (userInfo) {
            this.setData({
                nickname: userInfo.nickName || '',
                avatarUrl: userInfo.avatarUrl || ''
            });
        }
    },
    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    /**
     * 选择头像
     */
    onChooseAvatar(e) {
        const {
            avatarUrl
        } = e.detail;
        this.setData({
            avatarUrl
        });
        console.log('头像选择成功:', avatarUrl);
    },

    /**
     * 昵称输入处理
     */
    onNicknameInput(e) {
        this.setData({
            nickname: e.detail.value
        });
    },

    /**
     * 手机号输入处理
     */
    onPhoneInput(e) {
        this.setData({
            phone: e.detail.value
        });
    },

    /**
     * 选择店铺头像
     */
    chooseShopAvatar() {
        const that = this;
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            sizeType: ['compressed'],
            success(res) {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                that.setData({
                    shopAvatarUrl: tempFilePath
                });
                console.log('店铺头像选择成功:', tempFilePath);
            },
            fail(err) {
                console.error('选择店铺头像失败:', err);
                that.showModal('错误', '选择店铺头像失败，请重试');
            }
        });
    },

    /**
     * 店铺名称输入处理
     */
    onShopNameInput(e) {
        this.setData({
            shopName: e.detail.value
        });
    },

    /**
     * 店铺描述输入处理
     */
    onShopDescInput(e) {
        this.setData({
            shopDescription: e.detail.value
        });
    },

    /**
     * 选择营业执照
     */
    onChooseLicense() {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            maxDuration: 30,
            camera: 'back',
            success: (res) => {
                const licenseUrl = res.tempFiles[0].tempFilePath;
                this.setData({
                    licenseUrl
                });
                console.log('营业执照选择成功:', licenseUrl);
            },
            fail: (err) => {
                console.error('选择营业执照失败:', err);
                this.showModal('提示', '选择营业执照失败，请重试');
            }
        });
    },

    /**
     * 表单验证
     */
    validateForm() {
        const {
            avatarUrl,
            nickname,
            shopAvatarUrl,
            shopName,
            phone,
            licenseUrl
        } = this.data;

        if (!avatarUrl) {
            this.showModal('提示', '请上传商家头像');
            return false;
        }

        if (!nickname.trim()) {
            this.showModal('提示', '请输入商家昵称');
            return false;
        }

        if (!shopAvatarUrl) {
            this.showModal('提示', '请上传店铺头像');
            return false;
        }

        if (!shopName.trim()) {
            this.showModal('提示', '请输入店铺名称');
            return false;
        }

        if (!phone.trim()) {
            this.showModal('提示', '请输入联系方式');
            return false;
        }

        // 简单的手机号验证
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            this.showModal('提示', '请输入有效的手机号码');
            return false;
        }

        if (!licenseUrl) {
            this.showModal('提示', '请上传营业执照');
            return false;
        }

        return true;
    },

    /**
     * 上传文件到本地后端
     */
    uploadFileToCloud(filePath, folder) {
        return api.uploadFile(filePath, folder).then(res => res.fileID || res.url);
    },

    /**
     * 格式化申请时间为：2025/10/29 22:40
     */
    formatApplyTime() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始，补0
        const day = String(date.getDate()).padStart(2, '0'); // 日期补0
        const hours = String(date.getHours()).padStart(2, '0'); // 小时补0
        const minutes = String(date.getMinutes()).padStart(2, '0'); // 分钟补0
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    },

  /**
 * 提交申请
 */
async onSubmit() {
    if (!requireLogin()) return;
    if (!this.validateForm()) {
        return;
    }

    wx.showLoading({
        title: '提交中...'
    });

    try {
        // 1. 生成云存储路径（避免文件名重复）
        const timeStamp = Date.now(); // 时间戳作为唯一标识
        const avatarCloudPath = `merchant_apply/avatar/${timeStamp}_avatar.png`;
        const shopAvatarCloudPath = `merchant_apply/shop_avatar/${timeStamp}_shop.png`;
        const licenseCloudPath = `merchant_apply/license/${timeStamp}_license.png`;

        // 2. 上传所有图片到云存储（并行上传）
        const [
            avatarFileID,
            shopAvatarFileID,
            licenseFileID
        ] = await Promise.all([
            this.uploadFileToCloud(this.data.avatarUrl, 'merchant_apply/avatar'),
            this.uploadFileToCloud(this.data.shopAvatarUrl, 'merchant_apply/shop_avatar'),
            this.uploadFileToCloud(this.data.licenseUrl, 'merchant_apply/license')
        ]);

        // 3. 准备提交到merchant_apply表的数据
        const applyData = {
            type: "shop",
            shopName: this.data.shopName,
            nickName: this.data.nickname,
            logo: shopAvatarFileID,
            businessLicense: licenseFileID,
            phone: this.data.phone,
            description: this.data.shopDescription || '',
            tags: this.data.shopDescription ? [this.data.shopDescription] : [],
            auditStatus: 0,
            applyTime: this.formatApplyTime()
        };

        // 4. 插入数据到merchant_apply表
        await api.submitMerchantApply(applyData);

        wx.hideLoading(); // 隐藏加载框

        // 5. 直接跳转到待审核页面（无需查询，提交时已明确auditStatus=0）
        this.showModal('提交成功', '您的商家注册申请已提交，请等待审核', () => {
            wx.navigateTo({
                url: '/pages/audit-pending/audit-pending'
            });
        });

    } catch (error) {
        console.error('提交失败:', error);
        wx.hideLoading();
        this.showModal('提交失败', error.message || '网络错误，请稍后重试');
    }
},
    /**
     * 显示弹窗
     */
    showModal(title, message, callback) {
        this.setData({
            showModal: true,
            modalTitle: title,
            modalMessage: message,
            modalButtonText: '确定'
        });
        this.modalCallback = callback;
    },

    /**
     * 关闭弹窗
     */
    closeModal() {
        this.setData({
            showModal: false
        });
        if (typeof this.modalCallback === 'function') {
            this.modalCallback();
            this.modalCallback = null;
        }
    }
})