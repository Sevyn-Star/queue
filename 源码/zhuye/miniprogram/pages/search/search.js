const api = require('../../utils/api');

Page({
    data: {
        searchValue: '',
        list: [],
    },
    onSearchInput(e) {
        this.setData({
            searchValue: e.detail.value
        })
    },

    onSearch() {
        const keyword = this.data.searchValue
        if (!keyword) {
            wx.showToast({
                icon: 'error',
                title: '请输入搜索内容'
            });
            return;
        }
        api.searchRestaurants(keyword)
            .then(res => {
                if (!res.data || res.data.length === 0) {
                    wx.showToast({
                        icon: 'none',
                        title: '未搜索到相关结果'
                    });
                    return;
                }
                this.setData({
                    list: (res.data || []).map(item => ({
                        ...item,
                        tagsText: Array.isArray(item.tags) ? item.tags.join(' / ') : (item.tags || '')
                    }))
                })
            })
            .catch(err => {
                console.log('获取失败', err);
            })
    },
    skip(e) {
        wx.navigateTo({
            url: '/pages/restaurant/restaurant?id=' + e.currentTarget.dataset.id,
        });
    }
})
