import asyncio
import json
import os
from pathlib import Path
from typing import Optional, Literal, List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from lis.tcp_server import LisTcpServer
from printer.cups_printer import PrinterService


APP_DIR = Path(__file__).parent
CONFIG_PATH = APP_DIR / "config.json"
PRINT_OUT_DIR = APP_DIR / "printouts"
PRINT_OUT_DIR.mkdir(exist_ok=True)


class AppConfig(BaseModel):
    lis_mode: Literal["server"] = "server"
    lis_bind_host: str = "0.0.0.0"
    lis_bind_port: int = 5000
    ack_mode: Literal["none", "astm"] = "none"
    printer_name: Optional[str] = None
    print_encoding: str = "utf-8"
    save_raw_messages: bool = True


class PrintRequest(BaseModel):
    content: str = Field(..., description="要打印的文本内容")
    title: Optional[str] = Field(default="LIS Print")


class EventBroadcaster:
    def __init__(self) -> None:
        self._subscribers: List[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def publish(self, event: dict) -> None:
        async with self._lock:
            for queue in list(self._subscribers):
                try:
                    await queue.put(event)
                except Exception:
                    pass

    async def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._subscribers.append(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue) -> None:
        async with self._lock:
            if queue in self._subscribers:
                self._subscribers.remove(queue)


app = FastAPI(title="LIS Gateway Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

broadcaster = EventBroadcaster()
printer_service = PrinterService(output_dir=str(PRINT_OUT_DIR))
lis_server: Optional[LisTcpServer] = None
current_config: AppConfig


def load_config() -> AppConfig:
    if CONFIG_PATH.exists():
        data = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        return AppConfig.model_validate(data)
    cfg = AppConfig()
    save_config(cfg)
    return cfg


def save_config(cfg: AppConfig) -> None:
    CONFIG_PATH.write_text(cfg.model_dump_json(indent=2), encoding="utf-8")


async def start_lis_server(cfg: AppConfig) -> LisTcpServer:
    global lis_server
    if lis_server is not None:
        await lis_server.stop()
    lis_server = LisTcpServer(
        bind_host=cfg.lis_bind_host,
        bind_port=cfg.lis_bind_port,
        ack_mode=cfg.ack_mode,
        on_message=lambda b: asyncio.create_task(on_lis_message(b)),
        on_event=lambda e: asyncio.create_task(broadcaster.publish(e)),
    )
    await lis_server.start()
    return lis_server


async def on_lis_message(data: bytes) -> None:
    try:
        text = data.decode(current_config.print_encoding, errors="replace")
    except Exception:
        text = data.decode("latin-1", errors="replace")
    await broadcaster.publish({"type": "device_message", "text": text})
    try:
        printer_service.print_text(text=text, title="LIS Message")
        await broadcaster.publish({"type": "printed", "ok": True})
    except Exception as exc:
        await broadcaster.publish({"type": "printed", "ok": False, "error": str(exc)})


@app.on_event("startup")
async def on_startup() -> None:
    global current_config
    current_config = load_config()
    await start_lis_server(current_config)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global lis_server
    if lis_server is not None:
        await lis_server.stop()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "lis": {
            "host": current_config.lis_bind_host,
            "port": current_config.lis_bind_port,
            "ack_mode": current_config.ack_mode,
            "running": lis_server.is_running if lis_server else False,
        },
        "printer": {
            "name": printer_service.printer_name,
            "available": printer_service.is_available,
        },
    }


@app.get("/config")
async def get_config():
    return current_config


@app.post("/config")
async def update_config(cfg: AppConfig):
    global current_config
    current_config = cfg
    save_config(current_config)
    await broadcaster.publish({"type": "config_updated", "config": current_config.model_dump()})
    await start_lis_server(current_config)
    return {"ok": True}


@app.post("/print")
async def api_print(req: PrintRequest):
    printer_service.print_text(req.content, title=req.title or "LIS Print")
    await broadcaster.publish({"type": "manual_print", "ok": True})
    return {"ok": True}


@app.websocket("/ws/logs")
async def ws_logs(ws: WebSocket):
    await ws.accept()
    queue = await broadcaster.subscribe()
    try:
        await broadcaster.publish({"type": "client_connected"})
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    finally:
        await broadcaster.unsubscribe(queue)
        try:
            await ws.close()
        except Exception:
            pass