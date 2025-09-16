
"""
Global Cache IR Controller
Supports TCP/IP communication for Global Cache IR blasters
Used to control cable boxes, streaming devices, and other IR-controlled equipment
"""
import socket
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass
from enum import Enum

class IRCommand(Enum):
    """Common IR command types"""
    POWER = "POWER"
    CHANNEL_UP = "CH_UP"
    CHANNEL_DOWN = "CH_DOWN"
    VOLUME_UP = "VOL_UP"
    VOLUME_DOWN = "VOL_DOWN"
    MUTE = "MUTE"
    MENU = "MENU"
    SELECT = "SELECT"
    EXIT = "EXIT"
    GUIDE = "GUIDE"

@dataclass
class IRDevice:
    """Represents an IR-controlled device"""
    name: str
    device_type: str  # "cable_box", "fire_cube", "tv", etc.
    ir_port: int      # Global Cache IR port (1-3)
    commands: Dict[str, str]  # Command name -> IR code mapping

@dataclass
class GlobalCacheStatus:
    """Global Cache device status"""
    model: str = ""
    firmware: str = ""
    ip_address: str = ""
    ir_ports: int = 0
    connected_devices: Dict[int, IRDevice] = None

    def __post_init__(self):
        if self.connected_devices is None:
            self.connected_devices = {}

