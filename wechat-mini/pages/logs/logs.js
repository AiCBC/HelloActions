const { getWsUrl } = require('../../utils/api')

Page({
  data:{ events: [] },
  onLoad(){ this.openWs() },
  onUnload(){ if(this.ws){ this.ws.close() } },
  addEvent(e){
    const arr = this.data.events.slice(-200)
    arr.push(e)
    this.setData({events: arr})
  },
  openWs(){
    const base = getWsUrl()
    if(!base){ this.addEvent('未设置网关IP'); return }
    const url = base + '/ws/logs'
    const ws = wx.connectSocket({ url })
    this.ws = ws
    ws.onOpen(()=> this.addEvent('WS 连接成功'))
    ws.onError((e)=> this.addEvent('WS 错误'))
    ws.onClose(()=> this.addEvent('WS 关闭'))
    ws.onMessage((msg)=>{
      try{ this.addEvent(JSON.stringify(JSON.parse(msg.data))) }
      catch{ this.addEvent(String(msg.data)) }
    })
  }
})