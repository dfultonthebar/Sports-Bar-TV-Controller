
"""
Task Coordinator
================

Intelligent task routing and coordination system for distributed AI processing.
Manages task prioritization, load balancing, and collaborative workflows.
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
import json
from collections import defaultdict, deque

from .ai_bridge import AITask, TaskPriority
from ..providers.base_provider import TaskType, BaseAIProvider

logger = logging.getLogger(__name__)

class CoordinationStrategy(Enum):
    """Task coordination strategies"""
    SINGLE_BEST = "single_best"           # Route to single best provider
    PARALLEL_CONSENSUS = "parallel_consensus"  # Multiple providers, consensus
    SEQUENTIAL_REFINEMENT = "sequential_refinement"  # Chain providers
    LOAD_BALANCED = "load_balanced"       # Distribute based on load
    COST_OPTIMIZED = "cost_optimized"     # Minimize cost
    SPEED_OPTIMIZED = "speed_optimized"   # Minimize latency

@dataclass
class TaskRoute:
    """Represents a routing decision for a task"""
    task_id: str
    strategy: CoordinationStrategy
    primary_providers: List[str]
    fallback_providers: List[str] = field(default_factory=list)
    estimated_cost: float = 0.0
    estimated_time: float = 0.0
    confidence_threshold: float = 0.8

@dataclass
class ProviderLoad:
    """Track provider load and performance"""
    provider_name: str
    active_tasks: int = 0
    queue_length: int = 0
    avg_response_time: float = 0.0
    success_rate: float = 1.0
    last_updated: float = field(default_factory=time.time)

class TaskCoordinator:
    """
    Intelligent task coordination and routing system.
    
    Features:
    - Smart provider selection based on task type and requirements
    - Load balancing across providers
    - Cost and performance optimization
    - Collaborative workflows with multiple providers
    - Adaptive routing based on historical performance
    """
    
    def __init__(self, providers: Dict[str, BaseAIProvider], config: Dict[str, Any] = None):
        self.providers = providers
        self.config = config or {}
        
        # Provider load tracking
        self.provider_loads: Dict[str, ProviderLoad] = {}
        for provider_name in providers.keys():
            self.provider_loads[provider_name] = ProviderLoad(provider_name)
        
        # Task routing history
        self.routing_history: deque = deque(maxlen=1000)
        self.performance_history: Dict[str, List[float]] = defaultdict(list)
        
        # Strategy preferences by task type
        self.strategy_preferences = {
            TaskType.TROUBLESHOOTING: CoordinationStrategy.PARALLEL_CONSENSUS,
            TaskType.CODE_GENERATION: CoordinationStrategy.SEQUENTIAL_REFINEMENT,
            TaskType.CODE_REVIEW: CoordinationStrategy.PARALLEL_CONSENSUS,
            TaskType.ANALYSIS: CoordinationStrategy.PARALLEL_CONSENSUS,
            TaskType.OPTIMIZATION: CoordinationStrategy.SINGLE_BEST,
            TaskType.DOCUMENTATION: CoordinationStrategy.SINGLE_BEST,
            TaskType.TESTING: CoordinationStrategy.LOAD_BALANCED,
            TaskType.DEPLOYMENT: CoordinationStrategy.SINGLE_BEST,
            TaskType.MONITORING: CoordinationStrategy.SPEED_OPTIMIZED,
            TaskType.GENERAL: CoordinationStrategy.LOAD_BALANCED
        }
        
        # Provider specializations
        self.provider_specializations = {
            'openai': [TaskType.CODE_GENERATION, TaskType.GENERAL, TaskType.DOCUMENTATION],
            'anthropic': [TaskType.ANALYSIS, TaskType.CODE_REVIEW, TaskType.TROUBLESHOOTING],
            'grok': [TaskType.MONITORING, TaskType.TROUBLESHOOTING, TaskType.OPTIMIZATION]
        }
    
    def route_task(self, task: AITask) -> TaskRoute:
        """
        Determine the optimal routing strategy for a task.
        
        Args:
            task: The task to route
            
        Returns:
            TaskRoute with routing decisions
        """
        # Determine strategy
        strategy = self._select_strategy(task)
        
        # Select providers based on strategy
        if strategy == CoordinationStrategy.SINGLE_BEST:
            primary_providers = [self._select_best_provider(task)]
            fallback_providers = self._select_fallback_providers(task, primary_providers)
            
        elif strategy == CoordinationStrategy.PARALLEL_CONSENSUS:
            primary_providers = self._select_consensus_providers(task)
            fallback_providers = []
            
        elif strategy == CoordinationStrategy.SEQUENTIAL_REFINEMENT:
            primary_providers = self._select_refinement_chain(task)
            fallback_providers = []
            
        elif strategy == CoordinationStrategy.LOAD_BALANCED:
            primary_providers = [self._select_least_loaded_provider(task)]
            fallback_providers = self._select_fallback_providers(task, primary_providers)
            
        elif strategy == CoordinationStrategy.COST_OPTIMIZED:
            primary_providers = [self._select_cheapest_provider(task)]
            fallback_providers = self._select_fallback_providers(task, primary_providers)
            
        elif strategy == CoordinationStrategy.SPEED_OPTIMIZED:
            primary_providers = [self._select_fastest_provider(task)]
            fallback_providers = self._select_fallback_providers(task, primary_providers)
            
        else:
            # Default to single best
            primary_providers = [self._select_best_provider(task)]
            fallback_providers = self._select_fallback_providers(task, primary_providers)
        
        # Estimate cost and time
        estimated_cost = self._estimate_route_cost(task, primary_providers)
        estimated_time = self._estimate_route_time(task, primary_providers, strategy)
        
        route = TaskRoute(
            task_id=task.task_id,
            strategy=strategy,
            primary_providers=primary_providers,
            fallback_providers=fallback_providers,
            estimated_cost=estimated_cost,
            estimated_time=estimated_time
        )
        
        # Record routing decision
        self.routing_history.append({
            'task_id': task.task_id,
            'task_type': task.task_type.value,
            'strategy': strategy.value,
            'providers': primary_providers,
            'timestamp': time.time()
        })
        
        return route
    
    def _select_strategy(self, task: AITask) -> CoordinationStrategy:
        """Select coordination strategy based on task characteristics"""
        # Check for explicit strategy preference
        if task.requirements.get('strategy'):
            try:
                return CoordinationStrategy(task.requirements['strategy'])
            except ValueError:
                pass
        
        # Use task type preference
        base_strategy = self.strategy_preferences.get(task.task_type, CoordinationStrategy.SINGLE_BEST)
        
        # Adjust based on priority and requirements
        if task.priority == TaskPriority.CRITICAL:
            # Critical tasks get parallel consensus for reliability
            if base_strategy == CoordinationStrategy.SINGLE_BEST:
                return CoordinationStrategy.PARALLEL_CONSENSUS
        
        if task.requirements.get('speed_critical', False):
            return CoordinationStrategy.SPEED_OPTIMIZED
        
        if task.requirements.get('cost_sensitive', False):
            return CoordinationStrategy.COST_OPTIMIZED
        
        if task.requirements.get('high_accuracy', False):
            return CoordinationStrategy.PARALLEL_CONSENSUS
        
        return base_strategy
    
    def _select_best_provider(self, task: AITask) -> str:
        """Select the best single provider for a task"""
        available_providers = self._get_available_providers(task)
        
        if not available_providers:
            raise ValueError("No available providers for task")
        
        # Score providers based on multiple factors
        provider_scores = {}
        
        for provider_name in available_providers:
            score = self._calculate_provider_score(provider_name, task)
            provider_scores[provider_name] = score
        
        # Return highest scoring provider
        return max(provider_scores.items(), key=lambda x: x[1])[0]
    
    def _select_consensus_providers(self, task: AITask, num_providers: int = 2) -> List[str]:
        """Select multiple providers for consensus-based processing"""
        available_providers = self._get_available_providers(task)
        
        if len(available_providers) < num_providers:
            num_providers = len(available_providers)
        
        # Score and rank providers
        provider_scores = {}
        for provider_name in available_providers:
            score = self._calculate_provider_score(provider_name, task)
            provider_scores[provider_name] = score
        
        # Select top N providers
        sorted_providers = sorted(provider_scores.items(), key=lambda x: x[1], reverse=True)
        return [provider for provider, _ in sorted_providers[:num_providers]]
    
    def _select_refinement_chain(self, task: AITask) -> List[str]:
        """Select providers for sequential refinement"""
        available_providers = self._get_available_providers(task)
        
        if len(available_providers) < 2:
            return available_providers
        
        # For code generation, use a fast provider first, then a thorough one
        if task.task_type == TaskType.CODE_GENERATION:
            fast_providers = ['grok', 'openai']  # Generally faster
            thorough_providers = ['anthropic', 'openai']  # Generally more thorough
            
            chain = []
            
            # First: fast generation
            for provider in fast_providers:
                if provider in available_providers:
                    chain.append(provider)
                    break
            
            # Second: refinement and review
            for provider in thorough_providers:
                if provider in available_providers and provider not in chain:
                    chain.append(provider)
                    break
            
            return chain if len(chain) >= 2 else available_providers[:2]
        
        # Default: select top 2 providers
        return self._select_consensus_providers(task, 2)
    
    def _select_least_loaded_provider(self, task: AITask) -> str:
        """Select provider with lowest current load"""
        available_providers = self._get_available_providers(task)
        
        if not available_providers:
            raise ValueError("No available providers for task")
        
        # Find provider with lowest load
        min_load = float('inf')
        best_provider = available_providers[0]
        
        for provider_name in available_providers:
            load = self.provider_loads[provider_name]
            current_load = load.active_tasks + (load.queue_length * 0.5)
            
            if current_load < min_load:
                min_load = current_load
                best_provider = provider_name
        
        return best_provider
    
    def _select_cheapest_provider(self, task: AITask) -> str:
        """Select most cost-effective provider"""
        available_providers = self._get_available_providers(task)
        
        if not available_providers:
            raise ValueError("No available providers for task")
        
        # Estimate costs for each provider
        provider_costs = {}
        prompt_length = len(task.description) + len(str(task.context))
        
        for provider_name in available_providers:
            provider = self.providers[provider_name]
            cost = provider.estimate_cost(prompt_length, task.requirements.get('max_tokens', 1000))
            provider_costs[provider_name] = cost
        
        # Return cheapest provider
        return min(provider_costs.items(), key=lambda x: x[1])[0]
    
    def _select_fastest_provider(self, task: AITask) -> str:
        """Select fastest responding provider"""
        available_providers = self._get_available_providers(task)
        
        if not available_providers:
            raise ValueError("No available providers for task")
        
        # Find provider with best response time
        best_time = float('inf')
        best_provider = available_providers[0]
        
        for provider_name in available_providers:
            load = self.provider_loads[provider_name]
            avg_time = load.avg_response_time
            
            if avg_time < best_time:
                best_time = avg_time
                best_provider = provider_name
        
        return best_provider
    
    def _select_fallback_providers(self, task: AITask, exclude: List[str]) -> List[str]:
        """Select fallback providers excluding already selected ones"""
        available_providers = self._get_available_providers(task)
        fallback_providers = [p for p in available_providers if p not in exclude]
        
        # Sort by score and return top 2
        provider_scores = {}
        for provider_name in fallback_providers:
            score = self._calculate_provider_score(provider_name, task)
            provider_scores[provider_name] = score
        
        sorted_providers = sorted(provider_scores.items(), key=lambda x: x[1], reverse=True)
        return [provider for provider, _ in sorted_providers[:2]]
    
    def _get_available_providers(self, task: AITask) -> List[str]:
        """Get list of providers available for a task"""
        available = []
        
        for provider_name, provider in self.providers.items():
            # Check if provider is available
            if not provider.is_available():
                continue
            
            # Check if provider supports task type
            if task.task_type not in provider.get_capabilities():
                continue
            
            # Check preferred providers
            if task.preferred_providers and provider_name not in task.preferred_providers:
                continue
            
            # Check provider health
            load = self.provider_loads[provider_name]
            if load.success_rate < 0.5:  # Skip unhealthy providers
                continue
            
            available.append(provider_name)
        
        return available
    
    def _calculate_provider_score(self, provider_name: str, task: AITask) -> float:
        """Calculate a score for provider suitability for a task"""
        load = self.provider_loads[provider_name]
        provider = self.providers[provider_name]
        
        # Base score from success rate
        score = load.success_rate * 100
        
        # Bonus for specialization
        specializations = self.provider_specializations.get(provider_name, [])
        if task.task_type in specializations:
            score += 20
        
        # Penalty for high load
        current_load = load.active_tasks + load.queue_length
        if current_load > 5:
            score -= current_load * 2
        
        # Bonus for fast response time
        if load.avg_response_time < 5.0:
            score += 10
        elif load.avg_response_time > 30.0:
            score -= 10
        
        # Priority-based adjustments
        if task.priority == TaskPriority.CRITICAL:
            # Prefer reliable providers for critical tasks
            score += load.success_rate * 20
        
        return score
    
    def _estimate_route_cost(self, task: AITask, providers: List[str]) -> float:
        """Estimate total cost for routing strategy"""
        total_cost = 0.0
        prompt_length = len(task.description) + len(str(task.context))
        max_tokens = task.requirements.get('max_tokens', 1000)
        
        for provider_name in providers:
            provider = self.providers[provider_name]
            cost = provider.estimate_cost(prompt_length, max_tokens)
            total_cost += cost
        
        return total_cost
    
    def _estimate_route_time(self, task: AITask, providers: List[str], strategy: CoordinationStrategy) -> float:
        """Estimate total execution time for routing strategy"""
        if strategy == CoordinationStrategy.PARALLEL_CONSENSUS:
            # Parallel execution - time is max of all providers
            max_time = 0.0
            for provider_name in providers:
                load = self.provider_loads[provider_name]
                estimated_time = load.avg_response_time + (load.queue_length * 2)
                max_time = max(max_time, estimated_time)
            return max_time
            
        elif strategy == CoordinationStrategy.SEQUENTIAL_REFINEMENT:
            # Sequential execution - sum of all providers
            total_time = 0.0
            for provider_name in providers:
                load = self.provider_loads[provider_name]
                estimated_time = load.avg_response_time + (load.queue_length * 2)
                total_time += estimated_time
            return total_time
            
        else:
            # Single provider strategies
            if providers:
                load = self.provider_loads[providers[0]]
                return load.avg_response_time + (load.queue_length * 2)
            return 0.0
    
    def update_provider_load(self, provider_name: str, active_tasks: int, queue_length: int = 0):
        """Update provider load information"""
        if provider_name in self.provider_loads:
            load = self.provider_loads[provider_name]
            load.active_tasks = active_tasks
            load.queue_length = queue_length
            load.last_updated = time.time()
    
    def record_task_completion(self, task_id: str, provider_name: str, success: bool, execution_time: float):
        """Record task completion for performance tracking"""
        # Update provider performance history
        self.performance_history[provider_name].append(execution_time)
        
        # Keep only recent history
        if len(self.performance_history[provider_name]) > 100:
            self.performance_history[provider_name] = self.performance_history[provider_name][-100:]
        
        # Update provider load metrics
        if provider_name in self.provider_loads:
            load = self.provider_loads[provider_name]
            
            # Update average response time (exponential moving average)
            alpha = 0.1
            if load.avg_response_time == 0:
                load.avg_response_time = execution_time
            else:
                load.avg_response_time = alpha * execution_time + (1 - alpha) * load.avg_response_time
    
    def get_routing_stats(self) -> Dict[str, Any]:
        """Get routing statistics and performance metrics"""
        stats = {
            'total_routes': len(self.routing_history),
            'strategy_distribution': defaultdict(int),
            'provider_utilization': {},
            'average_response_times': {}
        }
        
        # Strategy distribution
        for route in self.routing_history:
            stats['strategy_distribution'][route['strategy']] += 1
        
        # Provider utilization and performance
        for provider_name, load in self.provider_loads.items():
            stats['provider_utilization'][provider_name] = {
                'active_tasks': load.active_tasks,
                'success_rate': load.success_rate,
                'avg_response_time': load.avg_response_time
            }
        
        # Average response times from history
        for provider_name, times in self.performance_history.items():
            if times:
                stats['average_response_times'][provider_name] = sum(times) / len(times)
        
        return dict(stats)
    
    def optimize_routing(self):
        """Optimize routing strategies based on historical performance"""
        # Analyze recent performance
        recent_routes = list(self.routing_history)[-100:]  # Last 100 routes
        
        # TODO: Implement machine learning-based optimization
        # For now, just log current performance
        logger.info(f"Routing optimization: {len(recent_routes)} recent routes analyzed")
        
        # Simple optimization: adjust strategy preferences based on success rates
        for task_type in TaskType:
            # Find best performing strategy for each task type
            strategy_performance = defaultdict(list)
            
            for route in recent_routes:
                if route.get('task_type') == task_type.value:
                    # TODO: Track success rates by strategy
                    pass
            
            # Update preferences based on performance
            # This is a placeholder for more sophisticated optimization
