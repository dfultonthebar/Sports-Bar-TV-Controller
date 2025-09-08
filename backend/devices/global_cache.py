import asyncio
from devices.base import DeviceDriver

class GlobalCacheITach(DeviceDriver):
    PORT = 4998
    async def connect(self):
        self.reader, self.writer = await asyncio.open_connection(self.host, self.PORT)
    async def _send(self, cmd):
        if not cmd.endswith("\r"): cmd += "\r"
        self.writer.write(cmd.encode()); await self.writer.drain()
    async def send_ir(self, cmd): await self._send(cmd)
    async def send_serial(self, connector, data):
        await self._send(f'send_string,{connector},"{data}\\r"')