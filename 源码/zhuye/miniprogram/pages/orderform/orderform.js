// pages/orderform/orderform.js
const api = require('../../utils/api');
Page({
    data: {
        activeTab: 'queue', // 当前激活的Tab页（默认排队取号）
        restaurants: [], // 餐厅列表（从数据库加载）
        menuItems: [], // 菜品列表（根据选中的餐厅加载）
        cartItems: [], // 购物车中的菜品
        cartTotal: 0, // 购物车总金额
        selectedRestaurantId: '', // 当前选中的餐厅ID（数据库中的_id）
        selectedRestaurantName: '', // 当前选中的餐厅名称
        selectedRestaurant: {}, // 当前选中的餐厅完整信息
        partySize: 2, // 用餐人数（默认2人）
        reserveTime: '', // 预约时间
        reserveDate: '', // 预约日期
        myTickets: [], // 我的排队/预约记录（从数据库加载）
        queueProgress: { // 排队进度信息
            currentNumber: 1, // 当前叫号
            //myNumber: 1, // 我的号码
            //estimatedTime: 20 // 预计等待时间（分钟）
        },
        userId: '', // 当前用户的openid（用于关联个人记录）
        refreshTimer: null // 自动刷新定时器
    },

    /**
     * 页面加载时执行
     * 1. 获取用户openid（用于身份标识）
     * 2. 加载餐厅列表
     * 3. 处理从其他页面跳转带来的参数（如指定餐厅ID或Tab页）
     */
    onLoad(options) {
        // 获取用户唯一标识（openid）
        this.getUserOpenid();
        // 从数据库加载餐厅列表
        this.loadRestaurants();
        this.applyPendingQuery(options);
    },

    /**
     * 获取用户的openid（通过云函数）
     * openid是微信用户的唯一标识，用于关联用户的排队/预约记录
     */
    getUserOpenid() {
        const userInfo = wx.getStorageSync('userinfo');
        if (userInfo && (userInfo._openid || userInfo._id)) {
            this.setData({
                userId: userInfo._openid || userInfo._id
            }, () => {
                this.loadMyQueueTickets();
            });
            return;
        }
        console.warn('未登录，无法加载个人排队记录');
    },

    /**
     * 从数据库加载餐厅列表
     * 餐厅数据存储在'restaurants'集合中
     */
    loadRestaurants() {
        api.getRestaurants()
            .then(res => {
                this.setData({
                    restaurants: res.data || []
                }, () => {
                    if (this.data.selectedRestaurantId) {
                        const restaurant = this.data.restaurants.find(r => r._id === this.data.selectedRestaurantId);
                        if (restaurant) {
                            this.setData({
                                selectedRestaurantName: restaurant.name,
                                selectedRestaurant: restaurant
                            });
                        }
                    }
                });
            })
            .catch(err => {
                console.error('获取餐厅失败：', err);
            });
    },

    /**
     * 从数据库加载当前用户的排队/预约记录
     * 记录存储在'queueTickets'集合中，通过userId筛选
     */
    loadMyQueueTickets() {
        if (!this.data.userId) return;

        api.getMyTickets()
            .then(res => {
                let myTickets = (res.data || []).map(ticket => ({
                    id: ticket._id,
                    type: ticket.type || (String(ticket.status).includes('reserved') ? 'reserve' : 'queue'),
                    restaurantId: ticket.restaurantid,
                    restaurantName: ticket.restaurantName || this.getRestaurantName(ticket.restaurantid),
                    partySize: ticket.partySize,
                    number: ticket.queueNumber || ticket.number || 0,
                    estimatedTime: ticket.estimatedTime || ticket.estimatedWaitTime || 0,
                    status: ticket.status,
                    statusText: this.getStatusText(ticket.status),
                    createTime: ticket.createTime,
                    reserveTime: ticket.reserveTime || '',
                    currentNumber: ticket.currentNumber || 1,
                    ticketsId: ticket.ticketsId,
                    order: ticket.order || null
                }));
                myTickets = myTickets.sort((a, b) => {
                    if (a.createTime !== b.createTime) {
                        return String(b.createTime).localeCompare(String(a.createTime));
                    }
                    return b.number - a.number;
                });
                this.setData({ myTickets }, () => {
                    this.loadQueueProgress();
                });
            })
            .catch(err => {
                console.error('加载我的排队记录失败：', err);
            });
    },

    /**
     * 辅助函数：根据餐厅ID获取餐厅名称
     * @param {string} restaurantId - 餐厅的_id
     * @return {string} 餐厅名称（未找到则返回空）
     */
    getRestaurantName(restaurantId) {
        const restaurant = this.data.restaurants.find(r => r._id === restaurantId);
        return restaurant ? restaurant.name : '';
    },

    /**
     * 辅助函数：将状态字段转换为文字描述
     * @param {string} status - 状态字段（如waiting/reserved）
     * @return {string} 状态文字（如"排队中"）
     */
    getStatusText(status) {
        const statusMap = {
            waiting: '排队中',
            called: '已叫号',
            arrived: '已到店',
            served: '已入座',
            cancelled: '已取消',
            overdue: '已过期',
            expired: '已过期',
            called: '已叫号',
            calling: '已叫号',
            reserved: '已预约',
            completed: '已完成'
        };
        return statusMap[status] || status; // 未匹配到则返回原状态
    },

    /**
     * 查询当前选中餐厅的菜单
     * 从'menuItems'集合中筛选出匹配当前餐厅ID的菜品
     */
    fetchMenuItems() {
        const {
            selectedRestaurantId
        } = this.data;
        // 如果未选择餐厅，不查询
        if (!selectedRestaurantId) {
            console.log('未选择餐厅，不查询菜单');
            return;
        }

        api.getRestaurantMenu(selectedRestaurantId)
            .then(res => {
                const allMenuItems = (res.data || []).map(item => ({
                    ...item,
                    quantity: 0
                }));
                this.setData({
                    menuItems: allMenuItems
                });
            })
            .catch(err => {
                console.error('查询menuItems失败：', err);
            });
    },

    /**
     * 加载排队进度（核心修改：按新规则计算等待时间）
     * 规则：
     * - 前5个等待号（差值1-5）：0分钟
     * - 6-10个等待号（差值6-10）：8分钟
     * - 11-15个等待号（差值11-15）：16分钟
     * - 16-20个等待号（差值16-20）：24分钟
     */
    /**
     * 加载排队进度（核心修改：从数据库queueTickets表获取currentNumber作为当前叫号）
     * 逻辑：
     * 1. 按当前选中的餐厅ID筛选排队记录
     * 2. 查询该餐厅最新叫号的记录（已叫号状态called，按时间倒序）
     * 3. 提取该记录的currentNumber作为当前叫号
     * 4. 同步更新所有用户排队记录的currentNumber和预计等待时间
     */
    /**
     * 加载排队进度：从数据库queueTickets表获取currentNumber作为当前叫号
     */
    loadQueueProgress() {
        const { myTickets, selectedRestaurantId } = this.data;
        if (!selectedRestaurantId) return;
        api.getQueueProgress(selectedRestaurantId)
            .then(res => {
                let currentNumber = (res.data && res.data.currentNumber) || 1;
                this.setData({
                    'queueProgress.currentNumber': currentNumber
                });
                const updatedTickets = myTickets.map(ticket => {
                    if (ticket.type === 'queue' && ticket.status === 'waiting') {
                        const diff = ticket.number - currentNumber;
                        let estimatedTime = 0;
                        if (diff > 0) {
                            if (diff <= 5) estimatedTime = 0;
                            else if (diff <= 10) estimatedTime = 8;
                            else if (diff <= 15) estimatedTime = 16;
                            else estimatedTime = 24;
                        }
                        return { ...ticket, estimatedTime };
                    }
                    return ticket;
                });
                this.setData({ myTickets: updatedTickets });
            })
            .catch(err => {
                console.error('查询currentNumber失败:', err);
                this.setData({
                    'queueProgress.currentNumber': 1
                });
            });
    },
    /**
     * 页面显示时执行
     * 刷新排队进度和我的记录
     */
    applyPendingQuery(query) {
        if (!query) return;
        const patch = {};
        if (query.tab) patch.activeTab = query.tab;
        if (query.restaurantId) patch.selectedRestaurantId = query.restaurantId;
        if (query.restaurantName) patch.selectedRestaurantName = query.restaurantName;
        this.setData(patch, () => {
            if (query.restaurantId) {
                const restaurant = (this.data.restaurants || []).find(r => r._id === query.restaurantId);
                if (restaurant) {
                    this.setData({
                        selectedRestaurant: restaurant,
                        selectedRestaurantName: restaurant.name
                    });
                }
                this.fetchMenuItems();
                this.loadQueueProgress();
            }
        });
    },

    onShow() {
        const pending = getApp().globalData.orderformQuery;
        if (pending) {
            getApp().globalData.orderformQuery = null;
            this.applyPendingQuery(pending);
        }
        this.getUserOpenid();
        this.loadQueueProgress();
        if (this.data.userId) {
            this.loadMyQueueTickets();
        }
    },

    /**
     * 创建排队或预约记录（存入数据库）：返回记录ID
     * @param {string} type - 类型（'queue'排队 / 'reserve'预约）
     * @return {Promise<string>} 记录ID
     */
    createTicket(type, extra) {
        extra = extra || {};
        return new Promise((resolve, reject) => {
            const {
                selectedRestaurantId,
                partySize,
                userId,
                reserveTime
            } = this.data;
            const reserveDate = extra.reserveDate || this.data.reserveDate;
            if (!selectedRestaurantId || !userId) {
                wx.showToast({ title: '请先登录', icon: 'none' });
                reject('缺少必要参数');
                return;
            }
            api.createTicket({
                restaurantId: selectedRestaurantId,
                partySize,
                type,
                reserveTime,
                reserveDate
            }).then(res => {
                resolve(res);
                wx.showToast({
                    title: type === 'reserve' ? '预约成功' : '取号成功',
                    icon: 'success'
                });
                this.loadMyQueueTickets();
                this.loadQueueProgress();
                this.setData({ activeTab: 'mine' });
            }).catch(err => {
                console.error('存入记录失败', err);
                wx.showToast({
                    title: (err && err.message) || (type === 'reserve' ? '预约失败' : '取号失败'),
                    icon: 'none'
                });
                reject(err);
            });
        });
    },

    /**
     * 返回上一页
     */
    goBack() {
        wx.navigateBack();
    },

    /**
     * 点击"立即取号"按钮
     * 校验餐厅是否选择，然后创建排队记录
     */
    onTakeNumber() {
        if (!this.data.selectedRestaurantId) {
            wx.showToast({
                title: '请选择餐厅',
                icon: 'none'
            });
            return;
        }
        wx.showModal({
            title: '提示',
            content: '需要先点餐吗？',
            cancelText: '直接取号',
            confirmText: '去点餐',
            success: (res) => {
                if (res.cancel) {
                    this.createTicket('queue').then(() => {
                        // 直接取号成功后，刷新排队进度
                        this.loadQueueProgress();
                    });
                } else if (res.confirm) {
                    // 关键修改：不用跳转，直接切换当前页面的Tab到order
                    this.setData({
                        activeTab: 'order' // 切换到点餐Tab
                    });
                    // 可选：如果需要确保菜单已加载，可手动触发一次菜单查询
                    this.fetchMenuItems();
                }
            }
        });
    },

    /**
     * 用餐人数滑块变化时触发
     * @param {event} e - 滑块事件，包含当前值
     */
    onPartySizeChange(e) {
        this.setData({
            partySize: e.detail.value
        });
    },

    /**
     * 预约时间选择变化时触发
     * @param {event} e - 选择器事件，包含选中的时间
     */
    onReserveTimeChange(e) {
        this.setData({
            reserveTime: e.detail.value
        });
    },

    /**
     * 预约日期选择变化时触发（预留，当前未在WXML中使用）
     * @param {event} e - 选择器事件，包含选中的日期
     */
    onReserveDateChange(e) {
        this.setData({
            reserveDate: e.detail.value
        });
    },

    /**
     * 点击"提交预约"按钮
     * 校验餐厅和时间是否选择，然后创建预约记录
     */
    onReserve() {
        if (!this.data.selectedRestaurantId) {
            wx.showToast({
                title: '请选择餐厅',
                icon: 'none'
            });
            return;
        }
        if (!this.data.reserveTime) {
            wx.showToast({
                title: '请选择预约时间',
                icon: 'none'
            });
            return;
        }
        // -------- 新增：计算固定预约日期 --------
        const now = new Date();
        const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 当前时间+1天
        const year = nextDay.getFullYear();
        const month = (nextDay.getMonth() + 1).toString().padStart(2, '0');
        const day = nextDay.getDate().toString().padStart(2, '0');
        const reserveDate = `${year}/${month}/${day}`;
        this.setData({ reserveDate }, () => {
            this.createTicket('reserve', { reserveDate });
        });
    },

    /**
     * 点击搜索框，跳转到搜索页
     */
    onSearch() {
        wx.navigateTo({
            url: '/pages/search/search'
        });
    },

    /**
     * 切换Tab页
     * @param {event} e - 点击事件，包含目标Tab的key
     */
    onTabChange(e) {
        this.setData({
            activeTab: e.currentTarget.dataset.key
        });
    },

    /**
     * 选择餐厅时触发（picker选择器变化）
     * @param {event} e - 选择器事件，包含选中的索引
     */
    onRestaurantPick(e) {
        const index = Number(e.detail.value); // 选中的餐厅索引
        const restaurant = this.data.restaurants[index]; // 获取选中的餐厅信息
        this.setData({
            selectedRestaurantId: restaurant._id, // 存储餐厅ID
            selectedRestaurantName: restaurant.name, // 存储餐厅名称
            selectedRestaurant: restaurant // 存储完整餐厅信息
        }, () => {
            // 切换餐厅后，重新查询该餐厅的菜单
            this.fetchMenuItems();// 加载菜单
            this.loadQueueProgress(); // 新增：切换餐厅后立即刷新叫号
        });
    },

    /**
     * 增加菜品数量（点餐功能）
     * @param {event} e - 点击事件，包含菜品ID
     */
    onIncreaseQuantity(e) {
        const id = e.currentTarget.dataset.id; // 菜品ID
        // 遍历菜单，找到对应菜品并增加数量
        const menuItems = this.data.menuItems.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    quantity: (item.quantity || 0) + 1
                };
            }
            return item;
        });
        this.setData({
            menuItems
        }); // 更新菜单数据
        this.updateCart(); // 同步更新购物车
    },

    /**
     * 减少菜品数量（点餐功能）
     * @param {event} e - 点击事件，包含菜品ID
     */
    onDecreaseQuantity(e) {
        const id = e.currentTarget.dataset.id; // 菜品ID
        // 遍历菜单，找到对应菜品并减少数量（最小为0）
        const menuItems = this.data.menuItems.map(item => {
            if (item.id === id) {
                const newQuantity = Math.max(0, (item.quantity || 0) - 1);
                return {
                    ...item,
                    quantity: newQuantity
                };
            }
            return item;
        });
        this.setData({
            menuItems
        }); // 更新菜单数据
        this.updateCart(); // 同步更新购物车
    },

    /**
     * 更新购物车数据
     * 筛选出数量>0的菜品，计算总金额
     */
    updateCart() {
        const cartItems = this.data.menuItems.filter(item => item.quantity > 0); // 购物车菜品
        const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0); // 总金额
        this.setData({
            cartItems,
            cartTotal
        });
    },

    /**
     * 提交订单（点餐功能）：同时创建排队记录，并将数据整合到orderform表
     */
    onSubmitOrder() {
        if (this.data.cartItems.length === 0) {
            wx.showToast({
                title: '购物车为空',
                icon: 'none'
            });
            return;
        }
        if (!this.data.selectedRestaurantId) {
            wx.showToast({
                title: '请选择餐厅',
                icon: 'none'
            });
            return;
        }

        // 1. 先创建排队记录（获取排队号等信息）
        this.createTicket('queue').then((ticketRes) => {
            const ticketId = ticketRes && ticketRes._id;
            if (!ticketId) {
                wx.showToast({
                    title: '取号失败，订单提交中断',
                    icon: 'none'
                });
                return;
            }

            const now = new Date();
            const createTime = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const orderFormData = {
                userId: this.data.userId,
                ticketId: ticketId,
                restaurantId: this.data.selectedRestaurantId,
                restaurantName: this.data.selectedRestaurantName,
                items: this.data.cartItems.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                })),
                totalPrice: this.data.cartTotal,
                queueNumber: (ticketRes.data && ticketRes.data.queueNumber) || 0,
                status: 'pending',
                createTime: createTime
            };

            // 4. 将整合数据写入orderform集合
            api.submitOrder(orderFormData)
                .then(() => {
                    // 清空购物车并提示
                    const menuItems = this.data.menuItems.map(item => ({
                        ...item,
                        quantity: 0
                    }));
                    this.setData({
                        menuItems,
                        cartItems: [],
                        cartTotal: 0,
                        activeTab: 'mine'
                    });
                    wx.showToast({
                        title: '订单及取号提交成功',
                        icon: 'success'
                    });
                })
                .catch(err => {
                    console.error('创建orderform记录失败', err);
                    wx.showToast({
                        title: '订单提交失败',
                        icon: 'none'
                    });
                });
        });
    },
    /**
     * 取消排队/预约
     * @param {event} e - 点击事件，包含记录ID
     */
    onCancel(e) {
        const ticketId = e.currentTarget.dataset.id; // 记录ID
        if (!ticketId) return;

        // 更新数据库中记录的状态为"已取消"
        api.cancelTicket(ticketId)
            .then(() => {
                wx.showToast({
                    title: '已取消',
                    icon: 'success'
                });
                this.loadMyQueueTickets(); // 刷新我的记录
            })
            .catch(err => {
                console.error('取消失败', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'none'
                });
            });
    },

    /**
     * 确认到店（仅排队记录）
     * @param {event} e - 点击事件，包含记录ID
     */
    onArrive(e) {
        const ticketId = e.currentTarget.dataset.id; // 记录ID
        if (!ticketId) return;

        // 更新数据库中记录的状态为"已到店"
        api.arriveTicket(ticketId)
            .then(() => {
                wx.showToast({
                    title: '已确认到店',
                    icon: 'success'
                });
                this.loadMyQueueTickets(); // 刷新我的记录
            })
            .catch(err => {
                console.error('确认到店失败', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'none'
                });
            });
    },

    /**
     * 重新取号（针对过期记录）
     * 先删除过期记录，再引导用户重新取号
     * @param {event} e - 点击事件，包含记录ID
     */
    onRetakeNumber(e) {
        const ticketId = e.currentTarget.dataset.id; // 记录ID
        if (!ticketId) return;

        // 删除过期记录
        api.deleteTicket(ticketId)
            .then(() => {
                wx.showToast({
                    title: '已删除过期记录',
                    icon: 'success'
                });
                this.loadMyQueueTickets(); // 刷新我的记录
                this.setData({
                    activeTab: 'queue'
                }); // 切换到排队取号页
            })
            .catch(err => {
                console.error('删除记录失败', err);
                wx.showToast({
                    title: '操作失败',
                    icon: 'none'
                });
            });
    }
});