// pages/add-dish/add-dish.js
const api = require('../../utils/api');
Page({
    data: {
        restaurantId: '',
        shopName: '',
        dishName: '',
        description: '',
        price: '',
        image: '',
        quantity: '0',
        status: 'active',
        auditStatus: 0,
        isEdit: false,
        dishId: ''
    },

    onLoad(options) {
        console.log('传过来的参数:', options);
        // 接收从merchant页面传来的餐厅ID
        if (options.restaurantId) {
            this.setData({
                restaurantId: options.restaurantId
            });
            console.log('餐厅ID:', options.restaurantId);
        }
        // 新增：接收并解码店铺名称（处理空格/特殊字符）
        if (options.shopName) {
            const shopName = decodeURIComponent(options.shopName);
            this.setData({
                shopName: shopName
            });
            console.log('店铺名称:', shopName);
        }
        
        // 处理编辑模式
        if (options.isEdit === 'true' && options.dishInfo) {
            try {
                const dishInfo = JSON.parse(decodeURIComponent(options.dishInfo));
                console.log('编辑菜品信息:', dishInfo);
                this.setData({
                    isEdit: true,
                    dishId: dishInfo._id || dishInfo.id,
                    dishName: dishInfo.name || '',
                    description: dishInfo.description || '',
                    price: dishInfo.price || '',
                    image: dishInfo.image || '',
                    quantity: dishInfo.quantity || '0',
                    status: dishInfo.status || 'active'
                });
            } catch (error) {
                console.error('解析菜品信息失败:', error);
                wx.showToast({
                    title: '获取菜品信息失败',
                    icon: 'none'
                });
            }
        }
    },

    // 输入框内容处理（保持原有逻辑）
    onNameInput(e) {
        this.setData({
            dishName: e.detail.value
        });
    },
    onDescriptionInput(e) {
        this.setData({
            description: e.detail.value
        });
    },
    onPriceInput(e) {
        const value = e.detail.value;
        if (/^\d*\.?\d*$/.test(value) || value === '') {
            this.setData({
                price: value
            });
        }
    },
    onQuantityInput(e) {
        const value = e.detail.value;
        if (/^\d*$/.test(value) || value === '') {
            this.setData({
                quantity: value
            });
        }
    },

    // 选择并上传图片（保持原有逻辑）
    onChooseImage() {
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                this.uploadImage(tempFilePath);
            }
        });
    },

    uploadImage(tempFilePath) {
        wx.showLoading({
            title: '上传中...'
        });
        const folder = 'dishes';
        api.uploadFile(tempFilePath, folder)
            .then((res) => {
                this.setData({
                    image: res.fileID || res.url
                });
                wx.hideLoading();
                wx.showToast({
                    title: '图片上传成功',
                    icon: 'success'
                });
            })
            .catch((err) => {
                console.error(err);
                wx.hideLoading();
                wx.showToast({
                    title: '图片上传失败',
                    icon: 'none'
                });
            });
    },

    // 格式化申请时间
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        return `${year}/${month}/${day} ${hour}:${minute}`;
    },

    onSubmit() {
        // 表单验证
        if (!this.data.dishName.trim()) {
            wx.showToast({
                title: '请输入菜品名称',
                icon: 'none'
            });
            return;
        }
        if (!this.data.price || parseFloat(this.data.price) <= 0) {
            wx.showToast({
                title: '请输入有效价格',
                icon: 'none'
            });
            return;
        }
        if (!this.data.image) {
            wx.showToast({
                title: '请上传菜品图片',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '提交中...'
        });

        // 构建菜品数据
        const dishData = {
            restaurantId: this.data.restaurantId,
            name: this.data.dishName,
            description: this.data.description,
            price: parseFloat(this.data.price),
            image: this.data.image,
            quantity: parseInt(this.data.quantity) || 0,
            status: this.data.status,
            updatedAt: new Date().toISOString()
        };

        if (this.data.isEdit && this.data.dishId) {
            // 编辑模式：更新菜品
            api.updateDish(this.data.dishId, dishData)
                .then(() => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '菜品更新成功',
                        icon: 'success'
                    });
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                })
                .catch((err) => {
                    console.error('更新菜品失败:', err);
                    wx.hideLoading();
                    wx.showToast({
                        title: '更新失败，请重试',
                        icon: 'none'
                    });
                });
        } else {
            dishData.auditStatus = 0;
            api.createDish(dishData)
                .then(() => {
                    wx.hideLoading();
                    wx.showToast({
                        title: '已提交审核',
                        icon: 'success'
                    });
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                })
                .catch((err) => {
                    console.error('添加菜品失败:', err);
                    wx.hideLoading();
                    wx.showToast({
                        title: '添加失败，请重试',
                        icon: 'none'
                    });
                });
        }
    }
});