
"""
Real-time Log Monitor for Sports Bar TV Controller

This module provides real-time monitoring of log files using the watchdog library,
detecting errors, warnings, and important events in the system logs.
"""

import os
import re
import time
import logging
import threading
from pathlib import Path
from typing import Dict, List, Callable, Optional, Any
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dataclasses import dataclass

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent

logger = logging.getLogger(__name__)

@dataclass
class LogEvent:
    """Represents a log event detected by the monitor"""
    timestamp: datetime
    level: str
    message: str
    source: str
    file_path: str
    line_number: Optional[int] = None
    context: Optional[Dict[str, Any]] = None

@dataclass
class ErrorPattern:
    """Defines an error pattern to detect in logs"""
    name: str
    pattern: re.Pattern
    severity: str
    description: str
    suggested_action: str

class LogFileHandler(FileSystemEventHandler):
    """Handles file system events for log files"""
    
    def __init__(self, monitor: 'LogMonitor'):
        self.monitor = monitor
        self.file_positions = {}
        
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        file_path = event.src_path
        if self.monitor.should_monitor_file(file_path):
            self.monitor.process_file_changes(file_path)

class LogMonitor:
    """
    Real-time log monitoring system with pattern detection and alerting
    """
    
    def __init__(self, log_directories: List[str] = None, config: Dict[str, Any] = None):
        self.log_directories = log_directories or ["logs/", "backend/logs/", "/var/log/"]
        self.config = config or {}
        
        # Initialize components
        self.observer = Observer()
        self.file_handler = LogFileHandler(self)
        self.file_positions = {}
        self.event_callbacks = []
        self.error_patterns = self._initialize_error_patterns()
        
        # Statistics and history
        self.event_history = deque(maxlen=1000)
        self.error_counts = defaultdict(int)
        self.last_seen_errors = {}
        
        # Threading
        self.running = False
        self.monitor_thread = None
        
        # Rate limiting
        self.rate_limits = defaultdict(lambda: deque(maxlen=10))
        
        logger.info("LogMonitor initialized")
    
    def _initialize_error_patterns(self) -> List[ErrorPattern]:
        """Initialize common error patterns to detect"""
        patterns = [
            ErrorPattern(
                name="connection_error",
                pattern=re.compile(r"(connection|connect).*(failed|error|timeout|refused)", re.IGNORECASE),
                severity="HIGH",
                description="Device connection failure detected",
                suggested_action="Check device network connectivity and power status"
            ),
            ErrorPattern(
                name="authentication_error",
                pattern=re.compile(r"(auth|login|credential).*(failed|error|invalid|denied)", re.IGNORECASE),
                severity="HIGH",
                description="Authentication failure detected",
                suggested_action="Verify device credentials and API keys"
            ),
            ErrorPattern(
                name="api_error",
                pattern=re.compile(r"(api|http).*(error|failed|timeout|500|404|401|403)", re.IGNORECASE),
                severity="MEDIUM",
                description="API communication error detected",
                suggested_action="Check API endpoints and network connectivity"
            ),
            ErrorPattern(
                name="device_error",
                pattern=re.compile(r"(wolfpack|atlas|device).*(error|failed|offline|disconnected)", re.IGNORECASE),
                severity="HIGH",
                description="Device communication error detected",
                suggested_action="Check device status and restart if necessary"
            ),
            ErrorPattern(
                name="memory_error",
                pattern=re.compile(r"(memory|ram|oom).*(error|full|exceeded|allocation)", re.IGNORECASE),
                severity="CRITICAL",
                description="Memory-related error detected",
                suggested_action="Check system memory usage and restart services if needed"
            ),
            ErrorPattern(
                name="disk_error",
                pattern=re.compile(r"(disk|storage|space).*(full|error|failed|no space)", re.IGNORECASE),
                severity="HIGH",
                description="Disk/storage error detected",
                suggested_action="Check disk space and clean up log files if necessary"
            ),
            ErrorPattern(
                name="sports_api_error",
                pattern=re.compile(r"(sports.*api|api.*sports).*(error|failed|timeout|limit)", re.IGNORECASE),
                severity="MEDIUM",
                description="Sports API error detected",
                suggested_action="Check API keys and rate limits for sports data services"
            ),
            ErrorPattern(
                name="video_routing_error",
                pattern=re.compile(r"(video|routing|matrix).*(error|failed|invalid)", re.IGNORECASE),
                severity="MEDIUM",
                description="Video routing error detected",
                suggested_action="Check video matrix connections and input/output mappings"
            ),
            ErrorPattern(
                name="audio_processing_error",
                pattern=re.compile(r"(audio|sound|volume).*(error|failed|mute)", re.IGNORECASE),
                severity="MEDIUM",
                description="Audio processing error detected",
                suggested_action="Check audio processor status and zone configurations"
            )
        ]
        
        # Add custom patterns from config
        custom_patterns = self.config.get("custom_patterns", [])
        for pattern_config in custom_patterns:
            patterns.append(ErrorPattern(
                name=pattern_config["name"],
                pattern=re.compile(pattern_config["pattern"], re.IGNORECASE),
                severity=pattern_config.get("severity", "MEDIUM"),
                description=pattern_config.get("description", "Custom pattern detected"),
                suggested_action=pattern_config.get("suggested_action", "Review logs for details")
            ))
        
        return patterns
    
    def start_monitoring(self):
        """Start the log monitoring system"""
        if self.running:
            logger.warning("LogMonitor is already running")
            return
        
        self.running = True
        
        # Set up file system monitoring
        for log_dir in self.log_directories:
            if os.path.exists(log_dir):
                self.observer.schedule(self.file_handler, log_dir, recursive=True)
                logger.info(f"Monitoring log directory: {log_dir}")
        
        # Start observer
        self.observer.start()
        
        # Start monitoring thread
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        
        logger.info("LogMonitor started successfully")
    
    def stop_monitoring(self):
        """Stop the log monitoring system"""
        if not self.running:
            return
        
        self.running = False
        
        # Stop observer
        self.observer.stop()
        self.observer.join()
        
        # Wait for monitor thread
        if self.monitor_thread and self.monitor_thread.is_alive():
            self.monitor_thread.join(timeout=5)
        
        logger.info("LogMonitor stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                # Process any pending log files
                self._process_existing_logs()
                
                # Clean up old events
                self._cleanup_old_events()
                
                # Sleep before next iteration
                time.sleep(self.config.get("monitor_interval", 5))
                
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                time.sleep(10)  # Wait longer on error
    
    def _process_existing_logs(self):
        """Process existing log files for new content"""
        for log_dir in self.log_directories:
            if not os.path.exists(log_dir):
                continue
                
            for file_path in Path(log_dir).rglob("*.log"):
                if self.should_monitor_file(str(file_path)):
                    self.process_file_changes(str(file_path))
    
    def should_monitor_file(self, file_path: str) -> bool:
        """Check if a file should be monitored"""
        file_path = str(file_path)
        
        # Check file extension
        if not file_path.endswith(('.log', '.txt')):
            return False
        
        # Check if file exists and is readable
        if not os.path.exists(file_path) or not os.access(file_path, os.R_OK):
            return False
        
        # Check exclusion patterns
        exclude_patterns = self.config.get("exclude_patterns", [])
        for pattern in exclude_patterns:
            if re.search(pattern, file_path):
                return False
        
        return True
    
    def process_file_changes(self, file_path: str):
        """Process changes in a log file"""
        try:
            # Get current file position
            current_pos = self.file_positions.get(file_path, 0)
            
            # Check file size
            file_size = os.path.getsize(file_path)
            if file_size <= current_pos:
                return  # No new content
            
            # Read new content
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(current_pos)
                new_lines = f.readlines()
                self.file_positions[file_path] = f.tell()
            
            # Process new lines
            for line_num, line in enumerate(new_lines, start=1):
                self._process_log_line(line.strip(), file_path, current_pos + line_num)
                
        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
    
    def _process_log_line(self, line: str, file_path: str, line_number: int):
        """Process a single log line"""
        if not line.strip():
            return
        
        # Parse log line
        log_event = self._parse_log_line(line, file_path, line_number)
        if not log_event:
            return
        
        # Check against error patterns
        for pattern in self.error_patterns:
            if pattern.pattern.search(line):
                # Check rate limiting
                if self._is_rate_limited(pattern.name):
                    continue
                
                # Update statistics
                self.error_counts[pattern.name] += 1
                self.last_seen_errors[pattern.name] = datetime.now()
                
                # Create enhanced log event
                enhanced_event = LogEvent(
                    timestamp=log_event.timestamp,
                    level="ERROR",
                    message=line,
                    source=log_event.source,
                    file_path=file_path,
                    line_number=line_number,
                    context={
                        "pattern_name": pattern.name,
                        "severity": pattern.severity,
                        "description": pattern.description,
                        "suggested_action": pattern.suggested_action
                    }
                )
                
                # Add to history
                self.event_history.append(enhanced_event)
                
                # Notify callbacks
                self._notify_callbacks(enhanced_event)
                
                logger.warning(f"Detected {pattern.name}: {pattern.description}")
                break
        else:
            # Add normal event to history
            self.event_history.append(log_event)
            
            # Notify callbacks for high-level events
            if log_event.level in ["ERROR", "CRITICAL", "WARNING"]:
                self._notify_callbacks(log_event)
    
    def _parse_log_line(self, line: str, file_path: str, line_number: int) -> Optional[LogEvent]:
        """Parse a log line into a LogEvent"""
        try:
            # Common log format patterns
            patterns = [
                # Standard Python logging format
                r'(?P<timestamp>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}) - (?P<source>\S+) - (?P<level>\w+) - (?P<message>.*)',
                # ISO timestamp format
                r'(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})) (?P<level>\w+) (?P<source>\S+): (?P<message>.*)',
                # Simple format
                r'(?P<level>\w+):\s*(?P<message>.*)',
            ]
            
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    groups = match.groupdict()
                    
                    # Parse timestamp
                    timestamp = datetime.now()
                    if 'timestamp' in groups and groups['timestamp']:
                        try:
                            # Try different timestamp formats
                            ts_str = groups['timestamp']
                            for fmt in ['%Y-%m-%d %H:%M:%S,%f', '%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S']:
                                try:
                                    timestamp = datetime.strptime(ts_str, fmt)
                                    break
                                except ValueError:
                                    continue
                        except:
                            pass
                    
                    return LogEvent(
                        timestamp=timestamp,
                        level=groups.get('level', 'INFO').upper(),
                        message=groups.get('message', line),
                        source=groups.get('source', os.path.basename(file_path)),
                        file_path=file_path,
                        line_number=line_number
                    )
            
            # Fallback: create basic event
            return LogEvent(
                timestamp=datetime.now(),
                level='INFO',
                message=line,
                source=os.path.basename(file_path),
                file_path=file_path,
                line_number=line_number
            )
            
        except Exception as e:
            logger.error(f"Error parsing log line: {e}")
            return None
    
    def _is_rate_limited(self, pattern_name: str) -> bool:
        """Check if a pattern is rate limited"""
        now = datetime.now()
        rate_window = timedelta(minutes=self.config.get("rate_limit_minutes", 5))
        
        # Clean old entries
        self.rate_limits[pattern_name] = deque([
            ts for ts in self.rate_limits[pattern_name] 
            if now - ts < rate_window
        ], maxlen=10)
        
        # Check if limit exceeded
        max_occurrences = self.config.get("max_occurrences_per_window", 5)
        if len(self.rate_limits[pattern_name]) >= max_occurrences:
            return True
        
        # Add current occurrence
        self.rate_limits[pattern_name].append(now)
        return False
    
    def _cleanup_old_events(self):
        """Clean up old events from history"""
        cutoff_time = datetime.now() - timedelta(hours=self.config.get("history_hours", 24))
        
        # Clean event history
        while self.event_history and self.event_history[0].timestamp < cutoff_time:
            self.event_history.popleft()
        
        # Clean error counts (reset daily)
        if datetime.now().hour == 0 and datetime.now().minute < 5:
            self.error_counts.clear()
    
    def _notify_callbacks(self, event: LogEvent):
        """Notify registered callbacks of new events"""
        for callback in self.event_callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"Error in event callback: {e}")
    
    def add_event_callback(self, callback: Callable[[LogEvent], None]):
        """Add a callback for log events"""
        self.event_callbacks.append(callback)
    
    def remove_event_callback(self, callback: Callable[[LogEvent], None]):
        """Remove a callback for log events"""
        if callback in self.event_callbacks:
            self.event_callbacks.remove(callback)
    
    def get_recent_events(self, hours: int = 1, level: str = None) -> List[LogEvent]:
        """Get recent events from history"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        events = [
            event for event in self.event_history 
            if event.timestamp >= cutoff_time
        ]
        
        if level:
            events = [event for event in events if event.level == level.upper()]
        
        return sorted(events, key=lambda x: x.timestamp, reverse=True)
    
    def get_error_statistics(self) -> Dict[str, Any]:
        """Get error statistics"""
        return {
            "total_errors": sum(self.error_counts.values()),
            "error_counts": dict(self.error_counts),
            "last_seen_errors": {
                name: timestamp.isoformat() 
                for name, timestamp in self.last_seen_errors.items()
            },
            "monitored_directories": self.log_directories,
            "active_patterns": len(self.error_patterns)
        }
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get system health based on recent events"""
        recent_errors = self.get_recent_events(hours=1, level="ERROR")
        recent_warnings = self.get_recent_events(hours=1, level="WARNING")
        
        # Calculate health score (0-100)
        health_score = 100
        health_score -= min(len(recent_errors) * 10, 50)  # Max 50 points for errors
        health_score -= min(len(recent_warnings) * 5, 30)  # Max 30 points for warnings
        health_score = max(health_score, 0)
        
        # Determine status
        if health_score >= 90:
            status = "HEALTHY"
        elif health_score >= 70:
            status = "WARNING"
        elif health_score >= 50:
            status = "DEGRADED"
        else:
            status = "CRITICAL"
        
        return {
            "status": status,
            "health_score": health_score,
            "recent_errors": len(recent_errors),
            "recent_warnings": len(recent_warnings),
            "last_update": datetime.now().isoformat()
        }
