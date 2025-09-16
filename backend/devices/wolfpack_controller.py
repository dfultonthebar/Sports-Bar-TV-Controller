import socket
import time
import logging
import json
from typing import Optional, Dict, List, Tuple
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

class WolfpackCommand(Enum):
    """Common Wolfpack matrix commands"""
    SWITCH_INPUT = "SW"
    GET_STATUS = "STATUS"
    SAVE_PRESET = "SAVE"
    RECALL_PRESET = "RECALL"
    POWER_ON = "PWR ON"
    POWER_OFF = "PWR OFF"
    GET_INFO = "INFO"

@dataclass
class MatrixRoute:
    """Represents an input-to-output route"""
    input_num: int
    output_num: int
    
@dataclass
class WolfpackStatus:
    """Matrix status information"""
    model: str = ""
    firmware: str = ""
    inputs: int = 36  # Enhanced to support 36 inputs
    outputs: int = 36  # Enhanced to support 36 outputs
    current_routes: Dict[int, int] = None
    
    def __post_init__(self):
        if self.current_routes is None:
            self.current_routes = {}

class WolfpackController:
    """
    Python control module for Wolfpack video matrix switchers
    Enhanced with 36x36 support and custom labeling capabilities
    Supports TCP/IP communication with error handling and logging
    """
    
    def __init__(self, ip_address: str, port: int = 23, timeout: int = 5, labels_file: str = "config/labels.json"):
        """
        Initialize Wolfpack controller
        
        Args:
            ip_address: Matrix IP address
            port: TCP port (usually 23 for telnet)
            timeout: Socket timeout in seconds
            labels_file: Path to labels configuration file
        """
        self.ip_address = ip_address
        self.port = port
        self.timeout = timeout
        self.socket: Optional[socket.socket] = None
        self.is_connected = False
        self.labels_file = labels_file
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(f"Wolfpack_{ip_address}")
        
        # Matrix info
        self.status = WolfpackStatus()
        
        # Load custom labels
        self.input_labels = {}
        self.output_labels = {}
        self.load_labels()
    
    def load_labels(self):
        """Load input/output labels from configuration file"""
        try:
            if Path(self.labels_file).exists():
                with open(self.labels_file, 'r') as f:
                    labels_data = json.load(f)
                    self.input_labels = labels_data.get('inputs', {})
                    self.output_labels = labels_data.get('outputs', {})
                    self.logger.info(f"Loaded labels from {self.labels_file}")
            else:
                # Create default labels for 36x36 matrix
                self.create_default_labels()
                self.save_labels()
        except Exception as e:
            self.logger.error(f"Failed to load labels: {e}")
            self.create_default_labels()
    
    def create_default_labels(self):
        """Create default labels for 36x36 matrix"""
        # Default input labels
        default_inputs = {
            "1": "ESPN HD", "2": "Fox Sports 1", "3": "NBC Sports", "4": "Local Broadcast",
            "5": "CNN", "6": "Weather Channel", "7": "Music Videos", "8": "Menu Channel",
            "9": "ESPN 2", "10": "Fox Sports 2", "11": "CBS Sports", "12": "TNT",
            "13": "TBS", "14": "USA Network", "15": "Discovery", "16": "History Channel",
            "17": "Food Network", "18": "HGTV", "19": "Comedy Central", "20": "MTV",
            "21": "VH1", "22": "Bravo", "23": "E!", "24": "Lifetime",
            "25": "A&E", "26": "FX", "27": "AMC", "28": "Syfy",
            "29": "National Geographic", "30": "Animal Planet", "31": "Travel Channel", "32": "Golf Channel",
            "33": "MLB Network", "34": "NFL Network", "35": "NBA TV", "36": "NHL Network"
        }
        
        # Default output labels (TV locations)
        default_outputs = {
            "1": "Main Bar TV 1", "2": "Main Bar TV 2", "3": "Main Bar TV 3", "4": "Main Bar TV 4",
            "5": "Patio TV 1", "6": "Patio TV 2", "7": "Dining Room TV 1", "8": "Dining Room TV 2",
            "9": "Private Room TV", "10": "Pool Table TV 1", "11": "Pool Table TV 2", "12": "VIP Section TV",
            "13": "Bar Back TV 1", "14": "Bar Back TV 2", "15": "Corner Booth TV", "16": "Window Booth TV",
            "17": "High Top TV 1", "18": "High Top TV 2", "19": "Dance Floor TV", "20": "Kitchen Display",
            "21": "Staff Office TV", "22": "Manager Office TV", "23": "Break Room TV", "24": "Entry TV",
            "25": "Restroom TV", "26": "Upstairs TV 1", "27": "Upstairs TV 2", "28": "Upstairs TV 3",
            "29": "Basement TV 1", "30": "Basement TV 2", "31": "Storage Room TV", "32": "Backup Display 1",
            "33": "Backup Display 2", "34": "Backup Display 3", "35": "Test Monitor", "36": "Spare Output"
        }
        
        self.input_labels = default_inputs
        self.output_labels = default_outputs
    
    def save_labels(self):
        """Save current labels to configuration file"""
        try:
            # Ensure config directory exists
            Path(self.labels_file).parent.mkdir(parents=True, exist_ok=True)
            
            labels_data = {
                'inputs': self.input_labels,
                'outputs': self.output_labels,
                'matrix_info': {
                    'total_inputs': 36,
                    'total_outputs': 36,
                    'last_updated': time.strftime('%Y-%m-%d %H:%M:%S')
                }
            }
            
            with open(self.labels_file, 'w') as f:
                json.dump(labels_data, f, indent=2)
            
            self.logger.info(f"Saved labels to {self.labels_file}")
        except Exception as e:
            self.logger.error(f"Failed to save labels: {e}")
    
    def get_input_label(self, input_num: int) -> str:
        """Get label for input number"""
        return self.input_labels.get(str(input_num), f"Input {input_num}")
    
    def get_output_label(self, output_num: int) -> str:
        """Get label for output number"""
        return self.output_labels.get(str(output_num), f"Output {output_num}")
    
    def set_input_label(self, input_num: int, label: str):
        """Set label for input number"""
        self.input_labels[str(input_num)] = label
        self.save_labels()
        self.logger.info(f"Updated input {input_num} label to: {label}")
    
    def set_output_label(self, output_num: int, label: str):
        """Set label for output number"""
        self.output_labels[str(output_num)] = label
        self.save_labels()
        self.logger.info(f"Updated output {output_num} label to: {label}")
    
    def get_all_labels(self) -> Dict[str, Dict[str, str]]:
        """Get all input and output labels"""
        return {
            'inputs': self.input_labels.copy(),
            'outputs': self.output_labels.copy()
        }
    
    def update_labels(self, input_labels: Dict[str, str] = None, output_labels: Dict[str, str] = None):
        """Update multiple labels at once"""
        if input_labels:
            self.input_labels.update(input_labels)
        if output_labels:
            self.output_labels.update(output_labels)
        self.save_labels()
        self.logger.info("Updated multiple labels")
        
    def connect(self) -> bool:
        """
        Establish connection to the matrix
        
        Returns:
            bool: True if connected successfully
        """
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.ip_address, self.port))
            self.is_connected = True
            self.logger.info(f"Connected to Wolfpack matrix at {self.ip_address}:{self.port}")
            
            # Get initial status
            self.get_matrix_info()
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to connect: {e}")
            self.is_connected = False
            return False
    
    def disconnect(self):
        """Close connection to matrix"""
        if self.socket:
            self.socket.close()
            self.is_connected = False
            self.logger.info("Disconnected from matrix")
    
    def send_command(self, command: str) -> Optional[str]:
        """
        Send command to matrix and get response
        
        Args:
            command: Command string to send
            
        Returns:
            str: Response from matrix, None if error
        """
        if not self.is_connected:
            self.logger.error("Not connected to matrix")
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
    
    def switch_input_to_output(self, input_num: int, output_num: int) -> bool:
        """
        Switch specific input to specific output
        
        Args:
            input_num: Input number (1-36)
            output_num: Output number (1-36)
            
        Returns:
            bool: True if successful
        """
        # Validate input/output ranges for 36x36 matrix
        if not (1 <= input_num <= 36):
            self.logger.error(f"Invalid input number: {input_num}. Must be 1-36")
            return False
        if not (1 <= output_num <= 36):
            self.logger.error(f"Invalid output number: {output_num}. Must be 1-36")
            return False
        
        # Common Wolfpack syntax: SW I01 O01 (varies by model)
        command = f"SW I{input_num:02d} O{output_num:02d}"
        response = self.send_command(command)
        
        if response and "OK" in response.upper():
            self.status.current_routes[output_num] = input_num
            input_label = self.get_input_label(input_num)
            output_label = self.get_output_label(output_num)
            self.logger.info(f"Switched {input_label} (Input {input_num}) to {output_label} (Output {output_num})")
            return True
        else:
            self.logger.error(f"Switch failed: {response}")
            return False
    
    def switch_input_to_multiple_outputs(self, input_num: int, output_list: List[int]) -> bool:
        """
        Switch one input to multiple outputs
        
        Args:
            input_num: Input number (1-36)
            output_list: List of output numbers (1-36)
            
        Returns:
            bool: True if all switches successful
        """
        success_count = 0
        for output in output_list:
            if self.switch_input_to_output(input_num, output):
                success_count += 1
        
        return success_count == len(output_list)
    
    def get_matrix_info(self) -> WolfpackStatus:
        """
        Get matrix model, firmware, and capabilities
        
        Returns:
            WolfpackStatus: Current matrix information
        """
        info_response = self.send_command("INFO")
        if info_response:
            # Parse response (format varies by model)
            lines = info_response.split('\n')
            for line in lines:
                if "MODEL" in line.upper():
                    self.status.model = line.split(':')[-1].strip()
                elif "FIRMWARE" in line.upper():
                    self.status.firmware = line.split(':')[-1].strip()
                elif "INPUT" in line.upper():
                    # Extract input count
                    try:
                        self.status.inputs = int(''.join(filter(str.isdigit, line)))
                    except:
                        pass
                elif "OUTPUT" in line.upper():
                    # Extract output count
                    try:
                        self.status.outputs = int(''.join(filter(str.isdigit, line)))
                    except:
                        pass
        
        return self.status
    
    def get_current_routes(self) -> Dict[int, int]:
        """
        Get all current input-to-output routes
        
        Returns:
            Dict[int, int]: {output_num: input_num}
        """
        status_response = self.send_command("STATUS")
        if status_response:
            # Parse routing status (format varies)
            # Example: "O01:I03, O02:I01, O03:I05..."
            routes = {}
            try:
                for route in status_response.split(','):
                    if ':' in route:
                        output_part, input_part = route.strip().split(':')
                        output_num = int(output_part.replace('O', ''))
                        input_num = int(input_part.replace('I', ''))
                        routes[output_num] = input_num
                
                self.status.current_routes = routes
            except Exception as e:
                self.logger.error(f"Failed to parse routes: {e}")
        
        return self.status.current_routes
    
    def get_current_routes_with_labels(self) -> Dict[int, Dict[str, str]]:
        """
        Get current routes with human-readable labels
        
        Returns:
            Dict[int, Dict[str, str]]: {output_num: {'input': input_num, 'input_label': label, 'output_label': label}}
        """
        routes = self.get_current_routes()
        labeled_routes = {}
        
        for output_num, input_num in routes.items():
            labeled_routes[output_num] = {
                'input': input_num,
                'input_label': self.get_input_label(input_num),
                'output_label': self.get_output_label(output_num)
            }
        
        return labeled_routes
    
    def save_preset(self, preset_num: int, name: str = "") -> bool:
        """
        Save current routing as preset
        
        Args:
            preset_num: Preset number (1-16 typically)
            name: Optional preset name
            
        Returns:
            bool: True if successful
        """
        command = f"SAVE {preset_num}"
        if name:
            command += f" {name}"
            
        response = self.send_command(command)
        return response and "OK" in response.upper()
    
    def recall_preset(self, preset_num: int) -> bool:
        """
        Recall saved preset
        
        Args:
            preset_num: Preset number to recall
            
        Returns:
            bool: True if successful
        """
        command = f"RECALL {preset_num}"
        response = self.send_command(command)
        
        if response and "OK" in response.upper():
            # Update current routes after preset recall
            time.sleep(0.5)  # Allow time for switching
            self.get_current_routes()
            return True
        return False
    
    def create_sports_bar_presets(self):
        """
        Example: Create common sports bar routing presets for 36x36 matrix
        """
        presets = {
            1: "Game Day - All Main TVs to ESPN",
            2: "Multi-Game - Split Coverage", 
            3: "Menu Mode - All to Menu Channel",
            4: "Closing Time - All Off"
        }
        
        for preset_num, description in presets.items():
            self.logger.info(f"Preset {preset_num}: {description}")
            # You would set up specific routes here, then save
            # Example for preset 1: All main bar TVs (1-4) to ESPN (input 1)
            if preset_num == 1:
                self.switch_input_to_multiple_outputs(1, [1,2,3,4])
                self.save_preset(preset_num, description)
    
    def get_visual_matrix_map(self) -> str:
        """
        Generate a visual representation of the current matrix routing
        
        Returns:
            str: ASCII art representation of the matrix
        """
        routes = self.get_current_routes_with_labels()
        
        output = "\n" + "="*80 + "\n"
        output += "WOLFPACK 36x36 MATRIX - CURRENT ROUTING\n"
        output += "="*80 + "\n"
        
        for output_num in range(1, 37):
            if output_num in routes:
                route_info = routes[output_num]
                output += f"Output {output_num:2d} ({route_info['output_label']:<20}) <- Input {route_info['input']:2d} ({route_info['input_label']})\n"
            else:
                output_label = self.get_output_label(output_num)
                output += f"Output {output_num:2d} ({output_label:<20}) <- No Signal\n"
        
        output += "="*80 + "\n"
        return output
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()

