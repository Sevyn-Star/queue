// 云函数：syncMerchant/index.js
const cloud = require('wx-server-sdk');

// ！！！替换为你的云环境ID（从小程序云开发控制台复制，格式如 cloud1-xxxxxx）
cloud.init({ env: 'cloud1-7gdlcdovae04b352'})
const db = cloud.database();

exports.main = async (event, context) => {
  const { applyId } = event; // 接收前端传递的申请记录ID
  try {
    // 1. 查询 merchant_apply 表中对应的申请数据（包含 applyTime、nickName、businessLicense 等所有字段）
    const applyRes = await db.collection('merchant_apply').doc(applyId).get();
    const applyData = applyRes.data; // 申请数据对象

    // 2. 构造写入 merchant 表的数据
    const merchantData = {
        _openid: applyData._openid || '', // 手动添加：从 merchant_apply 同步 _openid
      nickName: applyData.nickName || '', // 问题2：同步商家昵称（merchant_apply.nickName → merchant.nickName）
      avatarUrl: applyData.businessLicense || '', // 问题3：营业执照映射为头像（businessLicense → avatarUrl）
      shopName: applyData.shopName || '', // 店铺名称
      phone: applyData.phone || '', // 联系方式
      description: applyData.description || '', // 店铺描述
      logo: applyData.logo || '', // 店铺头像（原logo字段）
      type: applyData.type || 'shop', // 申请类型（默认shop）
      createTime: applyData.applyTime || '' // 关键：直接复用申请时间，无需重新生成
    };

    // 3. 写入 merchant 表（自动继承 applyData 的 _openid，解决 OpenID 显示问题）
    await db.collection('merchant').add({
      data: merchantData
    });

    // 新增：4. 构造写入 restaurants 表的数据（已有字段从申请数据同步，缺失字段留空）
    const restaurantData = {
      merchant_openid: applyData._openid || '', // 关联商家的OpenID
      name: applyData.shopName || '', // 店铺名称（同步申请数据的shopName）
      logo: applyData.logo || '', // 店铺logo（同步申请数据的logo）
      announcement: '', // 店铺公告（申请数据中无该字段，留空）
      avgPrice: '', // 人均消费（申请数据中无该字段，留空）
      tags: [], // 标签（申请数据中无该字段，留空数组）
      businessHours: '', // 营业时间（申请数据中无该字段，留空）
      phone: applyData.phone || '', // 联系电话（同步申请数据的phone）
      floor: '', // 楼层（申请数据中无该字段，留空）
      open: '', // 营业状态（申请数据中无该字段，留空）
      queueCount: '', // 排队人数（申请数据中无该字段，留空）
      rating: '', // 店铺评分（申请数据中无该字段，留空）
      createTime: applyData.applyTime || '' // 创建时间（复用申请时间）
    };

    // 新增：5. 写入 restaurants 表
    await db.collection('restaurants').add({
      data: restaurantData
    });

    // 6. 更新 merchant_apply 表的审核状态为「已通过」（auditStatus: 1）
    await db.collection('merchant_apply').doc(applyId).update({
      data: {
        auditStatus: 1
      }
    });

    // 7. 同步成功返回结果（新增restaurantsData返回，方便调试）
    return {
      success: true,
      message: '商家数据同步成功（已同步至merchant和restaurants表）',
      data: {
        merchantData, // 返回同步到 merchant 表的数据（可选，用于调试）
        restaurantData, // 返回同步到 restaurants 表的数据（可选，用于调试）
        applyId: applyId // 返回申请ID（可选）
      }
    };
  } catch (err) {
    // 异常捕获与错误返回
    console.error('syncMerchant 云函数执行失败：', err);
    return {
      success: false,
      message: `同步失败：${err.message}`,
      error: err // 返回错误详情（可选，用于调试）
    };
  }
};