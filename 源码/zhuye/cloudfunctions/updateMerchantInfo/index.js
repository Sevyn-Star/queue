const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-7gdlcdovae04b352'})
// cloud.init({
//   env: cloud.DYNAMIC_CURRENT_ENV
// })
const db = cloud.database()

exports.main = async (event, context) => {
  const { merchantOpenId, updateData, action } = event // 新增action参数区分操作
  
  console.log('云函数接收的数据:', {
    merchantOpenId,
    updateData,
    action
  })
  
  try {
    // ---------- 分支1：统计今日客流量 ----------
    if (action === 'getTodayCustomerFlow') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // 先查询该商家对应的restaurant _id
      const merchantRes = await db.collection('restaurants')
        .where({ merchant_openid: merchantOpenId })
        .field({ _id: true })
        .get();
      if (merchantRes.data.length === 0) {
        return { success: false, message: '未找到商家信息' };
      }
      const restaurantId = merchantRes.data[0]._id;

      // 统计今日queueTickets中该餐厅的queueNumber总和
      const flowRes = await db.collection('queueTickets')
        .where({
          restaurantid: restaurantId,
          createTime: db.command.and([
            db.command.gte(today),
            db.command.lt(tomorrow)
          ])
        })
        .get();
      const total = flowRes.data.reduce((sum, item) => sum + item.queueNumber, 0);
      return { success: true, total };
    }

    // ---------- 分支2：原有更新商家信息逻辑 ----------
    const cleanUpdateData = {}
    for (const key in updateData) {
      if (updateData[key] !== undefined && updateData[key] !== null) {
        if (updateData[key] && typeof updateData[key] === 'object' && updateData[key].__type === 'serverDate') {
          cleanUpdateData[key] = updateData[key]
        } else {
          cleanUpdateData[key] = updateData[key]
        }
      }
    }
    cleanUpdateData.updateTime = db.serverDate()
    
    const res = await db.collection('restaurants')
      .where({ merchant_openid: merchantOpenId })
      .update({ data: cleanUpdateData })
    
    return { success: true, data: res, message: '更新成功' }
  } catch (err) {
    console.error('云函数执行失败:', err)
    return { success: false, message: err.errMsg || '操作失败', error: err }
  }
}