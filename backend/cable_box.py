
"""
Cable Box Configuration and Global Cache Integration
Manages cable box devices, IR remote control codes, and Global Cache iTach integration
"""

import asyncio
import socket
import json
import logging
import requests
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml
from urllib.parse import urljoin

@dataclass
class IRCode:
    """Represents an IR remote control code"""
    name: str
    code: str
    frequency: int = 40000
    repeat: int = 1
    description: str = ""
    category: str = "general"
    
@dataclass
class CableBoxDevice:
    """Represents a cable box device configuration"""
    name: str
    brand: str
    model: str
    ip_address: str = ""
    global_cache_ip: str = ""
    global_cache_port: int = 1
    ir_codes: Dict[str, IRCode] = None
    channel_map: Dict[str, str] = None
    last_channel: str = ""
    power_state: bool = False
    
    def __post_init__(self):
        if self.ir_codes is None:
            self.ir_codes = {}
        if self.channel_map is None:
            self.channel_map = {}

class GlobalCacheController:
    """Controls Global Cache iTach devices for IR transmission"""
    
    def __init__(self, host: str, port: int = 4998):
        self.host = host
        self.port = port
        self.logger = logging.getLogger(__name__)
        self.socket = None
        self.connected = False
        
    async def connect(self) -> bool:
        """Connect to Global Cache device"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(5.0)
            self.socket.connect((self.host, self.port))
            self.connected = True
            self.logger.info(f"Connected to Global Cache at {self.host}:{self.port}")
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to Global Cache {self.host}:{self.port}: {e}")
            self.connected = False
            return False
    
    async def disconnect(self):
        """Disconnect from Global Cache device"""
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
        self.connected = False
        self.logger.info(f"Disconnected from Global Cache {self.host}")
    
    async def send_command(self, command: str) -> Optional[str]:
        """Send command to Global Cache device"""
        if not self.connected:
            if not await self.connect():
                return None
        
        try:
            # Ensure command ends with carriage return
            if not command.endswith('\r'):
                command += '\r'
                
            self.socket.send(command.encode('ascii'))
            
            # Wait for response
            response = self.socket.recv(1024).decode('ascii').strip()
            self.logger.debug(f"Sent: {command.strip()}, Received: {response}")
            return response
            
        except Exception as e:
            self.logger.error(f"Failed to send command '{command.strip()}': {e}")
            self.connected = False
            return None
    
    async def send_ir_code(self, connector: str, ir_code: IRCode, device_id: int = 1) -> bool:
        """
        Send IR code through Global Cache device
        
        Args:
            connector: Connector address (e.g., "1:1", "1:2", "1:3")
            ir_code: IR code to transmit
            device_id: Unique device ID for acknowledgment
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Format sendir command
            command = f"sendir,{connector},{device_id},{ir_code.frequency},{ir_code.repeat},1,{ir_code.code}"
            
            response = await self.send_command(command)
            
            if response and "completeir" in response.lower():
                self.logger.info(f"Successfully sent IR code '{ir_code.name}' to {connector}")
                return True
            else:
                self.logger.error(f"Failed to send IR code '{ir_code.name}': {response}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending IR code '{ir_code.name}': {e}")
            return False
    
    async def stop_ir(self, connector: str) -> bool:
        """Stop IR transmission on specified connector"""
        try:
            command = f"stopir,{connector}"
            response = await self.send_command(command)
            return response is not None
        except Exception as e:
            self.logger.error(f"Error stopping IR on {connector}: {e}")
            return False
    
    async def get_device_info(self) -> Optional[Dict[str, Any]]:
        """Get Global Cache device information"""
        try:
            response = await self.send_command("getdevices")
            if response:
                # Parse device information
                return {"raw_response": response, "connected": True}
            return None
        except Exception as e:
            self.logger.error(f"Error getting device info: {e}")
            return None

