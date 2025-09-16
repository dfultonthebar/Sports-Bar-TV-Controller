
"""
AI Bridge - Core Communication Hub
==================================

The main orchestrator for AI-to-AI communication, managing connections to multiple
external AI services and coordinating collaborative problem-solving tasks.
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
import json
from pathlib import Path

from ..providers.base_provider import BaseAIProvider, AIResponse, TaskType
from ..utils.config_manager import ConfigManager
from ..utils.metrics_collector import MetricsCollector

logger = logging.getLogger(__name__)

class TaskPriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

@dataclass
class AITask:
    """Represents a task to be processed by AI services"""
    task_id: str
    task_type: TaskType
    priority: TaskPriority
    description: str
    context: Dict[str, Any]
    requirements: Dict[str, Any] = field(default_factory=dict)
    preferred_providers: List[str] = field(default_factory=list)
    max_attempts: int = 3
    timeout_seconds: int = 300
    created_at: float = field(default_factory=time.time)
    
class AIBridge:
    """
    Central hub for AI-to-AI communication and task coordination.
    
    Features:
    - Multi-provider support with intelligent routing
    - Load balancing and failover capabilities
    - Task prioritization and queue management
    - Collaborative problem-solving workflows
    - Performance monitoring and optimization
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_manager = ConfigManager(config_path)
        self.metrics = MetricsCollector()
        
        # Provider management
        self.providers: Dict[str, BaseAIProvider] = {}
        self.provider_health: Dict[str, Dict[str, Any]] = {}
        
        # Task management
        self.task_queue: asyncio.Queue = asyncio.Queue()
        self.active_tasks: Dict[str, AITask] = {}
        self.completed_tasks: Dict[str, Dict[str, Any]] = {}
        
        # System state
        self.running = False
        self.worker_tasks: List[asyncio.Task] = []
        
        # Initialize providers
        self._initialize_providers()
        
    def _initialize_providers(self):
        """Initialize AI service providers based on configuration"""
        provider_configs = self.config_manager.get_provider_configs()
        
        for provider_name, config in provider_configs.items():
            if not config.get('enabled', False):
                continue
                
            try:
                provider_class = self._get_provider_class(provider_name)
                if provider_class:
                    provider = provider_class(config)
                    self.providers[provider_name] = provider
                    self.provider_health[provider_name] = {
                        'status': 'initialized',
                        'last_check': time.time(),
                        'success_rate': 1.0,
                        'avg_response_time': 0.0,
                        'total_requests': 0,
                        'failed_requests': 0
                    }
                    logger.info(f"Initialized AI provider: {provider_name}")
                    
            except Exception as e:
                logger.error(f"Failed to initialize provider {provider_name}: {e}")
    
    def _get_provider_class(self, provider_name: str):
        """Get provider class by name"""
        from ..providers.openai_provider import OpenAIProvider
        from ..providers.anthropic_provider import AnthropicProvider
        from ..providers.grok_provider import GrokProvider
        
        provider_classes = {
            'openai': OpenAIProvider,
            'anthropic': AnthropicProvider,
            'grok': GrokProvider
        }
        
        return provider_classes.get(provider_name.lower())
    
    async def start(self):
        """Start the AI bridge service"""
        if self.running:
            return
            
        self.running = True
        logger.info("Starting AI Bridge service...")
        
        # Start health monitoring
        health_task = asyncio.create_task(self._health_monitor_loop())
        self.worker_tasks.append(health_task)
        
        # Start task processing workers
        num_workers = self.config_manager.get('processing.num_workers', 3)
        for i in range(num_workers):
            worker_task = asyncio.create_task(self._task_worker(f"worker-{i}"))
            self.worker_tasks.append(worker_task)
        
        # Start metrics collection
        metrics_task = asyncio.create_task(self._metrics_loop())
        self.worker_tasks.append(metrics_task)
        
        logger.info(f"AI Bridge started with {len(self.providers)} providers and {num_workers} workers")
    
    async def stop(self):
        """Stop the AI bridge service"""
        if not self.running:
            return
            
        self.running = False
        logger.info("Stopping AI Bridge service...")
        
        # Cancel all worker tasks
        for task in self.worker_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.worker_tasks, return_exceptions=True)
        self.worker_tasks.clear()
        
        # Close provider connections
        for provider in self.providers.values():
            await provider.close()
        
        logger.info("AI Bridge service stopped")
    
    async def submit_task(self, task: AITask) -> str:
        """Submit a task for processing"""
        await self.task_queue.put(task)
        self.active_tasks[task.task_id] = task
        
        logger.info(f"Task submitted: {task.task_id} ({task.task_type.value}, priority: {task.priority.value})")
        return task.task_id
    
    async def get_task_result(self, task_id: str, timeout: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Get the result of a completed task"""
        start_time = time.time()
        
        while True:
            if task_id in self.completed_tasks:
                return self.completed_tasks[task_id]
            
            if timeout and (time.time() - start_time) > timeout:
                return None
            
            await asyncio.sleep(0.1)
    
    async def collaborate_on_task(self, task: AITask, num_providers: int = 2) -> Dict[str, Any]:
        """
        Collaborative problem-solving using multiple AI providers
        
        This method sends the same task to multiple providers and combines their responses
        for enhanced problem-solving capabilities.
        """
        if num_providers > len(self.providers):
            num_providers = len(self.providers)
        
        # Select best providers for this task
        selected_providers = self._select_providers_for_task(task, num_providers)
        
        # Execute task on multiple providers concurrently
        provider_tasks = []
        for provider_name in selected_providers:
            provider = self.providers[provider_name]
            provider_task = asyncio.create_task(
                self._execute_task_on_provider(task, provider, provider_name)
            )
            provider_tasks.append((provider_name, provider_task))
        
        # Collect results
        results = {}
        for provider_name, provider_task in provider_tasks:
            try:
                result = await asyncio.wait_for(provider_task, timeout=task.timeout_seconds)
                results[provider_name] = result
            except asyncio.TimeoutError:
                logger.warning(f"Provider {provider_name} timed out for task {task.task_id}")
                results[provider_name] = {"error": "timeout"}
            except Exception as e:
                logger.error(f"Provider {provider_name} failed for task {task.task_id}: {e}")
                results[provider_name] = {"error": str(e)}
        
        # Combine and analyze results
        combined_result = self._combine_provider_results(task, results)
        
        return combined_result
    
    def _select_providers_for_task(self, task: AITask, num_providers: int) -> List[str]:
        """Select the best providers for a given task"""
        available_providers = [
            name for name, health in self.provider_health.items()
            if health['status'] == 'healthy' and name in self.providers
        ]
        
        # If preferred providers are specified, prioritize them
        if task.preferred_providers:
            preferred_available = [
                p for p in task.preferred_providers 
                if p in available_providers
            ]
            if preferred_available:
                available_providers = preferred_available + [
                    p for p in available_providers 
                    if p not in preferred_available
                ]
        
        # Sort by success rate and response time
        available_providers.sort(
            key=lambda p: (
                -self.provider_health[p]['success_rate'],
                self.provider_health[p]['avg_response_time']
            )
        )
        
        return available_providers[:num_providers]
    
    async def _execute_task_on_provider(self, task: AITask, provider: BaseAIProvider, provider_name: str) -> Dict[str, Any]:
        """Execute a task on a specific provider"""
        start_time = time.time()
        
        try:
            response = await provider.process_task(
                task_type=task.task_type,
                prompt=task.description,
                context=task.context,
                requirements=task.requirements
            )
            
            execution_time = time.time() - start_time
            
            # Update provider health metrics
            self._update_provider_metrics(provider_name, True, execution_time)
            
            return {
                "success": True,
                "response": response,
                "provider": provider_name,
                "execution_time": execution_time
            }
            
        except Exception as e:
            execution_time = time.time() - start_time
            self._update_provider_metrics(provider_name, False, execution_time)
            
            return {
                "success": False,
                "error": str(e),
                "provider": provider_name,
                "execution_time": execution_time
            }
    
    def _update_provider_metrics(self, provider_name: str, success: bool, execution_time: float):
        """Update provider health and performance metrics"""
        health = self.provider_health[provider_name]
        
        health['total_requests'] += 1
        if not success:
            health['failed_requests'] += 1
        
        health['success_rate'] = 1.0 - (health['failed_requests'] / health['total_requests'])
        
        # Update average response time (exponential moving average)
        alpha = 0.1
        if health['avg_response_time'] == 0:
            health['avg_response_time'] = execution_time
        else:
            health['avg_response_time'] = (
                alpha * execution_time + (1 - alpha) * health['avg_response_time']
            )
        
        health['last_check'] = time.time()
        
        # Update status based on success rate
        if health['success_rate'] < 0.5:
            health['status'] = 'unhealthy'
        elif health['success_rate'] < 0.8:
            health['status'] = 'degraded'
        else:
            health['status'] = 'healthy'
    
    def _combine_provider_results(self, task: AITask, results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Combine results from multiple providers into a unified response"""
        successful_results = {
            provider: result for provider, result in results.items()
            if result.get('success', False)
        }
        
        if not successful_results:
            return {
                "success": False,
                "error": "All providers failed",
                "individual_results": results,
                "task_id": task.task_id
            }
        
        # For code generation tasks, we can compare and validate solutions
        if task.task_type == TaskType.CODE_GENERATION:
            return self._combine_code_generation_results(task, successful_results)
        
        # For troubleshooting, we can merge insights
        elif task.task_type == TaskType.TROUBLESHOOTING:
            return self._combine_troubleshooting_results(task, successful_results)
        
        # For analysis tasks, we can synthesize findings
        elif task.task_type == TaskType.ANALYSIS:
            return self._combine_analysis_results(task, successful_results)
        
        # Default: return the best result based on provider ranking
        else:
            best_provider = min(
                successful_results.keys(),
                key=lambda p: (
                    -self.provider_health[p]['success_rate'],
                    self.provider_health[p]['avg_response_time']
                )
            )
            
            return {
                "success": True,
                "primary_result": successful_results[best_provider]['response'],
                "alternative_results": {
                    p: r['response'] for p, r in successful_results.items()
                    if p != best_provider
                },
                "provider_consensus": len(successful_results),
                "task_id": task.task_id
            }
    
    def _combine_code_generation_results(self, task: AITask, results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Combine code generation results from multiple providers"""
        code_solutions = {}
        
        for provider, result in results.items():
            response = result['response']
            if hasattr(response, 'content') and response.content:
                code_solutions[provider] = {
                    'code': response.content,
                    'confidence': response.confidence,
                    'execution_time': result['execution_time']
                }
        
        # TODO: Implement code validation and comparison logic
        # For now, return the solution with highest confidence
        if code_solutions:
            best_solution = max(
                code_solutions.items(),
                key=lambda x: x[1]['confidence']
            )
            
            return {
                "success": True,
                "primary_solution": best_solution[1]['code'],
                "best_provider": best_solution[0],
                "alternative_solutions": {
                    p: s['code'] for p, s in code_solutions.items()
                    if p != best_solution[0]
                },
                "confidence_scores": {
                    p: s['confidence'] for p, s in code_solutions.items()
                },
                "task_id": task.task_id
            }
        
        return {"success": False, "error": "No valid code solutions generated"}
    
    def _combine_troubleshooting_results(self, task: AITask, results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Combine troubleshooting results from multiple providers"""
        diagnoses = []
        solutions = []
        
        for provider, result in results.items():
            response = result['response']
            if hasattr(response, 'diagnosis') and response.diagnosis:
                diagnoses.append({
                    'provider': provider,
                    'diagnosis': response.diagnosis,
                    'confidence': response.confidence
                })
            
            if hasattr(response, 'solutions') and response.solutions:
                for solution in response.solutions:
                    solutions.append({
                        'provider': provider,
                        'solution': solution,
                        'confidence': response.confidence
                    })
        
        # Merge and rank solutions
        merged_solutions = self._merge_similar_solutions(solutions)
        
        return {
            "success": True,
            "diagnoses": diagnoses,
            "recommended_solutions": merged_solutions[:5],  # Top 5 solutions
            "provider_count": len(results),
            "task_id": task.task_id
        }
    
    def _combine_analysis_results(self, task: AITask, results: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Combine analysis results from multiple providers"""
        insights = []
        recommendations = []
        
        for provider, result in results.items():
            response = result['response']
            if hasattr(response, 'insights') and response.insights:
                insights.extend([
                    {'provider': provider, 'insight': insight, 'confidence': response.confidence}
                    for insight in response.insights
                ])
            
            if hasattr(response, 'recommendations') and response.recommendations:
                recommendations.extend([
                    {'provider': provider, 'recommendation': rec, 'confidence': response.confidence}
                    for rec in response.recommendations
                ])
        
        return {
            "success": True,
            "consolidated_insights": insights,
            "consolidated_recommendations": recommendations,
            "provider_consensus": len(results),
            "task_id": task.task_id
        }
    
    def _merge_similar_solutions(self, solutions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Merge similar solutions and rank by consensus and confidence"""
        # TODO: Implement solution similarity detection and merging
        # For now, just sort by confidence
        return sorted(solutions, key=lambda x: x['confidence'], reverse=True)
    
    async def _task_worker(self, worker_name: str):
        """Worker coroutine for processing tasks"""
        logger.info(f"Task worker {worker_name} started")
        
        while self.running:
            try:
                # Get task from queue with timeout
                task = await asyncio.wait_for(self.task_queue.get(), timeout=1.0)
                
                logger.info(f"Worker {worker_name} processing task {task.task_id}")
                
                # Process the task
                result = await self.collaborate_on_task(task)
                
                # Store result
                self.completed_tasks[task.task_id] = result
                
                # Remove from active tasks
                if task.task_id in self.active_tasks:
                    del self.active_tasks[task.task_id]
                
                # Mark task as done
                self.task_queue.task_done()
                
                logger.info(f"Worker {worker_name} completed task {task.task_id}")
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Worker {worker_name} error: {e}")
                await asyncio.sleep(1)
    
    async def _health_monitor_loop(self):
        """Monitor provider health and connectivity"""
        while self.running:
            try:
                for provider_name, provider in self.providers.items():
                    try:
                        # Perform health check
                        health_status = await provider.health_check()
                        
                        if health_status:
                            if self.provider_health[provider_name]['status'] == 'unhealthy':
                                self.provider_health[provider_name]['status'] = 'healthy'
                                logger.info(f"Provider {provider_name} recovered")
                        else:
                            self.provider_health[provider_name]['status'] = 'unhealthy'
                            logger.warning(f"Provider {provider_name} health check failed")
                            
                    except Exception as e:
                        logger.error(f"Health check failed for {provider_name}: {e}")
                        self.provider_health[provider_name]['status'] = 'unhealthy'
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Health monitor error: {e}")
                await asyncio.sleep(5)
    
    async def _metrics_loop(self):
        """Collect and report metrics"""
        while self.running:
            try:
                # Collect current metrics
                metrics_data = {
                    'active_tasks': len(self.active_tasks),
                    'completed_tasks': len(self.completed_tasks),
                    'queue_size': self.task_queue.qsize(),
                    'provider_health': self.provider_health.copy(),
                    'timestamp': time.time()
                }
                
                # Store metrics
                self.metrics.record_metrics(metrics_data)
                
                await asyncio.sleep(60)  # Collect every minute
                
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(10)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current system status"""
        return {
            'running': self.running,
            'providers': {
                name: {
                    'status': health['status'],
                    'success_rate': health['success_rate'],
                    'avg_response_time': health['avg_response_time']
                }
                for name, health in self.provider_health.items()
            },
            'tasks': {
                'active': len(self.active_tasks),
                'completed': len(self.completed_tasks),
                'queued': self.task_queue.qsize()
            },
            'workers': len(self.worker_tasks)
        }
