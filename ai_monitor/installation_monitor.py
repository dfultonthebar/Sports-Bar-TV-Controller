
"""
Installation Process Monitor

Real-time monitoring of installation processes, git operations, build processes,
and deployment phases with proactive issue detection and resolution.
"""

import os
import re
import json
import logging
import asyncio
import subprocess
import threading
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass, field

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileModifiedEvent

from .rule_engine import RuleEngine, InstallationEvent, EventType

logger = logging.getLogger(__name__)

@dataclass
class InstallationProcess:
    """Represents an ongoing installation process"""
    process_id: str
    start_time: datetime
    phase: str
    status: str  # 'running', 'completed', 'failed', 'cancelled'
    git_repo: Optional[str] = None
    branch: Optional[str] = None
    commands_executed: List[str] = field(default_factory=list)
    events: List[InstallationEvent] = field(default_factory=list)
    error_count: int = 0
    warning_count: int = 0

class ProcessMonitor:
    """Monitors system processes for installation-related activities"""
    
    def __init__(self, callback: Callable[[InstallationEvent], None]):
        self.callback = callback
        self.monitored_processes = {}
        self.running = False
        self.monitor_thread = None
    
    def start(self):
        """Start process monitoring"""
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info("ProcessMonitor started")
    
    def stop(self):
        """Stop process monitoring"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("ProcessMonitor stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                self._check_running_processes()
                asyncio.run(asyncio.sleep(2))
            except Exception as e:
                logger.error(f"Error in process monitor loop: {e}")
                asyncio.run(asyncio.sleep(5))
    
    def _check_running_processes(self):
        """Check for installation-related processes"""
        try:
            # Monitor git processes
            result = subprocess.run(['pgrep', '-f', 'git'], capture_output=True, text=True)
            if result.returncode == 0:
                for pid in result.stdout.strip().split('\n'):
                    if pid and pid not in self.monitored_processes:
                        self._monitor_git_process(int(pid))
            
            # Monitor npm/pip processes
            for process_name in ['npm', 'pip', 'docker']:
                result = subprocess.run(['pgrep', '-f', process_name], capture_output=True, text=True)
                if result.returncode == 0:
                    for pid in result.stdout.strip().split('\n'):
                        if pid and pid not in self.monitored_processes:
                            self._monitor_build_process(int(pid), process_name)
        
        except Exception as e:
            logger.error(f"Error checking processes: {e}")
    
    def _monitor_git_process(self, pid: int):
        """Monitor a specific git process"""
        try:
            # Get process command line
            with open(f'/proc/{pid}/cmdline', 'r') as f:
                cmdline = f.read().replace('\0', ' ')
            
            event = InstallationEvent(
                event_id=f"git_process_{pid}_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                event_type=EventType.GIT_OPERATION,
                source="process_monitor",
                message=f"Git process detected: {cmdline}",
                context={"pid": pid, "command": cmdline},
                phase="git_operation",
                process_id=pid
            )
            
            self.callback(event)
            self.monitored_processes[str(pid)] = datetime.now()
            
        except Exception as e:
            logger.error(f"Error monitoring git process {pid}: {e}")
    
    def _monitor_build_process(self, pid: int, process_type: str):
        """Monitor a build process (npm, pip, docker, etc.)"""
        try:
            with open(f'/proc/{pid}/cmdline', 'r') as f:
                cmdline = f.read().replace('\0', ' ')
            
            event = InstallationEvent(
                event_id=f"{process_type}_process_{pid}_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                event_type=EventType.BUILD_PROCESS,
                source="process_monitor",
                message=f"{process_type.upper()} process detected: {cmdline}",
                context={"pid": pid, "command": cmdline, "process_type": process_type},
                phase="build_process",
                process_id=pid
            )
            
            self.callback(event)
            self.monitored_processes[str(pid)] = datetime.now()
            
        except Exception as e:
            logger.error(f"Error monitoring {process_type} process {pid}: {e}")

class GitMonitor:
    """Specialized monitor for git operations"""
    
    def __init__(self, callback: Callable[[InstallationEvent], None], repo_path: str = "."):
        self.callback = callback
        self.repo_path = Path(repo_path)
        self.git_dir = self.repo_path / ".git"
        self.observer = Observer()
        self.running = False
    
    def start(self):
        """Start git monitoring"""
        if not self.git_dir.exists():
            logger.warning(f"Git directory not found: {self.git_dir}")
            return
        
        self.running = True
        
        # Monitor .git directory for changes
        handler = GitFileHandler(self.callback)
        self.observer.schedule(handler, str(self.git_dir), recursive=True)
        self.observer.start()
        
        logger.info(f"GitMonitor started for repository: {self.repo_path}")
    
    def stop(self):
        """Stop git monitoring"""
        if self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False
            logger.info("GitMonitor stopped")

class GitFileHandler(FileSystemEventHandler):
    """Handles git file system events"""
    
    def __init__(self, callback: Callable[[InstallationEvent], None]):
        self.callback = callback
    
    def on_modified(self, event):
        """Handle file modification events in .git directory"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # Monitor specific git files
        if file_path.name in ['MERGE_HEAD', 'CONFLICT', 'index']:
            self._handle_git_operation(file_path)
    
    def _handle_git_operation(self, file_path: Path):
        """Handle git operation based on file changes"""
        try:
            if file_path.name == 'MERGE_HEAD':
                # Merge operation detected
                event = InstallationEvent(
                    event_id=f"git_merge_{int(datetime.now().timestamp())}",
                    timestamp=datetime.now(),
                    event_type=EventType.GIT_OPERATION,
                    source="git_monitor",
                    message="Git merge operation detected",
                    context={"operation": "merge", "file": str(file_path)},
                    phase="git_merge"
                )
                self.callback(event)
            
            elif 'CONFLICT' in file_path.name or self._check_merge_conflicts():
                # Merge conflict detected
                event = InstallationEvent(
                    event_id=f"git_conflict_{int(datetime.now().timestamp())}",
                    timestamp=datetime.now(),
                    event_type=EventType.ERROR,
                    source="git_monitor",
                    message="CONFLICT: Merge conflict detected in git operation",
                    context={"operation": "merge_conflict", "file": str(file_path)},
                    severity="HIGH",
                    phase="git_merge"
                )
                self.callback(event)
        
        except Exception as e:
            logger.error(f"Error handling git operation: {e}")
    
    def _check_merge_conflicts(self) -> bool:
        """Check if there are merge conflicts"""
        try:
            result = subprocess.run(
                ['git', 'diff', '--name-only', '--diff-filter=U'],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent.parent
            )
            return bool(result.stdout.strip())
        except:
            return False

