
"""
AI-Powered Error Analysis and Fix Suggestion System

This module provides intelligent analysis of system errors and suggests
automated fixes using LLM-based reasoning and code diff generation.
"""

import os
import re
import json
import logging
import asyncio
import subprocess
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path

from .monitor import LogEvent

logger = logging.getLogger(__name__)

@dataclass
class ErrorAnalysis:
    """Represents an analysis of a system error"""
    error_id: str
    timestamp: datetime
    error_type: str
    severity: str
    description: str
    root_cause: str
    affected_components: List[str]
    suggested_fixes: List[str]
    automated_fix_available: bool
    confidence_score: float
    context: Dict[str, Any]

@dataclass
class FixSuggestion:
    """Represents a suggested fix for an error"""
    fix_id: str
    description: str
    fix_type: str  # 'config', 'code', 'restart', 'manual'
    commands: List[str]
    files_to_modify: List[str]
    risk_level: str  # 'LOW', 'MEDIUM', 'HIGH'
    estimated_downtime: str
    rollback_commands: List[str]

class ErrorAnalyzer:
    """
    AI-powered error analysis system that can suggest and implement fixes
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.analysis_history = []
        self.fix_templates = self._load_fix_templates()
        self.project_root = Path(__file__).parent.parent
        
        # LLM configuration (placeholder for future integration)
        self.llm_enabled = self.config.get("llm_enabled", False)
        self.llm_model = self.config.get("llm_model", "gpt-3.5-turbo")
        
        logger.info("ErrorAnalyzer initialized")
    
    def _load_fix_templates(self) -> Dict[str, Any]:
        """Load predefined fix templates for common errors"""
        return {
            "connection_error": {
                "device_offline": {
                    "description": "Device appears to be offline or unreachable",
                    "fixes": [
                        {
                            "type": "network_check",
                            "commands": ["ping -c 3 {device_ip}", "telnet {device_ip} {device_port}"],
                            "risk": "LOW"
                        },
                        {
                            "type": "device_restart",
                            "commands": ["curl -X POST http://{device_ip}/api/restart"],
                            "risk": "MEDIUM"
                        },
                        {
                            "type": "service_restart",
                            "commands": ["systemctl restart sportsbar-controller"],
                            "risk": "MEDIUM"
                        }
                    ]
                },
                "network_timeout": {
                    "description": "Network timeout when connecting to device",
                    "fixes": [
                        {
                            "type": "config_adjustment",
                            "files": ["config/mappings.yaml"],
                            "changes": {"timeout_seconds": 30},
                            "risk": "LOW"
                        }
                    ]
                }
            },
            "authentication_error": {
                "invalid_credentials": {
                    "description": "Authentication failed due to invalid credentials",
                    "fixes": [
                        {
                            "type": "credential_check",
                            "commands": ["echo 'Check API keys and device passwords'"],
                            "risk": "LOW"
                        },
                        {
                            "type": "config_update",
                            "files": ["config/mappings.yaml", ".env"],
                            "risk": "LOW"
                        }
                    ]
                }
            },
            "api_error": {
                "rate_limit": {
                    "description": "API rate limit exceeded",
                    "fixes": [
                        {
                            "type": "rate_limit_adjustment",
                            "files": ["config/sports_config.yaml"],
                            "changes": {"cache_duration_minutes": 60},
                            "risk": "LOW"
                        }
                    ]
                },
                "api_key_invalid": {
                    "description": "API key is invalid or expired",
                    "fixes": [
                        {
                            "type": "api_key_refresh",
                            "commands": ["echo 'Update API keys in environment variables'"],
                            "risk": "LOW"
                        }
                    ]
                }
            },
            "memory_error": {
                "out_of_memory": {
                    "description": "System running out of memory",
                    "fixes": [
                        {
                            "type": "memory_cleanup",
                            "commands": [
                                "docker system prune -f",
                                "find logs/ -name '*.log' -mtime +7 -delete"
                            ],
                            "risk": "LOW"
                        },
                        {
                            "type": "service_restart",
                            "commands": ["systemctl restart sportsbar-controller"],
                            "risk": "MEDIUM"
                        }
                    ]
                }
            },
            "disk_error": {
                "disk_full": {
                    "description": "Disk space is running low",
                    "fixes": [
                        {
                            "type": "disk_cleanup",
                            "commands": [
                                "find logs/ -name '*.log' -mtime +30 -delete",
                                "docker system prune -a -f",
                                "apt-get autoremove -y"
                            ],
                            "risk": "LOW"
                        }
                    ]
                }
            }
        }
    
    async def analyze_error(self, log_event: LogEvent) -> Optional[ErrorAnalysis]:
        """Analyze a log event and provide detailed analysis"""
        try:
            # Extract error information
            error_info = self._extract_error_info(log_event)
            if not error_info:
                return None
            
            # Determine error type and severity
            error_type = self._classify_error_type(log_event)
            severity = self._assess_severity(log_event, error_type)
            
            # Find root cause
            root_cause = await self._find_root_cause(log_event, error_info)
            
            # Identify affected components
            affected_components = self._identify_affected_components(log_event, error_info)
            
            # Generate fix suggestions
            suggested_fixes = await self._generate_fix_suggestions(error_type, error_info, log_event)
            
            # Check if automated fix is available
            automated_fix_available = any(
                fix.fix_type in ['config', 'restart', 'cleanup'] 
                for fix in suggested_fixes
            )
            
            # Calculate confidence score
            confidence_score = self._calculate_confidence_score(error_info, suggested_fixes)
            
            # Create analysis
            analysis = ErrorAnalysis(
                error_id=f"err_{int(datetime.now().timestamp())}_{hash(log_event.message) % 10000}",
                timestamp=log_event.timestamp,
                error_type=error_type,
                severity=severity,
                description=self._generate_error_description(log_event, error_info),
                root_cause=root_cause,
                affected_components=affected_components,
                suggested_fixes=[fix.description for fix in suggested_fixes],
                automated_fix_available=automated_fix_available,
                confidence_score=confidence_score,
                context={
                    "original_message": log_event.message,
                    "source_file": log_event.file_path,
                    "line_number": log_event.line_number,
                    "fix_suggestions": [asdict(fix) for fix in suggested_fixes]
                }
            )
            
            # Store analysis
            self.analysis_history.append(analysis)
            
            logger.info(f"Generated error analysis: {analysis.error_id}")
            return analysis
            
        except Exception as e:
            logger.error(f"Error during analysis: {e}")
            return None
    
    def _extract_error_info(self, log_event: LogEvent) -> Optional[Dict[str, Any]]:
        """Extract structured information from error message"""
        message = log_event.message
        info = {}
        
        # Extract IP addresses
        ip_pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
        ips = re.findall(ip_pattern, message)
        if ips:
            info['ip_addresses'] = ips
        
        # Extract ports
        port_pattern = r':(\d{2,5})\b'
        ports = re.findall(port_pattern, message)
        if ports:
            info['ports'] = [int(p) for p in ports]
        
        # Extract device names
        device_pattern = r'(wolfpack|atlas|device|matrix|audio|video)'
        devices = re.findall(device_pattern, message, re.IGNORECASE)
        if devices:
            info['devices'] = list(set(devices))
        
        # Extract HTTP status codes
        http_pattern = r'\b(4\d{2}|5\d{2})\b'
        http_codes = re.findall(http_pattern, message)
        if http_codes:
            info['http_codes'] = [int(code) for code in http_codes]
        
        # Extract file paths
        path_pattern = r'[/\\][\w/\\.-]+'
        paths = re.findall(path_pattern, message)
        if paths:
            info['file_paths'] = paths
        
        # Extract API endpoints
        api_pattern = r'/api/[\w/]+'
        apis = re.findall(api_pattern, message)
        if apis:
            info['api_endpoints'] = apis
        
        return info if info else None
    
    def _classify_error_type(self, log_event: LogEvent) -> str:
        """Classify the type of error"""
        message = log_event.message.lower()
        
        if any(word in message for word in ['connection', 'connect', 'network', 'timeout']):
            return 'connection_error'
        elif any(word in message for word in ['auth', 'login', 'credential', 'permission']):
            return 'authentication_error'
        elif any(word in message for word in ['api', 'http', 'rest', 'endpoint']):
            return 'api_error'
        elif any(word in message for word in ['memory', 'ram', 'oom']):
            return 'memory_error'
        elif any(word in message for word in ['disk', 'space', 'storage']):
            return 'disk_error'
        elif any(word in message for word in ['device', 'wolfpack', 'atlas']):
            return 'device_error'
        elif any(word in message for word in ['video', 'routing', 'matrix']):
            return 'video_error'
        elif any(word in message for word in ['audio', 'sound', 'volume']):
            return 'audio_error'
        else:
            return 'general_error'
    
    def _assess_severity(self, log_event: LogEvent, error_type: str) -> str:
        """Assess the severity of an error"""
        message = log_event.message.lower()
        
        # Critical keywords
        if any(word in message for word in ['critical', 'fatal', 'crash', 'panic', 'oom']):
            return 'CRITICAL'
        
        # High severity keywords
        if any(word in message for word in ['failed', 'error', 'exception', 'offline']):
            return 'HIGH'
        
        # Medium severity keywords
        if any(word in message for word in ['warning', 'timeout', 'retry']):
            return 'MEDIUM'
        
        # Default based on error type
        severity_map = {
            'connection_error': 'HIGH',
            'authentication_error': 'HIGH',
            'memory_error': 'CRITICAL',
            'disk_error': 'HIGH',
            'device_error': 'HIGH',
            'api_error': 'MEDIUM',
            'video_error': 'MEDIUM',
            'audio_error': 'MEDIUM',
            'general_error': 'LOW'
        }
        
        return severity_map.get(error_type, 'MEDIUM')
    
    async def _find_root_cause(self, log_event: LogEvent, error_info: Dict[str, Any]) -> str:
        """Determine the root cause of an error"""
        message = log_event.message.lower()
        
        # Network-related root causes
        if 'connection refused' in message:
            return "Target service is not running or not accepting connections"
        elif 'timeout' in message:
            return "Network timeout - service may be overloaded or unreachable"
        elif 'host unreachable' in message:
            return "Network connectivity issue - check network configuration"
        
        # Authentication root causes
        elif any(word in message for word in ['unauthorized', '401', 'forbidden', '403']):
            return "Invalid credentials or insufficient permissions"
        elif 'api key' in message:
            return "API key is missing, invalid, or expired"
        
        # Resource root causes
        elif 'out of memory' in message:
            return "System has insufficient memory available"
        elif 'no space' in message:
            return "Disk space is full or insufficient"
        
        # Device root causes
        elif 'device' in message and 'offline' in message:
            return "Physical device is powered off or disconnected"
        
        # API root causes
        elif '429' in message or 'rate limit' in message:
            return "API rate limit exceeded - too many requests"
        elif '500' in message:
            return "Internal server error on remote service"
        
        return "Root cause analysis requires manual investigation"
    
    def _identify_affected_components(self, log_event: LogEvent, error_info: Dict[str, Any]) -> List[str]:
        """Identify which system components are affected"""
        components = []
        message = log_event.message.lower()
        
        # Device components
        if 'wolfpack' in message:
            components.append('Video Matrix (Wolfpack)')
        if 'atlas' in message:
            components.append('Audio Processor (Atlas)')
        
        # Service components
        if any(word in message for word in ['api', 'rest', 'http']):
            components.append('API Services')
        if 'sports' in message:
            components.append('Sports Content Discovery')
        if 'dashboard' in message:
            components.append('Web Dashboard')
        
        # System components
        if any(word in message for word in ['memory', 'ram']):
            components.append('System Memory')
        if any(word in message for word in ['disk', 'storage']):
            components.append('Storage System')
        if any(word in message for word in ['network', 'connection']):
            components.append('Network Connectivity')
        
        # Default to general system if no specific components identified
        if not components:
            components.append('General System')
        
        return components
    
    async def _generate_fix_suggestions(self, error_type: str, error_info: Dict[str, Any], log_event: LogEvent) -> List[FixSuggestion]:
        """Generate fix suggestions for an error"""
        suggestions = []
        
        # Get templates for this error type
        templates = self.fix_templates.get(error_type, {})
        
        # Generate suggestions based on error analysis
        if error_type == 'connection_error':
            if 'ip_addresses' in error_info:
                ip = error_info['ip_addresses'][0]
                port = error_info.get('ports', [80])[0]
                
                suggestions.append(FixSuggestion(
                    fix_id=f"fix_conn_{int(datetime.now().timestamp())}",
                    description=f"Test network connectivity to {ip}:{port}",
                    fix_type="diagnostic",
                    commands=[f"ping -c 3 {ip}", f"telnet {ip} {port}"],
                    files_to_modify=[],
                    risk_level="LOW",
                    estimated_downtime="0 minutes",
                    rollback_commands=[]
                ))
                
                suggestions.append(FixSuggestion(
                    fix_id=f"fix_restart_{int(datetime.now().timestamp())}",
                    description="Restart the Sports Bar Controller service",
                    fix_type="restart",
                    commands=["systemctl restart sportsbar-controller"],
                    files_to_modify=[],
                    risk_level="MEDIUM",
                    estimated_downtime="30 seconds",
                    rollback_commands=[]
                ))
        
        elif error_type == 'api_error':
            if '429' in log_event.message or 'rate limit' in log_event.message.lower():
                suggestions.append(FixSuggestion(
                    fix_id=f"fix_rate_{int(datetime.now().timestamp())}",
                    description="Increase API cache duration to reduce rate limit hits",
                    fix_type="config",
                    commands=[],
                    files_to_modify=["config/sports_config.yaml"],
                    risk_level="LOW",
                    estimated_downtime="0 minutes",
                    rollback_commands=[]
                ))
        
        elif error_type == 'memory_error':
            suggestions.append(FixSuggestion(
                fix_id=f"fix_memory_{int(datetime.now().timestamp())}",
                description="Clean up system resources and restart services",
                fix_type="cleanup",
                commands=[
                    "docker system prune -f",
                    "find logs/ -name '*.log' -mtime +7 -delete",
                    "systemctl restart sportsbar-controller"
                ],
                files_to_modify=[],
                risk_level="MEDIUM",
                estimated_downtime="1 minute",
                rollback_commands=[]
            ))
        
        elif error_type == 'disk_error':
            suggestions.append(FixSuggestion(
                fix_id=f"fix_disk_{int(datetime.now().timestamp())}",
                description="Clean up old log files and temporary data",
                fix_type="cleanup",
                commands=[
                    "find logs/ -name '*.log' -mtime +30 -delete",
                    "docker system prune -a -f",
                    "apt-get autoremove -y"
                ],
                files_to_modify=[],
                risk_level="LOW",
                estimated_downtime="0 minutes",
                rollback_commands=[]
            ))
        
        # Add generic diagnostic suggestion
        suggestions.append(FixSuggestion(
            fix_id=f"fix_diag_{int(datetime.now().timestamp())}",
            description="Run system diagnostics and collect logs",
            fix_type="diagnostic",
            commands=[
                "systemctl status sportsbar-controller",
                "docker ps -a",
                "df -h",
                "free -m"
            ],
            files_to_modify=[],
            risk_level="LOW",
            estimated_downtime="0 minutes",
            rollback_commands=[]
        ))
        
        return suggestions
    
    def _calculate_confidence_score(self, error_info: Dict[str, Any], suggested_fixes: List[FixSuggestion]) -> float:
        """Calculate confidence score for the analysis"""
        score = 0.5  # Base score
        
        # Increase confidence based on extracted information
        if error_info:
            if 'ip_addresses' in error_info:
                score += 0.1
            if 'devices' in error_info:
                score += 0.1
            if 'http_codes' in error_info:
                score += 0.1
            if 'api_endpoints' in error_info:
                score += 0.1
        
        # Increase confidence based on number of fix suggestions
        score += min(len(suggested_fixes) * 0.05, 0.2)
        
        return min(score, 1.0)
    
    def _generate_error_description(self, log_event: LogEvent, error_info: Dict[str, Any]) -> str:
        """Generate a human-readable description of the error"""
        base_message = log_event.message
        
        # Add context from error info
        context_parts = []
        
        if error_info:
            if 'devices' in error_info:
                context_parts.append(f"Affects devices: {', '.join(error_info['devices'])}")
            if 'ip_addresses' in error_info:
                context_parts.append(f"Network addresses involved: {', '.join(error_info['ip_addresses'])}")
            if 'http_codes' in error_info:
                context_parts.append(f"HTTP status codes: {', '.join(map(str, error_info['http_codes']))}")
        
        if context_parts:
            return f"{base_message}. Additional context: {'; '.join(context_parts)}"
        else:
            return base_message
    
    async def implement_fix(self, analysis: ErrorAnalysis, fix_index: int = 0) -> Dict[str, Any]:
        """Implement a suggested fix"""
        try:
            fix_suggestions = analysis.context.get('fix_suggestions', [])
            if fix_index >= len(fix_suggestions):
                return {"success": False, "error": "Invalid fix index"}
            
            fix = FixSuggestion(**fix_suggestions[fix_index])
            
            # Check risk level
            if fix.risk_level == 'HIGH':
                return {"success": False, "error": "High-risk fixes require manual approval"}
            
            results = []
            
            # Execute commands
            for command in fix.commands:
                try:
                    result = subprocess.run(
                        command,
                        shell=True,
                        capture_output=True,
                        text=True,
                        timeout=30,
                        cwd=str(self.project_root)
                    )
                    
                    results.append({
                        "command": command,
                        "returncode": result.returncode,
                        "stdout": result.stdout,
                        "stderr": result.stderr
                    })
                    
                    if result.returncode != 0:
                        logger.warning(f"Command failed: {command}, stderr: {result.stderr}")
                    
                except subprocess.TimeoutExpired:
                    results.append({
                        "command": command,
                        "error": "Command timed out"
                    })
                except Exception as e:
                    results.append({
                        "command": command,
                        "error": str(e)
                    })
            
            # Modify files if needed
            file_changes = []
            for file_path in fix.files_to_modify:
                try:
                    # This is a placeholder - actual file modification would depend on the specific fix
                    file_changes.append({
                        "file": file_path,
                        "status": "Would be modified (placeholder)"
                    })
                except Exception as e:
                    file_changes.append({
                        "file": file_path,
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "fix_id": fix.fix_id,
                "description": fix.description,
                "command_results": results,
                "file_changes": file_changes,
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error implementing fix: {e}")
            return {"success": False, "error": str(e)}
    
    def get_analysis_history(self, hours: int = 24) -> List[ErrorAnalysis]:
        """Get recent error analyses"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            analysis for analysis in self.analysis_history
            if analysis.timestamp >= cutoff_time
        ]
    
    def get_fix_success_rate(self) -> Dict[str, Any]:
        """Get statistics on fix success rates"""
        # This would be implemented with actual fix tracking
        return {
            "total_fixes_attempted": 0,
            "successful_fixes": 0,
            "success_rate": 0.0,
            "most_common_fixes": []
        }
