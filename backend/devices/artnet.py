import socket
from devices.base import DeviceDriver

class ArtNetDMX(DeviceDriver):
    PORT = 6454
    def __init__(self, host="255.255.255.255"):
        super().__init__(host)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self.scenes = {}

    async def connect(self): pass  # UDP, no connection

    def _build_packet(self, universe, dmx_data):
        header = b'Art-Net\x00' + (0x5000).to_bytes(2,'little') + (14).to_bytes(2,'big')
        return header + b'\x00\x00' + universe.to_bytes(2,'little') + len(dmx_data).to_bytes(2,'big') + dmx_data

    async def set_dmx_channels(self, universe: int, vals):
        dmx_data = bytes(vals + [0]*(512-len(vals)))
        pkt = self._build_packet(universe, dmx_data)
        self.sock.sendto(pkt, (self.host, self.PORT))

    async def recall_scene(self, scene_id: int): 
        vals = self.scenes.get(scene_id, [0]*512)
        await self.set_dmx_channels(0, vals)