import asyncio, json, os
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel

# Import drivers
from devices.atlas import AtlasAZM8
from devices.wolfpack import WolfPackMatrix
from devices.global_cache import GlobalCacheITach
from devices.dbx import DBXZonePro
from devices.artnet import ArtNetDMX

LAYOUT_FILE = "layout.json"

class DeviceManager:
    def __init__(self, config_path="config.json"):
        self.devices = {}
        self.config_path = config_path

    async def load_devices(self):
        with open(self.config_path) as f:
            cfg = json.load(f)
        for d in cfg["devices"]:
            if d["type"] == "atlas_azm8":
                dev = AtlasAZM8(d["host"])
            elif d["type"] == "wolfpack_matrix":
                dev = WolfPackMatrix(d["host"])
            elif d["type"] == "global_cache_itach":
                dev = GlobalCacheITach(d["host"])
            elif d["type"] == "dbx_zonepro":
                dev = DBXZonePro(d["host"])
            elif d["type"] == "artnet_dmx":
                dev = ArtNetDMX(d["host"])
            else:
                continue
            await dev.connect()
            self.devices[d["name"]] = dev

    def get(self, name): return self.devices.get(name)

app = FastAPI()
manager = DeviceManager()

@app.on_event("startup")
async def startup(): await manager.load_devices()

# Audio
@app.post("/audio/{device}/zone/{zone_id}/volume")
async def set_volume(device: str, zone_id: int, level: float):
    dsp = manager.get(device); await dsp.set_volume(zone_id, level); return {"ok": True}

@app.post("/audio/{device}/zone/{zone_id}/mute")
async def mute_zone(device: str, zone_id: int, mute: bool):
    dsp = manager.get(device); await dsp.mute(zone_id, mute); return {"ok": True}

# Video
@app.post("/video/{device}/route")
async def route_video(device: str, input: int, output: int):
    mx = manager.get(device); await mx.set_source(output, input); return {"ok": True}

# Lighting
@app.post("/lighting/{device}/scene/{scene_id}")
async def recall_scene(device: str, scene_id: int):
    light = manager.get(device); await light.recall_scene(scene_id); return {"ok": True}

# IR
@app.post("/ir/{device}/send")
async def send_ir(device: str, cmd: str):
    ir = manager.get(device); await ir.send_ir(cmd); return {"ok": True}

# Layout Save/Load
class LayoutModel(BaseModel):
    zones: list

@app.get("/layout")
def get_layout():
    if not os.path.exists(LAYOUT_FILE): return {"zones": []}
    return json.load(open(LAYOUT_FILE))

@app.post("/layout/save")
def save_layout(layout: LayoutModel):
    json.dump(layout.dict(), open(LAYOUT_FILE, "w"), indent=2)
    return {"ok": True}

# WebSocket
@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"msg": "connected"})
    while True:
        data = await ws.receive_text()
        await ws.send_text(f"Echo: {data}")