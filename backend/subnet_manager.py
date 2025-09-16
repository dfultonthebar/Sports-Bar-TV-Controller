
"""
Network Subnet Management System
Manages IP range definitions and network configuration for Sports Bar TV Controller
"""

import ipaddress
import json
import logging
import asyncio
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import yaml

@dataclass
class SubnetRange:
    """Represents a subnet IP range configuration"""
    name: str
    start_ip: str
    end_ip: str
    purpose: str
    description: str
    vlan_id: Optional[int] = None
    gateway: Optional[str] = None
    dns_servers: List[str] = None
    dhcp_enabled: bool = True
    reserved_ips: List[str] = None
    
    def __post_init__(self):
        if self.dns_servers is None:
            self.dns_servers = []
        if self.reserved_ips is None:
            self.reserved_ips = []
    
    @property
    def ip_count(self) -> int:
        """Calculate number of IPs in range"""
        start = ipaddress.IPv4Address(self.start_ip)
        end = ipaddress.IPv4Address(self.end_ip)
        return int(end) - int(start) + 1
    
    @property
    def cidr_notation(self) -> str:
        """Get CIDR notation for the range"""
        start = ipaddress.IPv4Address(self.start_ip)
        end = ipaddress.IPv4Address(self.end_ip)
        
        # Calculate the network that encompasses this range
        # This is a simplified approach - may not be exact for arbitrary ranges
        try:
            network = ipaddress.summarize_address_range(start, end)
            return str(list(network)[0])
        except ValueError:
            # Fallback for ranges that don't align to network boundaries
            return f"{self.start_ip}/24"
    
    def contains_ip(self, ip: str) -> bool:
        """Check if IP is within this range"""
        try:
            target_ip = ipaddress.IPv4Address(ip)
            start_ip = ipaddress.IPv4Address(self.start_ip)
            end_ip = ipaddress.IPv4Address(self.end_ip)
            return start_ip <= target_ip <= end_ip
        except ipaddress.AddressValueError:
            return False
    
    def get_available_ips(self) -> List[str]:
        """Get list of available IPs in range (excluding reserved)"""
        start = ipaddress.IPv4Address(self.start_ip)
        end = ipaddress.IPv4Address(self.end_ip)
        
        all_ips = []
        current = start
        while current <= end:
            ip_str = str(current)
            if ip_str not in self.reserved_ips:
                all_ips.append(ip_str)
            current += 1
            
        return all_ips

