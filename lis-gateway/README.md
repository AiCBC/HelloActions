# LIS 网关服务

用于与医疗设备通过 TCP 端口对接（LIS/ASTM 简化），并提供 HTTP/WebSocket 接口给微信小程序调用，实现打印。

## 功能
- TCP 监听设备数据（默认 0.0.0.0:5000）
- 可选 ASTM 简化 ACK（0x06）
- FastAPI 提供：
  - GET /health 健康检查
  - GET /config / POST /config 读取/更新配置（端口、ACK 模式、打印机名等）
  - POST /print 直接打印文本
  - WS /ws/logs 实时日志与设备消息
- 打印：优先 CUPS（若可用），否则落盘到 `printouts/` 目录

## 快速开始
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

启动后，LIS 设备可向本机端口（默认 5000）发送数据。可在浏览器/小程序调用：
- 健康检查：`http://<网关IP>:8000/health`
- WebSocket 日志：`ws://<网关IP>:8000/ws/logs`

## 配置参数示例
```json
{
  "lis_mode": "server",
  "lis_bind_host": "0.0.0.0",
  "lis_bind_port": 5000,
  "ack_mode": "none",
  "printer_name": null,
  "print_encoding": "utf-8",
  "save_raw_messages": true
}
```

更新配置后，TCP 监听会自动重启以应用新端口。

## 注意
- ASTM/LIS 协议实现为简化版，生产建议对接厂商协议文档进行完善解析与校验。
- 打印默认尝试 CUPS，不可用时会将内容存入 `printouts/` 以便调试。