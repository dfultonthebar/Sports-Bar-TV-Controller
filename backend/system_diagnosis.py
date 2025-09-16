
"""
System Diagnosis Module for Sports Bar TV Controller
Provides comprehensive system health monitoring and diagnostic capabilities
"""

import os
import psutil
import subprocess
import json
import logging
import time
import socket
import requests
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
import yaml

logger = logging.getLogger(__name__)

@dataclass
class SystemMetrics:
    """System performance metrics"""
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    network_io: Dict[str, int]
    process_count: int
    uptime_seconds: float
    timestamp: float

@dataclass
class ServiceStatus:
    """Service status information"""
    name: str
    status: str  # running, stopped, failed, unknown
    pid: Optional[int]
    memory_mb: float
    cpu_percent: float
    port: Optional[int]
    last_restart: Optional[str]

@dataclass
class NetworkDiagnostic:
    """Network diagnostic information"""
    interface: str
    ip_address: str
    is_up: bool
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errors_in: int
    errors_out: int

@dataclass
class DiagnosticResult:
    """Diagnostic test result"""
    test_name: str
    status: str  # pass, fail, warning
    message: str
    details: Dict[str, Any]
    timestamp: float
    severity: str  # low, medium, high, critical

class SystemDiagnostics:
    """Comprehensive system diagnostics and health monitoring"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        self.services_to_monitor = self.config.get('services', [
            'sports-bar-controller',
            'nginx',
            'ssh',
            'ufw'
        ])
        self.critical_ports = self.config.get('critical_ports', [22, 80, 443, 8000, 8080])
        self.network_interfaces = self.config.get('network_interfaces', ['eth0', 'wlan0', 'enp0s3'])
        
    def get_system_metrics(self) -> SystemMetrics:
        """Get current system performance metrics"""
        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            
            # Memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Disk usage
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            
            # Network I/O
            network_io = psutil.net_io_counters()._asdict()
            
            # Process count
            process_count = len(psutil.pids())
            
            # System uptime
            boot_time = psutil.boot_time()
            uptime_seconds = time.time() - boot_time
            
            return SystemMetrics(
                cpu_percent=cpu_percent,
                memory_percent=memory_percent,
                disk_percent=disk_percent,
                network_io=network_io,
                process_count=process_count,
                uptime_seconds=uptime_seconds,
                timestamp=time.time()
            )
            
        except Exception as e:
            self.logger.error(f"Error getting system metrics: {e}")
            return SystemMetrics(0, 0, 0, {}, 0, 0, time.time())
    
    def get_service_status(self, service_name: str) -> ServiceStatus:
        """Get status of a specific service"""
        try:
            # Try systemctl first
            result = subprocess.run(
                ['systemctl', 'is-active', service_name],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode == 0:
                status = "running"
            else:
                status = "stopped"
            
            # Get process information
            pid = None
            memory_mb = 0.0
            cpu_percent = 0.0
            port = None
            
            try:
                # Find process by name
                for proc in psutil.process_iter(['pid', 'name', 'memory_info', 'cpu_percent']):
                    if service_name.lower() in proc.info['name'].lower():
                        pid = proc.info['pid']
                        memory_mb = proc.info['memory_info'].rss / 1024 / 1024
                        cpu_percent = proc.info['cpu_percent'] or 0.0
                        
                        # Try to find listening port
                        try:
                            connections = proc.connections()
                            for conn in connections:
                                if conn.status == 'LISTEN':
                                    port = conn.laddr.port
                                    break
                        except:
                            pass
                        break
            except:
                pass
            
            # Get last restart time
            last_restart = None
            try:
                result = subprocess.run(
                    ['systemctl', 'show', service_name, '--property=ActiveEnterTimestamp'],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    timestamp_line = result.stdout.strip()
                    if '=' in timestamp_line:
                        last_restart = timestamp_line.split('=', 1)[1]
            except:
                pass
            
            return ServiceStatus(
                name=service_name,
                status=status,
                pid=pid,
                memory_mb=memory_mb,
                cpu_percent=cpu_percent,
                port=port,
                last_restart=last_restart
            )
            
        except Exception as e:
            self.logger.error(f"Error getting service status for {service_name}: {e}")
            return ServiceStatus(service_name, "unknown", None, 0.0, 0.0, None, None)
    
    def get_network_diagnostics(self) -> List[NetworkDiagnostic]:
        """Get network interface diagnostics"""
        diagnostics = []
        
        try:
            # Get network interfaces
            interfaces = psutil.net_if_addrs()
            stats = psutil.net_if_stats()
            io_counters = psutil.net_io_counters(pernic=True)
            
            for interface_name in interfaces:
                if interface_name in self.network_interfaces or interface_name.startswith(('eth', 'wlan', 'enp')):
                    # Get IP address
                    ip_address = "N/A"
                    for addr in interfaces[interface_name]:
                        if addr.family == socket.AF_INET:
                            ip_address = addr.address
                            break
                    
                    # Get interface status
                    is_up = stats.get(interface_name, {}).isup if interface_name in stats else False
                    
                    # Get I/O counters
                    io_data = io_counters.get(interface_name)
                    if io_data:
                        diagnostics.append(NetworkDiagnostic(
                            interface=interface_name,
                            ip_address=ip_address,
                            is_up=is_up,
                            bytes_sent=io_data.bytes_sent,
                            bytes_recv=io_data.bytes_recv,
                            packets_sent=io_data.packets_sent,
                            packets_recv=io_data.packets_recv,
                            errors_in=io_data.errin,
                            errors_out=io_data.errout
                        ))
            
        except Exception as e:
            self.logger.error(f"Error getting network diagnostics: {e}")
        
        return diagnostics
    
    def test_port_connectivity(self, host: str, port: int, timeout: int = 5) -> bool:
        """Test if a port is accessible"""
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(timeout)
            result = sock.connect_ex((host, port))
            sock.close()
            return result == 0
        except:
            return False
    
    def test_internet_connectivity(self) -> bool:
        """Test internet connectivity"""
        test_urls = [
            "http://8.8.8.8",
            "http://1.1.1.1",
            "https://google.com"
        ]
        
        for url in test_urls:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    return True
            except:
                continue
        
        return False
    
    def run_comprehensive_diagnostics(self) -> List[DiagnosticResult]:
        """Run comprehensive system diagnostics"""
        results = []
        
        # System metrics test
        metrics = self.get_system_metrics()
        
        # CPU test
        if metrics.cpu_percent > 90:
            results.append(DiagnosticResult(
                test_name="CPU Usage",
                status="fail",
                message=f"High CPU usage: {metrics.cpu_percent:.1f}%",
                details={"cpu_percent": metrics.cpu_percent},
                timestamp=time.time(),
                severity="high"
            ))
        elif metrics.cpu_percent > 70:
            results.append(DiagnosticResult(
                test_name="CPU Usage",
                status="warning",
                message=f"Elevated CPU usage: {metrics.cpu_percent:.1f}%",
                details={"cpu_percent": metrics.cpu_percent},
                timestamp=time.time(),
                severity="medium"
            ))
        else:
            results.append(DiagnosticResult(
                test_name="CPU Usage",
                status="pass",
                message=f"CPU usage normal: {metrics.cpu_percent:.1f}%",
                details={"cpu_percent": metrics.cpu_percent},
                timestamp=time.time(),
                severity="low"
            ))
        
        # Memory test
        if metrics.memory_percent > 90:
            results.append(DiagnosticResult(
                test_name="Memory Usage",
                status="fail",
                message=f"High memory usage: {metrics.memory_percent:.1f}%",
                details={"memory_percent": metrics.memory_percent},
                timestamp=time.time(),
                severity="high"
            ))
        elif metrics.memory_percent > 80:
            results.append(DiagnosticResult(
                test_name="Memory Usage",
                status="warning",
                message=f"Elevated memory usage: {metrics.memory_percent:.1f}%",
                details={"memory_percent": metrics.memory_percent},
                timestamp=time.time(),
                severity="medium"
            ))
        else:
            results.append(DiagnosticResult(
                test_name="Memory Usage",
                status="pass",
                message=f"Memory usage normal: {metrics.memory_percent:.1f}%",
                details={"memory_percent": metrics.memory_percent},
                timestamp=time.time(),
                severity="low"
            ))
        
        # Disk test
        if metrics.disk_percent > 95:
            results.append(DiagnosticResult(
                test_name="Disk Usage",
                status="fail",
                message=f"Disk almost full: {metrics.disk_percent:.1f}%",
                details={"disk_percent": metrics.disk_percent},
                timestamp=time.time(),
                severity="critical"
            ))
        elif metrics.disk_percent > 85:
            results.append(DiagnosticResult(
                test_name="Disk Usage",
                status="warning",
                message=f"Disk usage high: {metrics.disk_percent:.1f}%",
                details={"disk_percent": metrics.disk_percent},
                timestamp=time.time(),
                severity="medium"
            ))
        else:
            results.append(DiagnosticResult(
                test_name="Disk Usage",
                status="pass",
                message=f"Disk usage normal: {metrics.disk_percent:.1f}%",
                details={"disk_percent": metrics.disk_percent},
                timestamp=time.time(),
                severity="low"
            ))
        
        # Service tests
        for service in self.services_to_monitor:
            service_status = self.get_service_status(service)
            
            if service_status.status == "running":
                results.append(DiagnosticResult(
                    test_name=f"Service: {service}",
                    status="pass",
                    message=f"Service {service} is running",
                    details=asdict(service_status),
                    timestamp=time.time(),
                    severity="low"
                ))
            else:
                results.append(DiagnosticResult(
                    test_name=f"Service: {service}",
                    status="fail",
                    message=f"Service {service} is not running",
                    details=asdict(service_status),
                    timestamp=time.time(),
                    severity="high"
                ))
        
        # Port connectivity tests
        for port in self.critical_ports:
            is_accessible = self.test_port_connectivity('localhost', port)
            
            if is_accessible:
                results.append(DiagnosticResult(
                    test_name=f"Port {port}",
                    status="pass",
                    message=f"Port {port} is accessible",
                    details={"port": port, "accessible": True},
                    timestamp=time.time(),
                    severity="low"
                ))
            else:
                results.append(DiagnosticResult(
                    test_name=f"Port {port}",
                    status="warning",
                    message=f"Port {port} is not accessible",
                    details={"port": port, "accessible": False},
                    timestamp=time.time(),
                    severity="medium"
                ))
        
        # Internet connectivity test
        has_internet = self.test_internet_connectivity()
        if has_internet:
            results.append(DiagnosticResult(
                test_name="Internet Connectivity",
                status="pass",
                message="Internet connectivity is working",
                details={"has_internet": True},
                timestamp=time.time(),
                severity="low"
            ))
        else:
            results.append(DiagnosticResult(
                test_name="Internet Connectivity",
                status="fail",
                message="No internet connectivity",
                details={"has_internet": False},
                timestamp=time.time(),
                severity="high"
            ))
        
        # Network interface tests
        network_diagnostics = self.get_network_diagnostics()
        for net_diag in network_diagnostics:
            if net_diag.is_up and net_diag.ip_address != "N/A":
                results.append(DiagnosticResult(
                    test_name=f"Network: {net_diag.interface}",
                    status="pass",
                    message=f"Interface {net_diag.interface} is up with IP {net_diag.ip_address}",
                    details=asdict(net_diag),
                    timestamp=time.time(),
                    severity="low"
                ))
            else:
                results.append(DiagnosticResult(
                    test_name=f"Network: {net_diag.interface}",
                    status="warning",
                    message=f"Interface {net_diag.interface} may have issues",
                    details=asdict(net_diag),
                    timestamp=time.time(),
                    severity="medium"
                ))
        
        return results
    
    def get_system_health_summary(self) -> Dict[str, Any]:
        """Get overall system health summary"""
        diagnostics = self.run_comprehensive_diagnostics()
        
        # Count results by status
        status_counts = {"pass": 0, "warning": 0, "fail": 0}
        severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        
        for result in diagnostics:
            status_counts[result.status] = status_counts.get(result.status, 0) + 1
            severity_counts[result.severity] = severity_counts.get(result.severity, 0) + 1
        
        # Calculate health score
        total_tests = len(diagnostics)
        health_score = 100
        if total_tests > 0:
            health_score = (status_counts["pass"] / total_tests) * 100
            health_score -= (status_counts["warning"] / total_tests) * 20
            health_score -= (status_counts["fail"] / total_tests) * 50
            health_score = max(0, min(100, health_score))
        
        # Determine overall status
        if severity_counts["critical"] > 0:
            overall_status = "CRITICAL"
        elif status_counts["fail"] > 0:
            overall_status = "DEGRADED"
        elif status_counts["warning"] > 0:
            overall_status = "WARNING"
        else:
            overall_status = "HEALTHY"
        
        return {
            "overall_status": overall_status,
            "health_score": round(health_score, 1),
            "total_tests": total_tests,
            "status_counts": status_counts,
            "severity_counts": severity_counts,
            "timestamp": datetime.now().isoformat(),
            "diagnostics": [asdict(result) for result in diagnostics]
        }
    
    def get_log_analysis(self, log_file: str, lines: int = 100) -> Dict[str, Any]:
        """Analyze log file for errors and warnings"""
        try:
            if not os.path.exists(log_file):
                return {"error": f"Log file {log_file} not found"}
            
            # Read last N lines
            result = subprocess.run(
                ['tail', '-n', str(lines), log_file],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode != 0:
                return {"error": f"Failed to read log file: {result.stderr}"}
            
            log_lines = result.stdout.split('\n')
            
            # Analyze log content
            error_count = 0
            warning_count = 0
            recent_errors = []
            
            for line in log_lines:
                line_lower = line.lower()
                if 'error' in line_lower or 'exception' in line_lower:
                    error_count += 1
                    if len(recent_errors) < 5:
                        recent_errors.append(line.strip())
                elif 'warning' in line_lower or 'warn' in line_lower:
                    warning_count += 1
            
            return {
                "log_file": log_file,
                "lines_analyzed": len([l for l in log_lines if l.strip()]),
                "error_count": error_count,
                "warning_count": warning_count,
                "recent_errors": recent_errors,
                "analysis_time": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {"error": f"Error analyzing log file: {e}"}

# Example usage
if __name__ == "__main__":
    diagnostics = SystemDiagnostics()
    
    # Get system health summary
    health = diagnostics.get_system_health_summary()
    print(json.dumps(health, indent=2))
    
    # Analyze a log file
    log_analysis = diagnostics.get_log_analysis("/var/log/syslog")
    print(json.dumps(log_analysis, indent=2))
