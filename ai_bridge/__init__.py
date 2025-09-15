
"""
AI-to-AI Communication Bridge
============================

A distributed AI network framework that allows the local AI installation monitor
to communicate with external AI services (Grok, OpenAI, Claude, etc.) for enhanced
problem-solving capabilities, code generation, and task execution.

This module provides:
- Unified interface for multiple AI providers
- Intelligent task routing and load balancing
- Collaborative problem-solving workflows
- Enhanced troubleshooting capabilities
- Distributed code generation and review
"""

from .core.ai_bridge import AIBridge, AITask, TaskPriority
from .core.task_coordinator import TaskCoordinator
from .core.collaboration_engine import CollaborationEngine
from .providers.base_provider import BaseAIProvider, TaskType
from .providers.openai_provider import OpenAIProvider
from .providers.anthropic_provider import AnthropicProvider
from .providers.grok_provider import GrokProvider

__version__ = "1.0.0"
__author__ = "Sports Bar TV Controller AI System"

__all__ = [
    "AIBridge",
    "AITask",
    "TaskType", 
    "TaskPriority",
    "TaskCoordinator", 
    "CollaborationEngine",
    "BaseAIProvider",
    "OpenAIProvider",
    "AnthropicProvider",
    "GrokProvider"
]
