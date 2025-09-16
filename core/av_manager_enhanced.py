
"""
Enhanced AV Manager with bi-directional sync, event publishing, and UI controls
Supports sync toggle and per-TV manual controls
"""
import json
import yaml
import logging
import threading
import time
from pathlib import Path
from typing import Dict, Any, Optional
from devices.wolfpack_controller import WolfpackController
from devices.atlas_atmosphere import AtmosphereController
from core.event_bus import event_bus

class AVManagerEnhanced:
    """
    Enhanced AV Manager with bi-directional sync and UI event publishing
    """
    def __init__(self, wolfpack: WolfpackController, atlas: AtmosphereController,
                 config_file: str, poll_interval: int = 3):
        self.wolfpack = wolfpack
        self.atlas = atlas
        self.logger = logging.getLogger("AVManager")

        # Sync control
        self.sync_enabled = True  # default ON
        self._load_config(config_file)
        
        # Track current Wolfpack routing state
        self.last_routes = {}

        # Start Atmosphere WebSocket listener
        self.atlas.start_ws_listener(self._process_atmosphere_event)

        # Start Wolfpack polling thread (to detect manual video changes)
        self.poll_interval = poll_interval
        self._stop_polling = False
        self.poll_thread = threading.Thread(target=self._poll_wolfpack_routes, daemon=True)
        self.poll_thread.start()

    def _load_config(self, filepath: str):
        """Load AV mappings and presets from JSON or YAML config"""
        try:
            path = Path(filepath)
            with open(path, "r") as f:
                if path.suffix in [".yaml", ".yml"]:
                    config = yaml.safe_load(f)
                elif path.suffix == ".json":
                    config = json.load(f)
                else:
                    raise ValueError("Unsupported config format. Use .json or .yaml")

            # Convert keys back to int because YAML/JSON parse them as strings
            self.output_to_zone_map = {int(k): v for k, v in config.get("output_to_zone_map", {}).items()}
            self.input_to_source_map = {int(k): v for k, v in config.get("input_to_source_map", {}).items()}
            self.presets = config.get("presets", {})

            self.logger.info(f"Loaded AV config from {filepath}")
        except Exception as e:
            self.logger.error(f"Failed to load config: {e}")
            self.output_to_zone_map, self.input_to_source_map, self.presets = {}, {}, {}

    def _process_atmosphere_event(self, event: dict):
        """React to Atmosphere real-time events (Atmosphere -> Wolfpack sync)"""
        if not self.sync_enabled:
            return  # ignore events if sync disabled

        try:
            if event.get("type") == "zone":
                zone_id = event.get("id")
                change = event.get("change", {})
                if "source" in change:
                    src = change["source"]

                    # Find Wolfpack input
                    inv_src = {v: k for k, v in self.input_to_source_map.items()}
                    input_num = inv_src.get(src)

                    # Find Wolfpack output from this zone
                    inv_zone = {v: k for k, v in self.output_to_zone_map.items()}
                    output_num = inv_zone.get(zone_id)

                    if input_num and output_num:
                        self.logger.info(f"[SYNC] Atmosphere -> Wolfpack: Zone {zone_id} source={src}, "
                                       f"switching Wolfpack In{input_num}->Out{output_num}")
                        self.wolfpack.switch_input_to_output(input_num, output_num)
                        
                        # Publish event to UI
                        event_bus.publish({
                            "type": "av_sync",
                            "direction": "atmosphere_to_wolfpack",
                            "input": input_num,
                            "output": output_num,
                            "zone": zone_id,
                            "source": src
                        })
        except Exception as e:
            self.logger.error(f"Atmosphere WS event error: {e}")

    def _poll_wolfpack_routes(self):
        """Poll Wolfpack for route changes (Wolfpack -> Atmosphere sync)"""
        while not self._stop_polling:
            if not self.sync_enabled:
                time.sleep(self.poll_interval)
                continue

            try:
                current_routes = self.wolfpack.get_current_routes()
                if current_routes != self.last_routes:
                    for output, input_num in current_routes.items():
                        # Only act if mapping is known
                        zone_id = self.output_to_zone_map.get(output)
                        source_id = self.input_to_source_map.get(input_num)
                        if zone_id and source_id:
                            self.logger.info(f"[SYNC] Wolfpack -> Atmosphere: Out{output} now In{input_num}, "
                                           f"routing {source_id} to {zone_id}")

                            self.atlas.set_zone_source(zone_id, source_id)
                            
                            # Publish event to UI
                            event_bus.publish({
                                "type": "av_sync",
                                "direction": "wolfpack_to_atmosphere",
                                "input": input_num,
                                "output": output,
                                "zone": zone_id,
                                "source": source_id
                            })
                    
                    self.last_routes = current_routes
                    
                    # Publish route update to UI
                    event_bus.publish({
                        "type": "route_update",
                        "routes": current_routes,
                        "sync_enabled": self.sync_enabled
                    })
                    
            except Exception as e:
                self.logger.error(f"Wolfpack polling error: {e}")
            
            time.sleep(self.poll_interval)

    def switch_av(self, input_num: int, output_num: int, volume: float = 0.7):
        """Switch video & audio in sync (manual trigger)"""
        video_result = self.wolfpack.switch_input_to_output(input_num, output_num)
        zone_id = self.output_to_zone_map.get(output_num)
        source_id = self.input_to_source_map.get(input_num)

        if zone_id and source_id:
            audio_ok = self.atlas.set_zone_source(zone_id, source_id)
            vol_ok = self.atlas.set_zone_volume(zone_id, volume)
            
            # Publish manual switch event
            event_bus.publish({
                "type": "manual_switch",
                "input": input_num,
                "output": output_num,
                "zone": zone_id,
                "source": source_id,
                "volume": volume,
                "success": video_result and audio_ok and vol_ok
            })
            
            return video_result and audio_ok and vol_ok
        return False

    def recall_preset(self, preset_name: str):
        """Recall AV preset from config"""
        preset = self.presets.get(preset_name)
        if not preset:
            self.logger.error(f"Preset {preset_name} not found")
            return False

        self.logger.info(f"Recalling preset: {preset_name} — {preset.get('description','')}")
        success = True
        for route in preset.get("routes", []):
            ok = self.switch_av(route["input"], route["output"], route.get("volume", 0.7))
            success = success and ok
        
        # Publish preset recall event
        event_bus.publish({
            "type": "preset_recall",
            "preset_name": preset_name,
            "success": success,
            "routes": preset.get("routes", [])
        })
        
        return success

    def enable_sync(self):
        """Enable bi-directional sync"""
        self.sync_enabled = True
        self.logger.info("🔄 Sync ENABLED by user")
        event_bus.publish({
            "type": "sync_toggle",
            "sync_enabled": True
        })

    def disable_sync(self):
        """Disable bi-directional sync"""
        self.sync_enabled = False
        self.logger.info("⏸️ Sync DISABLED by user")
        event_bus.publish({
            "type": "sync_toggle",
            "sync_enabled": False
        })

    def get_available_inputs(self) -> Dict[int, str]:
        """Get available input sources for UI"""
        return {k: v for k, v in self.input_to_source_map.items()}

    def get_available_outputs(self) -> Dict[int, str]:
        """Get available output zones for UI"""
        return {k: v for k, v in self.output_to_zone_map.items()}

    def get_current_routes(self) -> Dict[int, int]:
        """Get current routing state"""
        return self.last_routes.copy()

    def get_presets(self) -> Dict[str, Any]:
        """Get available presets for UI"""
        return self.presets.copy()

    def stop(self):
        """Shutdown AV Manager"""
        self._stop_polling = True
        self.atlas.stop_ws_listener()
        self.logger.info("AV Manager stopped")
