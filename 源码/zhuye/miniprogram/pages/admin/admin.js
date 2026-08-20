// pages/admin/admin.js
const wxCharts = require('../../lib/wx-charts');
const api = require('../../utils/api');
const { requireAdmin } = require('../../utils/session');
let userGrowthChart = null;
let orderStatsChart = null;

Page({
    data: {
        activeTab: 'dashboard',
        todayDate: '', // 新增今日日期
        dataFilter: 'thisMonth', // 默认选择本月
        // 数据概览
        overview: {
            totalUsers: 0,
            totalMerchants: 0,
            todayOrders: 0,
            totalRevenue: 0
        },

        filteredComments: [],
        commentFilter: 'pending',
        // 商家申请管理
        applications: [],
        filteredApplications: [],
        merchantFilter: 'shopApply',
        // 系统管理
        announcements: [
            {
                id: 'a1',
                title: '商场美食节活动',
                content: '12月1日-12月31日，全场美食8折优惠',
                //status: 'published',
                createTime: '2023-12-01'
            },
            {
                id: 'a2',
                title: '系统维护通知',
                content: '12月5日凌晨2:00-4:00进行系统维护',
                //status: 'draft',
                createTime: '2023-12-02'
            }
        ],
        // 数据监控
        stats: {
            userGrowth: [
                {
                    date: '12/01',
                    count: 0
                },
                {
                    date: '12/08',
                    count: 195
                },
                {
                    date: '12/15',
                    count: 202
                },
                {
                    date: '12/22',
                    count: 210
                },
                {
                    date: '12/31',
                    count: 232
                }
            ],
            orderStats: [
                {
                    date: '12/01',
                    orders: 0
                },
                {
                    date: '12/08',
                    orders: 195
                },
                {
                    date: '12/15',
                    orders: 202
                },
                {
                    date: '12/22',
                    orders: 210
                },
                {
                    date: '12/31',
                    orders: 232
                }
            ],
            topMerchants: [
                {
                    name: '云味小馆',
                    orders: 156,
                    revenue: 8920
                },
                {
                    name: '海底捞',
                    orders: 134,
                    revenue: 15680
                },
                {
                    name: '麦门汉堡',
                    orders: 98,
                    revenue: 3120
                }
            ]
        }
    },

    // 修改：从数据库获取所有统计数据
    loadHotMerchants() {
        console.log('=== 开始加载今日数据 ===');

        // 获取今日日期字符串
        const today = new Date();
        const todayStr = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getDate().toString().padStart(2, '0')}`;

        console.log('今日日期:', todayStr);

        // 设置今日日期显示
        this.setData({
            todayDate: `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
        });

        // 同时获取所有需要的数据
        return api.getAdminOverview().then(res => {
            const data = res.data || {};
            const overview = data.overview || {};
            this.setData({
                'overview.totalUsers': overview.totalUsers || 0,
                'overview.totalMerchants': overview.totalMerchants || 0,
                'overview.todayOrders': overview.todayOrders || 0,
                'overview.totalRevenue': overview.totalRevenue || 0,
                'stats.topMerchants': data.topMerchants || []
            });
        }).catch(err => {
            console.error('获取数据失败:', err);
            wx.showToast({
                title: '数据加载失败',
                icon: 'none'
            });
            throw err;
        });
    },

    // 在 onLoad 中调用
    onLoad(options) {
        if (!requireAdmin()) return;
        const today = new Date();
        this.setData({
            activeTab: 'dashboard',
            todayDate: `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
        });

        this.initComments();
        this.loadHotMerchants();
    },
    // 添加下拉刷新
    onPullDownRefresh() {
        if (this.data.activeTab === 'dashboard') {
            this.loadHotMerchants().then(() => {
                wx.stopPullDownRefresh();
                wx.showToast({
                    title: '数据已更新',
                    icon: 'success'
                });
            }).catch(err => {
                wx.stopPullDownRefresh();
                wx.showToast({
                    title: '更新失败',
                    icon: 'none'
                });
            });
        } else {
            wx.stopPullDownRefresh();
        }
    },

    onShow() {
        if (!requireAdmin()) return;
        api.getApplies()
            .then(res => {
                // 核心修复：去掉错误的 "/pages/admin/" 前缀
                const apps = res.data.map(item => {
                    // 修复logo路径
                    if (item.logo && item.logo.startsWith('/pages/admin/')) {
                        item.logo = item.logo.replace('/pages/admin/', '');
                    }
                    // 修复营业执照路径
                    if (item.businessLicense && item.businessLicense.startsWith('/pages/admin/')) {
                        item.businessLicense = item.businessLicense.replace('/pages/admin/', '');
                    }
                    // 修复菜品图片路径（如果有）
                    if (item.dishImage && item.dishImage.startsWith('/pages/admin/')) {
                        item.dishImage = item.dishImage.replace('/pages/admin/', '');
                    }
                    return item;
                });
                
                this.setData({
                    applications: apps
                }, () => {
                    this.setData({
                        filteredApplications: this.filterApplications(apps, this.data.merchantFilter)
                    });
                });
            })
            .catch(err => {
                console.log('获取申请失败', err);
                this.setData({
                    applications: [],
                    filteredApplications: []
                });
                wx.showToast({
                    title: (err && err.message) || '申请加载失败',
                    icon: 'none'
                });
            });
        
        // 从云端获取公告数据
        api.getAnnouncements()
            .then(res => {
                if (res.data.length > 0) {
                    // 转换数据格式，确保id字段存在
                    const announcements = res.data.map(item => ({
                        id: item._id,
                        title: item.title,
                        content: item.content,
                        status: item.status,
                        createTime: item.createTime
                    }));
                    this.setData({
                        announcements: announcements
                    });
                }
            })
            .catch(err => {
                console.log('获取公告失败', err);
                // 使用默认数据
            });
    },

    // 示例申请数据（避免空列表）
    getSampleApplications() {
        return [
            {
                _id: 'shop1',
                type: 'shop',
                shopName: '云味小店',
                phone: '13254654785',
                description: '主打云南特色菜，健康美味',
                logo: 'https://img2.baidu.com/it/u=2684032961,2892737305&fm=253&fmt=auto&app=138&f=JPEG?w=600&h=400',
                businessLicense: 'https://img2.baidu.com/it/u=3881626573,2632546424&fm=253&fmt=auto&app=138&f=JPEG?w=600&h=400',
                applyTime: '2025/10/29 23:29',
                auditStatus: 0
            },
            {
                _id: 'dish1',
                type: 'dish',
                dishName: '麻婆豆腐',
                shopName: '川味坊',
                dishCategory: '川菜',
                price: 28.00,
                description: '正宗四川麻婆豆腐，麻辣鲜香',
                dishImage: 'https://img1.baidu.com/it/u=2701954174,2838491551&fm=253&fmt=auto&app=138&f=JPEG?w=600&h=400',
                applyTime: '2025/10/30 14:15',
                auditStatus: 0
            },
            {
                _id: 'shop2',
                type: 'shop',
                shopName: '鲜果时光',
                phone: '13899998888',
                description: '新鲜水果饮品店',
                logo: 'https://img0.baidu.com/it/u=3543424992,1096819875&fm=253&fmt=auto?w=500&h=500',
                businessLicense: 'https://img1.baidu.com/it/u=1812585528,3595011367&fm=253&fmt=auto?w=500&h=500',
                applyTime: '2025/10/30 09:45',
                auditStatus: 1
            },
            {
                _id: 'dish2',
                type: 'dish',
                dishName: '招牌牛肉面',
                shopName: '兰州拉面馆',
                dishCategory: '面食',
                price: 18.00,
                description: '手工拉面，牛肉大块',
                dishImage: 'https://img2.baidu.com/it/u=2325525544,1446830647&fm=253&fmt=auto?w=500&h=500',
                applyTime: '2025/10/29 16:30',
                auditStatus: 2
            }
        ];
    },

    // Tab切换
    onTabChange(e) {
        const key = e.currentTarget.dataset.key;
        this.setData({
            activeTab: key
        });
        
        // 当切换到数据tab时绘制图表
        if (key === 'data') {
            // 延迟绘制，确保canvas已经渲染完成
            setTimeout(() => {
                this.drawUserGrowthChart();
                this.drawOrderStatsChart();
            }, 100);
        }
    },

    // 敏感词处理
    highlightSensitiveWords(content) {
        // 将敏感词数组直接定义在函数内部，避免this上下文问题
        const sensitiveWords = ['违法', '违规', '广告', '垃圾', '诈骗', '赌博', '色情', '暴力', '虚假', '骗人', '上当'];
        if (!content || typeof content !== 'string') return {
            formattedContent: '',
            hasSensitiveWords: false
        };
        let formattedContent = content;
        let hasSensitiveWords = false;
        sensitiveWords.forEach(word => {
            if (formattedContent.includes(word)) {
                hasSensitiveWords = true;
                formattedContent = formattedContent.replace(new RegExp(word, 'gi'), `<span class="sensitive">${word}</span>`);
            }
        });
        return {
            formattedContent,
            hasSensitiveWords
        };
    },

    // 初始化评论
    initComments() {
        // 确保comments数组存在
        const comments = this.data.comments || [];
        const commentsWithFormatting = comments.map(comment => {
            const result = this.highlightSensitiveWords(comment.content || '');
            return {
                ...comment,
                ...result
            };
        });
        const filteredComments = commentsWithFormatting.filter(c => c.status === 'pending');
        this.setData({
            comments: commentsWithFormatting,
            filteredComments
        });
    },

    // 评论筛选
    onCommentFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        let filteredComments = [];
        if (filter === 'autoApproved') {
            filteredComments = this.data.comments.filter(c => c.status === 'approved' && !c.hasSensitiveWords);
        } else {
            filteredComments = this.data.comments.filter(c => c.status === filter);
        }
        this.setData({
            commentFilter: filter,
            filteredComments
        });
    },

    // 评论通过/驳回
    onApproveComment(e) {
        const commentId = e.currentTarget.dataset.id;
        const updatedComments = this.data.comments.map(c => c.id === commentId ? {
            ...c,
            status: 'approved'
        } : c);
        this.setData({
            comments: updatedComments,
            filteredComments: this.filterComments(updatedComments, this.data.commentFilter)
        });
        wx.showToast({
            title: '评论已通过',
            icon: 'success'
        });
    },
    onRejectComment(e) {
        const commentId = e.currentTarget.dataset.id;
        const updatedComments = this.data.comments.map(c => c.id === commentId ? {
            ...c,
            status: 'rejected'
        } : c);
        this.setData({
            comments: updatedComments,
            filteredComments: this.filterComments(updatedComments, this.data.commentFilter)
        });
        wx.showToast({
            title: '评论已驳回',
            icon: 'none'
        });
    },

    // 筛选辅助方法
    filterComments(comments, filter) {
        if (filter === 'autoApproved') {
            return comments.filter(c => c.status === 'approved' && !c.hasSensitiveWords);
        }
        return comments.filter(c => c.status === filter);
    },
    filterApplications(applications, filter) {
        switch (filter) {
            case 'shopApply':
                return applications.filter(a => a.type === 'shop' && Number(a.auditStatus) === 0);
            case 'dishApply':
                return applications.filter(a => a.type === 'dish' && Number(a.auditStatus) === 0);
            case 'approved':
                return applications.filter(a => Number(a.auditStatus) === 1);
            case 'rejected':
                return applications.filter(a => Number(a.auditStatus) === 2);
            default:
                return applications;
        }
    },

    // 初始化申请数据
    initApplications() {
        const sampleApps = this.getSampleApplications();
        this.setData({
            applications: sampleApps,
            filteredApplications: this.filterApplications(sampleApps, 'shopApply')
        });
    },

    // 商家申请筛选
    onMerchantFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        this.setData({
            merchantFilter: filter,
            filteredApplications: this.filterApplications(this.data.applications, filter)
        });
    },

    // 商家申请通过/驳回（带权限校验）
    onApproveMerchant(e) {
        const _id = e.currentTarget.dataset.id;
        api.approveApply(_id)
            .then(() => {
                const updatedApps = this.data.applications.map(a => a._id === _id ? {
                    ...a,
                    auditStatus: 1
                } : a);
                this.setData({
                    applications: updatedApps,
                    filteredApplications: this.filterApplications(updatedApps, this.data.merchantFilter)
                });
                wx.showToast({
                    title: '申请已通过',
                    icon: 'success'
                });
            })
            .catch(err => wx.showToast({
                title: (err && err.message) || '操作失败',
                icon: 'none'
            }));
    },
    onRejectMerchant(e) {
        const _id = e.currentTarget.dataset.id;
        api.rejectApply(_id)
            .then(() => {
                const updatedApps = this.data.applications.map(a => a._id === _id ? {
                    ...a,
                    auditStatus: 2
                } : a);
                this.setData({
                    applications: updatedApps,
                    filteredApplications: this.filterApplications(updatedApps, this.data.merchantFilter)
                });
                wx.showToast({
                    title: '申请已驳回',
                    icon: 'none'
                });
            })
            .catch(() => wx.showToast({
                title: '驳回失败',
                icon: 'none'
            }));
    },

    // 系统公告操作
    onPublishAnnouncement(e) {
        const id = e.currentTarget.dataset.id;
        
        wx.showLoading({
            title: '发布中...',
        });
        
        // 更新数据库中的公告状态
        api.updateAnnouncement(id, { status: 'published' })
            .then(() => {
                wx.hideLoading();
                const list = this.data.announcements.map(a => a.id === id ? {
                    ...a,
                    status: 'published'
                } : a);
                this.setData({
                    announcements: list
                });
                wx.showToast({
                    title: '公告已发布',
                    icon: 'success'
                });
            })
            .catch((err) => {
                wx.hideLoading();
                wx.showToast({
                    title: '发布失败',
                    icon: 'none'
                });
                console.error('发布公告失败:', err);
            });
    },
    onEditAnnouncement(e) {
        // 跳转到编辑公告页面
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({
            url: `/pages/publish-announcement/publish-announcement?id=${id}`
        });
    },
    onDeleteAnnouncement(e) {
        const id = e.currentTarget.dataset.id;
        
        wx.showModal({
            title: '删除确认',
            content: '确定删除这条公告？',
            success: (res) => {
                if (res.confirm) {
                    wx.showLoading({
                        title: '删除中...',
                    });
                    
                    // 从数据库中删除公告
                    api.deleteAnnouncement(id)
                        .then(() => {
                            wx.hideLoading();
                            this.setData({
                                announcements: this.data.announcements.filter(a => a.id !== id)
                            });
                            wx.showToast({
                                title: '公告已删除',
                                icon: 'success'
                            });
                        })
                        .catch((err) => {
                            wx.hideLoading();
                            wx.showToast({
                                title: '删除失败',
                                icon: 'none'
                            });
                            console.error('删除公告失败:', err);
                        });
                }
            }
        });
    },
    onCreateAnnouncement() {
        wx.navigateTo({
            url: '/pages/publish-announcement/publish-announcement'
        });
    },

    // 绘制用户增长趋势图表
    drawUserGrowthChart() {
        const { userGrowth } = this.data.stats;
        if (!userGrowth || userGrowth.length === 0) return;
    
        const categories = userGrowth.map(item => item.date);
        const data = userGrowth.map(item => item.count);
    
        const windowWidth = wx.getSystemInfoSync().windowWidth;
        userGrowthChart = new wxCharts.lineChart({
            canvasId: 'userGrowthChart',
            categories: categories,
            series: [{
                name: '用户增长',
                data: data,
                format: function (val) {
                    return val + '人';
                }
            }],
            width: windowWidth - 40, // 调整为 -40，增加左右边距
            height: 200,
            yAxis: {
                title: '用户数',
                format: function (val) {
                    return val;
                },
                min: 0
            },
            xAxis: {
                disableGrid: false
            },
            extra: {
                lineStyle: 'curve'
            }
        });
    },

    // 绘制订单趋势图
    drawOrderStatsChart() {
        const { orderStats } = this.data.stats;
        if (!orderStats || orderStats.length === 0) return;
    
        const categories = orderStats.map(item => item.date);
        const data = orderStats.map(item => item.orders);
    
        const windowWidth = wx.getSystemInfoSync().windowWidth;
        orderStatsChart = new wxCharts.barChart({
            canvasId: 'orderStatsChart',
            categories: categories,
            series: [{
                name: '订单数',
                data: data,
                color: '#1890ff',
                format: function (val) {
                    return val + '单';
                }
            }],
            width: windowWidth - 40, // 调整为 -40，增加左右边距
            height: 200,
            yAxis: {
                title: '订单数',
                format: function (val) {
                    return val;
                },
                min: 0
            },
            xAxis: {
                disableGrid: false,
                type: 'calibration'
            }
        });
    },

    // 数据监控
    onStatsFilterChange(e) {
        const filter = e.currentTarget.dataset.filter;
        this.setData({
            dataFilter: filter
        });
        
        // 根据筛选条件更新数据
        this.updateStatsData(filter);
        
        // 重新绘制图表
        this.drawUserGrowthChart();
        this.drawOrderStatsChart();
        
        // 显示提示
        let filterText = '';
        switch(filter) {
            case 'thisMonth':
                filterText = '本月';
                break;
            case 'lastMonth':
                filterText = '上月';
                break;
            case 'twoMonthsAgo':
                filterText = '上上月';
                break;
        }
        wx.showToast({
            title: `切换到${filterText}数据`,
            icon: 'none'
        });
    },
    
    // 更新统计数据
    updateStatsData(filter) {
        // 这里可以根据不同的筛选条件从服务器获取数据
        // 目前使用模拟数据，实际项目中应该替换为真实的API调用
        let newUserGrowth = [];
        let newOrderStats = [];
        
        // 根据筛选条件生成不同的模拟数据
        switch(filter) {
            case 'thisMonth':
                // 本月数据（1日不显示柱形，其他每隔7天，最后显示月末）
                newUserGrowth = [
                    { date: '12/01', count: 0 },
                    { date: '12/08', count: 195 },
                    { date: '12/15', count: 202 },
                    { date: '12/22', count: 210 },
                    { date: '12/31', count: 232 }
                ];
                newOrderStats = [
                    { date: '12/01', orders: 0 },
                    { date: '12/08', orders: 195 },
                    { date: '12/15', orders: 202 },
                    { date: '12/22', orders: 210 },
                    { date: '12/31', orders: 232 }
                ];
                break;
            case 'lastMonth':
                // 上月数据（1日不显示柱形，其他每隔7天，最后显示月末）
                newUserGrowth = [
                    { date: '11/01', count: 0 },
                    { date: '11/08', count: 135 },
                    { date: '11/15', count: 142 },
                    { date: '11/22', count: 158 },
                    { date: '11/30', count: 165 }
                ];
                newOrderStats = [
                    { date: '11/01', orders: 0 },
                    { date: '11/08', orders: 135 },
                    { date: '11/15', orders: 142 },
                    { date: '11/22', orders: 158 },
                    { date: '11/30', orders: 165 }
                ];
                break;
            case 'twoMonthsAgo':
                // 上上月数据（1日不显示柱形，其他每隔7天，最后显示月末）
                newUserGrowth = [
                    { date: '10/01', count: 0 },
                    { date: '10/08', count: 95 },
                    { date: '10/15', count: 102 },
                    { date: '10/22', count: 118 },
                    { date: '10/31', count: 125 }
                ];
                newOrderStats = [
                    { date: '10/01', orders: 0 },
                    { date: '10/08', orders: 95 },
                    { date: '10/15', orders: 102 },
                    { date: '10/22', orders: 118 },
                    { date: '10/31', orders: 125 }
                ];
                break;
        }
        
        // 更新数据
        this.setData({
            'stats.userGrowth': newUserGrowth,
            'stats.orderStats': newOrderStats
        });
    },
    onExportData() {
        wx.showToast({
            title: '数据导出中...',
            icon: 'loading',
            duration: 1500
        });
    },

    // 新增：图片预览功能
    previewImage(e) {
        const url = e.currentTarget.dataset.url;
        wx.previewImage({
            urls: [url], // 支持多图预览，这里只传当前图片
            current: url // 当前显示图片的链接
        });
    }
});