import asyncio
from typing import Awaitable, Callable, Optional


class LisTcpServer:
    def __init__(
        self,
        bind_host: str,
        bind_port: int,
        ack_mode: str,
        on_message: Callable[[bytes], Awaitable[None]],
        on_event: Callable[[dict], Awaitable[None]],
    ) -> None:
        self.bind_host = bind_host
        self.bind_port = bind_port
        self.ack_mode = ack_mode
        self.on_message = on_message
        self.on_event = on_event
        self._server: Optional[asyncio.AbstractServer] = None
        self.is_running: bool = False

    async def start(self) -> None:
        if self._server is not None:
            await self.stop()
        server = await asyncio.start_server(self._handle_client, self.bind_host, self.bind_port)
        self._server = server
        self.is_running = True
        await self.on_event({"type": "tcp_started", "host": self.bind_host, "port": self.bind_port})

        async def _serve_forever():
            async with server:
                await server.serve_forever()

        asyncio.create_task(_serve_forever())

    async def stop(self) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
            self._server = None
        if self.is_running:
            await self.on_event({"type": "tcp_stopped"})
        self.is_running = False

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        peername = writer.get_extra_info("peername")
        await self.on_event({"type": "client_connected", "peer": str(peername)})
        try:
            while True:
                data = await reader.read(4096)
                if not data:
                    break
                await self.on_event({"type": "data", "size": len(data)})
                if self.ack_mode == "astm":
                    try:
                        writer.write(b"\x06")  # ACK for ASTM frames (simplified)
                        await writer.drain()
                    except Exception:
                        pass
                await self.on_message(data)
        except Exception as exc:
            await self.on_event({"type": "client_error", "error": str(exc)})
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            await self.on_event({"type": "client_disconnected", "peer": str(peername)})