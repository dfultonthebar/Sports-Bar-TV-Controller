
"""
Atlas Atmosphere Audio Processor Controller
Professional REST API and WebSocket control for Atlas Atmosphere DSP in sports bar environments
"""

import requests
import json
import time
import logging
import threading
from typing import Optional, Dict, List, Any, Callable
from dataclasses import dataclass
from enum import Enum
import websocket
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AtmosphereZoneState(Enum):
    """Zone state enumeration"""
    MUTED = "muted"
    UNMUTED = "unmuted"
    OFFLINE = "offline"

@dataclass
class AtmosphereZone:
    """Represents an audio zone"""
    id: int
    name: str
    volume: float = 0.5  # 0.0 - 1.0
    muted: bool = False
    source: Optional[int] = None
    state: AtmosphereZoneState = AtmosphereZoneState.UNMUTED

@dataclass
class AtmosphereSource:
    """Represents an audio source"""
    id: int
    name: str
    active: bool = False

class AtlasAtmosphereController:
    """
    Professional Atlas Atmosphere Audio Controller
    
    Features:
    - REST API control over TCP/IP
    - WebSocket real-time event listening
    - Zone volume control (0.0 - 1.0)
    - Zone mute/unmute functionality
    - Source routing to zones
    - Preset recall capabilities
    - Game mode and chill mode automation
    """
    
    def __init__(self, host: str, port: int = 80, timeout: int = 5):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.base_url = f"http://{host}:{port}/api/v1"
        self.ws_url = f"ws://{host}:{port}/ws"
        
        self.zones = {}  # Zone ID -> AtmosphereZone
        self.sources = {}  # Source ID -> AtmosphereSource
        self.presets = {}  # Preset ID -> configuration
        
        self.ws = None
        self.ws_thread = None
        self.event_callbacks = []
        self.connected = False
        
        logger.info(f"Initialized Atlas Atmosphere controller for {host}:{port}")
    
    def connect(self) -> bool:
        """Establish connection and initialize zones/sources"""
        try:
            # Test REST API connection
            response = requests.get(f"{self.base_url}/status", timeout=self.timeout)
            if response.status_code == 200:
                self.connected = True
                logger.info(f"Connected to Atlas Atmosphere at {self.host}:{self.port}")
                
                # Initialize zones and sources
                self._initialize_zones()
                self._initialize_sources()
                
                # Start WebSocket connection for real-time events
                self._start_websocket()
                
                return True
            else:
                logger.error(f"Failed to connect: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Close connections"""
        self.connected = False
        
        # Close WebSocket
        if self.ws:
            self.ws.close()
        
        if self.ws_thread and self.ws_thread.is_alive():
            self.ws_thread.join(timeout=2)
        
        logger.info("Disconnected from Atlas Atmosphere")
    
    @contextmanager
    def connection(self):
        """Context manager for automatic connection handling"""
        try:
            if not self.connected:
                self.connect()
            yield self
        finally:
            self.disconnect()
    
    def _initialize_zones(self):
        """Initialize zone configuration"""
        try:
            response = requests.get(f"{self.base_url}/zones", timeout=self.timeout)
            if response.status_code == 200:
                zones_data = response.json()
                for zone_data in zones_data.get('zones', []):
                    zone = AtmosphereZone(
                        id=zone_data['id'],
                        name=zone_data['name'],
                        volume=zone_data.get('volume', 0.5),
                        muted=zone_data.get('muted', False),
                        source=zone_data.get('source')
                    )
                    self.zones[zone.id] = zone
                    logger.debug(f"Initialized zone {zone.id}: {zone.name}")
        except Exception as e:
            logger.error(f"Failed to initialize zones: {e}")
    
    def _initialize_sources(self):
        """Initialize source configuration"""
        try:
            response = requests.get(f"{self.base_url}/sources", timeout=self.timeout)
            if response.status_code == 200:
                sources_data = response.json()
                for source_data in sources_data.get('sources', []):
                    source = AtmosphereSource(
                        id=source_data['id'],
                        name=source_data['name'],
                        active=source_data.get('active', False)
                    )
                    self.sources[source.id] = source
                    logger.debug(f"Initialized source {source.id}: {source.name}")
        except Exception as e:
            logger.error(f"Failed to initialize sources: {e}")
    
    def _start_websocket(self):
        """Start WebSocket connection for real-time events"""
        def on_message(ws, message):
            try:
                event = json.loads(message)
                self._handle_websocket_event(event)
            except Exception as e:
                logger.error(f"WebSocket message error: {e}")
        
        def on_error(ws, error):
            logger.error(f"WebSocket error: {error}")
        
        def on_close(ws, close_status_code, close_msg):
            logger.info("WebSocket connection closed")
        
        def on_open(ws):
            logger.info("WebSocket connection opened")
        
        try:
            self.ws = websocket.WebSocketApp(
                self.ws_url,
                on_message=on_message,
                on_error=on_error,
                on_close=on_close,
                on_open=on_open
            )
            
            self.ws_thread = threading.Thread(target=self.ws.run_forever)
            self.ws_thread.daemon = True
            self.ws_thread.start()
            
        except Exception as e:
            logger.error(f"Failed to start WebSocket: {e}")
    
    def _handle_websocket_event(self, event: Dict):
        """Handle incoming WebSocket events"""
        event_type = event.get('type')
        
        if event_type == 'zone_volume_changed':
            zone_id = event.get('zone_id')
            volume = event.get('volume')
            if zone_id in self.zones:
                self.zones[zone_id].volume = volume
                logger.debug(f"Zone {zone_id} volume changed to {volume}")
        
        elif event_type == 'zone_mute_changed':
            zone_id = event.get('zone_id')
            muted = event.get('muted')
            if zone_id in self.zones:
                self.zones[zone_id].muted = muted
                logger.debug(f"Zone {zone_id} mute changed to {muted}")
        
        elif event_type == 'zone_source_changed':
            zone_id = event.get('zone_id')
            source_id = event.get('source_id')
            if zone_id in self.zones:
                self.zones[zone_id].source = source_id
                logger.debug(f"Zone {zone_id} source changed to {source_id}")
        
        # Notify registered callbacks
        for callback in self.event_callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"Event callback error: {e}")
    
    def add_event_callback(self, callback: Callable[[Dict], None]):
        """Add callback for WebSocket events"""
        self.event_callbacks.append(callback)
    
    def set_zone_volume(self, zone_id: int, volume: float) -> bool:
        """
        Set zone volume
        
        Args:
            zone_id: Zone ID
            volume: Volume level (0.0 - 1.0)
            
        Returns:
            bool: Success status
        """
        if not 0.0 <= volume <= 1.0:
            logger.error(f"Invalid volume level: {volume}")
            return False
        
        try:
            data = {'volume': volume}
            response = requests.put(
                f"{self.base_url}/zones/{zone_id}/volume",
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                if zone_id in self.zones:
                    self.zones[zone_id].volume = volume
                logger.info(f"Set zone {zone_id} volume to {volume}")
                return True
            else:
                logger.error(f"Failed to set volume: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Volume control failed: {e}")
            return False
    
    def mute_zone(self, zone_id: int, muted: bool = True) -> bool:
        """
        Mute or unmute a zone
        
        Args:
            zone_id: Zone ID
            muted: True to mute, False to unmute
            
        Returns:
            bool: Success status
        """
        try:
            data = {'muted': muted}
            response = requests.put(
                f"{self.base_url}/zones/{zone_id}/mute",
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                if zone_id in self.zones:
                    self.zones[zone_id].muted = muted
                action = "muted" if muted else "unmuted"
                logger.info(f"Zone {zone_id} {action}")
                return True
            else:
                logger.error(f"Failed to mute zone: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Mute control failed: {e}")
            return False
    
    def unmute_zone(self, zone_id: int) -> bool:
        """Unmute a zone"""
        return self.mute_zone(zone_id, False)
    
    def route_source_to_zone(self, source_id: int, zone_id: int) -> bool:
        """
        Route audio source to zone
        
        Args:
            source_id: Source ID
            zone_id: Zone ID
            
        Returns:
            bool: Success status
        """
        try:
            data = {'source_id': source_id}
            response = requests.put(
                f"{self.base_url}/zones/{zone_id}/source",
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                if zone_id in self.zones:
                    self.zones[zone_id].source = source_id
                logger.info(f"Routed source {source_id} to zone {zone_id}")
                return True
            else:
                logger.error(f"Failed to route source: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Source routing failed: {e}")
            return False
    
    def recall_preset(self, preset_id: int) -> bool:
        """
        Recall a saved preset
        
        Args:
            preset_id: Preset ID
            
        Returns:
            bool: Success status
        """
        try:
            response = requests.post(
                f"{self.base_url}/presets/{preset_id}/recall",
                timeout=self.timeout
            )
            
            if response.status_code == 200:
                logger.info(f"Recalled preset {preset_id}")
                # Refresh zone states
                self._initialize_zones()
                return True
            else:
                logger.error(f"Failed to recall preset: HTTP {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Preset recall failed: {e}")
            return False
    
    def get_zone_status(self, zone_id: int) -> Optional[AtmosphereZone]:
        """Get current zone status"""
        return self.zones.get(zone_id)
    
    def get_all_zones(self) -> Dict[int, AtmosphereZone]:
        """Get all zones"""
        return self.zones.copy()
    
    def get_all_sources(self) -> Dict[int, AtmosphereSource]:
        """Get all sources"""
        return self.sources.copy()

# Sports Bar Automation Examples
class SportsBarAtmosphereAutomation:
    """Sports bar specific automation using Atlas Atmosphere controller"""
    
    def __init__(self, controller: AtlasAtmosphereController):
        self.controller = controller
    
    def big_game_mode(self):
        """Activate big game audio mode - high volume, main audio feed"""
        with self.controller.connection():
            # Route main ESPN audio to all zones
            for zone_id in self.controller.zones:
                self.controller.route_source_to_zone(1, zone_id)  # ESPN audio
                self.controller.set_zone_volume(zone_id, 0.8)  # High volume
                self.controller.unmute_zone(zone_id)
            
            logger.info("Activated big game audio mode")
    
    def multi_game_mode(self):
        """Activate multi-game audio mode - different audio per zone"""
        with self.controller.connection():
            # Zone 1: ESPN audio
            self.controller.route_source_to_zone(1, 1)
            self.controller.set_zone_volume(1, 0.7)
            
            # Zone 2: Fox Sports audio
            self.controller.route_source_to_zone(2, 2)
            self.controller.set_zone_volume(2, 0.7)
            
            # Zone 3: NBC Sports audio
            self.controller.route_source_to_zone(3, 3)
            self.controller.set_zone_volume(3, 0.7)
            
            # Zone 4: Local audio
            self.controller.route_source_to_zone(4, 4)
            self.controller.set_zone_volume(4, 0.6)
            
            logger.info("Activated multi-game audio mode")
    
    def chill_mode(self):
        """Activate chill mode - background music, low volume"""
        with self.controller.connection():
            # Route background music to all zones
            for zone_id in self.controller.zones:
                self.controller.route_source_to_zone(8, zone_id)  # Background music
                self.controller.set_zone_volume(zone_id, 0.3)  # Low volume
                self.controller.unmute_zone(zone_id)
            
            logger.info("Activated chill audio mode")
    
    def commercial_break_volume_duck(self):
        """Duck volume during commercial breaks"""
        with self.controller.connection():
            for zone_id in self.controller.zones:
                current_zone = self.controller.get_zone_status(zone_id)
                if current_zone and not current_zone.muted:
                    # Reduce volume by 50%
                    new_volume = max(0.1, current_zone.volume * 0.5)
                    self.controller.set_zone_volume(zone_id, new_volume)
            
            logger.info("Applied commercial break volume duck")

# Example usage
if __name__ == "__main__":
    # Initialize controller
    atmosphere = AtlasAtmosphereController("192.168.1.50")
    
    # Example: Basic control
    with atmosphere.connection():
        # Set zone 1 volume to 70%
        atmosphere.set_zone_volume(1, 0.7)
        
        # Route ESPN audio (source 1) to bar area (zone 1)
        atmosphere.route_source_to_zone(1, 1)
        
        # Mute patio area during indoor event
        atmosphere.mute_zone(3)
        
        # Get zone status
        zone_status = atmosphere.get_zone_status(1)
        print(f"Zone 1 status: {zone_status}")
    
    # Example: Sports bar automation
    automation = SportsBarAtmosphereAutomation(atmosphere)
    automation.big_game_mode()
