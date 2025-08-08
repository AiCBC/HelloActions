const getBaseUrl = () => {
  const ip = wx.getStorageSync('gatewayIp') || ''
  const port = wx.getStorageSync('gatewayPort') || 8000
  if (!ip) return ''
  return `http://${ip}:${port}`
}

const getWsUrl = () => {
  const ip = wx.getStorageSync('gatewayIp') || ''
  const port = wx.getStorageSync('gatewayPort') || 8000
  if (!ip) return ''
  return `ws://${ip}:${port}`
}

module.exports = { getBaseUrl, getWsUrl }