class SubnetManager:
    """Manages network subnet configurations for the Sports Bar TV Controller"""
    
    def __init__(self, config_file: str = "config/network_subnets.yaml"):
        self.config_file = Path(config_file)
        self.logger = logging.getLogger(__name__)
        self.subnets: Dict[str, SubnetRange] = {}
        self._initialize_default_subnets()
        self.load_configuration()
    
    def _initialize_default_subnets(self):
        """Initialize default subnet ranges for Sports Bar TV Controller"""
        
        # TV Devices Range (192.168.1.1-32)
        tv_subnet = SubnetRange(
            name="tv_devices",
            start_ip="192.168.1.1",
            end_ip="192.168.1.32",
            purpose="tv_control",
            description="Smart TVs and display devices",
            gateway="192.168.1.1",
            dns_servers=["8.8.8.8", "8.8.4.4"],
            dhcp_enabled=True,
            reserved_ips=["192.168.1.1"]  # Gateway reserved
        )
        
        # Input Devices Range (192.168.1.40-60)
        input_subnet = SubnetRange(
            name="input_devices", 
            start_ip="192.168.1.40",
            end_ip="192.168.1.60",
            purpose="input_sources",
            description="Cable boxes, streaming devices, media players",
            gateway="192.168.1.1",
            dns_servers=["8.8.8.8", "8.8.4.4"],
            dhcp_enabled=True
        )
        
        # Hardware Control Range (192.168.1.80-100)
        hardware_subnet = SubnetRange(
            name="hardware_control",
            start_ip="192.168.1.80", 
            end_ip="192.168.1.100",
            purpose="av_hardware",
            description="AV switches, controllers, IR blasters, audio equipment",
            gateway="192.168.1.1",
            dns_servers=["8.8.8.8", "8.8.4.4"],
            dhcp_enabled=False,  # Static IPs for hardware
            reserved_ips=["192.168.1.80", "192.168.1.81"]  # Controller and backup
        )
        
        # Management Network Range (192.168.1.200-220)
        mgmt_subnet = SubnetRange(
            name="management",
            start_ip="192.168.1.200",
            end_ip="192.168.1.220", 
            purpose="management",
            description="Network management, monitoring, and control systems",
            gateway="192.168.1.1",
            dns_servers=["8.8.8.8", "8.8.4.4"],
            dhcp_enabled=False,
            reserved_ips=["192.168.1.200", "192.168.1.201"]
        )
        
        self.subnets = {
            "tv_devices": tv_subnet,
            "input_devices": input_subnet,
            "hardware_control": hardware_subnet,
            "management": mgmt_subnet
        }
    
    def load_configuration(self):
        """Load subnet configuration from file"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config_data = yaml.safe_load(f)
                    
                if config_data and 'subnets' in config_data:
                    for name, subnet_data in config_data['subnets'].items():
                        self.subnets[name] = SubnetRange(**subnet_data)
                        
                self.logger.info(f"Loaded subnet configuration from {self.config_file}")
            else:
                self.logger.info("No existing configuration found, using defaults")
                self.save_configuration()
                
        except Exception as e:
            self.logger.error(f"Failed to load subnet configuration: {e}")
            self.logger.info("Using default subnet configuration")
    
    def save_configuration(self):
        """Save current subnet configuration to file"""
        try:
            # Ensure config directory exists
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            
            config_data = {
                'subnets': {
                    name: asdict(subnet) for name, subnet in self.subnets.items()
                }
            }
            
            with open(self.config_file, 'w') as f:
                yaml.dump(config_data, f, default_flow_style=False, indent=2)
                
            self.logger.info(f"Saved subnet configuration to {self.config_file}")
            
        except Exception as e:
            self.logger.error(f"Failed to save subnet configuration: {e}")
    
    def get_subnet(self, name: str) -> Optional[SubnetRange]:
        """Get subnet configuration by name"""
        return self.subnets.get(name)
    
    def get_all_subnets(self) -> Dict[str, SubnetRange]:
        """Get all subnet configurations"""
        return self.subnets.copy()
    
    def add_subnet(self, subnet: SubnetRange) -> bool:
        """Add a new subnet configuration"""
        try:
            # Validate subnet doesn't overlap with existing ones
            if self._check_subnet_overlap(subnet):
                self.logger.error(f"Subnet {subnet.name} overlaps with existing subnet")
                return False
                
            self.subnets[subnet.name] = subnet
            self.save_configuration()
            self.logger.info(f"Added subnet: {subnet.name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to add subnet {subnet.name}: {e}")
            return False
    
    def update_subnet(self, name: str, subnet: SubnetRange) -> bool:
        """Update existing subnet configuration"""
        try:
            if name not in self.subnets:
                self.logger.error(f"Subnet {name} not found")
                return False
                
            # Check overlap with other subnets (excluding self)
            temp_subnets = {k: v for k, v in self.subnets.items() if k != name}
            temp_manager = SubnetManager.__new__(SubnetManager)
            temp_manager.subnets = temp_subnets
            
            if temp_manager._check_subnet_overlap(subnet):
                self.logger.error(f"Updated subnet {name} would overlap with existing subnet")
                return False
                
            self.subnets[name] = subnet
            self.save_configuration()
            self.logger.info(f"Updated subnet: {name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to update subnet {name}: {e}")
            return False
    
    def remove_subnet(self, name: str) -> bool:
        """Remove subnet configuration"""
        try:
            if name not in self.subnets:
                self.logger.error(f"Subnet {name} not found")
                return False
                
            del self.subnets[name]
            self.save_configuration()
            self.logger.info(f"Removed subnet: {name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to remove subnet {name}: {e}")
            return False
    
    def _check_subnet_overlap(self, new_subnet: SubnetRange) -> bool:
        """Check if new subnet overlaps with existing subnets"""
        new_start = ipaddress.IPv4Address(new_subnet.start_ip)
        new_end = ipaddress.IPv4Address(new_subnet.end_ip)
        
        for existing_subnet in self.subnets.values():
            existing_start = ipaddress.IPv4Address(existing_subnet.start_ip)
            existing_end = ipaddress.IPv4Address(existing_subnet.end_ip)
            
            # Check for overlap
            if (new_start <= existing_end and new_end >= existing_start):
                return True
                
        return False
    
    def find_subnet_for_ip(self, ip: str) -> Optional[SubnetRange]:
        """Find which subnet contains the given IP"""
        for subnet in self.subnets.values():
            if subnet.contains_ip(ip):
                return subnet
        return None
    
    def get_next_available_ip(self, subnet_name: str) -> Optional[str]:
        """Get next available IP in specified subnet"""
        subnet = self.get_subnet(subnet_name)
        if not subnet:
            return None
            
        available_ips = subnet.get_available_ips()
        return available_ips[0] if available_ips else None
    
    def reserve_ip(self, subnet_name: str, ip: str, description: str = "") -> bool:
        """Reserve an IP address in a subnet"""
        try:
            subnet = self.get_subnet(subnet_name)
            if not subnet:
                self.logger.error(f"Subnet {subnet_name} not found")
                return False
                
            if not subnet.contains_ip(ip):
                self.logger.error(f"IP {ip} not in subnet {subnet_name}")
                return False
                
            if ip not in subnet.reserved_ips:
                subnet.reserved_ips.append(ip)
                self.save_configuration()
                self.logger.info(f"Reserved IP {ip} in subnet {subnet_name}")
                return True
            else:
                self.logger.warning(f"IP {ip} already reserved in subnet {subnet_name}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to reserve IP {ip}: {e}")
            return False
    
    def release_ip(self, subnet_name: str, ip: str) -> bool:
        """Release a reserved IP address"""
        try:
            subnet = self.get_subnet(subnet_name)
            if not subnet:
                self.logger.error(f"Subnet {subnet_name} not found")
                return False
                
            if ip in subnet.reserved_ips:
                subnet.reserved_ips.remove(ip)
                self.save_configuration()
                self.logger.info(f"Released IP {ip} from subnet {subnet_name}")
                return True
            else:
                self.logger.warning(f"IP {ip} not reserved in subnet {subnet_name}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to release IP {ip}: {e}")
            return False
    
    def get_subnet_utilization(self, subnet_name: str) -> Dict[str, Any]:
        """Get utilization statistics for a subnet"""
        subnet = self.get_subnet(subnet_name)
        if not subnet:
            return {}
            
        total_ips = subnet.ip_count
        reserved_ips = len(subnet.reserved_ips)
        available_ips = total_ips - reserved_ips
        utilization_percent = (reserved_ips / total_ips) * 100 if total_ips > 0 else 0
        
        return {
            "subnet_name": subnet_name,
            "total_ips": total_ips,
            "reserved_ips": reserved_ips,
            "available_ips": available_ips,
            "utilization_percent": round(utilization_percent, 2),
            "ip_range": f"{subnet.start_ip} - {subnet.end_ip}",
            "purpose": subnet.purpose,
            "description": subnet.description
        }
    
    def get_network_overview(self) -> Dict[str, Any]:
        """Get overview of all network subnets"""
        overview = {
            "total_subnets": len(self.subnets),
            "subnets": {},
            "total_ips": 0,
            "total_reserved": 0
        }
        
        for name, subnet in self.subnets.items():
            utilization = self.get_subnet_utilization(name)
            overview["subnets"][name] = utilization
            overview["total_ips"] += utilization["total_ips"]
            overview["total_reserved"] += utilization["reserved_ips"]
            
        overview["total_available"] = overview["total_ips"] - overview["total_reserved"]
        overview["overall_utilization"] = (
            (overview["total_reserved"] / overview["total_ips"]) * 100 
            if overview["total_ips"] > 0 else 0
        )
        
        return overview
    
    def validate_network_configuration(self) -> Dict[str, Any]:
        """Validate current network configuration"""
        validation_results = {
            "valid": True,
            "warnings": [],
            "errors": [],
            "recommendations": []
        }
        
        # Check for overlapping subnets
        subnet_list = list(self.subnets.values())
        for i, subnet1 in enumerate(subnet_list):
            for subnet2 in subnet_list[i+1:]:
                if self._subnets_overlap(subnet1, subnet2):
                    validation_results["valid"] = False
                    validation_results["errors"].append(
                        f"Subnets {subnet1.name} and {subnet2.name} overlap"
                    )
        
        # Check for high utilization
        for name, subnet in self.subnets.items():
            utilization = self.get_subnet_utilization(name)
            if utilization["utilization_percent"] > 90:
                validation_results["warnings"].append(
                    f"Subnet {name} is {utilization['utilization_percent']:.1f}% utilized"
                )
            elif utilization["utilization_percent"] > 80:
                validation_results["recommendations"].append(
                    f"Consider expanding subnet {name} (currently {utilization['utilization_percent']:.1f}% utilized)"
                )
        
        # Check for missing gateways
        for name, subnet in self.subnets.items():
            if not subnet.gateway:
                validation_results["warnings"].append(
                    f"Subnet {name} has no gateway configured"
                )
        
        return validation_results
    
    def _subnets_overlap(self, subnet1: SubnetRange, subnet2: SubnetRange) -> bool:
        """Check if two subnets overlap"""
        start1 = ipaddress.IPv4Address(subnet1.start_ip)
        end1 = ipaddress.IPv4Address(subnet1.end_ip)
        start2 = ipaddress.IPv4Address(subnet2.start_ip)
        end2 = ipaddress.IPv4Address(subnet2.end_ip)
        
        return start1 <= end2 and start2 <= end1
    
    async def scan_subnet_usage(self, subnet_name: str) -> Dict[str, Any]:
        """Scan actual network usage in a subnet"""
        subnet = self.get_subnet(subnet_name)
        if not subnet:
            return {"error": f"Subnet {subnet_name} not found"}
        
        # Import discovery module for network scanning
        try:
            from .discovery import NetworkScanner
            scanner = NetworkScanner()
            
            # Scan the subnet
            devices = await scanner.discover_devices(subnet.cidr_notation)
            
            # Analyze results
            active_ips = [device.ip for device in devices]
            subnet_ips = subnet.get_available_ips() + subnet.reserved_ips
            
            return {
                "subnet_name": subnet_name,
                "total_ips_in_range": len(subnet_ips),
                "active_devices": len(active_ips),
                "active_ips": active_ips,
                "inactive_ips": [ip for ip in subnet_ips if ip not in active_ips],
                "devices": [
                    {
                        "ip": device.ip,
                        "mac": device.mac,
                        "device_type": device.device_type,
                        "manufacturer": device.manufacturer
                    }
                    for device in devices
                ]
            }
            
        except ImportError:
            return {"error": "Network scanning not available"}
        except Exception as e:
            return {"error": f"Scan failed: {str(e)}"}

# Example usage and testing
if __name__ == "__main__":
    async def main():
        # Initialize subnet manager
        manager = SubnetManager()
        
        # Display network overview
        overview = manager.get_network_overview()
        print("Network Overview:")
        print(f"Total Subnets: {overview['total_subnets']}")
        print(f"Total IPs: {overview['total_ips']}")
        print(f"Reserved IPs: {overview['total_reserved']}")
        print(f"Available IPs: {overview['total_available']}")
        print(f"Overall Utilization: {overview['overall_utilization']:.1f}%")
        
        print("\nSubnet Details:")
        for name, details in overview['subnets'].items():
            print(f"  {name}: {details['ip_range']} ({details['purpose']})")
            print(f"    Utilization: {details['utilization_percent']:.1f}%")
            print(f"    Available: {details['available_ips']} IPs")
        
        # Validate configuration
        validation = manager.validate_network_configuration()
        print(f"\nConfiguration Valid: {validation['valid']}")
        if validation['errors']:
            print("Errors:", validation['errors'])
        if validation['warnings']:
            print("Warnings:", validation['warnings'])
    
    asyncio.run(main())
