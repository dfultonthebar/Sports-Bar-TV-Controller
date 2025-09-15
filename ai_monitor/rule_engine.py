
"""
Enhanced Rule Engine for Proactive Installation Monitoring

This module provides a sophisticated rule engine that can detect installation
issues, git conflicts, and deployment problems, then automatically apply
appropriate fixes with safety mechanisms.
"""

import os
import re
import json
import yaml
import logging
import asyncio
from typing import Dict, List, Optional, Any, Callable, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict, field
from pathlib import Path
from enum import Enum

logger = logging.getLogger(__name__)

class EventType(Enum):
    """Types of installation events"""
    GIT_OPERATION = "git_operation"
    BUILD_PROCESS = "build_process"
    DEPLOYMENT = "deployment"
    SERVICE_START = "service_start"
    HEALTH_CHECK = "health_check"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"

class ActionType(Enum):
    """Types of automated actions"""
    GIT_COMMAND = "git_command"
    SYSTEM_COMMAND = "system_command"
    FILE_OPERATION = "file_operation"
    SERVICE_OPERATION = "service_operation"
    CONFIGURATION_CHANGE = "configuration_change"
    NOTIFICATION = "notification"

class RiskLevel(Enum):
    """Risk levels for automated actions"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

@dataclass
class InstallationEvent:
    """Represents an event during installation process"""
    event_id: str
    timestamp: datetime
    event_type: EventType
    source: str
    message: str
    context: Dict[str, Any] = field(default_factory=dict)
    severity: str = "INFO"
    phase: Optional[str] = None
    process_id: Optional[int] = None

@dataclass
class Action:
    """Represents an automated action to be executed"""
    action_id: str
    action_type: ActionType
    description: str
    commands: List[str] = field(default_factory=list)
    files_to_modify: List[str] = field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    timeout_seconds: int = 30
    rollback_commands: List[str] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    prerequisites: List[str] = field(default_factory=list)

@dataclass
class Rule:
    """Represents a monitoring and response rule"""
    rule_id: str
    name: str
    description: str
    event_pattern: Union[str, re.Pattern]
    conditions: List[Dict[str, Any]] = field(default_factory=list)
    actions: List[Action] = field(default_factory=list)
    enabled: bool = True
    priority: int = 5
    cooldown_minutes: int = 5
    max_executions_per_hour: int = 10
    success_rate_threshold: float = 0.8
    last_executed: Optional[datetime] = None
    execution_count: int = 0
    success_count: int = 0

@dataclass
class RuleExecutionResult:
    """Result of rule execution"""
    rule_id: str
    success: bool
    actions_executed: List[str]
    error_message: Optional[str] = None
    execution_time_seconds: float = 0.0
    rollback_performed: bool = False

class RuleEngine:
    """
    Advanced rule engine for proactive installation monitoring
    """
    
    def __init__(self, rules_config_path: Optional[str] = None):
        self.rules: Dict[str, Rule] = {}
        self.execution_history: List[RuleExecutionResult] = []
        self.event_callbacks: List[Callable] = []
        self.running = False
        
        # Load rules configuration
        if rules_config_path and os.path.exists(rules_config_path):
            self.load_rules_from_file(rules_config_path)
        else:
            self._load_default_rules()
        
        logger.info(f"RuleEngine initialized with {len(self.rules)} rules")
    
    def _load_default_rules(self):
        """Load default installation monitoring rules"""
        default_rules = [
            # Git conflict detection and resolution
            Rule(
                rule_id="git_merge_conflict",
                name="Git Merge Conflict Detection",
                description="Detects and resolves git merge conflicts automatically",
                event_pattern=re.compile(r"CONFLICT.*Merge conflict in", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="resolve_merge_conflict",
                        action_type=ActionType.GIT_COMMAND,
                        description="Attempt automatic merge conflict resolution",
                        commands=[
                            "git status --porcelain",
                            "git diff --name-only --diff-filter=U"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        timeout_seconds=60
                    )
                ],
                priority=9,
                cooldown_minutes=2
            ),
            
            # Branch divergence handling
            Rule(
                rule_id="branch_diverged",
                name="Branch Divergence Handler",
                description="Handles diverged branches during git operations",
                event_pattern=re.compile(r"Your branch and.*have diverged", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="resolve_branch_divergence",
                        action_type=ActionType.GIT_COMMAND,
                        description="Resolve branch divergence with rebase",
                        commands=[
                            "git fetch origin",
                            "git rebase origin/main"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        rollback_commands=["git rebase --abort"],
                        timeout_seconds=120
                    )
                ],
                priority=8
            ),
            
            # Git authentication failures
            Rule(
                rule_id="git_auth_failure",
                name="Git Authentication Failure",
                description="Handles git authentication failures",
                event_pattern=re.compile(r"Authentication failed.*git|Permission denied.*git", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="check_git_credentials",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Check and refresh git credentials",
                        commands=[
                            "git config --list | grep user",
                            "ssh -T git@github.com"
                        ],
                        risk_level=RiskLevel.LOW,
                        timeout_seconds=30
                    )
                ],
                priority=7
            ),
            
            # Build failures
            Rule(
                rule_id="build_failure",
                name="Build Process Failure",
                description="Handles build process failures",
                event_pattern=re.compile(r"Build failed|compilation error|npm ERR!", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="clean_and_rebuild",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Clean build artifacts and retry build",
                        commands=[
                            "rm -rf node_modules package-lock.json",
                            "npm cache clean --force",
                            "npm install"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        timeout_seconds=300
                    )
                ],
                priority=6
            ),
            
            # Dependency conflicts
            Rule(
                rule_id="dependency_conflict",
                name="Dependency Conflict Resolution",
                description="Resolves package dependency conflicts",
                event_pattern=re.compile(r"CONFLICT.*package.*version|dependency.*conflict", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="resolve_dependencies",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Resolve dependency conflicts",
                        commands=[
                            "npm audit fix",
                            "pip install --upgrade --force-reinstall -r requirements.txt"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        timeout_seconds=180
                    )
                ],
                priority=6
            ),
            
            # Port binding failures
            Rule(
                rule_id="port_binding_failure",
                name="Port Binding Failure",
                description="Handles port already in use errors",
                event_pattern=re.compile(r"Address already in use.*port|EADDRINUSE", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="kill_port_process",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Kill process using the port and restart service",
                        commands=[
                            "lsof -ti:8000 | xargs kill -9",
                            "sleep 2"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        timeout_seconds=30
                    )
                ],
                priority=7
            ),
            
            # Service startup failures
            Rule(
                rule_id="service_startup_failure",
                name="Service Startup Failure",
                description="Handles service startup failures",
                event_pattern=re.compile(r"Failed to start|Service.*failed|systemctl.*failed", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="restart_service",
                        action_type=ActionType.SERVICE_OPERATION,
                        description="Restart failed service",
                        commands=[
                            "systemctl daemon-reload",
                            "systemctl restart sportsbar-controller"
                        ],
                        risk_level=RiskLevel.MEDIUM,
                        timeout_seconds=60
                    )
                ],
                priority=8
            ),
            
            # Disk space issues
            Rule(
                rule_id="disk_space_low",
                name="Low Disk Space Handler",
                description="Handles low disk space issues",
                event_pattern=re.compile(r"No space left on device|Disk.*full", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="cleanup_disk_space",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Clean up disk space",
                        commands=[
                            "docker system prune -f",
                            "rm -rf /tmp/*",
                            "find /var/log -name '*.log' -mtime +7 -delete"
                        ],
                        risk_level=RiskLevel.LOW,
                        timeout_seconds=120
                    )
                ],
                priority=9
            ),
            
            # Memory issues
            Rule(
                rule_id="memory_exhaustion",
                name="Memory Exhaustion Handler",
                description="Handles out of memory errors",
                event_pattern=re.compile(r"Out of memory|OOM|Memory.*exhausted", re.IGNORECASE),
                actions=[
                    Action(
                        action_id="free_memory",
                        action_type=ActionType.SYSTEM_COMMAND,
                        description="Free up system memory",
                        commands=[
                            "sync",
                            "echo 3 > /proc/sys/vm/drop_caches",
                            "systemctl restart sportsbar-controller"
                        ],
                        risk_level=RiskLevel.HIGH,
                        timeout_seconds=60
                    )
                ],
                priority=10
            )
        ]
        
        for rule in default_rules:
            self.rules[rule.rule_id] = rule
    
    def load_rules_from_file(self, config_path: str):
        """Load rules from YAML configuration file"""
        try:
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            for rule_config in config.get('rules', []):
                rule = self._create_rule_from_config(rule_config)
                self.rules[rule.rule_id] = rule
            
            logger.info(f"Loaded {len(self.rules)} rules from {config_path}")
            
        except Exception as e:
            logger.error(f"Error loading rules from {config_path}: {e}")
            self._load_default_rules()
    
    def _create_rule_from_config(self, config: Dict[str, Any]) -> Rule:
        """Create a Rule object from configuration dictionary"""
        actions = []
        for action_config in config.get('actions', []):
            action = Action(
                action_id=action_config['action_id'],
                action_type=ActionType(action_config['action_type']),
                description=action_config['description'],
                commands=action_config.get('commands', []),
                files_to_modify=action_config.get('files_to_modify', []),
                risk_level=RiskLevel(action_config.get('risk_level', 'LOW')),
                timeout_seconds=action_config.get('timeout_seconds', 30),
                rollback_commands=action_config.get('rollback_commands', []),
                parameters=action_config.get('parameters', {})
            )
            actions.append(action)
        
        pattern = config['event_pattern']
        if isinstance(pattern, str):
            pattern = re.compile(pattern, re.IGNORECASE)
        
        return Rule(
            rule_id=config['rule_id'],
            name=config['name'],
            description=config['description'],
            event_pattern=pattern,
            conditions=config.get('conditions', []),
            actions=actions,
            enabled=config.get('enabled', True),
            priority=config.get('priority', 5),
            cooldown_minutes=config.get('cooldown_minutes', 5),
            max_executions_per_hour=config.get('max_executions_per_hour', 10)
        )
    
    async def process_event(self, event: InstallationEvent) -> List[RuleExecutionResult]:
        """Process an installation event against all rules"""
        results = []
        
        if not self.running:
            return results
        
        # Find matching rules
        matching_rules = self._find_matching_rules(event)
        
        # Sort by priority (higher priority first)
        matching_rules.sort(key=lambda r: r.priority, reverse=True)
        
        # Execute rules
        for rule in matching_rules:
            if self._should_execute_rule(rule):
                result = await self._execute_rule(rule, event)
                results.append(result)
                
                # Update rule statistics
                rule.execution_count += 1
                rule.last_executed = datetime.now()
                if result.success:
                    rule.success_count += 1
        
        return results
    
    def _find_matching_rules(self, event: InstallationEvent) -> List[Rule]:
        """Find rules that match the given event"""
        matching_rules = []
        
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            
            # Check pattern match
            if isinstance(rule.event_pattern, re.Pattern):
                if rule.event_pattern.search(event.message):
                    matching_rules.append(rule)
            elif isinstance(rule.event_pattern, str):
                if rule.event_pattern.lower() in event.message.lower():
                    matching_rules.append(rule)
            
            # Check additional conditions
            if self._check_rule_conditions(rule, event):
                if rule not in matching_rules:
                    matching_rules.append(rule)
        
        return matching_rules
    
    def _check_rule_conditions(self, rule: Rule, event: InstallationEvent) -> bool:
        """Check if rule conditions are met"""
        for condition in rule.conditions:
            condition_type = condition.get('type')
            
            if condition_type == 'event_type':
                if event.event_type.value != condition.get('value'):
                    return False
            
            elif condition_type == 'severity':
                if event.severity != condition.get('value'):
                    return False
            
            elif condition_type == 'context_key':
                key = condition.get('key')
                expected_value = condition.get('value')
                if event.context.get(key) != expected_value:
                    return False
            
            elif condition_type == 'time_range':
                current_hour = datetime.now().hour
                start_hour = condition.get('start_hour', 0)
                end_hour = condition.get('end_hour', 23)
                if not (start_hour <= current_hour <= end_hour):
                    return False
        
        return True
    
    def _should_execute_rule(self, rule: Rule) -> bool:
        """Check if rule should be executed based on cooldown and rate limits"""
        now = datetime.now()
        
        # Check cooldown
        if rule.last_executed:
            cooldown_period = timedelta(minutes=rule.cooldown_minutes)
            if now - rule.last_executed < cooldown_period:
                return False
        
        # Check hourly rate limit
        one_hour_ago = now - timedelta(hours=1)
        recent_executions = [
            result for result in self.execution_history
            if result.rule_id == rule.rule_id and 
            datetime.fromisoformat(result.rule_id.split('_')[-1]) > one_hour_ago
        ]
        
        if len(recent_executions) >= rule.max_executions_per_hour:
            return False
        
        # Check success rate threshold
        if rule.execution_count > 5:  # Only check after some executions
            success_rate = rule.success_count / rule.execution_count
            if success_rate < rule.success_rate_threshold:
                logger.warning(f"Rule {rule.rule_id} disabled due to low success rate: {success_rate:.2f}")
                rule.enabled = False
                return False
        
        return True
    
    async def _execute_rule(self, rule: Rule, event: InstallationEvent) -> RuleExecutionResult:
        """Execute a rule's actions"""
        start_time = datetime.now()
        executed_actions = []
        rollback_performed = False
        error_message = None
        
        try:
            logger.info(f"Executing rule: {rule.name} for event: {event.event_id}")
            
            for action in rule.actions:
                try:
                    # Execute action (this would be implemented by ActionExecutor)
                    await self._execute_action(action, event)
                    executed_actions.append(action.action_id)
                    
                except Exception as action_error:
                    logger.error(f"Action {action.action_id} failed: {action_error}")
                    
                    # Attempt rollback if available
                    if action.rollback_commands:
                        try:
                            await self._execute_rollback(action)
                            rollback_performed = True
                        except Exception as rollback_error:
                            logger.error(f"Rollback failed for {action.action_id}: {rollback_error}")
                    
                    error_message = str(action_error)
                    break
            
            execution_time = (datetime.now() - start_time).total_seconds()
            success = error_message is None
            
            result = RuleExecutionResult(
                rule_id=rule.rule_id,
                success=success,
                actions_executed=executed_actions,
                error_message=error_message,
                execution_time_seconds=execution_time,
                rollback_performed=rollback_performed
            )
            
            self.execution_history.append(result)
            
            # Notify callbacks
            for callback in self.event_callbacks:
                try:
                    await callback(rule, event, result)
                except Exception as callback_error:
                    logger.error(f"Event callback failed: {callback_error}")
            
            return result
            
        except Exception as e:
            logger.error(f"Rule execution failed: {e}")
            execution_time = (datetime.now() - start_time).total_seconds()
            
            return RuleExecutionResult(
                rule_id=rule.rule_id,
                success=False,
                actions_executed=executed_actions,
                error_message=str(e),
                execution_time_seconds=execution_time,
                rollback_performed=rollback_performed
            )
    
    async def _execute_action(self, action: Action, event: InstallationEvent):
        """Execute a single action (placeholder - would be implemented by ActionExecutor)"""
        # This is a placeholder - actual implementation would be in ActionExecutor
        logger.info(f"Executing action: {action.description}")
        await asyncio.sleep(0.1)  # Simulate action execution
    
    async def _execute_rollback(self, action: Action):
        """Execute rollback commands for an action"""
        logger.info(f"Executing rollback for action: {action.action_id}")
        for command in action.rollback_commands:
            logger.info(f"Rollback command: {command}")
            # Actual command execution would be implemented here
            await asyncio.sleep(0.1)
    
    def add_rule(self, rule: Rule):
        """Add a new rule to the engine"""
        self.rules[rule.rule_id] = rule
        logger.info(f"Added rule: {rule.name}")
    
    def remove_rule(self, rule_id: str):
        """Remove a rule from the engine"""
        if rule_id in self.rules:
            del self.rules[rule_id]
            logger.info(f"Removed rule: {rule_id}")
    
    def enable_rule(self, rule_id: str):
        """Enable a rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = True
            logger.info(f"Enabled rule: {rule_id}")
    
    def disable_rule(self, rule_id: str):
        """Disable a rule"""
        if rule_id in self.rules:
            self.rules[rule_id].enabled = False
            logger.info(f"Disabled rule: {rule_id}")
    
    def get_rule_statistics(self) -> Dict[str, Any]:
        """Get statistics about rule execution"""
        total_rules = len(self.rules)
        enabled_rules = len([r for r in self.rules.values() if r.enabled])
        total_executions = sum(r.execution_count for r in self.rules.values())
        successful_executions = sum(r.success_count for r in self.rules.values())
        
        return {
            "total_rules": total_rules,
            "enabled_rules": enabled_rules,
            "total_executions": total_executions,
            "successful_executions": successful_executions,
            "success_rate": successful_executions / max(total_executions, 1),
            "recent_executions": len(self.execution_history),
            "rules": {
                rule_id: {
                    "name": rule.name,
                    "enabled": rule.enabled,
                    "executions": rule.execution_count,
                    "successes": rule.success_count,
                    "success_rate": rule.success_count / max(rule.execution_count, 1),
                    "last_executed": rule.last_executed.isoformat() if rule.last_executed else None
                }
                for rule_id, rule in self.rules.items()
            }
        }
    
    def add_event_callback(self, callback: Callable):
        """Add callback for rule execution events"""
        self.event_callbacks.append(callback)
    
    def start(self):
        """Start the rule engine"""
        self.running = True
        logger.info("RuleEngine started")
    
    def stop(self):
        """Stop the rule engine"""
        self.running = False
        logger.info("RuleEngine stopped")
