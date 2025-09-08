from abc import ABC, abstractmethod

class DeviceDriver(ABC):
    def __init__(self, host): self.host = host
    @abstractmethod
    async def connect(self): pass
    async def set_volume(self, zone, level): raise NotImplementedError
    async def mute(self, zone, state): raise NotImplementedError
    async def set_source(self, output, input): raise NotImplementedError
    async def recall_scene(self, scene_id): raise NotImplementedError
    async def send_ir(self, cmd): raise NotImplementedError