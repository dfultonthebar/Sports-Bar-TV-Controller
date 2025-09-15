
"""
AI Agent System for Sports Bar TV Controller

This module provides intelligent monitoring, error analysis, and automated
system management capabilities for the Sports Bar TV Controller system.

Components:
- LogMonitor: Real-time log monitoring and pattern detection
- ErrorAnalyzer: AI-powered error analysis and fix suggestions
- TaskAutomator: Automated task execution and content discovery
- SystemManager: Intelligent system health monitoring and management
"""

from .monitor import LogMonitor
from .analyzer import ErrorAnalyzer
from .tasks import TaskAutomator
from .system_manager import SystemManager

__version__ = "1.0.0"
__all__ = ["LogMonitor", "ErrorAnalyzer", "TaskAutomator", "SystemManager"]
