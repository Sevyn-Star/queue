const api = require('../../utils/api');

Page({
    data: {
        restaurantId: '',
        restaurantInfo: null,
        loading: true,
        headerBg: "",
        // 新增：存储从menuItems查询的菜品
        recommendedDishes: [],
        // 模拟评价数据
        reviews: [{
                id: 1,
                userName: '小明',
                avatar: '../../image/my/avatar.png',
                rating: 5,
                content: '菜品非常美味，服务也很好，下次还会再来！',
                time: '2024-01-15',
                images: []
            },
            {
                id: 2,
                userName: '小红',
                avatar: '../../image/my/avatar.png',
                rating: 4,
                content: '环境不错，菜品也很有特色，值得推荐。',
                time: '2024-01-10',
                images: []
            }
        ]
    },

    onLoad(options) {
        // 获取传入的openid
        console.log('options', options)
        this.setData({
            restaurantId: options.openid || options.id // 兼容两种参数名
        });
        // 加载餐厅详情数据
        this.loadRestaurantDetail();
    },

    loadRestaurantDetail() {
        const restaurantId = this.data.restaurantId;
        api.getRestaurant(restaurantId)
            .then(restRes => {
                const headerBg = restRes.data.logo || "../../image/index/food.jpg";
                this.setData({
                    restaurantInfo: restRes.data,
                    headerBg: headerBg
                });
                return api.getRestaurantMenu(restaurantId);
            })
            .then(menuRes => {
                const allDishes = (menuRes.records || []).map(record => record.menuItems).filter(Boolean);
                this.setData({
                    recommendedDishes: allDishes,
                    loading: false
                });
            })
            .catch(err => {
                console.error('餐厅信息查询失败', err);
                wx.showToast({
                    title: '餐厅信息加载失败',
                    icon: 'none'
                });
                this.setData({
                    loading: false
                });
            });
    },
    onTakeNumber() {
        if (!this.data.restaurantInfo) return;
        getApp().openQueuePage({
            tab: 'queue',
            restaurantId: this.data.restaurantId,
            restaurantName: this.data.restaurantInfo.name
        });
    },

    onReserve() {
        if (!this.data.restaurantInfo) return;
        getApp().openQueuePage({
            tab: 'reserve',
            restaurantId: this.data.restaurantId,
            restaurantName: this.data.restaurantInfo.name
        });
    },

    onViewMenu() {
        wx.pageScrollTo({
            selector: '.menu-section',
            duration: 300
        });
    },

    // 收藏餐厅
    onFavorite() {
        wx.showToast({
            title: '收藏成功',
            icon: 'success'
        });
    },

    // 分享餐厅
    onShare() {
        wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });
    },

    // 返回上一页
    onBack() {
        wx.navigateBack();
    }
});