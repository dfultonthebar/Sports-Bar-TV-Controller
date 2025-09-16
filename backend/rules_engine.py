
"""
Rules Engine for Sports Bar TV Controller
Provides a flexible, YAML/JSON-based rules system for system automation and decision making
"""

import json
import yaml
import logging
import time
import re
from typing import Dict, List, Any, Optional, Callable, Union
from dataclasses import dataclass, asdict
from pathlib import Path
from datetime import datetime, timedelta
import operator
import importlib

logger = logging.getLogger(__name__)

@dataclass
class RuleCondition:
    """Represents a single condition in a rule"""
    field: str
    operator: str  # eq, ne, gt, lt, gte, lte, in, not_in, contains, regex
    value: Any
    type: str = "simple"  # simple, compound

@dataclass
class RuleAction:
    """Represents an action to be taken when a rule matches"""
    type: str  # log, alert, execute, api_call, service_restart
    parameters: Dict[str, Any]
    priority: int = 1

@dataclass
class Rule:
    """Represents a complete rule with conditions and actions"""
    id: str
    name: str
    description: str
    conditions: List[RuleCondition]
    actions: List[RuleAction]
    enabled: bool = True
    category: str = "general"
    tags: List[str] = None
    created_at: str = None
    updated_at: str = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = self.created_at

@dataclass
class RuleExecutionResult:
    """Result of rule execution"""
    rule_id: str
    matched: bool
    actions_executed: List[str]
    execution_time: float
    timestamp: str
    error: Optional[str] = None

class RuleEvaluator:
    """Evaluates rule conditions against context data"""
    
    def __init__(self):
        self.operators = {
            'eq': operator.eq,
            'ne': operator.ne,
            'gt': operator.gt,
            'lt': operator.lt,
            'gte': operator.ge,
            'lte': operator.le,
            'in': lambda x, y: x in y,
            'not_in': lambda x, y: x not in y,
            'contains': lambda x, y: y in str(x),
            'not_contains': lambda x, y: y not in str(x),
            'regex': lambda x, y: bool(re.search(y, str(x))),
            'starts_with': lambda x, y: str(x).startswith(str(y)),
            'ends_with': lambda x, y: str(x).endswith(str(y))
        }
    
    def evaluate_condition(self, condition: RuleCondition, context: Dict[str, Any]) -> bool:
        """Evaluate a single condition against context"""
        try:
            # Get field value from context using dot notation
            field_value = self._get_nested_value(context, condition.field)
            
            if field_value is None:
                return False
            
            # Get operator function
            op_func = self.operators.get(condition.operator)
            if not op_func:
                logger.error(f"Unknown operator: {condition.operator}")
                return False
            
            # Type conversion if needed
            if condition.operator in ['gt', 'lt', 'gte', 'lte']:
                try:
                    field_value = float(field_value)
                    condition.value = float(condition.value)
                except (ValueError, TypeError):
                    return False
            
            # Evaluate condition
            result = op_func(field_value, condition.value)
            logger.debug(f"Condition {condition.field} {condition.operator} {condition.value} = {result} (field_value: {field_value})")
            return result
            
        except Exception as e:
            logger.error(f"Error evaluating condition {condition.field}: {e}")
            return False
    
    def _get_nested_value(self, data: Dict[str, Any], field_path: str) -> Any:
        """Get nested value from dictionary using dot notation"""
        try:
            keys = field_path.split('.')
            value = data
            
            for key in keys:
                if isinstance(value, dict):
                    value = value.get(key)
                elif isinstance(value, list) and key.isdigit():
                    index = int(key)
                    value = value[index] if 0 <= index < len(value) else None
                else:
                    return None
                
                if value is None:
                    return None
            
            return value
            
        except Exception as e:
            logger.error(f"Error getting nested value for {field_path}: {e}")
            return None
    
    def evaluate_rule(self, rule: Rule, context: Dict[str, Any]) -> bool:
        """Evaluate all conditions in a rule (AND logic by default)"""
        if not rule.enabled:
            return False
        
        if not rule.conditions:
            return True  # No conditions means always match
        
        # Evaluate all conditions
        for condition in rule.conditions:
            if not self.evaluate_condition(condition, context):
                return False
        
        return True

