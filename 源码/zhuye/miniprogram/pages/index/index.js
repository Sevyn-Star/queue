const api = require('../../utils/api');

Page({
    data: {
        banners: [],
        hotRestaurants: [],
        queueOverview: []
    },
    onLoad() {
        api.getAnnouncements()
            .then(res => {
                const banners = (res.data || []).map(item => ({
                    id: item._id,
                    image: item.imageUrl,
                    title: item.content
                }));
                this.setData({ banners });
            })
            .catch(err => {
                console.log('获取轮播图数据失败', err);
            });

        api.getRestaurants()
            .then(res => {
                this.setData({
                    hotRestaurants: res.data || []
                });
                this.generateQueueOverview(res.data || []);
            })
            .catch(err => {
                console.log('获取餐厅数据失败', err);
            });
        this.loadData()
    },

    generateQueueOverview(restaurants) {
        const floorMap = {};
        restaurants.forEach(restaurant => {
            const floor = restaurant.floor;
            if (!floorMap[floor]) {
                floorMap[floor] = {
                    floor: floor,
                    restaurants: []
                };
            }
            floorMap[floor].restaurants.push({
                name: restaurant.name,
                queueCount: restaurant.queueCount
            });
        });
        this.setData({
            queueOverview: Object.values(floorMap)
        });
    },
    loadData() {
        console.log('加载首页数据')
    },
    onSearch() {
        wx.navigateTo({
            url: '/pages/search/search',
        })
    },
    onQuickQueue() {
        getApp().openQueuePage({ tab: 'queue' });
    },
    onQuickReserve() {
        getApp().openQueuePage({ tab: 'reserve' });
    },
    onRestaurantTap(e) {
        wx.navigateTo({
            url: '/pages/restaurant/restaurant?id=' + e.currentTarget.dataset.id
        });
    },
    onBannerTap(e) {
        const id = e.currentTarget.dataset.id
        wx.showToast({
            title: `点击了轮播图${id}`,
            icon: 'none'
        })
    }
})
