function requestP(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      ...options,
      success: resolve,
      fail: reject,
    });
  });
}

Page({
  data: {
    wifiSsid: '',
    wifiPassword: '',
    gatewayBase: 'ws://192.168.1.100:3001',
    deviceHost: '',
    devicePort: '',
    printerHost: '',
    printText: 'LIS 测试打印',
    statusText: '未连接',
    modes: ['AUTO', 'ASTM', 'MLLP'],
    modeIndex: 0,
    sendEnq: false,
    rawHex: '',
  },

  onInputSsid(e) { this.setData({ wifiSsid: e.detail.value }); },
  onInputPassword(e) { this.setData({ wifiPassword: e.detail.value }); },
  onInputGateway(e) { this.setData({ gatewayBase: e.detail.value }); },
  onInputDeviceHost(e) { this.setData({ deviceHost: e.detail.value }); },
  onInputDevicePort(e) { this.setData({ devicePort: e.detail.value }); },
  onInputPrinterHost(e) { this.setData({ printerHost: e.detail.value }); },
  onInputPrintText(e) { this.setData({ printText: e.detail.value }); },
  onInputRawHex(e) { this.setData({ rawHex: e.detail.value }); },
  onModeChange(e) { this.setData({ modeIndex: Number(e.detail.value) || 0 }); },
  onToggleEnq(e) { this.setData({ sendEnq: e.detail.value }); },

  async onConnectWifi() {
    const { wifiSsid, wifiPassword } = this.data;
    try {
      // Wi-Fi 接口需要定位开关与权限
      await wx.getSetting({});
      try { await wx.getLocation({ type: 'wgs84' }); } catch (_) {}
      await wx.startWifi();
      await wx.connectWifi({ SSID: wifiSsid, password: wifiPassword });
      wx.showToast({ title: 'Wi‑Fi 已连接', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: 'Wi‑Fi 失败', icon: 'error' });
    }
  },

  onConnectWs() {
    const { gatewayBase } = this.data;
    const wsUrl = gatewayBase.endsWith('/ws') ? gatewayBase : `${gatewayBase.replace('http', 'ws')}/ws`;
    const socket = wx.connectSocket({ url: wsUrl });
    socket.onOpen(() => this.appendStatus('WS 已连接'));
    socket.onMessage((msg) => this.appendStatus(`WS: ${msg.data}`));
    socket.onClose(() => this.appendStatus('WS 已关闭'));
    socket.onError(() => this.appendStatus('WS 错误'));
    this.socket = socket;
  },

  async onConnectDevice() {
    const { gatewayBase, deviceHost, devicePort, modes, modeIndex, sendEnq } = this.data;
    const httpBase = gatewayBase.startsWith('ws') ? gatewayBase.replace('ws', 'http') : gatewayBase;
    try {
      const res = await requestP({
        url: `${httpBase}/connect-device`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { host: deviceHost, port: Number(devicePort), mode: modes[modeIndex], sendEnq },
      });
      if (res.statusCode === 200) {
        this.appendStatus('设备已连接');
      } else {
        this.appendStatus('设备连接失败');
      }
    } catch (e) {
      this.appendStatus('设备连接异常');
    }
  },

  async onSendEnq() {
    const { gatewayBase } = this.data;
    const httpBase = gatewayBase.startsWith('ws') ? gatewayBase.replace('ws', 'http') : gatewayBase;
    try {
      await requestP({ url: `${httpBase}/send-enq`, method: 'POST' });
      this.appendStatus('已发送 ENQ');
    } catch (e) {
      this.appendStatus('发送 ENQ 失败');
    }
  },

  async onSendRaw() {
    const { gatewayBase, rawHex } = this.data;
    const httpBase = gatewayBase.startsWith('ws') ? gatewayBase.replace('ws', 'http') : gatewayBase;
    if (!rawHex) return this.appendStatus('请输入 HEX');
    try {
      const res = await requestP({
        url: `${httpBase}/send-raw`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { hex: rawHex },
      });
      if (res.statusCode === 200) {
        this.appendStatus('HEX 已发送');
      } else {
        this.appendStatus('HEX 发送失败');
      }
    } catch (e) {
      this.appendStatus('HEX 发送异常');
    }
  },

  async onPrint() {
    const { gatewayBase, printerHost, printText } = this.data;
    const httpBase = gatewayBase.startsWith('ws') ? gatewayBase.replace('ws', 'http') : gatewayBase;
    try {
      const res = await requestP({
        url: `${httpBase}/print`,
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { printerHost, text: printText },
      });
      if (res.statusCode === 200) {
        wx.showToast({ title: '已下发打印', icon: 'success' });
      } else {
        wx.showToast({ title: '打印失败', icon: 'error' });
      }
    } catch (e) {
      wx.showToast({ title: '打印异常', icon: 'error' });
    }
  },

  appendStatus(line) {
    const now = new Date().toLocaleTimeString();
    this.setData({ statusText: `${now} ${line}\n` + this.data.statusText.slice(0, 3000) });
  },
});