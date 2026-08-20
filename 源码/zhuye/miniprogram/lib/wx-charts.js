// wx-charts.js v3.0.1
// https://github.com/xiaolin3303/wx-charts
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.wxCharts = factory());
}(this, function () {
    'use strict';

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    function _defineProperties(target, props) {
        for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
        }
    }

    function _createClass(Constructor, protoProps, staticProps) {
        if (protoProps) _defineProperties(Constructor.prototype, protoProps);
        if (staticProps) _defineProperties(Constructor, staticProps);
        return Constructor;
    }

    function _extends() {
        _extends = Object.assign || function (target) {
            for (var i = 1; i < arguments.length; i++) {
                var source = arguments[i];
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }
            return target;
        };
        return _extends.apply(this, arguments);
    }

    var defaultColor = ['#8fc9fb', '#5cb85c', '#5bc0de', '#f0ad4e', '#d9534f', '#428bca', '#95a5a6', '#e74c3c', '#34495e', '#2ecc71'];

    var Chart = /*#__PURE__*/function () {
        function Chart(canvasId, type, categories, series, options) {
        _classCallCheck(this, Chart);

        // 支持两种调用方式：
        // 1. new Chart(canvasId, type, categories, series, options)
        // 2. new Chart(options) - 工厂函数调用方式
        if (typeof canvasId === 'object' && canvasId !== null) {
            var opts = canvasId;
            this.canvasId = opts.canvasId;
            this.type = opts.type;
            this.categories = opts.categories;
            this.series = opts.series;
            this.options = opts;
        } else {
            this.canvasId = canvasId;
            this.type = type;
            this.categories = categories;
            this.series = series;
            this.options = options || {};
        }

        this.width = this.options.width || 320;
        this.height = this.options.height || 200;
        this.padding = this.options.padding || 20;
        this.title = this.options.title || '';
        this.subtitle = this.options.subtitle || '';
        this.animation = this.options.animation !== false;
        this.legend = this.options.legend !== false;
        this.yAxis = this.options.yAxis || {};
        this.xAxis = this.options.xAxis || {};
        this.extra = this.options.extra || {};
        this.series = this.initSeries();
        this.chartData = this.initChartData();
        this.initCanvas();
        this.draw();
    }

        _createClass(Chart, [{            key: 'initCanvas',            value: function initCanvas() {
                var ctx = wx.createCanvasContext(this.canvasId);
                this.ctx = ctx;
            }
        }, {
            key: 'initSeries',
            value: function initSeries() {
                var series = this.series;
                if (!series) {
                    return [];
                }
                for (var i = 0; i < series.length; i++) {
                    var item = series[i];
                    item.color = item.color || defaultColor[i % defaultColor.length];
                    if (!item.data) {
                        item.data = [];
                    }
                    if (!item.format) {
                        item.format = function(val) {
                            return val;
                        };
                    }
                }
                return series;
            }
        }, {
            key: 'initChartData',
            value: function initChartData() {
                var chartData = {
                    max: 0,
                    min: this.yAxis.min !== undefined ? this.yAxis.min : 0,
                    sum: 0,
                    categories: this.categories
                };
                var dataList = [];
                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    for (var j = 0; j < item.data.length; j++) {
                        var value = item.data[j];
                        dataList.push(value);
                        if (value > chartData.max) {
                            chartData.max = value;
                        }
                        if (this.yAxis.min === undefined && value < chartData.min) {
                            chartData.min = value;
                        }
                        chartData.sum += value;
                    }
                }
                chartData.dataList = dataList;
                // 如果数据最大值小于最小值，重新设置最大值
                if (chartData.max < chartData.min) {
                    chartData.max = chartData.min + 10;
                }
                return chartData;
            }
        }, {
            key: 'draw',
            value: function draw() {
                this.ctx.clearRect(0, 0, this.width, this.height);
                if (this.legend) {
                    this.drawLegend();
                }
                if (this.title) {
                    this.drawTitle();
                }
                if (this.subtitle) {
                    this.drawSubtitle();
                }
                this.drawChart();
                this.ctx.draw();
            }
        }, {
            key: 'drawChart',
            value: function drawChart() {
                switch (this.type) {
                    case 'line':
                        this.drawLineChart();
                        break;
                    case 'bar':
                        this.drawBarChart();
                        break;
                    case 'column':
                        this.drawBarChart();
                        break;
                    case 'pie':
                        this.drawPieChart();
                        break;
                    case 'ring':
                        this.drawRingChart();
                        break;
                    case 'area':
                        this.drawAreaChart();
                        break;
                    case 'radar':
                        this.drawRadarChart();
                        break;
                }
            }
        }, {
            key: 'drawLineChart',
            value: function drawLineChart() {
                var chartWidth = this.width - this.padding;
                var chartHeight = this.height - this.padding * 2;
                var startX = this.padding / 2;
                var startY = this.padding;

                this.drawAxes(startX, startY, chartWidth, chartHeight);
                this.drawLines(startX, startY, chartWidth, chartHeight);
            }
        }, {
            key: 'drawBarChart',
            value: function drawBarChart() {
                if (!this.categories || this.categories.length === 0) {
                    return;
                }

                var chartWidth = this.width - this.padding;
                var chartHeight = this.height - this.padding * 2;
                var startX = this.padding / 2;
                var startY = this.padding;

                this.drawAxes(startX, startY, chartWidth, chartHeight);
                this.drawBars(startX, startY, chartWidth, chartHeight);
            }
        }, {
            key: 'drawAxes',
            value: function drawAxes(startX, startY, chartWidth, chartHeight) {
                this.ctx.strokeStyle = '#ccc';
                this.ctx.lineWidth = 1;

                // 绘制Y轴
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(startX, startY + chartHeight);
                this.ctx.stroke();

                // 绘制X轴
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY + chartHeight);
                this.ctx.lineTo(startX + chartWidth, startY + chartHeight);
                this.ctx.stroke();

                // 绘制Y轴标题
                if (this.yAxis.title) {
                    this.ctx.save();
                    this.ctx.font = '12px sans-serif';
                    this.ctx.fillStyle = '#666';
                    this.ctx.textAlign = 'center';
                    this.ctx.translate(startX - 20, startY + chartHeight / 2);
                    this.ctx.rotate(-Math.PI / 2);
                    this.ctx.fillText(this.yAxis.title, 0, 0);
                    this.ctx.restore();
                }

                // 绘制Y轴刻度
                var yAxisSplitNumber = this.yAxis.splitNumber || 5;
                var yAxisStep = this.chartData.max / yAxisSplitNumber;
                var yAxisMin = this.yAxis.min || 0;
                for (var i = 0; i <= yAxisSplitNumber; i++) {
                    var y = startY + chartHeight - ((i * yAxisStep + yAxisMin) / (this.chartData.max - yAxisMin) * chartHeight);
                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, y);
                    this.ctx.lineTo(startX + 5, y);
                    this.ctx.stroke();

                    // 绘制Y轴网格线
                    if (!this.xAxis.disableGrid) {
                        this.ctx.beginPath();
                        this.ctx.moveTo(startX + 5, y);
                        this.ctx.lineTo(startX + chartWidth, y);
                        this.ctx.strokeStyle = '#f0f0f0';
                        this.ctx.stroke();
                        this.ctx.strokeStyle = '#ccc';
                    }

                    var value = i * yAxisStep + yAxisMin;
                    if (this.yAxis.format) {
                        value = this.yAxis.format(value);
                    }
                    this.ctx.font = '12px sans-serif';
                    this.ctx.fillStyle = '#666';
                    this.ctx.textAlign = 'right';
                    this.ctx.fillText(value, startX - 5, y + 4);
                }

                // 绘制X轴刻度和标签
                if (this.categories && this.categories.length > 0) {
                    var dataLength = Math.max(1, this.categories.length);
                    var availableWidth = chartWidth - 10;
                    var spacing = (availableWidth - (availableWidth / (dataLength * 1.5)) * dataLength) / (dataLength + 1);
                    var barWidth = availableWidth / (dataLength * 1.5);
                    
                    for (var j = 0; j < this.categories.length; j++) {
                        // 计算刻度和标签的X位置，与柱子对齐
                        var x = startX + spacing + j * (barWidth + spacing) + barWidth / 2;
                        
                        // 绘制X轴刻度
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, startY + chartHeight);
                        this.ctx.lineTo(x, startY + chartHeight + 5);
                        this.ctx.stroke();

                        // 绘制X轴网格线
                        if (!this.xAxis.disableGrid) {
                            this.ctx.beginPath();
                            this.ctx.moveTo(x, startY);
                            this.ctx.lineTo(x, startY + chartHeight - 5);
                            this.ctx.strokeStyle = '#f0f0f0';
                            this.ctx.stroke();
                            this.ctx.strokeStyle = '#ccc';
                        }

                        // 绘制X轴标签
                        this.ctx.font = '12px sans-serif';
                        this.ctx.fillStyle = '#666';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(this.categories[j], x, startY + chartHeight + 15);
                    }
                }
            }
        }, {
            key: 'drawLines',
            value: function drawLines(startX, startY, chartWidth, chartHeight) {
                if (!this.categories || this.categories.length === 0) {
                    return;
                }

                // 确保所有数据点都能均匀分布并完整显示
                var dataLength = Math.max(1, this.categories.length);
                var availableWidth = chartWidth - 10; // 留出右边距
                var spacing = (availableWidth - (availableWidth / (dataLength * 1.5)) * dataLength) / (dataLength + 1);
                var barWidth = availableWidth / (dataLength * 1.5);
                var yAxisStep = chartHeight / this.chartData.max;
                var lineStyle = this.extra.lineStyle || 'straight';

                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    this.ctx.strokeStyle = item.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();

                    for (var j = 0; j < item.data.length; j++) {
                        // 计算数据点的X位置，与柱子和标签对齐
                        var x = startX + spacing + j * (barWidth + spacing) + barWidth / 2;
                        var y = startY + chartHeight - (item.data[j] * yAxisStep);

                        if (j === 0) {
                            this.ctx.moveTo(x, y);
                        } else {
                            if (lineStyle === 'curve') {
                                // 绘制曲线，使用新的坐标计算方式
                                var prevX = startX + spacing + (j - 1) * (barWidth + spacing) + barWidth / 2;
                                var prevY = startY + chartHeight - (item.data[j - 1] * yAxisStep);
                                var cpx1 = prevX + (x - prevX) / 2;
                                var cpy1 = prevY;
                                var cpx2 = prevX + (x - prevX) / 2;
                                var cpy2 = y;
                                this.ctx.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, x, y);
                            } else {
                                // 绘制直线
                                this.ctx.lineTo(x, y);
                            }
                        }

                        // 绘制数据点
                        this.ctx.fillStyle = item.color;
                        this.ctx.beginPath();
                        this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    }

                    this.ctx.stroke();
                }
            }
        }, {
            key: 'drawBars',
            value: function drawBars(startX, startY, chartWidth, chartHeight) {
                if (!this.categories || this.categories.length === 0) {
                    return;
                }

                // 确保至少有一个数据点
                var dataLength = Math.max(1, this.categories.length);
                // 为所有数据点分配均匀的空间，确保最后一个点也能完整显示
                var availableWidth = chartWidth - 10; // 留出右边距
                var barWidth = availableWidth / (dataLength * 1.5); // 根据数据点数量动态计算柱宽
                var spacing = (availableWidth - barWidth * dataLength) / (dataLength + 1);
                var yAxisStep = chartHeight / this.chartData.max;

                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    this.ctx.fillStyle = item.color;

                    for (var j = 0; j < item.data.length; j++) {
                        // 计算柱子x位置，确保所有柱子都能均匀分布
                        var x = startX + spacing + j * (barWidth + spacing);
                        var barHeight = item.data[j] * yAxisStep;
                        var y = startY + chartHeight - barHeight;

                        // 每次绘制柱子前都重新设置颜色
                        this.ctx.fillStyle = item.color;
                        this.ctx.fillRect(x, y, barWidth, barHeight);

                        // 绘制数值标签
                        this.ctx.font = '12px sans-serif';
                        this.ctx.fillStyle = '#666';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(item.format(item.data[j]), x + barWidth / 2, y - 5);
                    }
                }
            }
        }, {
            key: 'drawLegend',
            value: function drawLegend() {
                var legendHeight = 20;
                var legendWidth = 0;
                var legendItems = [];

                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    var legendItem = {
                        name: item.name || 'Series ' + (i + 1),
                        color: item.color
                    };
                    legendItems.push(legendItem);
                    legendWidth += this.ctx.measureText(legendItem.name).width + 20;
                }

                var startX = (this.width - legendWidth) / 2;
                var startY = 20;

                for (var j = 0; j < legendItems.length; j++) {
                    var legendItem = legendItems[j];

                    // 绘制颜色块
                    this.ctx.fillStyle = legendItem.color;
                    this.ctx.fillRect(startX, startY - 5, 10, 10);

                    // 绘制文字
                    this.ctx.font = '12px sans-serif';
                    this.ctx.fillStyle = '#666';
                    this.ctx.textAlign = 'left';
                    this.ctx.fillText(legendItem.name, startX + 15, startY + 5);

                    startX += this.ctx.measureText(legendItem.name).width + 25;
                }
            }
        }, {
            key: 'drawTitle',
            value: function drawTitle() {
                this.ctx.font = '16px sans-serif';
                this.ctx.fillStyle = '#333';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(this.title, this.width / 2, 25);
            }
        }, {
            key: 'drawSubtitle',
            value: function drawSubtitle() {
                this.ctx.font = '12px sans-serif';
                this.ctx.fillStyle = '#666';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(this.subtitle, this.width / 2, 45);
            }
        }, {
            key: 'drawPieChart',
            value: function drawPieChart() {
                var centerX = this.width / 2;
                var centerY = this.height / 2;
                var radius = Math.min(centerX, centerY) - this.padding;

                var startAngle = 0;
                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    var angle = item.data / this.chartData.sum * Math.PI * 2;

                    this.ctx.fillStyle = item.color;
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
                    this.ctx.closePath();
                    this.ctx.fill();

                    startAngle += angle;
                }
            }
        }, {
            key: 'drawRingChart',
            value: function drawRingChart() {
                var centerX = this.width / 2;
                var centerY = this.height / 2;
                var radius = Math.min(centerX, centerY) - this.padding;
                var innerRadius = radius * 0.6;

                var startAngle = 0;
                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    var angle = item.data / this.chartData.sum * Math.PI * 2;

                    this.ctx.fillStyle = item.color;
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
                    this.ctx.arc(centerX, centerY, innerRadius, startAngle + angle, startAngle, true);
                    this.ctx.closePath();
                    this.ctx.fill();

                    startAngle += angle;
                }
            }
        }, {
            key: 'drawAreaChart',
            value: function drawAreaChart() {
                var chartWidth = this.width - this.padding * 2;
                var chartHeight = this.height - this.padding * 2;
                var startX = this.padding;
                var startY = this.padding;

                this.drawAxes(startX, startY, chartWidth, chartHeight);

                if (!this.categories || this.categories.length === 0) {
                    return;
                }

                // 确保所有数据点都能均匀分布并完整显示
                var dataLength = Math.max(1, this.categories.length);
                var availableWidth = chartWidth - 10; // 留出右边距
                var spacing = (availableWidth - (availableWidth / (dataLength * 1.5)) * dataLength) / (dataLength + 1);
                var barWidth = availableWidth / (dataLength * 1.5);
                var yAxisStep = chartHeight / this.chartData.max;

                for (var i = 0; i < this.series.length; i++) {
                    var item = this.series[i];
                    var gradient = this.ctx.createLinearGradient(startX, startY, startX, startY + chartHeight);
                    gradient.addColorStop(0, item.color + '80');
                    gradient.addColorStop(1, item.color + '00');

                    this.ctx.fillStyle = gradient;
                    this.ctx.beginPath();
                    this.ctx.moveTo(startX, startY + chartHeight);

                    for (var j = 0; j < item.data.length; j++) {
                        var x = startX + spacing + j * (barWidth + spacing) + barWidth / 2;
                        var y = startY + chartHeight - (item.data[j] * yAxisStep);

                        if (j === 0) {
                            this.ctx.lineTo(x, y);
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }

                    // 关闭面积图路径
                    this.ctx.lineTo(startX + spacing + (item.data.length - 1) * (barWidth + spacing) + barWidth / 2, startY + chartHeight);
                    this.ctx.closePath();
                    this.ctx.fill();

                    // 绘制线条
                    this.ctx.strokeStyle = item.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();

                    for (var k = 0; k < item.data.length; k++) {
                        var xLine = startX + spacing + k * (barWidth + spacing) + barWidth / 2;
                        var yLine = startY + chartHeight - (item.data[k] * yAxisStep);

                        if (k === 0) {
                            this.ctx.moveTo(xLine, yLine);
                        } else {
                            this.ctx.lineTo(xLine, yLine);
                        }
                    }

                    this.ctx.stroke();
                }
            }
        }, {
            key: 'drawRadarChart',
            value: function drawRadarChart() {
                var centerX = this.width / 2;
                var centerY = this.height / 2;
                var radius = Math.min(centerX, centerY) - this.padding;

                var categories = this.categories;
                var series = this.series;

                if (!categories || categories.length === 0) {
                    return;
                }

                var angleStep = Math.PI * 2 / categories.length;

                // 绘制网格
                for (var i = 1; i <= 5; i++) {
                    this.ctx.strokeStyle = '#ccc';
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();

                    for (var j = 0; j < categories.length; j++) {
                        var angle = j * angleStep - Math.PI / 2;
                        var x = centerX + Math.cos(angle) * (radius * i / 5);
                        var y = centerY + Math.sin(angle) * (radius * i / 5);

                        if (j === 0) {
                            this.ctx.moveTo(x, y);
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }

                    this.ctx.closePath();
                    this.ctx.stroke();
                }

                // 绘制轴线
                for (var k = 0; k < categories.length; k++) {
                    var angle = k * angleStep - Math.PI / 2;
                    var x = centerX + Math.cos(angle) * radius;
                    var y = centerY + Math.sin(angle) * radius;

                    this.ctx.strokeStyle = '#ccc';
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.lineTo(x, y);
                    this.ctx.stroke();

                    // 绘制分类名称
                    this.ctx.font = '12px sans-serif';
                    this.ctx.fillStyle = '#666';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(categories[k], x, y + 15);
                }

                // 绘制数据
                for (var l = 0; l < series.length; l++) {
                    var item = series[l];
                    this.ctx.strokeStyle = item.color;
                    this.ctx.lineWidth = 2;
                    this.ctx.fillStyle = item.color + '40';
                    this.ctx.beginPath();

                    for (var m = 0; m < item.data.length; m++) {
                        var angle = m * angleStep - Math.PI / 2;
                        var value = item.data[m] / this.chartData.max;
                        var x = centerX + Math.cos(angle) * (radius * value);
                        var y = centerY + Math.sin(angle) * (radius * value);

                        if (m === 0) {
                            this.ctx.moveTo(x, y);
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }

                    this.ctx.closePath();
                    this.ctx.fill();
                    this.ctx.stroke();
                }
            }
        }]);

        return Chart;
    }();

    // 兼容构造函数形式的API
    var wxCharts = function(options) {
        var canvasId = options.canvasId;
        var type = options.type;
        var categories = options.categories;
        var series = options.series;
        return new Chart(canvasId, type, categories, series, options);
    };

    // 保留工厂函数形式的API
    wxCharts.lineChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'line' }));
    };

    wxCharts.barChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'bar' }));
    };

    wxCharts.pieChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'pie' }));
    };

    wxCharts.ringChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'ring' }));
    };

    wxCharts.columnChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'column' }));
    };

    wxCharts.areaChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'area' }));
    };

    wxCharts.radarChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'radar' }));
    };

    wxCharts.lineChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'line' }));
    };

    wxCharts.barChart = function(options) {
        return new wxCharts(_extends({}, options, { type: 'bar' }));
    };

    return wxCharts;
}));