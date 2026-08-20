App({
    onLaunch: function () {
        this.globalData = {
            env: '',
            baseUrl: 'http://127.0.0.1:3001',
            orderformQuery: null,
        };
    },
    openQueuePage(query) {
        this.globalData.orderformQuery = query || {};
        wx.switchTab({
            url: '/pages/orderform/orderform'
        });
    },
});
