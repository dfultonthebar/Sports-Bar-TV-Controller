
"""
DBX ZonePro Audio Controller
Supports TCP/IP communication for DBX ZonePro audio processors
"""
import socket
import time
import logging
from typing import Optional, Dict, List
from dataclasses import dataclass

@dataclass
class ZoneProStatus:
    """ZonePro status information"""
    model: str = ""
    firmware: str = ""
    zones: int = 0
    inputs: int = 0
    current_levels: Dict[int, float] = None
    current_mutes: Dict[int, bool] = None

    def __post_init__(self):
        if self.current_levels is None:
            self.current_levels = {}
        if self.current_mutes is None:
            self.current_mutes = {}

class DBXZoneProController:
    """
    Python control module for DBX ZonePro audio processors
    Supports TCP/IP communication with error handling and logging
    """

    def __init__(self, ip_address: str, port: int = 23, timeout: int = 5):
        """
        Initialize DBX ZonePro controller

        Args:
            ip_address: ZonePro IP address
            port: TCP port (usually 23 for telnet)
            timeout: Socket timeout in seconds
        """
        self.ip_address = ip_address
        self.port = port
        self.timeout = timeout
        self.socket: Optional[socket.socket] = None
        self.is_connected = False

        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"DBXZonePro_{ip_address}")

        # ZonePro info
        self.status = ZoneProStatus()

    def connect(self) -> bool:
        """
        Establish connection to the ZonePro

        Returns:
            bool: True if connected successfully
        """
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip_address, self.port))
            self.is_connected = True
            self.logger.info(f"Connected to DBX ZonePro at {self.ip_address}:{self.port}")

            # Get initial status
            self.get_device_info()
            return True
        except Exception as e:
            self.logger.error(f"Failed to connect to DBX ZonePro: {e}")
            self.is_connected = False
            return False

    def disconnect(self):
        """Close connection to ZonePro"""
        if self.socket:
            self.socket.close()
        self.is_connected = False
        self.logger.info("Disconnected from ZonePro")

    def send_command(self, command: str) -> Optional[str]:
        """
        Send command to ZonePro and get response

        Args:
            command: Command string to send

        Returns:
            str: Response from ZonePro, None if error
        """
        if not self.is_connected:
            self.logger.error("Not connected to ZonePro")
            return None

        try:
            # Send command (add carriage return if needed)
            cmd_bytes = f"{command}\r\n".encode('ascii')
            self.socket.send(cmd_bytes)

            # Get response
            response = self.socket.recv(1024).decode('ascii').strip()
            self.logger.debug(f"Sent: {command} | Received: {response}")
            return response
        except Exception as e:
            self.logger.error(f"Command failed: {e}")
            return None

    def set_zone_level(self, zone: int, level: float) -> bool:
        """
        Set zone output level

        Args:
            zone: Zone number (1-based)
            level: Level in dB (-60.0 to +12.0)

        Returns:
            bool: True if successful
        """
        # DBX ZonePro command format: SV zone level
        command = f"SV {zone} {level:.1f}"
        response = self.send_command(command)

        if response and "OK" in response.upper():
            self.status.current_levels[zone] = level
            self.logger.info(f"Set Zone {zone} level to {level} dB")
            return True
        else:
            self.logger.error(f"Failed to set zone level: {response}")
            return False

    def mute_zone(self, zone: int, mute: bool = True) -> bool:
        """
        Mute or unmute a zone

        Args:
            zone: Zone number (1-based)
            mute: True to mute, False to unmute

        Returns:
            bool: True if successful
        """
        # DBX ZonePro mute command: SM zone 1/0
        mute_val = 1 if mute else 0
        command = f"SM {zone} {mute_val}"
        response = self.send_command(command)

        if response and "OK" in response.upper():
            self.status.current_mutes[zone] = mute
            action = "muted" if mute else "unmuted"
            self.logger.info(f"Zone {zone} {action}")
            return True
        else:
            self.logger.error(f"Failed to mute zone: {response}")
            return False

    def get_zone_level(self, zone: int) -> Optional[float]:
        """
        Get current zone level

        Args:
            zone: Zone number (1-based)

        Returns:
            float: Current level in dB, None if error
        """
        command = f"GV {zone}"
        response = self.send_command(command)

        if response:
            try:
                # Parse response to extract level
                level = float(response.split()[-1])
                self.status.current_levels[zone] = level
                return level
            except (ValueError, IndexError):
                self.logger.error(f"Failed to parse level response: {response}")
        return None

    def get_device_info(self) -> ZoneProStatus:
        """
        Get ZonePro model and firmware information

        Returns:
            ZoneProStatus: Current device information
        """
        info_response = self.send_command("GI")
        if info_response:
            # Parse response (format varies by model)
            lines = info_response.split('\n')
            for line in lines:
                if "MODEL" in line.upper():
                    self.status.model = line.split(':')[-1].strip()
                elif "FIRMWARE" in line.upper():
                    self.status.firmware = line.split(':')[-1].strip()

        return self.status

    def recall_preset(self, preset_num: int) -> bool:
        """
        Recall a stored preset

        Args:
            preset_num: Preset number (1-16 typically)

        Returns:
            bool: True if successful
        """
        command = f"RP {preset_num}"
        response = self.send_command(command)

        if response and "OK" in response.upper():
            self.logger.info(f"Recalled preset {preset_num}")
            # Update current status after preset recall
            time.sleep(0.5)
            return True
        return False

    def save_preset(self, preset_num: int, name: str = "") -> bool:
        """
        Save current settings as preset

        Args:
            preset_num: Preset number (1-16 typically)
            name: Optional preset name

        Returns:
            bool: True if successful
        """
        command = f"SP {preset_num}"
        if name:
            command += f" {name}"

        response = self.send_command(command)
        return response and "OK" in response.upper()

    def sports_bar_presets(self):
        """
        Example: Create common sports bar audio presets
        """
        presets = {
            1: "Game Day - High Energy",
            2: "Background Music - Low",
            3: "Announcement Mode",
            4: "Closing Time - Quiet"
        }

        for preset_num, description in presets.items():
            self.logger.info(f"Preset {preset_num}: {description}")
            # Set up specific levels, then save
            # Example configurations would go here

    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()

# Example usage
def example_usage():
    """Example of how to use the DBX ZonePro controller"""
    
    # Initialize controller
    zonepro = DBXZoneProController("192.168.1.102", port=23)

    try:
        # Connect to ZonePro
        if zonepro.connect():
            print(f"Connected to {zonepro.status.model}")

            # Set zone levels
            zonepro.set_zone_level(1, -10.0)  # Main bar zone
            zonepro.set_zone_level(2, -15.0)  # Patio zone
            
            # Mute zone 3
            zonepro.mute_zone(3, True)

            # Get current level
            level = zonepro.get_zone_level(1)
            print(f"Zone 1 level: {level} dB")

            # Recall preset
            zonepro.recall_preset(1)

        else:
            print("Failed to connect to ZonePro")

    finally:
        zonepro.disconnect()

if __name__ == "__main__":
    example_usage()
