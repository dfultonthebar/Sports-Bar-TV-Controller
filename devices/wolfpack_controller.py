
"""
Wolfpack Video Matrix Controller
Professional TCP/IP control for Wolfpack video matrices in sports bar environments
"""

import socket
import time
import logging
import threading
from typing import Optional, Dict, List, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from contextlib import contextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WolfpackCommand(Enum):
    """Wolfpack command types"""
    SWITCH = "SW"
    PRESET_SAVE = "PS"
    PRESET_RECALL = "PR"
    STATUS = "ST"
    RESET = "RS"

@dataclass
class WolfpackRoute:
    """Represents a video route"""
    input: int
    output: int
    timestamp: float = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

class WolfpackController:
    """
    Professional Wolfpack Video Matrix Controller
    
    Features:
    - TCP/IP communication with error handling
    - Input-to-output switching (single & multiple)
    - Preset save/recall functionality
    - Status monitoring and route tracking
    - Sports bar automation examples
    - Context manager support
    - Comprehensive logging
    """
    
    def __init__(self, host: str, port: int = 5000, timeout: int = 5):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.socket = None
        self.connected = False
        self.routes = {}  # Track current routes
        self.presets = {}  # Store preset configurations
        self.lock = threading.Lock()
        
        logger.info(f"Initialized Wolfpack controller for {host}:{port}")
    
    def connect(self) -> bool:
        """Establish TCP connection to Wolfpack matrix"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))
            self.connected = True
            logger.info(f"Connected to Wolfpack matrix at {self.host}:{self.port}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Wolfpack: {e}")
            self.connected = False
            return False
    
    def disconnect(self):
        """Close connection to Wolfpack matrix"""
        if self.socket:
            try:
                self.socket.close()
                self.connected = False
                logger.info("Disconnected from Wolfpack matrix")
            except Exception as e:
                logger.error(f"Error disconnecting: {e}")
    
    @contextmanager
    def connection(self):
        """Context manager for automatic connection handling"""
        try:
            if not self.connected:
                self.connect()
            yield self
        finally:
            self.disconnect()
    
    def _send_command(self, command: str) -> Optional[str]:
        """Send command to Wolfpack and return response"""
        if not self.connected:
            logger.error("Not connected to Wolfpack matrix")
            return None
        
        try:
            with self.lock:
                # Ensure command ends with period
                if not command.endswith('.'):
                    command += '.'
                
                logger.debug(f"Sending command: {command}")
                self.socket.send(command.encode())
                
                # Read response
                response = self.socket.recv(1024).decode().strip()
                logger.debug(f"Received response: {response}")
                return response
                
        except Exception as e:
            logger.error(f"Command failed: {e}")
            self.connected = False
            return None
    
    def switch_input_to_output(self, input_num: int, output_num: int) -> bool:
        """
        Switch a single input to a single output
        
        Args:
            input_num: Input number (1-based)
            output_num: Output number (1-based)
            
        Returns:
            bool: Success status
        """
        command = f"{WolfpackCommand.SWITCH.value}I{input_num:02d}O{output_num:02d}"
        response = self._send_command(command)
        
        if response and "OK" in response:
            # Update route tracking
            route = WolfpackRoute(input_num, output_num)
            self.routes[output_num] = route
            logger.info(f"Switched input {input_num} to output {output_num}")
            return True
        else:
            logger.error(f"Failed to switch input {input_num} to output {output_num}")
            return False
    
    def switch_input_to_multiple_outputs(self, input_num: int, output_list: List[int]) -> bool:
        """
        Switch a single input to multiple outputs
        
        Args:
            input_num: Input number (1-based)
            output_list: List of output numbers (1-based)
            
        Returns:
            bool: Success status
        """
        success_count = 0
        for output_num in output_list:
            if self.switch_input_to_output(input_num, output_num):
                success_count += 1
        
        logger.info(f"Switched input {input_num} to {success_count}/{len(output_list)} outputs")
        return success_count == len(output_list)
    
    def get_current_routes(self) -> Dict[int, WolfpackRoute]:
        """Get current routing configuration"""
        return self.routes.copy()
    
    def get_output_input(self, output_num: int) -> Optional[int]:
        """Get which input is currently routed to an output"""
        route = self.routes.get(output_num)
        return route.input if route else None
    
    def save_preset(self, preset_num: int, name: str = None) -> bool:
        """
        Save current routing as a preset
        
        Args:
            preset_num: Preset number (1-99)
            name: Optional preset name for tracking
            
        Returns:
            bool: Success status
        """
        command = f"{WolfpackCommand.PRESET_SAVE.value}{preset_num:02d}"
        response = self._send_command(command)
        
        if response and "OK" in response:
            # Store preset info locally
            self.presets[preset_num] = {
                'name': name or f"Preset {preset_num}",
                'routes': self.routes.copy(),
                'timestamp': time.time()
            }
            logger.info(f"Saved preset {preset_num}: {name}")
            return True
        else:
            logger.error(f"Failed to save preset {preset_num}")
            return False
    
    def recall_preset(self, preset_num: int) -> bool:
        """
        Recall a saved preset
        
        Args:
            preset_num: Preset number (1-99)
            
        Returns:
            bool: Success status
        """
        command = f"{WolfpackCommand.PRESET_RECALL.value}{preset_num:02d}"
        response = self._send_command(command)
        
        if response and "OK" in response:
            # Update local route tracking if we have preset info
            if preset_num in self.presets:
                self.routes = self.presets[preset_num]['routes'].copy()
                preset_name = self.presets[preset_num]['name']
                logger.info(f"Recalled preset {preset_num}: {preset_name}")
            else:
                logger.info(f"Recalled preset {preset_num} (unknown configuration)")
            return True
        else:
            logger.error(f"Failed to recall preset {preset_num}")
            return False
    
    def get_status(self) -> Optional[Dict]:
        """Get matrix status information"""
        command = WolfpackCommand.STATUS.value
        response = self._send_command(command)
        
        if response:
            # Parse status response (implementation depends on Wolfpack model)
            status = {
                'connected': self.connected,
                'routes': self.routes,
                'presets': list(self.presets.keys()),
                'timestamp': time.time()
            }
            return status
        return None
    
    def reset_matrix(self) -> bool:
        """Reset the matrix to default state"""
        command = WolfpackCommand.RESET.value
        response = self._send_command(command)
        
        if response and "OK" in response:
            self.routes.clear()
            logger.info("Matrix reset to default state")
            return True
        else:
            logger.error("Failed to reset matrix")
            return False

# Sports Bar Automation Examples
class SportsBarWolfpackAutomation:
    """Sports bar specific automation using Wolfpack controller"""
    
    def __init__(self, controller: WolfpackController):
        self.controller = controller
        self.setup_sports_bar_presets()
    
    def setup_sports_bar_presets(self):
        """Setup common sports bar routing presets"""
        with self.controller.connection():
            # Big Game Mode - All TVs to main ESPN feed
            self.controller.switch_input_to_multiple_outputs(1, [1, 2, 3, 4, 5, 6])
            self.controller.save_preset(1, "Big Game Mode")
            
            # Multi-Game Mode - Different games on different zones
            self.controller.switch_input_to_output(1, 1)  # ESPN on TV1
            self.controller.switch_input_to_output(2, 2)  # Fox Sports on TV2
            self.controller.switch_input_to_output(3, 3)  # NBC Sports on TV3
            self.controller.switch_input_to_output(4, 4)  # Local on TV4
            self.controller.save_preset(2, "Multi-Game Mode")
            
            # Chill Mode - Menu channel everywhere
            self.controller.switch_input_to_multiple_outputs(8, [1, 2, 3, 4, 5, 6])
            self.controller.save_preset(3, "Chill Mode")
    
    def big_game_mode(self):
        """Activate big game mode"""
        return self.controller.recall_preset(1)
    
    def multi_game_mode(self):
        """Activate multi-game mode"""
        return self.controller.recall_preset(2)
    
    def chill_mode(self):
        """Activate chill mode"""
        return self.controller.recall_preset(3)

# Example usage
if __name__ == "__main__":
    # Initialize controller
    wolfpack = WolfpackController("192.168.1.70")
    
    # Example: Basic switching
    with wolfpack.connection():
        # Switch ESPN (input 1) to main TV (output 1)
        wolfpack.switch_input_to_output(1, 1)
        
        # Switch Fox Sports (input 2) to multiple TVs
        wolfpack.switch_input_to_multiple_outputs(2, [2, 3, 4])
        
        # Save current configuration as preset
        wolfpack.save_preset(10, "Custom Setup")
        
        # Get current status
        status = wolfpack.get_status()
        print(f"Matrix status: {status}")
    
    # Example: Sports bar automation
    automation = SportsBarWolfpackAutomation(wolfpack)
    automation.big_game_mode()