# Example usage and testing functions
def example_usage():
    """Example of how to use the enhanced Wolfpack controller"""
    
    # Initialize controller with custom labels
    matrix = WolfpackController("192.168.1.100", port=23, labels_file="config/labels.json")
    
    try:
        # Connect to matrix
        if matrix.connect():
            print(f"Connected to {matrix.status.model}")
            print(f"Inputs: {matrix.status.inputs}, Outputs: {matrix.status.outputs}")
            
            # Show current labels
            labels = matrix.get_all_labels()
            print(f"Input 1 Label: {labels['inputs']['1']}")
            print(f"Output 1 Label: {labels['outputs']['1']}")
            
            # Switch with labels
            matrix.switch_input_to_output(1, 1)  # ESPN to Main Bar TV 1
            
            # Switch to multiple outputs with labels
            matrix.switch_input_to_multiple_outputs(2, [2, 3, 4])  # Fox Sports to multiple TVs
            
            # Get current routing with labels
            labeled_routes = matrix.get_current_routes_with_labels()
            for output_num, route_info in labeled_routes.items():
                print(f"{route_info['output_label']} is showing {route_info['input_label']}")
            
            # Show visual matrix map
            print(matrix.get_visual_matrix_map())
            
            # Update a label
            matrix.set_input_label(5, "Cable Box 1")
            matrix.set_output_label(10, "Corner Booth Big Screen")
            
        else:
            print("Failed to connect to matrix")
            
    finally:
        matrix.disconnect()

if __name__ == "__main__":
    # Run example
    print("Enhanced Wolfpack Matrix Controller - 36x36 with Custom Labels")
    print("=" * 70)
    example_usage()
