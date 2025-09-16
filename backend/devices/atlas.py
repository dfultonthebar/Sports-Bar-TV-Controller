import asyncio, json
from devices.base import DeviceDriver

class AtlasAZM8(DeviceDriver):
    PORT = 5321
    async def connect(self):
        self.reader, self.writer = await asyncio.open_connection(self.host, self.PORT)

    async def _send(self, msg):
        data = json.dumps(msg) + "\r\n"
        self.writer.write(data.encode()); await self.writer.drain()

    async def set_volume(self, zone, level):
        await self._send({"jsonrpc":"2.0","method":"set",
                          "params":{"param":f"ZoneGain_{zone}","val":level}})
    async def mute(self, zone, state: bool):
        await self._send({"jsonrpc":"2.0","method":"set",
                          "params":{"param":f"ZoneMute_{zone}","val":int(state)}})
    async def recall_scene(self, scene_id): 
        await self._send({"jsonrpc":"2.0","method":"set",
                          "params":{"param":f"RecallScene_{scene_id}","val":1}})