class ActionExecutor:
    """Executes rule actions"""
    
    def __init__(self):
        self.action_handlers = {
            'log': self._handle_log_action,
            'alert': self._handle_alert_action,
            'execute': self._handle_execute_action,
            'api_call': self._handle_api_call_action,
            'service_restart': self._handle_service_restart_action,
            'firewall_rule': self._handle_firewall_rule_action,
            'notification': self._handle_notification_action
        }
        self.custom_handlers = {}
    
    def register_action_handler(self, action_type: str, handler: Callable):
        """Register a custom action handler"""
        self.custom_handlers[action_type] = handler
    
    def execute_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Execute a single action"""
        try:
            # Check custom handlers first
            if action.type in self.custom_handlers:
                return self.custom_handlers[action.type](action, context)
            
            # Check built-in handlers
            if action.type in self.action_handlers:
                return self.action_handlers[action.type](action, context)
            
            logger.error(f"Unknown action type: {action.type}")
            return False
            
        except Exception as e:
            logger.error(f"Error executing action {action.type}: {e}")
            return False
    
    def _handle_log_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle log action"""
        message = action.parameters.get('message', 'Rule triggered')
        level = action.parameters.get('level', 'info').upper()
        
        # Replace placeholders in message
        message = self._replace_placeholders(message, context)
        
        # Log the message
        log_func = getattr(logger, level.lower(), logger.info)
        log_func(f"Rule Action: {message}")
        
        return True
    
    def _handle_alert_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle alert action"""
        message = action.parameters.get('message', 'Alert triggered')
        severity = action.parameters.get('severity', 'medium')
        
        message = self._replace_placeholders(message, context)
        
        # In a real implementation, this would send to an alerting system
        logger.warning(f"ALERT [{severity.upper()}]: {message}")
        
        return True
    
    def _handle_execute_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle execute command action"""
        command = action.parameters.get('command')
        if not command:
            logger.error("Execute action missing command parameter")
            return False
        
        command = self._replace_placeholders(command, context)
        
        try:
            import subprocess
            result = subprocess.run(
                command, shell=True, capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                logger.info(f"Command executed successfully: {command}")
                return True
            else:
                logger.error(f"Command failed: {command}, Error: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error executing command {command}: {e}")
            return False
    
    def _handle_api_call_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle API call action"""
        url = action.parameters.get('url')
        method = action.parameters.get('method', 'GET').upper()
        headers = action.parameters.get('headers', {})
        data = action.parameters.get('data', {})
        
        if not url:
            logger.error("API call action missing URL parameter")
            return False
        
        url = self._replace_placeholders(url, context)
        
        try:
            import requests
            
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, headers=headers, json=data, timeout=10)
            else:
                logger.error(f"Unsupported HTTP method: {method}")
                return False
            
            if response.status_code < 400:
                logger.info(f"API call successful: {method} {url}")
                return True
            else:
                logger.error(f"API call failed: {method} {url}, Status: {response.status_code}")
                return False
                
        except Exception as e:
            logger.error(f"Error making API call to {url}: {e}")
            return False
    
    def _handle_service_restart_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle service restart action"""
        service_name = action.parameters.get('service')
        if not service_name:
            logger.error("Service restart action missing service parameter")
            return False
        
        try:
            import subprocess
            result = subprocess.run(
                ['sudo', 'systemctl', 'restart', service_name],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                logger.info(f"Service {service_name} restarted successfully")
                return True
            else:
                logger.error(f"Failed to restart service {service_name}: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error restarting service {service_name}: {e}")
            return False
    
    def _handle_firewall_rule_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle firewall rule action"""
        rule_action = action.parameters.get('action', 'allow')  # allow, deny, delete
        port = action.parameters.get('port')
        protocol = action.parameters.get('protocol', 'tcp')
        source_ip = action.parameters.get('source_ip')
        
        if not port:
            logger.error("Firewall rule action missing port parameter")
            return False
        
        try:
            import subprocess
            
            # Build UFW command
            if rule_action == 'allow':
                cmd = ['sudo', 'ufw', 'allow']
                if source_ip:
                    cmd.extend(['from', source_ip, 'to', 'any', 'port', str(port)])
                else:
                    cmd.append(f"{port}/{protocol}")
            elif rule_action == 'deny':
                cmd = ['sudo', 'ufw', 'deny']
                if source_ip:
                    cmd.extend(['from', source_ip, 'to', 'any', 'port', str(port)])
                else:
                    cmd.append(f"{port}/{protocol}")
            elif rule_action == 'delete':
                cmd = ['sudo', 'ufw', 'delete', 'allow', f"{port}/{protocol}"]
            else:
                logger.error(f"Unknown firewall action: {rule_action}")
                return False
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            
            if result.returncode == 0:
                logger.info(f"Firewall rule applied: {' '.join(cmd)}")
                return True
            else:
                logger.error(f"Failed to apply firewall rule: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error applying firewall rule: {e}")
            return False
    
    def _handle_notification_action(self, action: RuleAction, context: Dict[str, Any]) -> bool:
        """Handle notification action"""
        message = action.parameters.get('message', 'Notification from rules engine')
        title = action.parameters.get('title', 'Sports Bar TV Controller')
        
        message = self._replace_placeholders(message, context)
        title = self._replace_placeholders(title, context)
        
        # In a real implementation, this would send to notification service
        logger.info(f"NOTIFICATION - {title}: {message}")
        
        return True
    
    def _replace_placeholders(self, text: str, context: Dict[str, Any]) -> str:
        """Replace placeholders in text with context values"""
        if not isinstance(text, str):
            return text
        
        # Simple placeholder replacement: {field.subfield}
        import re
        
        def replace_match(match):
            field_path = match.group(1)
            value = self._get_nested_value(context, field_path)
            return str(value) if value is not None else match.group(0)
        
        return re.sub(r'\{([^}]+)\}', replace_match, text)
    
    def _get_nested_value(self, data: Dict[str, Any], field_path: str) -> Any:
        """Get nested value from dictionary using dot notation"""
        try:
            keys = field_path.split('.')
            value = data
            
            for key in keys:
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    return None
                
                if value is None:
                    return None
            
            return value
            
        except Exception:
            return None

class RulesEngine:
    """Main rules engine class"""
    
    def __init__(self, rules_directory: str = "rules"):
        self.rules_directory = Path(rules_directory)
        self.rules: Dict[str, Rule] = {}
        self.evaluator = RuleEvaluator()
        self.executor = ActionExecutor()
        self.execution_history: List[RuleExecutionResult] = []
        self.logger = logging.getLogger(__name__)
        
        # Create rules directory if it doesn't exist
        self.rules_directory.mkdir(exist_ok=True)
        
        # Load existing rules
        self.load_rules()
    
    def load_rules(self):
        """Load rules from YAML/JSON files"""
        self.rules.clear()
        
        # Load from YAML files
        for yaml_file in self.rules_directory.glob("*.yaml"):
            self._load_rules_from_file(yaml_file)
        
        for yml_file in self.rules_directory.glob("*.yml"):
            self._load_rules_from_file(yml_file)
        
        # Load from JSON files
        for json_file in self.rules_directory.glob("*.json"):
            self._load_rules_from_file(json_file)
        
        self.logger.info(f"Loaded {len(self.rules)} rules from {self.rules_directory}")
    
    def _load_rules_from_file(self, file_path: Path):
        """Load rules from a single file"""
        try:
            with open(file_path, 'r') as f:
                if file_path.suffix.lower() in ['.yaml', '.yml']:
                    data = yaml.safe_load(f)
                else:
                    data = json.load(f)
            
            # Handle both single rule and multiple rules formats
            if isinstance(data, dict):
                if 'rules' in data:
                    # Multiple rules format
                    rules_data = data['rules']
                else:
                    # Single rule format
                    rules_data = [data]
            elif isinstance(data, list):
                rules_data = data
            else:
                self.logger.error(f"Invalid rule format in {file_path}")
                return
            
            # Parse rules
            for rule_data in rules_data:
                rule = self._parse_rule_data(rule_data)
                if rule:
                    self.rules[rule.id] = rule
                    self.logger.debug(f"Loaded rule: {rule.id} - {rule.name}")
                    
        except Exception as e:
            self.logger.error(f"Error loading rules from {file_path}: {e}")
    
    def _parse_rule_data(self, rule_data: Dict[str, Any]) -> Optional[Rule]:
        """Parse rule data into Rule object"""
        try:
            # Parse conditions
            conditions = []
            for cond_data in rule_data.get('conditions', []):
                condition = RuleCondition(
                    field=cond_data['field'],
                    operator=cond_data['operator'],
                    value=cond_data['value'],
                    type=cond_data.get('type', 'simple')
                )
                conditions.append(condition)
            
            # Parse actions
            actions = []
            for action_data in rule_data.get('actions', []):
                action = RuleAction(
                    type=action_data['type'],
                    parameters=action_data.get('parameters', {}),
                    priority=action_data.get('priority', 1)
                )
                actions.append(action)
            
            # Create rule
            rule = Rule(
                id=rule_data['id'],
                name=rule_data['name'],
                description=rule_data.get('description', ''),
                conditions=conditions,
                actions=actions,
                enabled=rule_data.get('enabled', True),
                category=rule_data.get('category', 'general'),
                tags=rule_data.get('tags', []),
                created_at=rule_data.get('created_at'),
                updated_at=rule_data.get('updated_at')
            )
            
            return rule
            
        except Exception as e:
            self.logger.error(f"Error parsing rule data: {e}")
            return None
    
    def add_rule(self, rule: Rule, save_to_file: bool = True) -> bool:
        """Add a new rule"""
        try:
            self.rules[rule.id] = rule
            
            if save_to_file:
                self.save_rule_to_file(rule)
            
            self.logger.info(f"Added rule: {rule.id} - {rule.name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error adding rule {rule.id}: {e}")
            return False
    
    def save_rule_to_file(self, rule: Rule):
        """Save a rule to a YAML file"""
        try:
            file_path = self.rules_directory / f"{rule.id}.yaml"
            
            rule_data = {
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'enabled': rule.enabled,
                'category': rule.category,
                'tags': rule.tags,
                'created_at': rule.created_at,
                'updated_at': rule.updated_at,
                'conditions': [
                    {
                        'field': cond.field,
                        'operator': cond.operator,
                        'value': cond.value,
                        'type': cond.type
                    }
                    for cond in rule.conditions
                ],
                'actions': [
                    {
                        'type': action.type,
                        'parameters': action.parameters,
                        'priority': action.priority
                    }
                    for action in rule.actions
                ]
            }
            
            with open(file_path, 'w') as f:
                yaml.dump(rule_data, f, default_flow_style=False, indent=2)
            
            self.logger.debug(f"Saved rule {rule.id} to {file_path}")
            
        except Exception as e:
            self.logger.error(f"Error saving rule {rule.id}: {e}")
    
    def remove_rule(self, rule_id: str, delete_file: bool = True) -> bool:
        """Remove a rule"""
        try:
            if rule_id in self.rules:
                del self.rules[rule_id]
                
                if delete_file:
                    file_path = self.rules_directory / f"{rule_id}.yaml"
                    if file_path.exists():
                        file_path.unlink()
                
                self.logger.info(f"Removed rule: {rule_id}")
                return True
            else:
                self.logger.warning(f"Rule {rule_id} not found")
                return False
                
        except Exception as e:
            self.logger.error(f"Error removing rule {rule_id}: {e}")
            return False
    
    def evaluate_rules(self, context: Dict[str, Any]) -> List[RuleExecutionResult]:
        """Evaluate all rules against context and execute matching actions"""
        results = []
        
        for rule_id, rule in self.rules.items():
            start_time = time.time()
            
            try:
                # Evaluate rule
                matched = self.evaluator.evaluate_rule(rule, context)
                
                actions_executed = []
                error = None
                
                if matched:
                    # Execute actions
                    for action in sorted(rule.actions, key=lambda a: a.priority):
                        try:
                            success = self.executor.execute_action(action, context)
                            if success:
                                actions_executed.append(action.type)
                            else:
                                error = f"Failed to execute action: {action.type}"
                        except Exception as e:
                            error = f"Error executing action {action.type}: {e}"
                            self.logger.error(error)
                
                execution_time = time.time() - start_time
                
                result = RuleExecutionResult(
                    rule_id=rule_id,
                    matched=matched,
                    actions_executed=actions_executed,
                    execution_time=execution_time,
                    timestamp=datetime.now().isoformat(),
                    error=error
                )
                
                results.append(result)
                
                # Add to history
                self.execution_history.append(result)
                
                # Keep history limited
                if len(self.execution_history) > 1000:
                    self.execution_history = self.execution_history[-500:]
                
            except Exception as e:
                error_msg = f"Error evaluating rule {rule_id}: {e}"
                self.logger.error(error_msg)
                
                result = RuleExecutionResult(
                    rule_id=rule_id,
                    matched=False,
                    actions_executed=[],
                    execution_time=time.time() - start_time,
                    timestamp=datetime.now().isoformat(),
                    error=error_msg
                )
                results.append(result)
        
        return results
    
    def get_rules_by_category(self, category: str) -> List[Rule]:
        """Get rules by category"""
        return [rule for rule in self.rules.values() if rule.category == category]
    
    def get_rules_by_tag(self, tag: str) -> List[Rule]:
        """Get rules by tag"""
        return [rule for rule in self.rules.values() if tag in rule.tags]
    
    def get_rule_statistics(self) -> Dict[str, Any]:
        """Get rules engine statistics"""
        total_rules = len(self.rules)
        enabled_rules = len([r for r in self.rules.values() if r.enabled])
        
        categories = {}
        for rule in self.rules.values():
            categories[rule.category] = categories.get(rule.category, 0) + 1
        
        recent_executions = [r for r in self.execution_history if 
                           datetime.fromisoformat(r.timestamp) > datetime.now() - timedelta(hours=24)]
        
        return {
            "total_rules": total_rules,
            "enabled_rules": enabled_rules,
            "disabled_rules": total_rules - enabled_rules,
            "categories": categories,
            "recent_executions": len(recent_executions),
            "successful_matches": len([r for r in recent_executions if r.matched and not r.error]),
            "failed_executions": len([r for r in recent_executions if r.error]),
            "last_evaluation": self.execution_history[-1].timestamp if self.execution_history else None
        }

# Example usage and default rules
if __name__ == "__main__":
    # Create rules engine
    engine = RulesEngine("backend/rules")
    
    # Example context (would come from system diagnostics)
    context = {
        "system": {
            "cpu_percent": 85.0,
            "memory_percent": 75.0,
            "disk_percent": 90.0
        },
        "services": {
            "nginx": {"status": "running"},
            "ssh": {"status": "stopped"}
        },
        "network": {
            "internet_connectivity": False
        }
    }
    
    # Evaluate rules
    results = engine.evaluate_rules(context)
    
    print("Rule Evaluation Results:")
    for result in results:
        print(f"Rule {result.rule_id}: {'MATCHED' if result.matched else 'NO MATCH'}")
        if result.actions_executed:
            print(f"  Actions: {', '.join(result.actions_executed)}")
        if result.error:
            print(f"  Error: {result.error}")
    
    # Print statistics
    stats = engine.get_rule_statistics()
    print(f"\nRules Engine Statistics:")
    print(json.dumps(stats, indent=2))
