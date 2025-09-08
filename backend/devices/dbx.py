import asyncio
from devices.base import DeviceDriver

class DBXZonePro(DeviceDriver):
    PORT = 3804
    async def connect(self):
        self.reader, self.writer = await asyncio.open_connection(self.host, self.PORT)

    async def _send(self, cmd): 
        if not cmd.endswith("\r\n"): cmd += "\r\n"
        self.writer.write(cmd.encode()); await self.writer.drain()

    async def set_volume(self, zone, level): await self._send(f"SET ZONE {zone} VOLUME {level}")
    async def mute(self, zone, state): await self._send(f"SET ZONE {zone} MUTE {'ON' if state else 'OFF'}")
    async def recall_scene(self, scene_id): await self._send(f"RECALL SCENE {scene_id}")