class LogFileMonitor:
    """Monitor log files for installation events"""
    
    def __init__(self, callback: Callable[[InstallationEvent], None], log_directories: List[str]):
        self.callback = callback
        self.log_directories = log_directories
        self.observer = Observer()
        self.file_positions = {}
        self.running = False
    
    def start(self):
        """Start log file monitoring"""
        self.running = True
        
        for log_dir in self.log_directories:
            if os.path.exists(log_dir):
                handler = LogFileHandler(self.callback, self.file_positions)
                self.observer.schedule(handler, log_dir, recursive=True)
        
        self.observer.start()
        logger.info(f"LogFileMonitor started for directories: {self.log_directories}")
    
    def stop(self):
        """Stop log file monitoring"""
        if self.running:
            self.observer.stop()
            self.observer.join()
            self.running = False
            logger.info("LogFileMonitor stopped")

class LogFileHandler(FileSystemEventHandler):
    """Handles log file events"""
    
    def __init__(self, callback: Callable[[InstallationEvent], None], file_positions: Dict[str, int]):
        self.callback = callback
        self.file_positions = file_positions
    
    def on_modified(self, event):
        """Handle log file modifications"""
        if event.is_directory or not event.src_path.endswith(('.log', '.txt')):
            return
        
        self._process_log_file(event.src_path)
    
    def _process_log_file(self, file_path: str):
        """Process new content in log file"""
        try:
            current_pos = self.file_positions.get(file_path, 0)
            file_size = os.path.getsize(file_path)
            
            if file_size <= current_pos:
                return
            
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(current_pos)
                new_lines = f.readlines()
                self.file_positions[file_path] = f.tell()
            
            for line in new_lines:
                self._process_log_line(line.strip(), file_path)
        
        except Exception as e:
            logger.error(f"Error processing log file {file_path}: {e}")
    
    def _process_log_line(self, line: str, file_path: str):
        """Process a single log line"""
        if not line.strip():
            return
        
        # Determine event type and severity based on content
        event_type = EventType.INFO
        severity = "INFO"
        
        if any(keyword in line.lower() for keyword in ['error', 'failed', 'exception']):
            event_type = EventType.ERROR
            severity = "ERROR"
        elif any(keyword in line.lower() for keyword in ['warning', 'warn']):
            event_type = EventType.WARNING
            severity = "WARNING"
        elif any(keyword in line.lower() for keyword in ['git', 'clone', 'pull', 'merge']):
            event_type = EventType.GIT_OPERATION
        elif any(keyword in line.lower() for keyword in ['build', 'compile', 'npm', 'pip']):
            event_type = EventType.BUILD_PROCESS
        
        event = InstallationEvent(
            event_id=f"log_{int(datetime.now().timestamp())}_{hash(line) % 10000}",
            timestamp=datetime.now(),
            event_type=event_type,
            source="log_monitor",
            message=line,
            context={"file_path": file_path},
            severity=severity
        )
        
        self.callback(event)