class GlobalCacheIRController:
    """
    Python control module for Global Cache IR blasters
    Supports TCP/IP communication for controlling IR devices
    """

    def __init__(self, ip_address: str, port: int = 4998, timeout: int = 5):
        """
        Initialize Global Cache IR controller

        Args:
            ip_address: Global Cache IP address
            port: TCP port (usually 4998)
            timeout: Socket timeout in seconds
        """
        self.ip_address = ip_address
        self.port = port
        self.timeout = timeout
        self.socket: Optional[socket.socket] = None
        self.is_connected = False

        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"GlobalCache_{ip_address}")

        # Device info
        self.status = GlobalCacheStatus()
        self.status.ip_address = ip_address

        # Load common IR codes
        self._load_ir_codes()

    def _load_ir_codes(self):
        """Load common IR codes for different device types"""
        # These are example IR codes - you'll need actual codes for your devices
        self.ir_codes = {
            "directv": {
                "POWER": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,21,21,64,21,64,21,21,21,21,21,64,21,21,21,64,21,64,21,64,21,21,21,21,21,64,21,1820",
                "CH_UP": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,21,21,21,21,64,21,21,21,21,21,64,21,64,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,21,21,21,21,64,21,1820",
                "CH_DOWN": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,64,21,21,21,21,21,21,21,64,21,21,21,64,21,64,21,21,21,21,21,64,21,1820",
                "GUIDE": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,64,21,1820"
            },
            "fire_cube": {
                "POWER": "38000,1,1,342,171,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,21,21,64,21,64,21,64,21,1820",
                "HOME": "38000,1,1,342,171,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,21,21,21,21,21,21,21,21,64,21,21,21,64,21,21,21,64,21,64,21,64,21,64,21,1820",
                "SELECT": "38000,1,1,342,171,21,64,21,64,21,21,21,21,21,21,21,21,21,21,21,64,21,64,21,21,21,64,21,64,21,64,21,64,21,64,21,21,21,21,21,21,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,21,21,64,21,64,21,64,21,1820"
            },
            "cable_box": {
                "POWER": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,21,21,64,21,64,21,21,21,21,21,64,21,21,21,64,21,64,21,64,21,21,21,21,21,64,21,1820",
                "GUIDE": "38000,1,1,342,171,21,64,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,21,21,64,21,64,21,64,21,21,21,64,21,21,21,64,21,64,21,21,21,21,21,21,21,21,21,64,21,21,21,64,21,21,21,21,21,64,21,1820"
            }
        }

    def connect(self) -> bool:
        """
        Establish connection to the Global Cache device

        Returns:
            bool: True if connected successfully
        """
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip_address, self.port))
            self.is_connected = True
            self.logger.info(f"Connected to Global Cache at {self.ip_address}:{self.port}")

            # Get device info
            self.get_device_info()
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to Global Cache: {e}")
            self.is_connected = False
            return False

    def disconnect(self):
        """Close connection to Global Cache"""
        if self.socket:
            self.socket.close()
        self.is_connected = False
        self.logger.info("Disconnected from Global Cache")

    def send_command(self, command: str) -> Optional[str]:
        """
        Send command to Global Cache and get response

        Args:
            command: Command string to send

        Returns:
            str: Response from Global Cache, None if error
        """
        if not self.is_connected:
            self.logger.error("Not connected to Global Cache")
            return None

        try:
            # Send command (add carriage return)
            cmd_bytes = f"{command}\r".encode('ascii')
            self.socket.send(cmd_bytes)

            # Get response
            response = self.socket.recv(1024).decode('ascii').strip()
            self.logger.debug(f"Sent: {command} | Received: {response}")
            return response
        except Exception as e:
            self.logger.error(f"Command failed: {e}")
            return None

    def send_ir_command(self, ir_port: int, ir_code: str) -> bool:
        """
        Send IR command through specified port

        Args:
            ir_port: IR port number (1-3)
            ir_code: IR code string

        Returns:
            bool: True if successful
        """
        # Global Cache IR command format: sendir,1:ir_port,1,ir_code
        command = f"sendir,1:{ir_port},1,{ir_code}"
        response = self.send_command(command)

        if response and "completeir" in response.lower():
            self.logger.info(f"Sent IR command on port {ir_port}")
            return True
        else:
            self.logger.error(f"IR command failed: {response}")
            return False

    def control_device(self, device_name: str, command: str) -> bool:
        """
        Send command to a specific device

        Args:
            device_name: Name of the device (must be registered)
            command: Command to send (POWER, CH_UP, etc.)

        Returns:
            bool: True if successful
        """
        # Find device in registered devices
        device = None
        for port, dev in self.status.connected_devices.items():
            if dev.name.lower() == device_name.lower():
                device = dev
                break

        if not device:
            self.logger.error(f"Device '{device_name}' not found")
            return False

        # Get IR code for command
        ir_code = device.commands.get(command)
        if not ir_code:
            self.logger.error(f"Command '{command}' not found for device '{device_name}'")
            return False

        # Send IR command
        return self.send_ir_command(device.ir_port, ir_code)

    def register_device(self, name: str, device_type: str, ir_port: int) -> bool:
        """
        Register a new IR device

        Args:
            name: Device name (e.g., "Main Bar DirecTV")
            device_type: Device type (directv, fire_cube, cable_box)
            ir_port: IR port number (1-3)

        Returns:
            bool: True if successful
        """
        if device_type not in self.ir_codes:
            self.logger.error(f"Unknown device type: {device_type}")
            return False

        device = IRDevice(
            name=name,
            device_type=device_type,
            ir_port=ir_port,
            commands=self.ir_codes[device_type].copy()
        )

        self.status.connected_devices[ir_port] = device
        self.logger.info(f"Registered {device_type} '{name}' on IR port {ir_port}")
        return True

    def get_device_info(self) -> GlobalCacheStatus:
        """
        Get Global Cache device information

        Returns:
            GlobalCacheStatus: Current device information
        """
        # Get device version
        version_response = self.send_command("getversion")
        if version_response:
            parts = version_response.split(',')
            if len(parts) >= 2:
                self.status.model = parts[0]
                self.status.firmware = parts[1]

        # Get device configuration
        devices_response = self.send_command("getdevices")
        if devices_response:
            # Parse device configuration
            # Format: device,<connector>,<type>
            lines = devices_response.split('\r')
            ir_count = 0
            for line in lines:
                if 'IR' in line:
                    ir_count += 1
            self.status.ir_ports = ir_count

        return self.status

    def power_on_device(self, device_name: str) -> bool:
        """Power on a specific device"""
        return self.control_device(device_name, "POWER")

    def change_channel_up(self, device_name: str) -> bool:
        """Change channel up on a specific device"""
        return self.control_device(device_name, "CH_UP")

    def change_channel_down(self, device_name: str) -> bool:
        """Change channel down on a specific device"""
        return self.control_device(device_name, "CH_DOWN")

    def show_guide(self, device_name: str) -> bool:
        """Show TV guide on a specific device"""
        return self.control_device(device_name, "GUIDE")

    def sports_bar_setup(self):
        """
        Example: Set up common sports bar IR devices
        """
        # Register common devices
        self.register_device("Main Bar DirecTV", "directv", 1)
        self.register_device("Patio Fire Cube", "fire_cube", 2)
        self.register_device("Dining Cable Box", "cable_box", 3)

        self.logger.info("Sports bar IR devices registered")

    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()

# Example usage
def example_usage():
    """Example of how to use the Global Cache IR controller"""
    
    # Initialize controller
    gc_ir = GlobalCacheIRController("192.168.1.103", port=4998)

    try:
        # Connect to Global Cache
        if gc_ir.connect():
            print(f"Connected to {gc_ir.status.model}")

            # Set up devices
            gc_ir.sports_bar_setup()

            # Control devices
            gc_ir.power_on_device("Main Bar DirecTV")
            time.sleep(1)
            gc_ir.show_guide("Main Bar DirecTV")

            # Control Fire Cube
            gc_ir.power_on_device("Patio Fire Cube")
            time.sleep(1)
            gc_ir.control_device("Patio Fire Cube", "HOME")

        else:
            print("Failed to connect to Global Cache")

    finally:
        gc_ir.disconnect()

if __name__ == "__main__":
    example_usage()
