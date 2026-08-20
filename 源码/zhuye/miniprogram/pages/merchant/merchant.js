const api = require('../../utils/api');
const { requireMerchant } = require('../../utils/session');
Page({
    data: {
        activeTab: 'home',
        merchantOpenId: '', // 存储接收的 OpenID
        restaurantId: '',
        merchantInfo: {},
        todayRevenue: '', //今日营收
        today: '', //今天日期
        currentStatsFilter: 'today', // 当前选中的数据分析筛选器
        // 新增：维护当前应叫的号码
        currentCallNumber: 0,
        queue: [], // 排队管理
        waitingCount: 0,
        completedCount: 0,
        queueView: 'waiting', // waiting 或 completed，用于切换排队视图
        queueFilter: 'all', // all, waiting, completed, cancelled
        orders: [], // 订单管理
        orderFilter: 'all', // all, pending, preparing, completed, cancelled
        dishes: [], // 菜品管理
        pendingDishes: [], // 待审核的菜品
        selectedCategory: 'all',
        // 数据分析
        stats: {
            todayCustomers: 1, //156
            todayRevenue: 0, //今天营收
            popularDishes: []
        },
        images: [], // 图片管理
    },
    onLoad(options) {
        if (!requireMerchant()) return;
        const userInfo = wx.getStorageSync('userinfo') || {};
        const openid = options.openid || options._openid || userInfo._openid || '';
        this.setData({ merchantOpenId: openid });
        this.getMerchantDetail(openid);
        this.onStatsFilterChange({
            currentTarget: {
                dataset: {
                    filter: 'today'
                }
            }
        });
    },

    // 根据 OpenID 查询商家详情（查询后赋值到merchantInfo，用于页面回显）
    getMerchantDetail(openid) {
        api.getMerchantRestaurant()
            .then(res => {
                const restaurantInfo = res.data;
                if (restaurantInfo) {
                    this.setData({
                        merchantInfo: restaurantInfo,
                        restaurantId: restaurantInfo._id,
                        selectedCategory: 'all',
                        merchantOpenId: restaurantInfo.merchant_openid || openid
                    });

                    // 并行加载所有数据
                    Promise.all([
                        this.loadQueueData(restaurantInfo._id),
                        this.loadOrderData(restaurantInfo._id),
                        this.loadDishes(),
                        this.loadPendingDishes()
                    ]).then(() => {
                        console.log('所有数据加载完成');
                        // 加载完成后统计今日数据
                        this.onStatsFilterChange({
                            currentTarget: {
                                dataset: {
                                    filter: 'today'
                                }
                            }
                        });
                    }).catch(err => {
                        console.error('数据加载失败:', err);
                        wx.showToast({
                            title: '部分数据加载失败',
                            icon: 'none'
                        });
                    });

                } else {
                    wx.showToast({
                        title: '未查询到商家信息',
                        icon: 'none'
                    });
                    this.setData({
                        merchantInfo: {}
                    });
                }
            })
            .catch(err => {
                console.log('查询商家详情失败：', err);
                wx.showToast({
                    title: '查询失败，请重试',
                    icon: 'none'
                });
                this.setData({
                    merchantInfo: {}
                });
            });
    },
    // 加载排队数据
    loadQueueData(restaurantId) {
        return api.getMerchantQueue().then(res => {
            const queueData = res.data || [];
            if (queueData.length > 0) {
                const minNumber = Math.min(...queueData.map(item => item.queueNumber || 0));
                this.setData({
                    currentCallNumber: minNumber - 1
                });
            }
            this.setData({
                queue: queueData,
                waitingCount: queueData.filter(item => item.status === 'waiting').length,
                completedCount: queueData.filter(item => item.status !== 'waiting').length
            });
        });
    },

    // 加载预约订单数据
    loadOrderData(restaurantId) {
        return api.getMerchantOrders('reserved').then(res => {
            this.setData({ orders: res.data || [] });
        });
    },
    queryDishSales(dishList, timeFilter) {
        return api.getMerchantStats(timeFilter).then(res => (res.data && res.data.popularDishes) || []);
    },
    // 切换营业状态
    async onToggleOpenStatus() {
        const {
            merchantOpenId,
            merchantInfo
        } = this.data;
        // 获取当前状态，如果没有open字段，默认为0（暂停）
        const currentStatus = merchantInfo.open || '0';
        const newStatus = currentStatus === '1' ? '0' : '1';

        console.log(`切换营业状态: ${currentStatus} -> ${newStatus}`);

        wx.showLoading({
            title: '更新中...',
        });

        try {
            // 调用云函数更新营业状态
            const res = await api.updateMerchantRestaurant({ open: newStatus });

            wx.hideLoading();

            if (res.success) {
                // 更新本地数据
                this.setData({
                    'merchantInfo.open': newStatus
                });

                const statusText = newStatus === '1' ? '营业' : '暂停';
                wx.showToast({
                    title: `已${statusText}`,
                    icon: 'success',
                    duration: 2000
                });
            } else {
                throw new Error(res.message || '更新失败');
            }
        } catch (err) {
            wx.hideLoading();
            console.error('切换营业状态失败:', err);
            wx.showToast({
                title: '更新失败，请重试',
                icon: 'none',
                duration: 2000
            });
        }
    },


    onFinish() {
        // 切换到已完成视图，显示非waiting状态的排队记录
        this.setData({
            queueView: this.data.queueView === 'waiting' ? 'completed' : 'waiting'
        });
    },

    loadData() {
        // 模拟数据加载
        console.log('加载商家数据')
    },

    // Tab切换
    onTabChange(e) {
        this.setData({
            activeTab: e.currentTarget.dataset.key
        })
    },

    // ---------------------- 店铺信息输入事件（数据绑定到merchantInfo）----------------------
    onShopNameChange(e) {
        // 更新merchantInfo中的name字段
        this.setData({
            'merchantInfo.name': e.detail.value
        })
        console.log('merchantInfo:', this.data.merchantInfo);
    },
    onShopDescriptionChange(e) {
        this.setData({
            'merchantInfo.description': e.detail.value // 改为description字段
        })
    },
    onShopPriceChange(e) {
        this.setData({
            'merchantInfo.avgPrice': Number(e.detail.value)
        })
    },
    onShopTagsChange(e) {
        const inputText = e.detail.value.trim();

        this.setData({
            'merchantInfo.tagsStr': inputText,
            'merchantInfo.tags': inputText ? inputText.split(',') : []
        });
    },
    onShopHoursChange(e) {
        this.setData({
            'merchantInfo.businessHours': e.detail.value
        })
    },
    onShopPhoneChange(e) {
        this.setData({
            'merchantInfo.phone': e.detail.value
        })
    },
    onShopfloorChange(e) {
        this.setData({
            'merchantInfo.floor': e.detail.value
        })
    },
    onAnnouncementChange(e) {
        this.setData({
            'merchantInfo.announcement': e.detail.value
        })
    },

    // ---------------------- 保存店铺信息（使用云函数更新）----------------------
    async onSaveShop() {
        const {
            merchantOpenId,
            merchantInfo
        } = this.data;

        // 验证商家openid是否存在
        if (!merchantOpenId) {
            wx.showToast({
                title: '商家身份异常',
                icon: 'none'
            });
            return;
        }

        // 构建更新数据对象 - 确保字段名与数据库完全一致
        // 【重要修复】确保字段映射正确
        const updateData = {
            name: merchantInfo.name || '',
            description: merchantInfo.description || '', // 使用description字段而不是tags
            businessHours: merchantInfo.businessHours || '',
            phone: merchantInfo.phone || '',
            announcement: merchantInfo.announcement || '',
            tags: Array.isArray(merchantInfo.tags) ? merchantInfo.tags : [] // 单独处理tags
        };

        // 处理价格字段
        if (merchantInfo.avgPrice !== undefined && merchantInfo.avgPrice !== '') {
            updateData.avgPrice = Number(merchantInfo.avgPrice);
        }

        // 处理地址字段
        if (merchantInfo.floor !== undefined && merchantInfo.floor !== '') {
            updateData.floor = merchantInfo.floor;
        }

        // 处理标签字段
        if (merchantInfo.tags !== undefined) {
            updateData.tags = Array.isArray(merchantInfo.tags) ? merchantInfo.tags : [];
        }

        console.log('准备更新的数据:', updateData);
        console.log('商家OpenID:', merchantOpenId);

        // 显示加载中
        wx.showLoading({
            title: '保存中...',
        });

        try {
            // 调用云函数更新商家信息
            const res = await api.updateMerchantRestaurant(updateData);

            wx.hideLoading();

            if (res.success) {
                const updateResult = res.data;
                if (updateResult && updateResult.stats && updateResult.stats.updated > 0) {
                    wx.showToast({
                        title: '店铺信息已保存',
                        icon: 'success',
                        duration: 2000
                    });
                    // 重新获取最新数据确保同步
                    setTimeout(() => {
                        this.getMerchantDetail(merchantOpenId);
                    }, 1500);
                } else {
                    wx.showToast({
                        title: '数据未变化',
                        icon: 'none',
                        duration: 2000
                    });
                }
            } else {
                wx.showToast({
                    title: '保存失败: ' + (res.message || '未知错误'),
                    icon: 'none',
                    duration: 3000
                });
            }
        } catch (err) {
            wx.hideLoading();
            console.error('调用云函数失败:', err);
            wx.showToast({
                title: '网络错误，请重试',
                icon: 'none',
                duration: 2000
            });
        }
    },
    // 排队管理
    onQueueFilterChange(e) {
        this.setData({
            queueFilter: e.currentTarget.dataset.filter
        })
    },
    onCallNext() {
        // 1. 从页面数据中解构需要的变量（包含 currentCallNumber）
        const {
            queue,
            merchantInfo,
            currentCallNumber
        } = this.data;

        // 2. 校验队列是否为空
        if (queue.length === 0) {
            wx.showToast({
                title: '当前无排队',
                icon: 'none'
            });
            return;
        }

        // 3. 计算下一个要叫的号码（当前已叫号码 + 1）
        const nextCallNumber = currentCallNumber + 1;

        // 4. 在队列中找到对应号码的排队记录（按 queueNumber 匹配，而非数组索引）
        const currentTicket = queue.find(item => item.queueNumber === nextCallNumber);
        if (!currentTicket) {
            wx.showToast({
                title: '队列中无此号码，请检查数据',
                icon: 'none'
            });
            return;
        }
        const currentTicketId = currentTicket._id;

        // 5. 叫号确认弹窗
        wx.showModal({
            title: '叫号确认',
            content: `是否叫号 ${nextCallNumber} 号？`, // 显示下一个要叫的号码
            success: async (res) => {
                if (res.confirm) {
                    wx.showLoading({
                        title: '叫号中...'
                    });

                    try {
                        await api.callNext({
                            nextCallNumber,
                            ticketId: currentTicketId
                        });

                        // 第三步：更新本地状态（关键！）
                        this.setData({
                            currentCallNumber: nextCallNumber, // 更新已叫号码，下次从下一个开始
                            // 从本地队列中移除已叫号的记录（按号码筛选，避免索引错误）
                            queue: queue.filter(item => item.queueNumber !== nextCallNumber)
                        });

                        wx.hideLoading();
                        wx.showToast({
                            title: `已叫号 ${nextCallNumber}`,
                            icon: 'success'
                        });

                    } catch (error) {
                        wx.hideLoading();
                        console.error('叫号同步失败:', error);
                        wx.showToast({
                            title: '叫号失败，请重试',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    },
    onMarkOverdue(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认过号',
            content: '确定要将此排队标记为过号吗？',
            success: (res) => {
                if (res.confirm) {
                    api.updateQueueStatus(id, 'expired')
                        .then(() => {
                            wx.showToast({
                                title: '标记成功',
                                icon: 'success'
                            });
                            // 重新获取排队信息以更新页面
                            this.getMerchantDetail(this.data.merchantOpenId);
                        })
                        .catch(error => {
                            console.error('过号标记失败:', error);
                            wx.showToast({
                                title: '标记失败',
                                icon: 'none'
                            });
                        });
                }
            }
        });
    },
    onPauseQueue() {
        wx.showToast({
            title: '已暂停取号',
            icon: 'none'
        })
    },
    onResumeQueue() {
        wx.showToast({
            title: '已恢复取号',
            icon: 'none'
        })
    },
    onClearQueue() {
        wx.showModal({
            title: '清空队列',
            content: '确定要清空当前等待中的排队吗？',
            success: (res) => {
                if (!res.confirm) return;
                api.clearMerchantQueue()
                    .then(() => {
                        this.setData({ queue: [], waitingCount: 0 });
                        wx.showToast({ title: '队列已清空', icon: 'success' });
                        this.getMerchantDetail(this.data.merchantOpenId);
                    })
                    .catch((err) => {
                        wx.showToast({ title: (err && err.message) || '清空失败', icon: 'none' });
                    });
            }
        });
    },

    // 订单管理 - 显示所有订单（含ticketsId的queueTickets记录）
    onShowAllOrders() {
        const {
            merchantInfo
        } = this.data;
        if (!merchantInfo._id) {
            wx.showToast({
                title: '商家信息未加载完成',
                icon: 'none'
            });
            return;
        }

        wx.showLoading({
            title: '加载所有订单中...',
        });

        // 查询queueTickets中该商家的所有记录（含ticketsId的）
        api.getMerchantOrders()
            .then(res => {
                this.setData({
                    orders: res.data || [],
                    orderFilter: 'all'
                });
                wx.hideLoading();
                wx.showToast({
                    title: '已加载所有订单',
                    icon: 'success'
                });
            })
            .catch(err => {
                wx.hideLoading();
                console.error('加载所有订单失败：', err);
                wx.showToast({
                    title: '加载失败，请重试',
                    icon: 'none'
                });
            });
    },

    // 订单管理 - 清空有票据且状态不为reserved的queueTickets数据
    onClearCompletedOrders() {
        const {
            merchantInfo
        } = this.data;
        if (!merchantInfo._id) {
            wx.showToast({
                title: '商家信息未加载完成',
                icon: 'none'
            });
            return;
        }

        wx.showModal({
            title: '提示',
            content: '确定要清空所有已完成和已过期的订单吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({
                        title: '清空数据中...',
                    });

                    // 从数据库删除queueTickets中 有ticketsId且status≠reserved 的记录
                    api.clearCompletedOrders()
                        .then(res => {
                            wx.hideLoading();
                            if (res.removed > 0) {
                                const filteredOrders = this.data.orders.filter(order => order.status === 'reserved');
                                this.setData({
                                    orders: filteredOrders
                                });
                                wx.showToast({
                                    title: '已清空符合条件的订单',
                                    icon: 'success'
                                });
                            } else {
                                wx.showToast({
                                    title: '无符合条件的数据可清空',
                                    icon: 'none'
                                });
                            }
                        })
                        .catch(err => {
                            wx.hideLoading();
                            console.error('清空数据失败：', err);
                            wx.showToast({
                                title: '清空失败，请重试',
                                icon: 'none'
                            });
                        });
                }
            }
        });
    },

    // 标记订单为已完成
    onMarkOrderCompleted(e) {
        const id = e.currentTarget.dataset.id;
        const orders = this.data.orders;
        const index = orders.findIndex(item => item.id === id);

        if (index !== -1) {
            // 1. 先更新数据库中queueTickets的状态为called
            api.updateQueueStatus(id, 'called')
                .then(() => {
                    // 2. 再更新本地orders数据的状态
                    orders[index].status = 'completed';
                    this.setData({
                        orders: orders
                    });
                    wx.showToast({
                        title: '已标记为完成',
                        icon: 'success'
                    });
                })
                .catch(error => {
                    console.error('更新queueTickets状态失败:', error);
                    wx.showToast({
                        title: '操作失败，请重试',
                        icon: 'none'
                    });
                });
        }
    },

    // 标记订单为已过期
    onMarkOrderExpired(e) {
        const id = e.currentTarget.dataset.id;
        const orders = this.data.orders;
        const index = orders.findIndex(item => item.id === id);

        if (index !== -1) {
            // 1. 先更新数据库中queueTickets的状态为expired
            api.updateQueueStatus(id, 'expired')
                .then(() => {
                    // 2. 再更新本地orders数据的状态
                    orders[index].status = 'expired';
                    this.setData({
                        orders: orders
                    });
                    wx.showToast({
                        title: '已标记为过期',
                        icon: 'success'
                    });
                })
                .catch(error => {
                    console.error('更新queueTickets状态失败:', error);
                    wx.showToast({
                        title: '操作失败，请重试',
                        icon: 'none'
                    });
                });
        }
    },

    // 加载订单数据
    loadOrders() {
        // 这里可以添加从数据库加载订单的逻辑
        // 目前使用的是模拟数据
        console.log('加载订单数据');
    },

    // 加载菜品数据
    loadDishes() {
        if (!this.data.merchantInfo._id) {
            return Promise.reject('商家信息未加载');
        }

        wx.showLoading({
            title: '加载中...'
        });

        return api.getMerchantDishes()
            .then(res => {
                this.setData({
                    dishes: res.data || []
                });
                wx.hideLoading();
                return res.data;
            })
            .catch(err => {
                console.error('加载菜品失败:', err);
                wx.hideLoading();
                wx.showToast({
                    title: '加载菜品失败',
                    icon: 'none'
                });
            });
    },

    // 加载待审核的菜品数据
    loadPendingDishes() {
        if (!this.data.merchantInfo._id) {
            return;
        }

        api.getPendingDishes()
            .then(res => {
                this.setData({
                    pendingDishes: res.data || []
                });
            })
            .catch(err => {
                console.error('加载待审核菜品失败:', err);
            });
    },

    // 菜品管理
    onCategoryChange(e) {
        this.setData({
            selectedCategory: e.currentTarget.dataset.category
        })
    },
    onDishStatusChange(e) {
        // 获取菜品ID和开关的实际值
        const id = e.currentTarget.dataset.id;
        const newStatus = e.detail.value ? 'active' : 'inactive';

        // 显示加载提示
        wx.showLoading({
            title: '更新中...'
        });

        // 先更新数据库中菜品的状态
        api.updateDish(id, { status: newStatus })
            .then(() => {
                // 更新本地数据
                const updatedDishes = this.data.dishes.map(item => {
                    if (item.id === id || item._id === id) {
                        return {
                            ...item,
                            status: newStatus
                        }
                    }
                    return item;
                });

                // 更新UI
                this.setData({
                    dishes: updatedDishes
                });

                wx.hideLoading();
                wx.showToast({
                    title: '菜品状态已更新',
                    icon: 'success'
                });
            })
            .catch(err => {
                console.error('更新菜品状态失败:', err);
                wx.hideLoading();
                wx.showToast({
                    title: '更新失败，请重试',
                    icon: 'none'
                });
            });
    },
    onAddDish() {
        // 跳转到添加菜品页面，并携带餐厅_id和店铺名称
        if (this.data.merchantInfo._id) {
            // 获取店铺名称（若未获取到则设为空字符串，避免参数异常）
            const shopName = this.data.merchantInfo.name || '';
            // 拼接参数：restaurantId（餐厅ID）、shopName（店铺名称）
            wx.navigateTo({
                url: `/pages/add-dish/add-dish?restaurantId=${this.data.merchantInfo._id}&shopName=${encodeURIComponent(shopName)}`
            });
        } else {
            wx.showToast({
                title: '获取餐厅信息失败',
                icon: 'none'
            })
        }
    },
    onEditDish(e) {
        const id = e.currentTarget.dataset.id;
        // 查找要编辑的菜品
        const dish = this.data.dishes.find(item => item.id === id || item._id === id);
        if (!dish) {
            wx.showToast({
                title: '未找到菜品信息',
                icon: 'none'
            });
            return;
        }

        console.log('编辑菜品信息:', dish);

        // 跳转到添加菜品页面进行编辑，并携带菜品信息
        if (this.data.merchantInfo._id) {
            // 将菜品信息转换为JSON字符串并编码
            const dishInfo = encodeURIComponent(JSON.stringify(dish));
            const restaurantId = this.data.merchantInfo._id;
            const shopName = this.data.merchantInfo.name || '';

            wx.navigateTo({
                url: `/pages/add-dish/add-dish?restaurantId=${restaurantId}&shopName=${encodeURIComponent(shopName)}&isEdit=true&dishInfo=${dishInfo}`
            });
        } else {
            wx.showToast({
                title: '获取餐厅信息失败',
                icon: 'none'
            });
        }
    },

    // 下架菜品
    onRemoveDish(e) {
        const id = e.currentTarget.dataset.id;

        wx.showModal({
            title: '确认下架',
            content: '确定要下架这个菜品吗？下架后将从菜单中移除。',
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({
                        title: '处理中...'
                    });

                    // 从menuItems表中删除该菜品
                    api.deleteDish(id)
                        .then(() => {
                            // 更新本地数据，从dishes数组中移除该菜品
                            const updatedDishes = this.data.dishes.filter(item => item.id !== id && item._id !== id);
                            this.setData({
                                dishes: updatedDishes
                            });

                            wx.hideLoading();
                            wx.showToast({
                                title: '菜品已下架',
                                icon: 'success'
                            });
                        })
                        .catch(err => {
                            console.error('下架菜品失败:', err);
                            wx.hideLoading();
                            wx.showToast({
                                title: '下架失败，请重试',
                                icon: 'none'
                            });
                        });
                }
            }
        });
    },
    // 图片管理
    onChooseImage() {
        wx.chooseMedia({
            count: 9,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (res) => {
                const files = res.tempFiles.map(f => f.tempFilePath)
                this.setData({
                    images: [...this.data.images, ...files]
                })
            }
        })
    },
    onDeleteImage(e) {
        const index = e.currentTarget.dataset.index
        const list = this.data.images.filter((_, i) => i !== index)
        this.setData({
            images: list
        })
    },

    // 数据分析
    onStatsFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        wx.showLoading({
            title: '加载数据中...'
        });
        this.setData({
            currentStatsFilter: filter
        });

        // 并行查询客流和营收
        api.getMerchantStats(filter).then(res => {
            wx.hideLoading();
            const data = res.data || {};
            this.setData({
                'stats.todayCustomers': data.todayCustomers || 0,
                todayRevenue: data.todayRevenue || 0,
                'stats.popularDishes': data.popularDishes || []
            });
            wx.showToast({
                title: `已加载${filter === 'today' ? '今日' : filter === 'week' ? '本周' : '本月'}数据`,
                icon: 'none'
            });
        }).catch(err => {
            wx.hideLoading();
            wx.showToast({
                title: '数据加载失败',
                icon: 'none'
            });
            console.error('数据加载失败', err);
        });
    },
    // 定义格式化日期的函数
    formatDate(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 月份从0开始，需加1
        const day = date.getDate();
        // 月份和日期补零（保证与数据表格式完全一致，如11月显示为“11”，8号显示为“08”）
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        return `${year}/${monthStr}/${dayStr}`;
    },
    // 封装获取时间范围的函数
    getDateRange(filter) {
        const date = new Date();
        let start, end;
        if (filter === 'week') {
            // 本周：周一到周日
            const day = date.getDay();
            const diff = day === 0 ? -6 : 1 - day; // 计算与周一的差值（周日特殊处理）
            start = new Date(date.setDate(date.getDate() + diff));
            end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        } else if (filter === 'month') {
            // 本月：1号到月末
            start = new Date(date.getFullYear(), date.getMonth(), 1);
            end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        } else {
            // 今日：默认返回当天（兼容现有逻辑）
            start = end = new Date();
        }
        // 格式化日期为“年/月/日”（与数据库存储格式一致）
        const format = (d) => {
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}/${month}/${day}`;
        };
        return {
            start: format(start),
            end: format(end),
            isSingleDay: filter === 'today' // 标记是否为单日（用于正则匹配方式）
        };
    },
    // 查询客流（queueTickets表）
    queryCustomerFlow(filter) {
        return api.getMerchantStats(filter).then(res => (res.data && res.data.todayCustomers) || 0);
    },
    queryRevenue(filter) {
        return api.getMerchantStats(filter).then(res => (res.data && res.data.todayRevenue) || 0);
    },
})