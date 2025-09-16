
"""
Network Configuration Manager
Handles VLAN network configuration including subnet, gateway, and DNS servers
"""

import json
import yaml
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class VLANConfig:
    """VLAN network configuration"""
    vlan_id: int
    name: str
    subnet: str
    gateway: str
    dns_servers: List[str]
    enabled: bool = True
    description: str = ""

@dataclass
class NetworkConfig:
    """Complete network configuration"""
    vlans: Dict[int, VLANConfig]
    default_vlan: int
    management_interface: str = "eth0"
    dhcp_enabled: bool = True

class NetworkConfigManager:
    """
    Network Configuration Manager
    
    Features:
    - VLAN configuration management
    - Subnet, gateway, and DNS server configuration
    - Configuration persistence (YAML/JSON)
    - Validation and error handling
    """
    
    def __init__(self, config_path: str = "config/network_config.yaml"):
        self.config_path = config_path
        self.network_config: Optional[NetworkConfig] = None
        self.load_configuration()
    
    def load_configuration(self):
        """Load network configuration from file"""
        config_file = Path(self.config_path)
        
        if not config_file.exists():
            logger.warning(f"Network config file not found: {self.config_path}")
            self._create_default_config()
            return
        
        try:
            with open(config_file, 'r') as f:
                if config_file.suffix.lower() in ['.yaml', '.yml']:
                    config_data = yaml.safe_load(f)
                else:
                    config_data = json.load(f)
            
            self._parse_configuration(config_data)
            logger.info(f"Network configuration loaded from {self.config_path}")
            
        except Exception as e:
            logger.error(f"Failed to load network configuration: {e}")
            self._create_default_config()
    
    def _create_default_config(self):
        """Create default network configuration"""
        default_vlans = {
            10: VLANConfig(
                vlan_id=10,
                name="Management",
                subnet="192.168.10.0/24",
                gateway="192.168.10.1",
                dns_servers=["8.8.8.8", "8.8.4.4"],
                description="Management network for AV equipment"
            ),
            20: VLANConfig(
                vlan_id=20,
                name="AV_Control",
                subnet="192.168.20.0/24",
                gateway="192.168.20.1",
                dns_servers=["192.168.20.1", "8.8.8.8"],
                description="AV control and automation network"
            ),
            30: VLANConfig(
                vlan_id=30,
                name="Guest_WiFi",
                subnet="192.168.30.0/24",
                gateway="192.168.30.1",
                dns_servers=["1.1.1.1", "1.0.0.1"],
                description="Guest WiFi network"
            )
        }
        
        self.network_config = NetworkConfig(
            vlans=default_vlans,
            default_vlan=10,
            management_interface="eth0",
            dhcp_enabled=True
        )
        
        self.save_configuration()
    
    def _parse_configuration(self, config_data: Dict):
        """Parse configuration data"""
        vlans = {}
        for vlan_data in config_data.get('vlans', []):
            vlan = VLANConfig(
                vlan_id=vlan_data['vlan_id'],
                name=vlan_data['name'],
                subnet=vlan_data['subnet'],
                gateway=vlan_data['gateway'],
                dns_servers=vlan_data['dns_servers'],
                enabled=vlan_data.get('enabled', True),
                description=vlan_data.get('description', '')
            )
            vlans[vlan.vlan_id] = vlan
        
        self.network_config = NetworkConfig(
            vlans=vlans,
            default_vlan=config_data.get('default_vlan', 10),
            management_interface=config_data.get('management_interface', 'eth0'),
            dhcp_enabled=config_data.get('dhcp_enabled', True)
        )
    
    def save_configuration(self):
        """Save network configuration to file"""
        if not self.network_config:
            logger.error("No network configuration to save")
            return False
        
        config_data = {
            'vlans': [asdict(vlan) for vlan in self.network_config.vlans.values()],
            'default_vlan': self.network_config.default_vlan,
            'management_interface': self.network_config.management_interface,
            'dhcp_enabled': self.network_config.dhcp_enabled
        }
        
        try:
            config_file = Path(self.config_path)
            config_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(config_file, 'w') as f:
                if config_file.suffix.lower() in ['.yaml', '.yml']:
                    yaml.dump(config_data, f, default_flow_style=False, indent=2)
                else:
                    json.dump(config_data, f, indent=2)
            
            logger.info(f"Network configuration saved to {self.config_path}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to save network configuration: {e}")
            return False
    
    def get_vlan_config(self, vlan_id: int) -> Optional[VLANConfig]:
        """Get VLAN configuration by ID"""
        if not self.network_config:
            return None
        return self.network_config.vlans.get(vlan_id)
    
    def get_all_vlans(self) -> Dict[int, VLANConfig]:
        """Get all VLAN configurations"""
        if not self.network_config:
            return {}
        return self.network_config.vlans.copy()
    
    def add_vlan(self, vlan_config: VLANConfig) -> bool:
        """Add new VLAN configuration"""
        if not self.network_config:
            return False
        
        if not self._validate_vlan_config(vlan_config):
            return False
        
        self.network_config.vlans[vlan_config.vlan_id] = vlan_config
        return self.save_configuration()
    
    def update_vlan(self, vlan_id: int, vlan_config: VLANConfig) -> bool:
        """Update existing VLAN configuration"""
        if not self.network_config or vlan_id not in self.network_config.vlans:
            return False
        
        if not self._validate_vlan_config(vlan_config):
            return False
        
        self.network_config.vlans[vlan_id] = vlan_config
        return self.save_configuration()
    
    def delete_vlan(self, vlan_id: int) -> bool:
        """Delete VLAN configuration"""
        if not self.network_config or vlan_id not in self.network_config.vlans:
            return False
        
        # Don't allow deletion of default VLAN
        if vlan_id == self.network_config.default_vlan:
            logger.error(f"Cannot delete default VLAN {vlan_id}")
            return False
        
        del self.network_config.vlans[vlan_id]
        return self.save_configuration()
    
    def _validate_vlan_config(self, vlan_config: VLANConfig) -> bool:
        """Validate VLAN configuration"""
        import ipaddress
        
        try:
            # Validate VLAN ID
            if not (1 <= vlan_config.vlan_id <= 4094):
                logger.error(f"Invalid VLAN ID: {vlan_config.vlan_id}")
                return False
            
            # Validate subnet
            network = ipaddress.ip_network(vlan_config.subnet, strict=False)
            
            # Validate gateway
            gateway = ipaddress.ip_address(vlan_config.gateway)
            if gateway not in network:
                logger.error(f"Gateway {vlan_config.gateway} not in subnet {vlan_config.subnet}")
                return False
            
            # Validate DNS servers
            for dns in vlan_config.dns_servers:
                ipaddress.ip_address(dns)  # Will raise exception if invalid
            
            return True
            
        except Exception as e:
            logger.error(f"VLAN configuration validation error: {e}")
            return False
    
    def get_network_status(self) -> Dict[str, Any]:
        """Get network configuration status"""
        if not self.network_config:
            return {'error': 'No network configuration loaded'}
        
        return {
            'total_vlans': len(self.network_config.vlans),
            'enabled_vlans': sum(1 for vlan in self.network_config.vlans.values() if vlan.enabled),
            'default_vlan': self.network_config.default_vlan,
            'management_interface': self.network_config.management_interface,
            'dhcp_enabled': self.network_config.dhcp_enabled
        }
