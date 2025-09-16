
"""
Action Executor for AI Installation Monitor

Executes automated actions with safety checks, rollback capabilities,
and comprehensive logging for installation and deployment fixes.
"""

import os
import json
import logging
import asyncio
import subprocess
import shutil
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

from .rule_engine import Action, ActionType, RiskLevel, InstallationEvent

logger = logging.getLogger(__name__)

class ExecutionResult(Enum):
    """Execution result types"""
    SUCCESS = "success"
    FAILURE = "failure"
    PARTIAL_SUCCESS = "partial_success"
    SKIPPED = "skipped"
    ROLLBACK_REQUIRED = "rollback_required"

@dataclass
class ActionExecutionResult:
    """Result of action execution"""
    action_id: str
    result: ExecutionResult
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    commands_executed: List[str]
    files_modified: List[str]
    output: str
    error_output: str
    rollback_performed: bool = False
    rollback_successful: bool = False

class SafetyChecker:
    """Safety checks for automated actions"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.max_file_size_mb = self.config.get("max_file_size_mb", 100)
        self.protected_paths = self.config.get("protected_paths", [
            "/etc", "/usr", "/var", "/boot", "/sys", "/proc"
        ])
        self.dangerous_commands = self.config.get("dangerous_commands", [
            "rm -rf /", "format", "fdisk", "mkfs", "dd if=", "shutdown", "reboot"
        ])
    
    def check_action_safety(self, action: Action) -> Tuple[bool, str]:
        """Check if action is safe to execute"""
        try:
            # Check risk level
            if action.risk_level == RiskLevel.CRITICAL:
                return False, "Critical risk level actions require manual approval"
            
            # Check commands for dangerous patterns
            for command in action.commands:
                if self._is_dangerous_command(command):
                    return False, f"Dangerous command detected: {command}"
            
            # Check file paths
            for file_path in action.files_to_modify:
                if self._is_protected_path(file_path):
                    return False, f"Protected path: {file_path}"
                
                if self._is_file_too_large(file_path):
                    return False, f"File too large: {file_path}"
            
            # Check prerequisites
            for prereq in action.prerequisites:
                if not self._check_prerequisite(prereq):
                    return False, f"Prerequisite not met: {prereq}"
            
            return True, "Action passed safety checks"
        
        except Exception as e:
            return False, f"Safety check failed: {e}"
    
    def _is_dangerous_command(self, command: str) -> bool:
        """Check if command is dangerous"""
        command_lower = command.lower()
        return any(dangerous in command_lower for dangerous in self.dangerous_commands)
    
    def _is_protected_path(self, file_path: str) -> bool:
        """Check if path is protected"""
        abs_path = os.path.abspath(file_path)
        return any(abs_path.startswith(protected) for protected in self.protected_paths)
    
    def _is_file_too_large(self, file_path: str) -> bool:
        """Check if file is too large to modify safely"""
        try:
            if os.path.exists(file_path):
                size_mb = os.path.getsize(file_path) / (1024 * 1024)
                return size_mb > self.max_file_size_mb
        except:
            pass
        return False
    
    def _check_prerequisite(self, prereq: str) -> bool:
        """Check if prerequisite is met"""
        try:
            if prereq.startswith("command_exists:"):
                command = prereq.split(":", 1)[1]
                return shutil.which(command) is not None
            
            elif prereq.startswith("file_exists:"):
                file_path = prereq.split(":", 1)[1]
                return os.path.exists(file_path)
            
            elif prereq.startswith("service_running:"):
                service = prereq.split(":", 1)[1]
                result = subprocess.run(
                    ["systemctl", "is-active", service],
                    capture_output=True,
                    text=True
                )
                return result.returncode == 0
            
            elif prereq.startswith("port_available:"):
                port = int(prereq.split(":", 1)[1])
                return self._is_port_available(port)
            
            return True
        
        except Exception as e:
            logger.error(f"Error checking prerequisite {prereq}: {e}")
            return False
    
    def _is_port_available(self, port: int) -> bool:
        """Check if port is available"""
        import socket
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            return False

class GitActions:
    """Git-specific actions"""
    
    def __init__(self, repo_path: str = "."):
        self.repo_path = Path(repo_path)
    
    async def execute_git_command(self, command: str, timeout: int = 30) -> Tuple[str, str, int]:
        """Execute git command safely"""
        try:
            # Ensure we're in the git repository
            if not (self.repo_path / ".git").exists():
                raise Exception(f"Not a git repository: {self.repo_path}")
            
            # Split command and execute
            cmd_parts = command.split()
            if cmd_parts[0] != "git":
                cmd_parts.insert(0, "git")
            
            process = await asyncio.create_subprocess_exec(
                *cmd_parts,
                cwd=self.repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            return stdout.decode(), stderr.decode(), process.returncode
        
        except asyncio.TimeoutError:
            process.kill()
            return "", "Command timed out", -1
        except Exception as e:
            return "", str(e), -1
    
    async def resolve_merge_conflict(self, file_path: str, strategy: str = "theirs") -> bool:
        """Resolve merge conflict for specific file"""
        try:
            if strategy == "ours":
                command = f"git checkout --ours {file_path}"
            elif strategy == "theirs":
                command = f"git checkout --theirs {file_path}"
            else:
                return False
            
            stdout, stderr, returncode = await self.execute_git_command(command)
            
            if returncode == 0:
                # Stage the resolved file
                stdout, stderr, returncode = await self.execute_git_command(f"git add {file_path}")
                return returncode == 0
            
            return False
        
        except Exception as e:
            logger.error(f"Error resolving conflict for {file_path}: {e}")
            return False
    
    async def create_backup_branch(self, branch_name: str = None) -> Optional[str]:
        """Create backup branch before making changes"""
        try:
            if not branch_name:
                timestamp = int(datetime.now().timestamp())
                branch_name = f"backup-{timestamp}"
            
            stdout, stderr, returncode = await self.execute_git_command(f"git branch {branch_name}")
            
            if returncode == 0:
                logger.info(f"Created backup branch: {branch_name}")
                return branch_name
            else:
                logger.error(f"Failed to create backup branch: {stderr}")
                return None
        
        except Exception as e:
            logger.error(f"Error creating backup branch: {e}")
            return None

class SystemActions:
    """System-level actions"""
    
    def __init__(self):
        pass
    
    async def execute_system_command(self, command: str, timeout: int = 30, cwd: str = None) -> Tuple[str, str, int]:
        """Execute system command safely"""
        try:
            # Split command for security
            cmd_parts = command.split()
            
            process = await asyncio.create_subprocess_exec(
                *cmd_parts,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )
            
            return stdout.decode(), stderr.decode(), process.returncode
        
        except asyncio.TimeoutError:
            process.kill()
            return "", "Command timed out", -1
        except Exception as e:
            return "", str(e), -1
    
    async def restart_service(self, service_name: str) -> bool:
        """Restart system service"""
        try:
            stdout, stderr, returncode = await self.execute_system_command(
                f"systemctl restart {service_name}",
                timeout=60
            )
            
            if returncode == 0:
                # Verify service is running
                stdout, stderr, returncode = await self.execute_system_command(
                    f"systemctl is-active {service_name}",
                    timeout=10
                )
                return returncode == 0
            
            return False
        
        except Exception as e:
            logger.error(f"Error restarting service {service_name}: {e}")
            return False
    
    async def kill_process_on_port(self, port: int) -> bool:
        """Kill process using specific port"""
        try:
            # Find process using port
            stdout, stderr, returncode = await self.execute_system_command(
                f"lsof -ti:{port}",
                timeout=10
            )
            
            if returncode == 0 and stdout.strip():
                pids = stdout.strip().split('\n')
                
                for pid in pids:
                    if pid.strip():
                        stdout, stderr, returncode = await self.execute_system_command(
                            f"kill -9 {pid.strip()}",
                            timeout=5
                        )
                        
                        if returncode == 0:
                            logger.info(f"Killed process {pid} on port {port}")
                
                return True
            
            return False
        
        except Exception as e:
            logger.error(f"Error killing process on port {port}: {e}")
            return False
    
    async def cleanup_disk_space(self, target_mb: int = 1000) -> int:
        """Clean up disk space and return MB freed"""
        freed_mb = 0
        
        try:
            # Clean Docker system
            stdout, stderr, returncode = await self.execute_system_command(
                "docker system prune -f",
                timeout=120
            )
            if returncode == 0:
                freed_mb += 100  # Estimate
            
            # Clean temp files
            stdout, stderr, returncode = await self.execute_system_command(
                "find /tmp -type f -mtime +1 -delete",
                timeout=60
            )
            if returncode == 0:
                freed_mb += 50  # Estimate
            
            # Clean old log files
            stdout, stderr, returncode = await self.execute_system_command(
                "find /var/log -name '*.log' -mtime +7 -delete",
                timeout=60
            )
            if returncode == 0:
                freed_mb += 200  # Estimate
            
            logger.info(f"Cleaned up approximately {freed_mb} MB of disk space")
            return freed_mb
        
        except Exception as e:
            logger.error(f"Error cleaning disk space: {e}")
            return freed_mb

class FileActions:
    """File system actions"""
    
    def __init__(self):
        pass
    
    async def backup_file(self, file_path: str) -> Optional[str]:
        """Create backup of file"""
        try:
            if not os.path.exists(file_path):
                return None
            
            timestamp = int(datetime.now().timestamp())
            backup_path = f"{file_path}.backup_{timestamp}"
            
            shutil.copy2(file_path, backup_path)
            logger.info(f"Created backup: {backup_path}")
            return backup_path
        
        except Exception as e:
            logger.error(f"Error backing up file {file_path}: {e}")
            return None
    
    async def restore_file(self, backup_path: str, original_path: str) -> bool:
        """Restore file from backup"""
        try:
            if not os.path.exists(backup_path):
                return False
            
            shutil.copy2(backup_path, original_path)
            logger.info(f"Restored file from backup: {original_path}")
            return True
        
        except Exception as e:
            logger.error(f"Error restoring file from {backup_path}: {e}")
            return False
    
    async def modify_config_file(self, file_path: str, changes: Dict[str, Any]) -> bool:
        """Modify configuration file safely"""
        try:
            # Create backup first
            backup_path = await self.backup_file(file_path)
            if not backup_path:
                return False
            
            # Read current content
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Apply changes (simple key=value replacement)
            for key, value in changes.items():
                pattern = f"{key}\\s*=\\s*.*"
                replacement = f"{key} = {value}"
                content = re.sub(pattern, replacement, content)
            
            # Write modified content
            with open(file_path, 'w') as f:
                f.write(content)
            
            logger.info(f"Modified config file: {file_path}")
            return True
        
        except Exception as e:
            logger.error(f"Error modifying config file {file_path}: {e}")
            # Restore from backup on error
            if backup_path:
                await self.restore_file(backup_path, file_path)
            return False

class ActionExecutor:
    """
    Main action executor that coordinates all action types
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        
        # Initialize action handlers
        self.safety_checker = SafetyChecker(self.config.get("safety", {}))
        self.git_actions = GitActions(self.config.get("repo_path", "."))
        self.system_actions = SystemActions()
        self.file_actions = FileActions()
        
        # Execution tracking
        self.execution_history: List[ActionExecutionResult] = []
        self.active_executions: Dict[str, datetime] = {}
        
        # Configuration
        self.dry_run_mode = self.config.get("dry_run_mode", False)
        self.max_concurrent_actions = self.config.get("max_concurrent_actions", 3)
        
        logger.info("ActionExecutor initialized")
    
    async def execute_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute a single action with safety checks and logging"""
        start_time = datetime.now()
        
        # Check if we're at max concurrent executions
        if len(self.active_executions) >= self.max_concurrent_actions:
            return ActionExecutionResult(
                action_id=action.action_id,
                result=ExecutionResult.SKIPPED,
                start_time=start_time,
                end_time=start_time,
                duration_seconds=0,
                commands_executed=[],
                files_modified=[],
                output="",
                error_output="Maximum concurrent actions reached"
            )
        
        # Add to active executions
        self.active_executions[action.action_id] = start_time
        
        try:
            # Safety checks
            is_safe, safety_message = self.safety_checker.check_action_safety(action)
            if not is_safe:
                return self._create_failed_result(action, start_time, f"Safety check failed: {safety_message}")
            
            # Dry run mode
            if self.dry_run_mode:
                return self._create_dry_run_result(action, start_time)
            
            # Execute based on action type
            if action.action_type == ActionType.GIT_COMMAND:
                result = await self._execute_git_action(action, event)
            elif action.action_type == ActionType.SYSTEM_COMMAND:
                result = await self._execute_system_action(action, event)
            elif action.action_type == ActionType.FILE_OPERATION:
                result = await self._execute_file_action(action, event)
            elif action.action_type == ActionType.SERVICE_OPERATION:
                result = await self._execute_service_action(action, event)
            elif action.action_type == ActionType.CONFIGURATION_CHANGE:
                result = await self._execute_config_action(action, event)
            else:
                result = self._create_failed_result(action, start_time, f"Unknown action type: {action.action_type}")
            
            # Add to history
            self.execution_history.append(result)
            
            # Keep only last 1000 executions
            if len(self.execution_history) > 1000:
                self.execution_history = self.execution_history[-1000:]
            
            return result
        
        finally:
            # Remove from active executions
            if action.action_id in self.active_executions:
                del self.active_executions[action.action_id]
    
    async def _execute_git_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute git-specific action"""
        start_time = datetime.now()
        commands_executed = []
        output_lines = []
        error_lines = []
        
        try:
            for command in action.commands:
                commands_executed.append(command)
                stdout, stderr, returncode = await self.git_actions.execute_git_command(
                    command, 
                    action.timeout_seconds
                )
                
                output_lines.append(stdout)
                if stderr:
                    error_lines.append(stderr)
                
                if returncode != 0:
                    # Command failed, attempt rollback if available
                    rollback_performed = False
                    rollback_successful = False
                    
                    if action.rollback_commands:
                        rollback_performed = True
                        rollback_successful = await self._execute_rollback(action)
                    
                    return ActionExecutionResult(
                        action_id=action.action_id,
                        result=ExecutionResult.ROLLBACK_REQUIRED if rollback_performed else ExecutionResult.FAILURE,
                        start_time=start_time,
                        end_time=datetime.now(),
                        duration_seconds=(datetime.now() - start_time).total_seconds(),
                        commands_executed=commands_executed,
                        files_modified=action.files_to_modify,
                        output='\n'.join(output_lines),
                        error_output='\n'.join(error_lines),
                        rollback_performed=rollback_performed,
                        rollback_successful=rollback_successful
                    )
            
            return ActionExecutionResult(
                action_id=action.action_id,
                result=ExecutionResult.SUCCESS,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=(datetime.now() - start_time).total_seconds(),
                commands_executed=commands_executed,
                files_modified=action.files_to_modify,
                output='\n'.join(output_lines),
                error_output='\n'.join(error_lines)
            )
        
        except Exception as e:
            return self._create_failed_result(action, start_time, str(e))
    
    async def _execute_system_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute system command action"""
        start_time = datetime.now()
        commands_executed = []
        output_lines = []
        error_lines = []
        
        try:
            for command in action.commands:
                commands_executed.append(command)
                stdout, stderr, returncode = await self.system_actions.execute_system_command(
                    command,
                    action.timeout_seconds
                )
                
                output_lines.append(stdout)
                if stderr:
                    error_lines.append(stderr)
                
                if returncode != 0:
                    rollback_performed = False
                    rollback_successful = False
                    
                    if action.rollback_commands:
                        rollback_performed = True
                        rollback_successful = await self._execute_rollback(action)
                    
                    return ActionExecutionResult(
                        action_id=action.action_id,
                        result=ExecutionResult.ROLLBACK_REQUIRED if rollback_performed else ExecutionResult.FAILURE,
                        start_time=start_time,
                        end_time=datetime.now(),
                        duration_seconds=(datetime.now() - start_time).total_seconds(),
                        commands_executed=commands_executed,
                        files_modified=action.files_to_modify,
                        output='\n'.join(output_lines),
                        error_output='\n'.join(error_lines),
                        rollback_performed=rollback_performed,
                        rollback_successful=rollback_successful
                    )
            
            return ActionExecutionResult(
                action_id=action.action_id,
                result=ExecutionResult.SUCCESS,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=(datetime.now() - start_time).total_seconds(),
                commands_executed=commands_executed,
                files_modified=action.files_to_modify,
                output='\n'.join(output_lines),
                error_output='\n'.join(error_lines)
            )
        
        except Exception as e:
            return self._create_failed_result(action, start_time, str(e))
    
    async def _execute_file_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute file operation action"""
        start_time = datetime.now()
        
        try:
            # Handle file modifications
            for file_path in action.files_to_modify:
                backup_path = await self.file_actions.backup_file(file_path)
                
                # Apply changes from parameters
                if 'changes' in action.parameters:
                    success = await self.file_actions.modify_config_file(
                        file_path, 
                        action.parameters['changes']
                    )
                    
                    if not success:
                        return self._create_failed_result(action, start_time, f"Failed to modify {file_path}")
            
            return ActionExecutionResult(
                action_id=action.action_id,
                result=ExecutionResult.SUCCESS,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=(datetime.now() - start_time).total_seconds(),
                commands_executed=[],
                files_modified=action.files_to_modify,
                output=f"Modified {len(action.files_to_modify)} files",
                error_output=""
            )
        
        except Exception as e:
            return self._create_failed_result(action, start_time, str(e))
    
    async def _execute_service_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute service operation action"""
        start_time = datetime.now()
        
        try:
            service_name = action.parameters.get('service_name', 'sportsbar-controller')
            
            if 'restart' in action.description.lower():
                success = await self.system_actions.restart_service(service_name)
            else:
                success = False
            
            result_type = ExecutionResult.SUCCESS if success else ExecutionResult.FAILURE
            
            return ActionExecutionResult(
                action_id=action.action_id,
                result=result_type,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=(datetime.now() - start_time).total_seconds(),
                commands_executed=[f"systemctl restart {service_name}"],
                files_modified=[],
                output=f"Service {service_name} {'restarted successfully' if success else 'restart failed'}",
                error_output="" if success else f"Failed to restart {service_name}"
            )
        
        except Exception as e:
            return self._create_failed_result(action, start_time, str(e))
    
    async def _execute_config_action(self, action: Action, event: InstallationEvent) -> ActionExecutionResult:
        """Execute configuration change action"""
        # Similar to file action but specifically for config files
        return await self._execute_file_action(action, event)
    
    async def _execute_rollback(self, action: Action) -> bool:
        """Execute rollback commands"""
        try:
            for command in action.rollback_commands:
                if command.startswith('git'):
                    stdout, stderr, returncode = await self.git_actions.execute_git_command(command)
                else:
                    stdout, stderr, returncode = await self.system_actions.execute_system_command(command)
                
                if returncode != 0:
                    logger.error(f"Rollback command failed: {command} - {stderr}")
                    return False
            
            logger.info(f"Rollback successful for action: {action.action_id}")
            return True
        
        except Exception as e:
            logger.error(f"Rollback failed for action {action.action_id}: {e}")
            return False
    
    def _create_failed_result(self, action: Action, start_time: datetime, error_message: str) -> ActionExecutionResult:
        """Create failed execution result"""
        return ActionExecutionResult(
            action_id=action.action_id,
            result=ExecutionResult.FAILURE,
            start_time=start_time,
            end_time=datetime.now(),
            duration_seconds=(datetime.now() - start_time).total_seconds(),
            commands_executed=[],
            files_modified=[],
            output="",
            error_output=error_message
        )
    
    def _create_dry_run_result(self, action: Action, start_time: datetime) -> ActionExecutionResult:
        """Create dry run execution result"""
        return ActionExecutionResult(
            action_id=action.action_id,
            result=ExecutionResult.SUCCESS,
            start_time=start_time,
            end_time=datetime.now(),
            duration_seconds=0.1,
            commands_executed=action.commands,
            files_modified=action.files_to_modify,
            output=f"DRY RUN: Would execute {len(action.commands)} commands",
            error_output=""
        )
    
    def get_execution_statistics(self) -> Dict[str, Any]:
        """Get execution statistics"""
        total_executions = len(self.execution_history)
        successful_executions = len([r for r in self.execution_history if r.result == ExecutionResult.SUCCESS])
        failed_executions = len([r for r in self.execution_history if r.result == ExecutionResult.FAILURE])
        rollback_executions = len([r for r in self.execution_history if r.rollback_performed])
        
        avg_duration = 0
        if self.execution_history:
            avg_duration = sum(r.duration_seconds for r in self.execution_history) / len(self.execution_history)
        
        return {
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "failed_executions": failed_executions,
            "rollback_executions": rollback_executions,
            "success_rate": successful_executions / max(total_executions, 1),
            "average_duration_seconds": avg_duration,
            "active_executions": len(self.active_executions),
            "dry_run_mode": self.dry_run_mode
        }
    
    def enable_dry_run_mode(self):
        """Enable dry run mode"""
        self.dry_run_mode = True
        logger.info("Dry run mode enabled")
    
    def disable_dry_run_mode(self):
        """Disable dry run mode"""
        self.dry_run_mode = False
        logger.info("Dry run mode disabled")
