const { getBaseUrl } = require('../../utils/api')

Page({
  data: {
    ssid: '',
    password: '',
    wifiMsg: '',
    gatewayIp: wx.getStorageSync('gatewayIp') || '',
    gatewayPort: wx.getStorageSync('gatewayPort') || 8000,
    gatewayMsg: ''
  },
  onSsidInput(e){ this.setData({ssid: e.detail.value}) },
  onPwdInput(e){ this.setData({password: e.detail.value}) },
  onIpInput(e){ this.setData({gatewayIp: e.detail.value}) },
  onPortInput(e){ this.setData({gatewayPort: Number(e.detail.value) || 8000}) },
  onConnectWifi(){
    const { ssid, password } = this.data
    if(!ssid){ this.setData({wifiMsg:'请输入SSID'}); return }
    wx.startWifi({
      success: ()=>{
        wx.connectWifi({
          SSID: ssid,
          password,
          success: ()=> this.setData({wifiMsg: 'WiFi 连接成功'}),
          fail: (err)=> this.setData({wifiMsg: '连接失败: '+ (err.errMsg||'')})
        })
      },
      fail: (err)=> this.setData({wifiMsg: 'WiFi 启动失败: '+(err.errMsg||'')})
    })
  },
  onSaveGateway(){
    const { gatewayIp, gatewayPort } = this.data
    if(!gatewayIp){ this.setData({gatewayMsg:'请输入网关IP'}); return }
    wx.setStorageSync('gatewayIp', gatewayIp)
    wx.setStorageSync('gatewayPort', gatewayPort)
    this.setData({gatewayMsg: '已保存'})
  },
  onTestGateway(){
    const base = getBaseUrl()
    if(!base){ this.setData({gatewayMsg: '请先保存网关IP'}); return }
    wx.request({
      url: base + '/health',
      method: 'GET',
      success: (res)=>{
        if(res.statusCode === 200){
          this.setData({gatewayMsg: '连接成功: '+ JSON.stringify(res.data)})
        } else {
          this.setData({gatewayMsg: '连接失败: '+res.statusCode})
        }
      },
      fail: (err)=> this.setData({gatewayMsg: '请求失败: '+(err.errMsg||'')})
    })
  },
  goPrint(){ wx.navigateTo({url:'/pages/print/print'}) },
  goLogs(){ wx.navigateTo({url:'/pages/logs/logs'}) }
})