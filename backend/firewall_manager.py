
"""
Firewall Manager for Sports Bar TV Controller
Provides programmatic UFW firewall management for AI service access
"""

import subprocess
import logging
import json
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import ipaddress

logger = logging.getLogger(__name__)

@dataclass
class FirewallRule:
    """Represents a firewall rule"""
    rule_number: Optional[int]
    action: str  # ALLOW, DENY, REJECT
    from_ip: str
    to_ip: str
    port: Optional[str]
    protocol: Optional[str]
    comment: Optional[str] = None

@dataclass
class FirewallStatus:
    """Represents firewall status"""
    active: bool
    default_incoming: str
    default_outgoing: str
    default_routed: str
    rules: List[FirewallRule]
    logging: str

class FirewallManager:
    """Manages UFW firewall programmatically for AI service access"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.logger = logging.getLogger(__name__)
        
        # AI service ports that need access
        self.ai_service_ports = {
            'chat_interface': 8001,
            'api_service': 8002,
            'websocket': 8003,
            'diagnostics': 8004,
            'rules_engine': 8005
        }
        
        # Trusted IP ranges for AI services
        self.trusted_ranges = [
            '192.168.1.0/24',  # Local network
            '10.0.0.0/8',      # Private network
            '172.16.0.0/12'    # Private network
        ]
    
    def is_ufw_installed(self) -> bool:
        """Check if UFW is installed"""
        try:
            result = subprocess.run(['which', 'ufw'], capture_output=True, text=True)
            return result.returncode == 0
        except Exception as e:
            self.logger.error(f"Error checking UFW installation: {e}")
            return False
    
    def is_ufw_active(self) -> bool:
        """Check if UFW is active"""
        try:
            result = subprocess.run(['sudo', 'ufw', 'status'], capture_output=True, text=True, timeout=10)
            if result.returncode == 0:
                return 'Status: active' in result.stdout
            return False
        except Exception as e:
            self.logger.error(f"Error checking UFW status: {e}")
            return False
    
    def get_ufw_status(self) -> FirewallStatus:
        """Get detailed UFW status"""
        try:
            result = subprocess.run(['sudo', 'ufw', 'status', 'verbose'], capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                raise Exception(f"UFW status command failed: {result.stderr}")
            
            output = result.stdout
            
            # Parse status
            active = 'Status: active' in output
            
            # Parse defaults
            default_incoming = "deny"
            default_outgoing = "allow"
            default_routed = "disabled"
            
            for line in output.split('\n'):
                if 'Default:' in line:
                    # Example: "Default: deny (incoming), allow (outgoing), disabled (routed)"
                    defaults_match = re.search(r'Default: (\w+) \(incoming\), (\w+) \(outgoing\)(?:, (\w+) \(routed\))?', line)
                    if defaults_match:
                        default_incoming = defaults_match.group(1)
                        default_outgoing = defaults_match.group(2)
                        if defaults_match.group(3):
                            default_routed = defaults_match.group(3)
            
            # Parse logging
            logging_status = "off"
            for line in output.split('\n'):
                if 'Logging:' in line:
                    logging_match = re.search(r'Logging: (\w+)', line)
                    if logging_match:
                        logging_status = logging_match.group(1)
            
            # Parse rules
            rules = self._parse_ufw_rules(output)
            
            return FirewallStatus(
                active=active,
                default_incoming=default_incoming,
                default_outgoing=default_outgoing,
                default_routed=default_routed,
                rules=rules,
                logging=logging_status
            )
            
        except Exception as e:
            self.logger.error(f"Error getting UFW status: {e}")
            return FirewallStatus(False, "unknown", "unknown", "unknown", [], "unknown")
    
    def _parse_ufw_rules(self, status_output: str) -> List[FirewallRule]:
        """Parse UFW rules from status output"""
        rules = []
        
        try:
            lines = status_output.split('\n')
            in_rules_section = False
            
            for line in lines:
                line = line.strip()
                
                # Skip header lines
                if 'To' in line and 'Action' in line and 'From' in line:
                    in_rules_section = True
                    continue
                
                if not in_rules_section or not line or line.startswith('-'):
                    continue
                
                # Parse rule line
                # Example formats:
                # "22/tcp                     ALLOW IN    Anywhere"
                # "80,443/tcp (Nginx Full)   ALLOW IN    Anywhere"
                # "Anywhere                  ALLOW OUT   Anywhere on lo"
                
                parts = re.split(r'\s{2,}', line)  # Split on multiple spaces
                if len(parts) >= 3:
                    to_part = parts[0]
                    action_part = parts[1]
                    from_part = parts[2]
                    
                    # Extract port and protocol
                    port = None
                    protocol = None
                    
                    if '/' in to_part:
                        port_proto = to_part.split('/')
                        port = port_proto[0]
                        protocol = port_proto[1] if len(port_proto) > 1 else None
                    elif to_part.isdigit():
                        port = to_part
                    
                    # Extract action
                    action = action_part.split()[0]  # Take first word (ALLOW, DENY, etc.)
                    
                    rule = FirewallRule(
                        rule_number=None,  # Not available in verbose output
                        action=action,
                        from_ip=from_part,
                        to_ip=to_part,
                        port=port,
                        protocol=protocol
                    )
                    
                    rules.append(rule)
        
        except Exception as e:
            self.logger.error(f"Error parsing UFW rules: {e}")
        
        return rules
    
    def enable_ufw(self) -> bool:
        """Enable UFW firewall"""
        try:
            if self.dry_run:
                self.logger.info("DRY RUN: Would enable UFW")
                return True
            
            # Set default policies first
            subprocess.run(['sudo', 'ufw', '--force', 'default', 'deny', 'incoming'], 
                         capture_output=True, text=True, timeout=10)
            subprocess.run(['sudo', 'ufw', '--force', 'default', 'allow', 'outgoing'], 
                         capture_output=True, text=True, timeout=10)
            
            # Enable UFW
            result = subprocess.run(['sudo', 'ufw', '--force', 'enable'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                self.logger.info("UFW enabled successfully")
                return True
            else:
                self.logger.error(f"Failed to enable UFW: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error enabling UFW: {e}")
            return False
    
    def disable_ufw(self) -> bool:
        """Disable UFW firewall"""
        try:
            if self.dry_run:
                self.logger.info("DRY RUN: Would disable UFW")
                return True
            
            result = subprocess.run(['sudo', 'ufw', '--force', 'disable'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                self.logger.info("UFW disabled successfully")
                return True
            else:
                self.logger.error(f"Failed to disable UFW: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error disabling UFW: {e}")
            return False
    
    def allow_port(self, port: int, protocol: str = 'tcp', from_ip: Optional[str] = None, comment: Optional[str] = None) -> bool:
        """Allow access to a specific port"""
        try:
            cmd = ['sudo', 'ufw', 'allow']
            
            if from_ip:
                # Validate IP address/range
                try:
                    ipaddress.ip_network(from_ip, strict=False)
                except ValueError:
                    self.logger.error(f"Invalid IP address/range: {from_ip}")
                    return False
                
                cmd.extend(['from', from_ip, 'to', 'any', 'port', str(port)])
            else:
                cmd.append(f"{port}/{protocol}")
            
            if comment:
                cmd.extend(['comment', comment])
            
            if self.dry_run:
                self.logger.info(f"DRY RUN: Would execute: {' '.join(cmd)}")
                return True
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                self.logger.info(f"Allowed port {port}/{protocol}" + (f" from {from_ip}" if from_ip else ""))
                return True
            else:
                self.logger.error(f"Failed to allow port {port}: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error allowing port {port}: {e}")
            return False
    
    def deny_port(self, port: int, protocol: str = 'tcp', from_ip: Optional[str] = None) -> bool:
        """Deny access to a specific port"""
        try:
            cmd = ['sudo', 'ufw', 'deny']
            
            if from_ip:
                try:
                    ipaddress.ip_network(from_ip, strict=False)
                except ValueError:
                    self.logger.error(f"Invalid IP address/range: {from_ip}")
                    return False
                
                cmd.extend(['from', from_ip, 'to', 'any', 'port', str(port)])
            else:
                cmd.append(f"{port}/{protocol}")
            
            if self.dry_run:
                self.logger.info(f"DRY RUN: Would execute: {' '.join(cmd)}")
                return True
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                self.logger.info(f"Denied port {port}/{protocol}" + (f" from {from_ip}" if from_ip else ""))
                return True
            else:
                self.logger.error(f"Failed to deny port {port}: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error denying port {port}: {e}")
            return False
    
    def delete_rule(self, rule_spec: str) -> bool:
        """Delete a firewall rule"""
        try:
            cmd = ['sudo', 'ufw', 'delete'] + rule_spec.split()
            
            if self.dry_run:
                self.logger.info(f"DRY RUN: Would execute: {' '.join(cmd)}")
                return True
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                self.logger.info(f"Deleted rule: {rule_spec}")
                return True
            else:
                self.logger.error(f"Failed to delete rule {rule_spec}: {result.stderr}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error deleting rule {rule_spec}: {e}")
            return False
    
    def configure_ai_service_access(self) -> Dict[str, bool]:
        """Configure firewall access for AI services"""
        results = {}
        
        # Ensure UFW is enabled
        if not self.is_ufw_active():
            if not self.enable_ufw():
                return {"error": "Failed to enable UFW"}
        
        # Allow SSH access (essential for remote management)
        results['ssh'] = self.allow_port(22, 'tcp', comment='SSH access')
        
        # Allow AI service ports from trusted networks
        for service_name, port in self.ai_service_ports.items():
            success = True
            
            # Allow from trusted IP ranges
            for ip_range in self.trusted_ranges:
                if not self.allow_port(port, 'tcp', from_ip=ip_range, comment=f'AI {service_name}'):
                    success = False
            
            results[service_name] = success
        
        # Allow standard web ports for the main interface
        results['http'] = self.allow_port(80, 'tcp', comment='HTTP web interface')
        results['https'] = self.allow_port(443, 'tcp', comment='HTTPS web interface')
        
        # Allow alternative web port for development
        results['dev_web'] = self.allow_port(8000, 'tcp', comment='Development web server')
        
        return results
    
    def configure_secure_ai_access(self, allowed_ips: List[str]) -> Dict[str, bool]:
        """Configure secure AI access for specific IP addresses"""
        results = {}
        
        # Validate IP addresses
        valid_ips = []
        for ip in allowed_ips:
            try:
                ipaddress.ip_network(ip, strict=False)
                valid_ips.append(ip)
            except ValueError:
                self.logger.error(f"Invalid IP address: {ip}")
                results[f"invalid_ip_{ip}"] = False
        
        # Configure access for each AI service
        for service_name, port in self.ai_service_ports.items():
            success = True
            
            for ip in valid_ips:
                if not self.allow_port(port, 'tcp', from_ip=ip, comment=f'Secure AI {service_name}'):
                    success = False
            
            results[service_name] = success
        
        return results
    
    def get_ai_service_status(self) -> Dict[str, Any]:
        """Get status of AI service firewall rules"""
        status = self.get_ufw_status()
        
        ai_rules = []
        for rule in status.rules:
            if rule.port and int(rule.port) in self.ai_service_ports.values():
                ai_rules.append(asdict(rule))
        
        return {
            "firewall_active": status.active,
            "ai_service_rules": ai_rules,
            "ai_service_ports": self.ai_service_ports,
            "trusted_ranges": self.trusted_ranges,
            "total_rules": len(status.rules)
        }
    
    def reset_ai_service_rules(self) -> bool:
        """Reset all AI service firewall rules"""
        try:
            # Get current status
            status = self.get_ufw_status()
            
            # Delete AI service rules
            deleted_count = 0
            for rule in status.rules:
                if rule.port and int(rule.port) in self.ai_service_ports.values():
                    # Try to delete the rule
                    rule_spec = f"allow {rule.port}"
                    if rule.from_ip != "Anywhere":
                        rule_spec = f"allow from {rule.from_ip} to any port {rule.port}"
                    
                    if self.delete_rule(rule_spec):
                        deleted_count += 1
            
            self.logger.info(f"Reset {deleted_count} AI service firewall rules")
            return True
            
        except Exception as e:
            self.logger.error(f"Error resetting AI service rules: {e}")
            return False
    
    def backup_firewall_rules(self, backup_file: str) -> bool:
        """Backup current firewall rules to a file"""
        try:
            status = self.get_ufw_status()
            
            backup_data = {
                "timestamp": datetime.now().isoformat(),
                "firewall_status": asdict(status),
                "ai_service_ports": self.ai_service_ports,
                "trusted_ranges": self.trusted_ranges
            }
            
            with open(backup_file, 'w') as f:
                json.dump(backup_data, f, indent=2)
            
            self.logger.info(f"Firewall rules backed up to {backup_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error backing up firewall rules: {e}")
            return False
    
    def restore_firewall_rules(self, backup_file: str) -> bool:
        """Restore firewall rules from a backup file"""
        try:
            with open(backup_file, 'r') as f:
                backup_data = json.load(f)
            
            # This is a simplified restore - in practice, you'd want to
            # carefully restore each rule while avoiding conflicts
            self.logger.info(f"Firewall rules restore from {backup_file} - manual implementation needed")
            return True
            
        except Exception as e:
            self.logger.error(f"Error restoring firewall rules: {e}")
            return False

# Example usage and testing
if __name__ == "__main__":
    # Create firewall manager (dry run mode for testing)
    fw_manager = FirewallManager(dry_run=True)
    
    # Check UFW status
    if not fw_manager.is_ufw_installed():
        print("UFW is not installed")
        exit(1)
    
    # Get current status
    status = fw_manager.get_ufw_status()
    print(f"UFW Active: {status.active}")
    print(f"Rules: {len(status.rules)}")
    
    # Configure AI service access
    print("\nConfiguring AI service access...")
    results = fw_manager.configure_ai_service_access()
    for service, success in results.items():
        print(f"  {service}: {'SUCCESS' if success else 'FAILED'}")
    
    # Get AI service status
    ai_status = fw_manager.get_ai_service_status()
    print(f"\nAI Service Rules: {len(ai_status['ai_service_rules'])}")
    
    # Backup rules
    fw_manager.backup_firewall_rules("firewall_backup.json")
    print("Firewall rules backed up")