class IRCodeDatabase:
    """Manages IR code database and downloads from Global Cache Control Tower"""
    
    def __init__(self, cache_dir: str = "config/ir_codes"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger(__name__)
        self.code_cache = {}
        
    def load_cached_codes(self, brand: str, model: str) -> Dict[str, IRCode]:
        """Load cached IR codes for a device"""
        cache_file = self.cache_dir / f"{brand}_{model}.json"
        
        try:
            if cache_file.exists():
                with open(cache_file, 'r') as f:
                    data = json.load(f)
                    
                codes = {}
                for name, code_data in data.items():
                    codes[name] = IRCode(**code_data)
                    
                self.logger.info(f"Loaded {len(codes)} cached IR codes for {brand} {model}")
                return codes
        except Exception as e:
            self.logger.error(f"Failed to load cached codes for {brand} {model}: {e}")
            
        return {}
    
    def save_codes_to_cache(self, brand: str, model: str, codes: Dict[str, IRCode]):
        """Save IR codes to cache"""
        cache_file = self.cache_dir / f"{brand}_{model}.json"
        
        try:
            data = {name: asdict(code) for name, code in codes.items()}
            
            with open(cache_file, 'w') as f:
                json.dump(data, f, indent=2)
                
            self.logger.info(f"Cached {len(codes)} IR codes for {brand} {model}")
            
        except Exception as e:
            self.logger.error(f"Failed to cache codes for {brand} {model}: {e}")
    
    async def download_ir_codes(self, brand: str, model: str) -> Dict[str, IRCode]:
        """
        Download IR codes from Global Cache Control Tower or other sources
        Note: This is a placeholder implementation as the actual API requires authentication
        """
        self.logger.info(f"Attempting to download IR codes for {brand} {model}")
        
        # Check cache first
        cached_codes = self.load_cached_codes(brand, model)
        if cached_codes:
            return cached_codes
        
        # Try to download from various sources
        codes = {}
        
        # Method 1: Try Global Cache Control Tower (requires API key)
        codes.update(await self._try_global_cache_api(brand, model))
        
        # Method 2: Try built-in database
        codes.update(self._get_builtin_codes(brand, model))
        
        # Method 3: Try community databases
        codes.update(await self._try_community_databases(brand, model))
        
        if codes:
            self.save_codes_to_cache(brand, model, codes)
            
        return codes
    
    async def _try_global_cache_api(self, brand: str, model: str) -> Dict[str, IRCode]:
        """Try to download from Global Cache Control Tower API"""
        # This would require API authentication and proper endpoint
        # Placeholder implementation
        self.logger.debug(f"Global Cache API download not implemented for {brand} {model}")
        return {}
    
    def _get_builtin_codes(self, brand: str, model: str) -> Dict[str, IRCode]:
        """Get codes from built-in database"""
        builtin_codes = {
            # Common cable box IR codes (example format)
            "power": IRCode(
                name="power",
                code="343,171,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,22,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,65,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,22,21,22,21,1517",
                frequency=40000,
                description="Power on/off",
                category="power"
            ),
            "channel_up": IRCode(
                name="channel_up",
                code="343,171,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,65,21,22,21,22,21,1517",
                frequency=40000,
                description="Channel up",
                category="channel"
            ),
            "channel_down": IRCode(
                name="channel_down", 
                code="343,171,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,22,21,65,21,22,21,65,21,65,21,65,21,65,21,65,21,65,21,22,21,22,21,1517",
                frequency=40000,
                description="Channel down",
                category="channel"
            )
        }
        
        # Add number codes
        for i in range(10):
            builtin_codes[f"number_{i}"] = IRCode(
                name=f"number_{i}",
                code=f"343,171,21,22,21,22,21,65,21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,22,21,{22+i*10},21,22,21,22,21,22,21,22,21,22,21,65,21,65,21,22,21,65,21,65,21,65,21,65,21,65,21,22,21,22,21,1517",
                frequency=40000,
                description=f"Number {i}",
                category="numbers"
            )
        
        self.logger.info(f"Using built-in IR codes for {brand} {model}")
        return builtin_codes
    
    async def _try_community_databases(self, brand: str, model: str) -> Dict[str, IRCode]:
        """Try to download from community IR code databases"""
        # Placeholder for community database integration
        self.logger.debug(f"Community database download not implemented for {brand} {model}")
        return {}

class CableBoxManager:
    """Manages cable box devices and their configurations"""
    
    def __init__(self, config_file: str = "config/cable_boxes.yaml"):
        self.config_file = Path(config_file)
        self.logger = logging.getLogger(__name__)
        self.cable_boxes: Dict[str, CableBoxDevice] = {}
        self.global_cache_controllers: Dict[str, GlobalCacheController] = {}
        self.ir_database = IRCodeDatabase()
        self.load_configuration()
    
    def load_configuration(self):
        """Load cable box configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config_data = yaml.safe_load(f)
                    
                if config_data and 'cable_boxes' in config_data:
                    for name, box_data in config_data['cable_boxes'].items():
                        # Convert IR codes
                        if 'ir_codes' in box_data:
                            ir_codes = {}
                            for code_name, code_data in box_data['ir_codes'].items():
                                ir_codes[code_name] = IRCode(**code_data)
                            box_data['ir_codes'] = ir_codes
                            
                        self.cable_boxes[name] = CableBoxDevice(**box_data)
                        
                self.logger.info(f"Loaded {len(self.cable_boxes)} cable box configurations")
            else:
                self.logger.info("No cable box configuration found, creating default")
                self._create_default_configuration()
                
        except Exception as e:
            self.logger.error(f"Failed to load cable box configuration: {e}")
    
    def _create_default_configuration(self):
        """Create default cable box configuration"""
        default_box = CableBoxDevice(
            name="main_cable_box",
            brand="Generic",
            model="Cable Box",
            global_cache_ip="192.168.1.80",
            global_cache_port=1
        )
        
        self.cable_boxes["main_cable_box"] = default_box
        self.save_configuration()
    
    def save_configuration(self):
        """Save cable box configuration to file"""
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            config_data = {'cable_boxes': {}}
            
            for name, box in self.cable_boxes.items():
                box_data = asdict(box)
                # Convert IR codes to dict
                if box_data['ir_codes']:
                    box_data['ir_codes'] = {
                        code_name: asdict(code) 
                        for code_name, code in box.ir_codes.items()
                    }
                config_data['cable_boxes'][name] = box_data
            
            with open(self.config_file, 'w') as f:
                yaml.dump(config_data, f, default_flow_style=False, indent=2)
                
            self.logger.info("Saved cable box configuration")
            
        except Exception as e:
            self.logger.error(f"Failed to save cable box configuration: {e}")
    
    async def add_cable_box(self, box: CableBoxDevice) -> bool:
        """Add a new cable box"""
        try:
            # Download IR codes if not present
            if not box.ir_codes:
                box.ir_codes = await self.ir_database.download_ir_codes(box.brand, box.model)
            
            self.cable_boxes[box.name] = box
            self.save_configuration()
            
            self.logger.info(f"Added cable box: {box.name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to add cable box {box.name}: {e}")
            return False
    
    async def remove_cable_box(self, name: str) -> bool:
        """Remove a cable box"""
        try:
            if name in self.cable_boxes:
                del self.cable_boxes[name]
                self.save_configuration()
                self.logger.info(f"Removed cable box: {name}")
                return True
            else:
                self.logger.error(f"Cable box {name} not found")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to remove cable box {name}: {e}")
            return False
    
    async def send_ir_command(self, box_name: str, command: str) -> bool:
        """Send IR command to cable box"""
        try:
            box = self.cable_boxes.get(box_name)
            if not box:
                self.logger.error(f"Cable box {box_name} not found")
                return False
            
            if command not in box.ir_codes:
                self.logger.error(f"IR code '{command}' not found for {box_name}")
                return False
            
            # Get or create Global Cache controller
            gc_key = f"{box.global_cache_ip}:{self.port}"
            if gc_key not in self.global_cache_controllers:
                self.global_cache_controllers[gc_key] = GlobalCacheController(
                    box.global_cache_ip, 4998
                )
            
            controller = self.global_cache_controllers[gc_key]
            connector = f"1:{box.global_cache_port}"
            ir_code = box.ir_codes[command]
            
            success = await controller.send_ir_code(connector, ir_code)
            
            if success:
                self.logger.info(f"Sent '{command}' to {box_name}")
                
                # Update state for certain commands
                if command == "power":
                    box.power_state = not box.power_state
                elif command.startswith("number_") or command in ["channel_up", "channel_down"]:
                    if command.startswith("number_"):
                        box.last_channel = command.replace("number_", "")
                        
            return success
            
        except Exception as e:
            self.logger.error(f"Failed to send IR command '{command}' to {box_name}: {e}")
            return False
    
    async def change_channel(self, box_name: str, channel: str) -> bool:
        """Change channel on cable box"""
        try:
            success = True
            
            # Send each digit of the channel
            for digit in channel:
                if digit.isdigit():
                    command = f"number_{digit}"
                    if not await self.send_ir_command(box_name, command):
                        success = False
                        break
                    # Small delay between digits
                    await asyncio.sleep(0.1)
            
            if success:
                box = self.cable_boxes.get(box_name)
                if box:
                    box.last_channel = channel
                    self.save_configuration()
                    
            return success
            
        except Exception as e:
            self.logger.error(f"Failed to change channel to {channel} on {box_name}: {e}")
            return False
    
    async def power_toggle(self, box_name: str) -> bool:
        """Toggle power on cable box"""
        return await self.send_ir_command(box_name, "power")
    
    async def refresh_ir_codes(self, box_name: str) -> bool:
        """Refresh IR codes for a cable box"""
        try:
            box = self.cable_boxes.get(box_name)
            if not box:
                return False
            
            new_codes = await self.ir_database.download_ir_codes(box.brand, box.model)
            if new_codes:
                box.ir_codes.update(new_codes)
                self.save_configuration()
                self.logger.info(f"Refreshed IR codes for {box_name}")
                return True
            
            return False
            
        except Exception as e:
            self.logger.error(f"Failed to refresh IR codes for {box_name}: {e}")
            return False
    
    def get_cable_box_status(self, box_name: str) -> Optional[Dict[str, Any]]:
        """Get status of a cable box"""
        box = self.cable_boxes.get(box_name)
        if not box:
            return None
            
        return {
            "name": box.name,
            "brand": box.brand,
            "model": box.model,
            "ip_address": box.ip_address,
            "global_cache_ip": box.global_cache_ip,
            "global_cache_port": box.global_cache_port,
            "power_state": box.power_state,
            "last_channel": box.last_channel,
            "available_commands": list(box.ir_codes.keys()),
            "channel_count": len([cmd for cmd in box.ir_codes.keys() if cmd.startswith("number_")])
        }
    
    def get_all_cable_boxes(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all cable boxes"""
        return {
            name: self.get_cable_box_status(name)
            for name in self.cable_boxes.keys()
        }

# Example usage and testing
if __name__ == "__main__":
    async def main():
        # Initialize cable box manager
        manager = CableBoxManager()
        
        # Add a test cable box
        test_box = CableBoxDevice(
            name="living_room_cable",
            brand="Comcast",
            model="X1",
            global_cache_ip="192.168.1.80",
            global_cache_port=1
        )
        
        await manager.add_cable_box(test_box)
        
        # Display all cable boxes
        boxes = manager.get_all_cable_boxes()
        print("Cable Boxes:")
        for name, status in boxes.items():
            print(f"  {name}: {status['brand']} {status['model']}")
            print(f"    Commands: {len(status['available_commands'])}")
            print(f"    Power: {'On' if status['power_state'] else 'Off'}")
            print(f"    Last Channel: {status['last_channel']}")
    
    asyncio.run(main())