class InstallationMonitor:
    """
    Main installation monitoring system that coordinates all monitoring components
    """
    
    def __init__(self, rule_engine: RuleEngine, config: Dict[str, Any] = None):
        self.rule_engine = rule_engine
        self.config = config or {}
        
        # Initialize monitoring components
        self.process_monitor = ProcessMonitor(self._handle_event)
        self.git_monitor = GitMonitor(
            self._handle_event,
            self.config.get('repo_path', '.')
        )
        self.log_monitor = LogFileMonitor(
            self._handle_event,
            self.config.get('log_directories', ['logs/', 'backend/logs/'])
        )
        
        # Installation tracking
        self.active_installations: Dict[str, InstallationProcess] = {}
        self.installation_history: List[InstallationProcess] = []
        
        # Event callbacks
        self.event_callbacks: List[Callable] = []
        
        self.running = False
        
        logger.info("InstallationMonitor initialized")
    
    def start(self):
        """Start all monitoring components"""
        if self.running:
            logger.warning("InstallationMonitor is already running")
            return
        
        self.running = True
        
        # Start rule engine
        self.rule_engine.start()
        
        # Start monitoring components
        self.process_monitor.start()
        self.git_monitor.start()
        self.log_monitor.start()
        
        logger.info("InstallationMonitor started successfully")
    
    def stop(self):
        """Stop all monitoring components"""
        if not self.running:
            return
        
        self.running = False
        
        # Stop monitoring components
        self.process_monitor.stop()
        self.git_monitor.stop()
        self.log_monitor.stop()
        
        # Stop rule engine
        self.rule_engine.stop()
        
        logger.info("InstallationMonitor stopped")
    
    async def _handle_event(self, event: InstallationEvent):
        """Handle events from monitoring components"""
        try:
            # Update installation tracking
            self._update_installation_tracking(event)
            
            # Process event through rule engine
            results = await self.rule_engine.process_event(event)
            
            # Log rule execution results
            for result in results:
                if result.success:
                    logger.info(f"Rule {result.rule_id} executed successfully for event {event.event_id}")
                else:
                    logger.error(f"Rule {result.rule_id} failed for event {event.event_id}: {result.error_message}")
            
            # Notify callbacks
            for callback in self.event_callbacks:
                try:
                    await callback(event, results)
                except Exception as e:
                    logger.error(f"Event callback failed: {e}")
        
        except Exception as e:
            logger.error(f"Error handling event {event.event_id}: {e}")
    
    def _update_installation_tracking(self, event: InstallationEvent):
        """Update installation process tracking"""
        try:
            # Determine if this is part of an installation process
            process_id = self._get_or_create_installation_process(event)
            
            if process_id:
                installation = self.active_installations[process_id]
                installation.events.append(event)
                
                # Update counters
                if event.severity == "ERROR":
                    installation.error_count += 1
                elif event.severity == "WARNING":
                    installation.warning_count += 1
                
                # Update phase based on event
                if event.phase:
                    installation.phase = event.phase
                
                # Check if installation is complete or failed
                if self._is_installation_complete(installation):
                    installation.status = "completed"
                    self._move_to_history(process_id)
                elif self._is_installation_failed(installation):
                    installation.status = "failed"
                    self._move_to_history(process_id)
        
        except Exception as e:
            logger.error(f"Error updating installation tracking: {e}")
    
    def _get_or_create_installation_process(self, event: InstallationEvent) -> Optional[str]:
        """Get or create installation process for event"""
        # Use process ID if available
        if event.process_id:
            process_id = f"process_{event.process_id}"
            if process_id not in self.active_installations:
                self.active_installations[process_id] = InstallationProcess(
                    process_id=process_id,
                    start_time=event.timestamp,
                    phase=event.phase or "unknown",
                    status="running"
                )
            return process_id
        
        # Create installation process for git operations
        if event.event_type == EventType.GIT_OPERATION:
            process_id = f"git_{int(event.timestamp.timestamp())}"
            if process_id not in self.active_installations:
                self.active_installations[process_id] = InstallationProcess(
                    process_id=process_id,
                    start_time=event.timestamp,
                    phase="git_operation",
                    status="running"
                )
            return process_id
        
        return None
    
    def _is_installation_complete(self, installation: InstallationProcess) -> bool:
        """Check if installation is complete"""
        # Simple heuristic: if no events for 5 minutes and no errors
        if installation.events:
            last_event_time = installation.events[-1].timestamp
            time_since_last_event = datetime.now() - last_event_time
            
            if (time_since_last_event > timedelta(minutes=5) and 
                installation.error_count == 0):
                return True
        
        return False
    
    def _is_installation_failed(self, installation: InstallationProcess) -> bool:
        """Check if installation has failed"""
        # Failed if too many errors or critical error
        if installation.error_count > 5:
            return True
        
        # Check for critical errors in recent events
        recent_events = [
            e for e in installation.events[-10:]
            if e.severity in ["ERROR", "CRITICAL"]
        ]
        
        critical_patterns = [
            "fatal error",
            "installation failed",
            "cannot continue",
            "abort"
        ]
        
        for event in recent_events:
            if any(pattern in event.message.lower() for pattern in critical_patterns):
                return True
        
        return False
    
    def _move_to_history(self, process_id: str):
        """Move completed/failed installation to history"""
        if process_id in self.active_installations:
            installation = self.active_installations.pop(process_id)
            self.installation_history.append(installation)
            
            # Keep only last 100 installations in history
            if len(self.installation_history) > 100:
                self.installation_history = self.installation_history[-100:]
    
    def get_active_installations(self) -> List[InstallationProcess]:
        """Get list of active installations"""
        return list(self.active_installations.values())
    
    def get_installation_history(self, hours: int = 24) -> List[InstallationProcess]:
        """Get installation history for specified hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            installation for installation in self.installation_history
            if installation.start_time >= cutoff_time
        ]
    
    def get_installation_statistics(self) -> Dict[str, Any]:
        """Get installation statistics"""
        active_count = len(self.active_installations)
        recent_history = self.get_installation_history(24)
        
        completed_count = len([i for i in recent_history if i.status == "completed"])
        failed_count = len([i for i in recent_history if i.status == "failed"])
        
        success_rate = completed_count / max(completed_count + failed_count, 1)
        
        return {
            "active_installations": active_count,
            "completed_24h": completed_count,
            "failed_24h": failed_count,
            "success_rate_24h": success_rate,
            "total_history": len(self.installation_history),
            "rule_statistics": self.rule_engine.get_rule_statistics()
        }
    
    def add_event_callback(self, callback: Callable):
        """Add callback for installation events"""
        self.event_callbacks.append(callback)
    
    def trigger_manual_installation_check(self) -> Dict[str, Any]:
        """Manually trigger installation health check"""
        try:
            # Create manual check event
            event = InstallationEvent(
                event_id=f"manual_check_{int(datetime.now().timestamp())}",
                timestamp=datetime.now(),
                event_type=EventType.HEALTH_CHECK,
                source="manual_trigger",
                message="Manual installation health check triggered",
                context={"trigger": "manual"},
                phase="health_check"
            )
            
            # Process through rule engine
            asyncio.create_task(self._handle_event(event))
            
            return {
                "success": True,
                "message": "Manual installation check triggered",
                "event_id": event.event_id
            }
        
        except Exception as e:
            logger.error(f"Error triggering manual check: {e}")
            return {
                "success": False,
                "message": f"Failed to trigger manual check: {e}"
            }
