
"""
AV Manager - Coordination Layer
Enhanced AV Manager with bi-directional sync, YAML/JSON config support, and event publishing
"""

import yaml
import json
import time
import threading
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path

from devices.wolfpack_controller import WolfpackController
from devices.atlas_atmosphere import AtlasAtmosphereController
from core.event_bus import (
    event_bus, EventType, Event,
    create_video_route_event, create_audio_route_event,
    create_preset_event, create_sync_status_event
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class AVMapping:
    """Represents mapping between video output and audio zone"""
    video_output: int
    audio_zone: int
    video_input: Optional[int] = None
    audio_source: Optional[int] = None

@dataclass
class AVPreset:
    """Represents a complete AV preset configuration"""
    id: int
    name: str
    description: str
    video_routes: Dict[int, int]  # output -> input
    audio_routes: Dict[int, int]  # zone -> source
    audio_volumes: Dict[int, float]  # zone -> volume
    audio_mutes: Dict[int, bool]  # zone -> muted

class AVManager:
    """
    Enhanced AV Manager with bi-directional sync
    
    Features:
    - Bi-directional sync between video and audio systems
    - YAML/JSON configuration support for mappings
    - Preset management with complex routing scenarios
    - Event-driven architecture with pub-sub system
    - Sync toggle functionality (enable/disable sync)
    - Real-time polling for Wolfpack changes
    - WebSocket listening for Atmosphere changes
    """
    
    def __init__(self, config_path: str = "config/mappings.yaml"):
        self.config_path = config_path
        self.mappings: Dict[int, AVMapping] = {}
        self.presets: Dict[int, AVPreset] = {}
        
        # Device controllers
        self.wolfpack: Optional[WolfpackController] = None
        self.atmosphere: Optional[AtlasAtmosphereController] = None
        
        # Sync control
        self.sync_enabled = True
        self.sync_lock = threading.Lock()
        
        # Polling threads
        self.polling_active = False
        self.wolfpack_poll_thread = None
        self.last_wolfpack_routes = {}
        
        # Load configuration
        self.load_configuration()
        
        logger.info("AV Manager initialized")
    
    def load_configuration(self):
        """Load configuration from YAML or JSON file"""
        config_file = Path(self.config_path)
        
        if not config_file.exists():
            logger.warning(f"Configuration file not found: {self.config_path}")
            self._create_default_config()
            return
        
        try:
            with open(config_file, 'r') as f:
                if config_file.suffix.lower() in ['.yaml', '.yml']:
                    config = yaml.safe_load(f)
                else:
                    config = json.load(f)
            
            self._parse_configuration(config)
            logger.info(f"Configuration loaded from {self.config_path}")
            
        except Exception as e:
            logger.error(f"Failed to load configuration: {e}")
            self._create_default_config()
    
    def _create_default_config(self):
        """Create default configuration"""
        default_config = {
            'devices': {
                'wolfpack': {
                    'host': '192.168.1.70',
                    'port': 5000
                },
                'atmosphere': {
                    'host': '192.168.1.50',
                    'port': 80
                }
            },
            'mappings': [
                {'video_output': 1, 'audio_zone': 1, 'name': 'Main Bar TV'},
                {'video_output': 2, 'audio_zone': 2, 'name': 'Patio TV'},
                {'video_output': 3, 'audio_zone': 3, 'name': 'Dining Room TV'},
                {'video_output': 4, 'audio_zone': 4, 'name': 'Private Room TV'}
            ],
            'presets': [
                {
                    'id': 1,
                    'name': 'Big Game Mode',
                    'description': 'All TVs to main ESPN feed, high volume',
                    'video_routes': {1: 1, 2: 1, 3: 1, 4: 1},
                    'audio_routes': {1: 1, 2: 1, 3: 1, 4: 1},
                    'audio_volumes': {1: 0.8, 2: 0.8, 3: 0.8, 4: 0.8},
                    'audio_mutes': {1: False, 2: False, 3: False, 4: False}
                },
                {
                    'id': 2,
                    'name': 'Multi-Game Mode',
                    'description': 'Different games on different TV zones',
                    'video_routes': {1: 1, 2: 2, 3: 3, 4: 4},
                    'audio_routes': {1: 1, 2: 2, 3: 3, 4: 4},
                    'audio_volumes': {1: 0.7, 2: 0.7, 3: 0.7, 4: 0.6},
                    'audio_mutes': {1: False, 2: False, 3: False, 4: False}
                },
                {
                    'id': 3,
                    'name': 'Chill Mode',
                    'description': 'Menu channel everywhere, background music',
                    'video_routes': {1: 8, 2: 8, 3: 8, 4: 8},
                    'audio_routes': {1: 8, 2: 8, 3: 8, 4: 8},
                    'audio_volumes': {1: 0.3, 2: 0.3, 3: 0.3, 4: 0.3},
                    'audio_mutes': {1: False, 2: False, 3: False, 4: False}
                }
            ]
        }
        
        self._parse_configuration(default_config)
        self.save_configuration()
    
    def _parse_configuration(self, config: Dict):
        """Parse configuration data"""
        # Parse mappings
        self.mappings.clear()
        for mapping_data in config.get('mappings', []):
            mapping = AVMapping(
                video_output=mapping_data['video_output'],
                audio_zone=mapping_data['audio_zone']
            )
            self.mappings[mapping.video_output] = mapping
        
        # Parse presets
        self.presets.clear()
        for preset_data in config.get('presets', []):
            preset = AVPreset(
                id=preset_data['id'],
                name=preset_data['name'],
                description=preset_data['description'],
                video_routes=preset_data['video_routes'],
                audio_routes=preset_data['audio_routes'],
                audio_volumes=preset_data['audio_volumes'],
                audio_mutes=preset_data['audio_mutes']
            )
            self.presets[preset.id] = preset
        
        # Store device configuration for initialization
        self.device_config = config.get('devices', {})
    
    def save_configuration(self):
        """Save current configuration to file"""
        config = {
            'devices': self.device_config,
            'mappings': [
                {
                    'video_output': mapping.video_output,
                    'audio_zone': mapping.audio_zone,
                    'name': f'TV {mapping.video_output}'
                }
                for mapping in self.mappings.values()
            ],
            'presets': [
                {
                    'id': preset.id,
                    'name': preset.name,
                    'description': preset.description,
                    'video_routes': preset.video_routes,
                    'audio_routes': preset.audio_routes,
                    'audio_volumes': preset.audio_volumes,
                    'audio_mutes': preset.audio_mutes
                }
                for preset in self.presets.values()
            ]
        }
        
        try:
            config_file = Path(self.config_path)
            config_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(config_file, 'w') as f:
                if config_file.suffix.lower() in ['.yaml', '.yml']:
                    yaml.dump(config, f, default_flow_style=False, indent=2)
                else:
                    json.dump(config, f, indent=2)
            
            logger.info(f"Configuration saved to {self.config_path}")
            
        except Exception as e:
            logger.error(f"Failed to save configuration: {e}")
    
    def initialize_devices(self):
        """Initialize device controllers"""
        try:
            # Initialize Wolfpack controller
            wolfpack_config = self.device_config.get('wolfpack', {})
            self.wolfpack = WolfpackController(
                host=wolfpack_config.get('host', '192.168.1.70'),
                port=wolfpack_config.get('port', 5000)
            )
            
            # Initialize Atmosphere controller
            atmosphere_config = self.device_config.get('atmosphere', {})
            self.atmosphere = AtlasAtmosphereController(
                host=atmosphere_config.get('host', '192.168.1.50'),
                port=atmosphere_config.get('port', 80)
            )
            
            # Setup Atmosphere event callback for bi-directional sync
            if self.atmosphere:
                self.atmosphere.add_event_callback(self._handle_atmosphere_event)
            
            logger.info("Device controllers initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize devices: {e}")
    
    def connect_devices(self) -> bool:
        """Connect to all devices"""
        success = True
        
        if self.wolfpack:
            if not self.wolfpack.connect():
                success = False
        
        if self.atmosphere:
            if not self.atmosphere.connect():
                success = False
        
        if success:
            self._start_polling()
            logger.info("All devices connected successfully")
        else:
            logger.error("Failed to connect to some devices")
        
        return success
    
    def disconnect_devices(self):
        """Disconnect from all devices"""
        self._stop_polling()
        
        if self.wolfpack:
            self.wolfpack.disconnect()
        
        if self.atmosphere:
            self.atmosphere.disconnect()
        
        logger.info("Disconnected from all devices")
    
    def _start_polling(self):
        """Start polling threads for device state monitoring"""
        self.polling_active = True
        
        # Start Wolfpack polling thread
        if self.wolfpack:
            self.wolfpack_poll_thread = threading.Thread(
                target=self._wolfpack_polling_loop,
                daemon=True
            )
            self.wolfpack_poll_thread.start()
            logger.info("Started Wolfpack polling thread")
    
    def _stop_polling(self):
        """Stop polling threads"""
        self.polling_active = False
        
        if self.wolfpack_poll_thread and self.wolfpack_poll_thread.is_alive():
            self.wolfpack_poll_thread.join(timeout=2)
        
        logger.info("Stopped polling threads")
    
    def _wolfpack_polling_loop(self):
        """Polling loop for Wolfpack route changes"""
        while self.polling_active:
            try:
                if self.wolfpack and self.wolfpack.connected:
                    current_routes = self.wolfpack.get_current_routes()
                    
                    # Check for changes
                    for output, route in current_routes.items():
                        if output not in self.last_wolfpack_routes or \
                           self.last_wolfpack_routes[output].input != route.input:
                            
                            # Route changed, publish event
                            event = create_video_route_event(
                                "wolfpack", route.input, output
                            )
                            event_bus.publish(event)
                            
                            # Trigger sync if enabled
                            if self.sync_enabled:
                                self._sync_audio_to_video(output, route.input)
                    
                    self.last_wolfpack_routes = current_routes.copy()
                
                time.sleep(1)  # Poll every second
                
            except Exception as e:
                logger.error(f"Wolfpack polling error: {e}")
                time.sleep(5)  # Wait longer on error
    
    def _handle_atmosphere_event(self, event_data: Dict):
        """Handle WebSocket events from Atmosphere controller"""
        try:
            event_type = event_data.get('type')
            
            if event_type == 'zone_source_changed' and self.sync_enabled:
                zone_id = event_data.get('zone_id')
                source_id = event_data.get('source_id')
                
                # Find corresponding video output
                video_output = self._find_video_output_for_zone(zone_id)
                if video_output:
                    # Find corresponding video input
                    video_input = self._find_video_input_for_source(source_id)
                    if video_input:
                        self._sync_video_to_audio(video_output, video_input)
                
                # Publish audio route event
                event = create_audio_route_event("atmosphere", source_id, zone_id)
                event_bus.publish(event)
            
        except Exception as e:
            logger.error(f"Atmosphere event handling error: {e}")
    
    def _sync_audio_to_video(self, video_output: int, video_input: int):
        """Sync audio routing based on video change"""
        with self.sync_lock:
            try:
                # Find corresponding audio zone
                mapping = self.mappings.get(video_output)
                if mapping and self.atmosphere:
                    # Find corresponding audio source
                    audio_source = self._find_audio_source_for_input(video_input)
                    if audio_source:
                        self.atmosphere.route_source_to_zone(audio_source, mapping.audio_zone)
                        logger.debug(f"Synced audio: source {audio_source} -> zone {mapping.audio_zone}")
                
            except Exception as e:
                logger.error(f"Audio sync error: {e}")
    
    def _sync_video_to_audio(self, video_output: int, video_input: int):
        """Sync video routing based on audio change"""
        with self.sync_lock:
            try:
                if self.wolfpack:
                    self.wolfpack.switch_input_to_output(video_input, video_output)
                    logger.debug(f"Synced video: input {video_input} -> output {video_output}")
                
            except Exception as e:
                logger.error(f"Video sync error: {e}")
    
    def _find_video_output_for_zone(self, zone_id: int) -> Optional[int]:
        """Find video output corresponding to audio zone"""
        for output, mapping in self.mappings.items():
            if mapping.audio_zone == zone_id:
                return output
        return None
    
    def _find_video_input_for_source(self, source_id: int) -> Optional[int]:
        """Find video input corresponding to audio source (1:1 mapping assumed)"""
        return source_id  # Simple 1:1 mapping
    
    def _find_audio_source_for_input(self, video_input: int) -> Optional[int]:
        """Find audio source corresponding to video input (1:1 mapping assumed)"""
        return video_input  # Simple 1:1 mapping
    
    def set_sync_enabled(self, enabled: bool):
        """Enable or disable bi-directional sync"""
        self.sync_enabled = enabled
        
        # Publish sync status event
        event = create_sync_status_event("av_manager", enabled)
        event_bus.publish(event)
        
        status = "enabled" if enabled else "disabled"
        logger.info(f"Bi-directional sync {status}")
    
    def is_sync_enabled(self) -> bool:
        """Check if sync is enabled"""
        return self.sync_enabled
    
    def recall_preset(self, preset_id: int) -> bool:
        """
        Recall a complete AV preset
        
        Args:
            preset_id: Preset ID to recall
            
        Returns:
            bool: Success status
        """
        preset = self.presets.get(preset_id)
        if not preset:
            logger.error(f"Preset {preset_id} not found")
            return False
        
        try:
            success = True
            
            # Temporarily disable sync to avoid conflicts
            original_sync = self.sync_enabled
            self.sync_enabled = False
            
            # Apply video routes
            if self.wolfpack and self.wolfpack.connected:
                for output, input_num in preset.video_routes.items():
                    if not self.wolfpack.switch_input_to_output(input_num, output):
                        success = False
            
            # Apply audio routes and settings
            if self.atmosphere and self.atmosphere.connected:
                for zone, source in preset.audio_routes.items():
                    if not self.atmosphere.route_source_to_zone(source, zone):
                        success = False
                
                for zone, volume in preset.audio_volumes.items():
                    if not self.atmosphere.set_zone_volume(zone, volume):
                        success = False
                
                for zone, muted in preset.audio_mutes.items():
                    if not self.atmosphere.mute_zone(zone, muted):
                        success = False
            
            # Restore sync setting
            self.sync_enabled = original_sync
            
            if success:
                # Publish preset event
                event = create_preset_event("av_manager", preset_id, preset.name)
                event_bus.publish(event)
                
                logger.info(f"Successfully recalled preset {preset_id}: {preset.name}")
            else:
                logger.error(f"Failed to fully recall preset {preset_id}")
            
            return success
            
        except Exception as e:
            logger.error(f"Preset recall error: {e}")
            self.sync_enabled = original_sync  # Restore sync on error
            return False
    
    def get_presets(self) -> Dict[int, AVPreset]:
        """Get all available presets"""
        return self.presets.copy()
    
    def get_mappings(self) -> Dict[int, AVMapping]:
        """Get all AV mappings"""
        return self.mappings.copy()
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status"""
        return {
            'sync_enabled': self.sync_enabled,
            'wolfpack_connected': self.wolfpack.connected if self.wolfpack else False,
            'atmosphere_connected': self.atmosphere.connected if self.atmosphere else False,
            'mappings_count': len(self.mappings),
            'presets_count': len(self.presets),
            'polling_active': self.polling_active
        }

# Example usage
if __name__ == "__main__":
    # Initialize AV Manager
    av_manager = AVManager("config/mappings.yaml")
    av_manager.initialize_devices()
    
    # Connect to devices
    if av_manager.connect_devices():
        # Example: Recall big game preset
        av_manager.recall_preset(1)
        
        # Example: Toggle sync
        av_manager.set_sync_enabled(False)
        time.sleep(2)
        av_manager.set_sync_enabled(True)
        
        # Get system status
        status = av_manager.get_system_status()
        print(f"System status: {status}")
        
        # Keep running for a while to see sync in action
        time.sleep(30)
    
    # Cleanup
    av_manager.disconnect_devices()
