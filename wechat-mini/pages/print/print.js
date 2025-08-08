const { getBaseUrl } = require('../../utils/api')

Page({
  data:{ text:'测试打印', msg:'' },
  onText(e){ this.setData({text:e.detail.value}) },
  onPrint(){
    const base = getBaseUrl()
    if(!base){ this.setData({msg:'请先在首页设置网关IP'}); return }
    wx.request({
      url: base + '/print',
      method: 'POST',
      data: { content: this.data.text, title: '小程序打印' },
      header: { 'content-type':'application/json' },
      success: (res)=>{
        if(res.statusCode===200 && res.data.ok){
          this.setData({msg:'已提交打印'})
        } else {
          this.setData({msg:'打印失败: '+ (res.statusCode||'')})
        }
      },
      fail: (err)=> this.setData({msg:'请求失败: '+(err.errMsg||'')})
    })
  }
})