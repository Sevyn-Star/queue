const app = getApp();

function baseUrl() {
  return (app && app.globalData && app.globalData.baseUrl) || 'http://127.0.0.1:3001';
}

function request(url, method, data) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({
      url: baseUrl() + url,
      method: method || 'GET',
      data: data || {},
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          const err = res.data || { message: '请求失败' };
          err.statusCode = res.statusCode;
          reject(err);
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

function uploadFile(filePath, folder) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.uploadFile({
      url: baseUrl() + '/api/upload',
      filePath,
      name: 'file',
      formData: { folder: folder || 'misc' },
      header: token ? { Authorization: 'Bearer ' + token } : {},
      success(res) {
        try {
          const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
          if (res.statusCode >= 200 && res.statusCode < 300 && data.success) {
            resolve(data);
          } else {
            reject(data);
          }
        } catch (e) {
          reject(e);
        }
      },
      fail: reject,
    });
  });
}

module.exports = {
  baseUrl,
  request,
  uploadFile,
  get: (url, data) => request(url, 'GET', data),
  post: (url, data) => request(url, 'POST', data),
  put: (url, data) => request(url, 'PUT', data),
  del: (url, data) => request(url, 'DELETE', data),
};
