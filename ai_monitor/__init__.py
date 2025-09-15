
"""
Enhanced AI Installation Monitor

Proactive monitoring and self-healing system for installation processes,
git operations, and deployment issues.
"""

from .rule_engine import RuleEngine, Rule, Action, InstallationEvent
from .installation_monitor import InstallationMonitor
from .git_conflict_resolver import GitConflictResolver
from .action_executor import ActionExecutor

__version__ = "1.0.0"
__all__ = [
    "RuleEngine",
    "Rule", 
    "Action",
    "InstallationEvent",
    "InstallationMonitor",
    "GitConflictResolver",
    "ActionExecutor"
]
