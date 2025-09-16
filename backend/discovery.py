
"""
TV Discovery System - Network Scanning and Device Detection
Implements comprehensive network scanning for TV and device discovery using ARP, ICMP, and port scanning.
"""

import asyncio
import socket
import struct
import subprocess
import ipaddress
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import json
import time

try:
    from scapy.all import ARP, Ether, srp, IP, ICMP, sr, TCP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False
    logging.warning("Scapy not available. Using alternative network scanning methods.")

@dataclass
class DiscoveredDevice:
    """Represents a discovered network device"""
    ip: str
    mac: str = ""
    hostname: str = ""
    device_type: str = "unknown"
    manufacturer: str = ""
    ports: List[int] = None
    last_seen: float = 0
    response_time: float = 0
    
    def __post_init__(self):
        if self.ports is None:
            self.ports = []
        if self.last_seen == 0:
            self.last_seen = time.time()

class NetworkScanner:
    """Advanced network scanner for TV and device discovery"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.discovered_devices: Dict[str, DiscoveredDevice] = {}
        self.tv_ports = [80, 443, 8080, 8443, 7001, 7002, 9000, 55000]  # Common TV/streaming device ports
        self.manufacturer_oui = self._load_oui_database()
        
    def _load_oui_database(self) -> Dict[str, str]:
        """Load OUI (Organizationally Unique Identifier) database for manufacturer identification"""
        # Basic OUI mappings for common TV manufacturers
        return {
            "00:13:95": "LG Electronics",
            "00:26:E2": "LG Electronics", 
            "3C:BD:D8": "LG Electronics",
            "00:0D:97": "Hitachi",
            "00:09:DF": "Sony Corporation",
            "00:1B:EF": "Sony Corporation",
            "00:1D:BA": "Sony Corporation",
            "00:E0:4C": "Realtek",
            "00:1F:20": "Arcadyan Technology",
            "00:07:AB": "Toshiba",
            "00:1E:A6": "Toshiba",
            "00:26:CC": "Toshiba",
            "00:1C:FB": "Apple",
            "00:25:00": "Apple",
            "28:CF:E9": "Apple",
            "00:1B:63": "Apple",
            "00:0F:CC": "Roku",
            "DC:3A:5E": "Roku",
            "B0:EE:7B": "Roku",
            "00:1A:11": "Google",
            "DA:A1:19": "Google",
            "F4:F5:D8": "Google",
        }
    
    async def discover_devices(self, network_range: str = "192.168.1.0/24") -> List[DiscoveredDevice]:
        """
        Comprehensive device discovery using multiple scanning methods
        
        Args:
            network_range: CIDR notation network range to scan
            
        Returns:
            List of discovered devices
        """
        self.logger.info(f"Starting device discovery on network: {network_range}")
        
        # Run multiple scanning methods concurrently
        tasks = []
        
        if SCAPY_AVAILABLE:
            tasks.append(self._arp_scan_scapy(network_range))
        else:
            tasks.append(self._arp_scan_native(network_range))
            
        tasks.append(self._ping_scan(network_range))
        tasks.append(self._port_scan_common_devices(network_range))
        
        # Execute all scanning methods
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Merge results and identify TV devices
        await self._identify_tv_devices()
        
        devices = list(self.discovered_devices.values())
        self.logger.info(f"Discovery complete. Found {len(devices)} devices")
        
        return devices
    
    async def _arp_scan_scapy(self, network_range: str) -> List[DiscoveredDevice]:
        """ARP scan using Scapy library"""
        if not SCAPY_AVAILABLE:
            return []
            
        self.logger.info("Performing ARP scan with Scapy")
        
        def _scapy_arp_scan():
            try:
                arp_request = ARP(pdst=network_range)
                broadcast = Ether(dst="ff:ff:ff:ff:ff:ff")
                arp_request_broadcast = broadcast / arp_request
                answered_list = srp(arp_request_broadcast, timeout=2, verbose=False)[0]
                
                devices = []
                for element in answered_list:
                    ip = element[1].psrc
                    mac = element[1].hwsrc
                    device = DiscoveredDevice(ip=ip, mac=mac)
                    device.manufacturer = self._get_manufacturer_from_mac(mac)
                    devices.append(device)
                    
                return devices
            except Exception as e:
                self.logger.error(f"Scapy ARP scan failed: {e}")
                return []
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            devices = await loop.run_in_executor(executor, _scapy_arp_scan)
            
        # Update discovered devices
        for device in devices:
            self.discovered_devices[device.ip] = device
            
        self.logger.info(f"ARP scan found {len(devices)} devices")
        return devices
    
    async def _arp_scan_native(self, network_range: str) -> List[DiscoveredDevice]:
        """Native ARP scan using system ARP table"""
        self.logger.info("Performing native ARP scan")
        
        try:
            # First, ping the network to populate ARP table
            network = ipaddress.IPv4Network(network_range, strict=False)
            
            # Ping sweep to populate ARP table
            ping_tasks = []
            for ip in network.hosts():
                ping_tasks.append(self._ping_host(str(ip)))
                
            await asyncio.gather(*ping_tasks, return_exceptions=True)
            
            # Read ARP table
            devices = []
            try:
                result = subprocess.run(['arp', '-a'], capture_output=True, text=True, timeout=10)
                for line in result.stdout.split('\n'):
                    if '(' in line and ')' in line:
                        parts = line.split()
                        if len(parts) >= 4:
                            ip = parts[1].strip('()')
                            mac = parts[3] if len(parts[3]) == 17 else ""
                            
                            if self._is_valid_ip(ip) and mac:
                                device = DiscoveredDevice(ip=ip, mac=mac)
                                device.manufacturer = self._get_manufacturer_from_mac(mac)
                                devices.append(device)
                                
            except subprocess.TimeoutExpired:
                self.logger.warning("ARP table read timed out")
            except Exception as e:
                self.logger.error(f"Failed to read ARP table: {e}")
                
            # Update discovered devices
            for device in devices:
                self.discovered_devices[device.ip] = device
                
            self.logger.info(f"Native ARP scan found {len(devices)} devices")
            return devices
            
        except Exception as e:
            self.logger.error(f"Native ARP scan failed: {e}")
            return []
    
    async def _ping_scan(self, network_range: str) -> List[DiscoveredDevice]:
        """ICMP ping scan to discover responsive hosts"""
        self.logger.info("Performing ping scan")
        
        network = ipaddress.IPv4Network(network_range, strict=False)
        ping_tasks = []
        
        for ip in network.hosts():
            ping_tasks.append(self._ping_host(str(ip)))
            
        results = await asyncio.gather(*ping_tasks, return_exceptions=True)
        
        devices = []
        for ip_str, result in zip([str(ip) for ip in network.hosts()], results):
            if isinstance(result, tuple) and result[0]:  # (success, response_time)
                if ip_str not in self.discovered_devices:
                    device = DiscoveredDevice(ip=ip_str)
                    device.response_time = result[1]
                    devices.append(device)
                    self.discovered_devices[ip_str] = device
                else:
                    self.discovered_devices[ip_str].response_time = result[1]
                    
        self.logger.info(f"Ping scan found {len(devices)} new responsive hosts")
        return devices
    
    async def _ping_host(self, ip: str) -> Tuple[bool, float]:
        """Ping a single host"""
        try:
            start_time = time.time()
            process = await asyncio.create_subprocess_exec(
                'ping', '-c', '1', '-W', '1', ip,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL
            )
            await process.wait()
            response_time = time.time() - start_time
            
            return process.returncode == 0, response_time
        except Exception:
            return False, 0.0
    
    async def _port_scan_common_devices(self, network_range: str) -> List[DiscoveredDevice]:
        """Scan for common TV/streaming device ports"""
        self.logger.info("Performing port scan for TV devices")
        
        network = ipaddress.IPv4Network(network_range, strict=False)
        scan_tasks = []
        
        for ip in network.hosts():
            scan_tasks.append(self._scan_host_ports(str(ip), self.tv_ports))
            
        results = await asyncio.gather(*scan_tasks, return_exceptions=True)
        
        devices = []
        for ip_str, result in zip([str(ip) for ip in network.hosts()], results):
            if isinstance(result, list) and result:  # Found open ports
                if ip_str not in self.discovered_devices:
                    device = DiscoveredDevice(ip=ip_str)
                    device.ports = result
                    devices.append(device)
                    self.discovered_devices[ip_str] = device
                else:
                    self.discovered_devices[ip_str].ports.extend(result)
                    
        self.logger.info(f"Port scan found {len(devices)} devices with TV-related ports")
        return devices
    
    async def _scan_host_ports(self, ip: str, ports: List[int]) -> List[int]:
        """Scan specific ports on a host"""
        open_ports = []
        
        for port in ports:
            try:
                future = asyncio.open_connection(ip, port)
                reader, writer = await asyncio.wait_for(future, timeout=1.0)
                writer.close()
                await writer.wait_closed()
                open_ports.append(port)
            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                pass
                
        return open_ports
    
    async def _identify_tv_devices(self):
        """Identify which discovered devices are likely TVs or streaming devices"""
        for device in self.discovered_devices.values():
            device.device_type = self._classify_device(device)
    
    def _classify_device(self, device: DiscoveredDevice) -> str:
        """Classify device type based on available information"""
        # Check manufacturer
        if any(tv_brand in device.manufacturer.lower() for tv_brand in 
               ['lg', 'sony', 'samsung', 'toshiba', 'roku', 'apple', 'google']):
            if any(brand in device.manufacturer.lower() for brand in ['roku', 'apple', 'google']):
                return "streaming_device"
            return "smart_tv"
        
        # Check open ports
        tv_port_indicators = [7001, 7002, 9000, 55000]
        if any(port in device.ports for port in tv_port_indicators):
            return "smart_tv"
            
        streaming_port_indicators = [8080, 8443]
        if any(port in device.ports for port in streaming_port_indicators):
            return "streaming_device"
            
        # Check hostname patterns
        hostname_lower = device.hostname.lower()
        if any(keyword in hostname_lower for keyword in ['tv', 'roku', 'appletv', 'chromecast']):
            return "streaming_device" if any(keyword in hostname_lower for keyword in ['roku', 'appletv', 'chromecast']) else "smart_tv"
            
        return "unknown"
    
    def _get_manufacturer_from_mac(self, mac: str) -> str:
        """Get manufacturer from MAC address OUI"""
        if not mac or len(mac) < 8:
            return "Unknown"
            
        oui = mac[:8].upper()
        return self.manufacturer_oui.get(oui, "Unknown")
    
    def _is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format"""
        try:
            ipaddress.IPv4Address(ip)
            return True
        except ipaddress.AddressValueError:
            return False
    
    async def get_device_details(self, ip: str) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific device"""
        if ip not in self.discovered_devices:
            return None
            
        device = self.discovered_devices[ip]
        
        # Try to get hostname
        try:
            hostname = socket.gethostbyaddr(ip)[0]
            device.hostname = hostname
        except socket.herror:
            pass
            
        # Additional port scanning for detailed analysis
        extended_ports = [21, 22, 23, 53, 80, 443, 554, 1900, 8008, 8080, 8443, 9000]
        device.ports = await self._scan_host_ports(ip, extended_ports)
        
        # Re-classify with updated information
        device.device_type = self._classify_device(device)
        
        return {
            "ip": device.ip,
            "mac": device.mac,
            "hostname": device.hostname,
            "device_type": device.device_type,
            "manufacturer": device.manufacturer,
            "ports": device.ports,
            "last_seen": device.last_seen,
            "response_time": device.response_time
        }

class TVDiscoveryService:
    """High-level TV discovery service"""
    
    def __init__(self):
        self.scanner = NetworkScanner()
        self.logger = logging.getLogger(__name__)
        self.discovery_cache = {}
        self.cache_timeout = 300  # 5 minutes
    
    async def discover_tvs(self, network_ranges: List[str] = None) -> List[Dict[str, Any]]:
        """
        Discover TVs on specified network ranges
        
        Args:
            network_ranges: List of CIDR network ranges to scan
            
        Returns:
            List of discovered TV devices
        """
        if network_ranges is None:
            network_ranges = ["192.168.1.0/24"]
            
        all_devices = []
        
        for network_range in network_ranges:
            cache_key = f"discovery_{network_range}"
            
            # Check cache
            if (cache_key in self.discovery_cache and 
                time.time() - self.discovery_cache[cache_key]['timestamp'] < self.cache_timeout):
                self.logger.info(f"Using cached discovery results for {network_range}")
                all_devices.extend(self.discovery_cache[cache_key]['devices'])
                continue
                
            # Perform discovery
            devices = await self.scanner.discover_devices(network_range)
            
            # Filter for TV and streaming devices
            tv_devices = [
                await self.scanner.get_device_details(device.ip)
                for device in devices
                if device.device_type in ['smart_tv', 'streaming_device'] or
                any(port in device.ports for port in [7001, 7002, 9000, 55000])
            ]
            
            # Remove None results
            tv_devices = [device for device in tv_devices if device is not None]
            
            # Cache results
            self.discovery_cache[cache_key] = {
                'devices': tv_devices,
                'timestamp': time.time()
            }
            
            all_devices.extend(tv_devices)
            
        self.logger.info(f"TV discovery complete. Found {len(all_devices)} TV/streaming devices")
        return all_devices
    
    async def refresh_device_info(self, ip: str) -> Optional[Dict[str, Any]]:
        """Refresh information for a specific device"""
        return await self.scanner.get_device_details(ip)
    
    def clear_cache(self):
        """Clear discovery cache"""
        self.discovery_cache.clear()
        self.logger.info("Discovery cache cleared")

# Example usage and testing
if __name__ == "__main__":
    async def main():
        discovery_service = TVDiscoveryService()
        
        # Discover TVs on default network
        tvs = await discovery_service.discover_tvs()
        
        print(f"Found {len(tvs)} TV/streaming devices:")
        for tv in tvs:
            print(f"  {tv['ip']} - {tv['device_type']} ({tv['manufacturer']})")
            if tv['hostname']:
                print(f"    Hostname: {tv['hostname']}")
            if tv['ports']:
                print(f"    Open ports: {tv['ports']}")
    
    asyncio.run(main())
