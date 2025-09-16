import asyncio
from devices.base import DeviceDriver

class WolfPackMatrix(DeviceDriver):
    PORT = 5000
    async def connect(self): 
        self.reader, self.writer = await asyncio.open_connection(self.host, self.PORT)

    async def _send(self, cmd):
        if not cmd.endswith('.'): cmd += '.'
        self.writer.write(cmd.encode()); await self.writer.drain()

    async def set_source(self, output, input):
        cmd = f"{input}X{output}."
        await self._send(cmd)

    async def recall_scene(self, scene_id): await self._send(f"Recall{scene_id}.")