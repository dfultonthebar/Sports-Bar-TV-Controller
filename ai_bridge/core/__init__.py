
"""
AI Bridge Core Components
========================

Core components for the AI-to-AI communication system.
"""

from .ai_bridge import AIBridge, AITask, TaskPriority
from .task_coordinator import TaskCoordinator, CoordinationStrategy
from .collaboration_engine import CollaborationEngine, WorkflowType

__all__ = [
    'AIBridge',
    'AITask',
    'TaskPriority',
    'TaskCoordinator',
    'CoordinationStrategy',
    'CollaborationEngine',
    'WorkflowType'
]
