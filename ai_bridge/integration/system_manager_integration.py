
"""
System Manager Integration
==========================

Integration layer between the AI Bridge and the existing System Manager.
Provides seamless AI-to-AI communication capabilities to the Sports Bar TV Controller.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import time

from ..core.ai_bridge import AIBridge, AITask, TaskPriority
from ..core.task_coordinator import TaskCoordinator
from ..core.collaboration_engine import CollaborationEngine, WorkflowType
from ..providers.base_provider import TaskType

logger = logging.getLogger(__name__)

@dataclass
class AIAssistanceRequest:
    """Request for AI assistance from the system manager"""
    request_id: str
    request_type: str
    description: str
    context: Dict[str, Any]
    priority: TaskPriority = TaskPriority.MEDIUM
    preferred_providers: List[str] = None
    collaboration_required: bool = False
    timeout_seconds: int = 300

class SystemManagerAIIntegration:
    """
    Integration layer that provides AI-to-AI communication capabilities
    to the existing System Manager.
    """
    
    def __init__(self, ai_bridge: AIBridge, config: Dict[str, Any] = None):
        self.ai_bridge = ai_bridge
        self.config = config or {}
        
        # Integration settings
        self.auto_collaboration_threshold = config.get('auto_collaboration_threshold', 'medium')
        self.max_concurrent_ai_tasks = config.get('max_concurrent_ai_tasks', 5)
        self.default_timeout = config.get('default_timeout', 300)
        
        # Task tracking
        self.active_ai_requests: Dict[str, AIAssistanceRequest] = {}
        self.ai_request_history: List[Dict[str, Any]] = []
        
        # Collaboration engine
        self.collaboration_engine = CollaborationEngine(
            ai_bridge.providers, 
            config.get('collaboration', {})
        )
    
    async def request_ai_assistance(
        self,
        request_type: str,
        description: str,
        context: Dict[str, Any],
        priority: TaskPriority = TaskPriority.MEDIUM,
        collaboration: bool = None
    ) -> Dict[str, Any]:
        """
        Request AI assistance for a system management task.
        
        Args:
            request_type: Type of assistance needed (troubleshooting, analysis, etc.)
            description: Detailed description of the issue or task
            context: Relevant context information
            priority: Task priority level
            collaboration: Whether to use collaborative AI (auto-determined if None)
            
        Returns:
            AI assistance result with recommendations and solutions
        """
        request_id = f"ai_assist_{int(time.time())}_{len(self.active_ai_requests)}"
        
        # Determine if collaboration is needed
        if collaboration is None:
            collaboration = self._should_use_collaboration(request_type, priority, context)
        
        # Create assistance request
        ai_request = AIAssistanceRequest(
            request_id=request_id,
            request_type=request_type,
            description=description,
            context=context,
            priority=priority,
            collaboration_required=collaboration,
            timeout_seconds=self.default_timeout
        )
        
        self.active_ai_requests[request_id] = ai_request
        
        try:
            if collaboration:
                result = await self._handle_collaborative_request(ai_request)
            else:
                result = await self._handle_single_ai_request(ai_request)
            
            # Record success
            self._record_ai_request_completion(ai_request, True, result)
            return result
            
        except Exception as e:
            logger.error(f"AI assistance request {request_id} failed: {e}")
            error_result = {
                'success': False,
                'error': str(e),
                'request_id': request_id
            }
            self._record_ai_request_completion(ai_request, False, error_result)
            return error_result
            
        finally:
            # Clean up
            if request_id in self.active_ai_requests:
                del self.active_ai_requests[request_id]
    
    async def troubleshoot_system_issue(
        self,
        issue_description: str,
        error_logs: List[str] = None,
        system_metrics: Dict[str, Any] = None,
        recent_changes: List[str] = None
    ) -> Dict[str, Any]:
        """
        Use AI to troubleshoot system issues.
        
        Args:
            issue_description: Description of the issue
            error_logs: Relevant error log entries
            system_metrics: Current system metrics
            recent_changes: Recent system changes
            
        Returns:
            Troubleshooting results with diagnosis and solutions
        """
        context = {
            'issue_type': 'system_troubleshooting',
            'error_logs': error_logs or [],
            'system_metrics': system_metrics or {},
            'recent_changes': recent_changes or [],
            'timestamp': time.time()
        }
        
        return await self.request_ai_assistance(
            request_type='troubleshooting',
            description=issue_description,
            context=context,
            priority=TaskPriority.HIGH,
            collaboration=True  # Always use collaboration for troubleshooting
        )
    
    async def analyze_performance_issue(
        self,
        performance_data: Dict[str, Any],
        time_range: str = "1 hour"
    ) -> Dict[str, Any]:
        """
        Use AI to analyze performance issues.
        
        Args:
            performance_data: Performance metrics and data
            time_range: Time range for the analysis
            
        Returns:
            Performance analysis with insights and recommendations
        """
        context = {
            'analysis_type': 'performance_analysis',
            'performance_data': performance_data,
            'time_range': time_range,
            'timestamp': time.time()
        }
        
        return await self.request_ai_assistance(
            request_type='analysis',
            description=f"Analyze performance issues over {time_range}",
            context=context,
            priority=TaskPriority.MEDIUM,
            collaboration=True
        )
    
    async def generate_configuration_fix(
        self,
        config_issue: str,
        current_config: Dict[str, Any],
        requirements: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Use AI to generate configuration fixes.
        
        Args:
            config_issue: Description of the configuration issue
            current_config: Current configuration
            requirements: Requirements for the fix
            
        Returns:
            Configuration fix recommendations
        """
        context = {
            'task_type': 'configuration_fix',
            'current_config': current_config,
            'requirements': requirements or {},
            'timestamp': time.time()
        }
        
        return await self.request_ai_assistance(
            request_type='code_generation',
            description=config_issue,
            context=context,
            priority=TaskPriority.MEDIUM
        )
    
    async def review_system_changes(
        self,
        changes: List[Dict[str, Any]],
        change_type: str = "configuration"
    ) -> Dict[str, Any]:
        """
        Use AI to review system changes before applying them.
        
        Args:
            changes: List of proposed changes
            change_type: Type of changes (configuration, code, etc.)
            
        Returns:
            Review results with safety assessment and recommendations
        """
        context = {
            'review_type': 'system_change_review',
            'changes': changes,
            'change_type': change_type,
            'timestamp': time.time()
        }
        
        return await self.request_ai_assistance(
            request_type='code_review',
            description=f"Review {change_type} changes for safety and correctness",
            context=context,
            priority=TaskPriority.HIGH,
            collaboration=True  # Always use collaboration for safety reviews
        )
    
    async def optimize_system_configuration(
        self,
        current_config: Dict[str, Any],
        performance_goals: Dict[str, Any],
        constraints: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Use AI to optimize system configuration.
        
        Args:
            current_config: Current system configuration
            performance_goals: Desired performance improvements
            constraints: System constraints and limitations
            
        Returns:
            Optimization recommendations
        """
        context = {
            'optimization_type': 'system_configuration',
            'current_config': current_config,
            'performance_goals': performance_goals,
            'constraints': constraints or {},
            'timestamp': time.time()
        }
        
        return await self.request_ai_assistance(
            request_type='optimization',
            description="Optimize system configuration for better performance",
            context=context,
            priority=TaskPriority.MEDIUM,
            collaboration=True
        )
    
    def _should_use_collaboration(
        self,
        request_type: str,
        priority: TaskPriority,
        context: Dict[str, Any]
    ) -> bool:
        """Determine if collaborative AI should be used for a request"""
        
        # Always use collaboration for critical tasks
        if priority == TaskPriority.CRITICAL:
            return True
        
        # Use collaboration for complex troubleshooting
        if request_type == 'troubleshooting' and priority >= TaskPriority.HIGH:
            return True
        
        # Use collaboration for safety-critical reviews
        if request_type == 'code_review':
            return True
        
        # Use collaboration for complex analysis
        if request_type == 'analysis' and len(context.get('performance_data', {})) > 10:
            return True
        
        # Check auto-collaboration threshold
        threshold_map = {
            'low': TaskPriority.LOW,
            'medium': TaskPriority.MEDIUM,
            'high': TaskPriority.HIGH,
            'critical': TaskPriority.CRITICAL
        }
        
        threshold = threshold_map.get(self.auto_collaboration_threshold, TaskPriority.MEDIUM)
        return priority >= threshold
    
    async def _handle_single_ai_request(self, request: AIAssistanceRequest) -> Dict[str, Any]:
        """Handle a single AI request without collaboration"""
        
        # Map request type to task type
        task_type_map = {
            'troubleshooting': TaskType.TROUBLESHOOTING,
            'analysis': TaskType.ANALYSIS,
            'code_generation': TaskType.CODE_GENERATION,
            'code_review': TaskType.CODE_REVIEW,
            'optimization': TaskType.OPTIMIZATION,
            'documentation': TaskType.DOCUMENTATION
        }
        
        task_type = task_type_map.get(request.request_type, TaskType.GENERAL)
        
        # Create AI task
        ai_task = AITask(
            task_id=request.request_id,
            task_type=task_type,
            priority=request.priority,
            description=request.description,
            context=request.context,
            preferred_providers=request.preferred_providers or [],
            timeout_seconds=request.timeout_seconds
        )
        
        # Submit task to AI bridge
        task_id = await self.ai_bridge.submit_task(ai_task)
        
        # Wait for result
        result = await self.ai_bridge.get_task_result(task_id, timeout=request.timeout_seconds)
        
        if result:
            return {
                'success': True,
                'result': result.get('primary_result'),
                'alternative_results': result.get('alternative_results', {}),
                'confidence': result.get('confidence_score', 0.0),
                'provider_used': result.get('provider_consensus', 1),
                'request_id': request.request_id,
                'execution_time': result.get('execution_time', 0.0)
            }
        else:
            return {
                'success': False,
                'error': 'Task timeout or failure',
                'request_id': request.request_id
            }
    
    async def _handle_collaborative_request(self, request: AIAssistanceRequest) -> Dict[str, Any]:
        """Handle a collaborative AI request using multiple providers"""
        
        # Map request type to task type and workflow
        workflow_map = {
            'troubleshooting': WorkflowType.PARALLEL_CONSENSUS,
            'analysis': WorkflowType.PARALLEL_CONSENSUS,
            'code_generation': WorkflowType.SEQUENTIAL_REFINEMENT,
            'code_review': WorkflowType.PEER_REVIEW,
            'optimization': WorkflowType.DEBATE_CONSENSUS
        }
        
        task_type_map = {
            'troubleshooting': TaskType.TROUBLESHOOTING,
            'analysis': TaskType.ANALYSIS,
            'code_generation': TaskType.CODE_GENERATION,
            'code_review': TaskType.CODE_REVIEW,
            'optimization': TaskType.OPTIMIZATION
        }
        
        workflow_type = workflow_map.get(request.request_type, WorkflowType.PARALLEL_CONSENSUS)
        task_type = task_type_map.get(request.request_type, TaskType.GENERAL)
        
        # Create AI task
        ai_task = AITask(
            task_id=request.request_id,
            task_type=task_type,
            priority=request.priority,
            description=request.description,
            context=request.context,
            preferred_providers=request.preferred_providers or [],
            timeout_seconds=request.timeout_seconds
        )
        
        # Execute collaborative workflow
        workflow_result = await self.collaboration_engine.execute_collaborative_workflow(
            workflow_type=workflow_type,
            task=ai_task
        )
        
        if workflow_result.success:
            return {
                'success': True,
                'result': workflow_result.final_result,
                'step_results': {
                    step_id: result.content 
                    for step_id, result in workflow_result.step_results.items()
                },
                'confidence': workflow_result.confidence_score,
                'workflow_type': workflow_type.value,
                'providers_used': len(workflow_result.step_results),
                'request_id': request.request_id,
                'execution_time': workflow_result.execution_time,
                'total_cost': workflow_result.total_cost
            }
        else:
            return {
                'success': False,
                'error': workflow_result.metadata.get('error', 'Workflow execution failed'),
                'request_id': request.request_id,
                'execution_time': workflow_result.execution_time
            }
    
    def _record_ai_request_completion(
        self,
        request: AIAssistanceRequest,
        success: bool,
        result: Dict[str, Any]
    ):
        """Record completion of an AI assistance request"""
        
        record = {
            'request_id': request.request_id,
            'request_type': request.request_type,
            'priority': request.priority.value,
            'collaboration_used': request.collaboration_required,
            'success': success,
            'execution_time': result.get('execution_time', 0.0),
            'confidence': result.get('confidence', 0.0),
            'timestamp': time.time()
        }
        
        self.ai_request_history.append(record)
        
        # Keep only recent history
        if len(self.ai_request_history) > 1000:
            self.ai_request_history = self.ai_request_history[-1000:]
    
    def get_ai_assistance_stats(self) -> Dict[str, Any]:
        """Get statistics about AI assistance usage"""
        
        if not self.ai_request_history:
            return {'total_requests': 0}
        
        successful_requests = [r for r in self.ai_request_history if r['success']]
        collaborative_requests = [r for r in self.ai_request_history if r['collaboration_used']]
        
        stats = {
            'total_requests': len(self.ai_request_history),
            'successful_requests': len(successful_requests),
            'success_rate': len(successful_requests) / len(self.ai_request_history),
            'collaborative_requests': len(collaborative_requests),
            'collaboration_rate': len(collaborative_requests) / len(self.ai_request_history),
            'average_execution_time': sum(r['execution_time'] for r in successful_requests) / len(successful_requests) if successful_requests else 0,
            'average_confidence': sum(r['confidence'] for r in successful_requests) / len(successful_requests) if successful_requests else 0,
            'active_requests': len(self.active_ai_requests)
        }
        
        # Request type distribution
        request_types = {}
        for request in self.ai_request_history:
            req_type = request['request_type']
            if req_type not in request_types:
                request_types[req_type] = {'count': 0, 'success_rate': 0}
            request_types[req_type]['count'] += 1
        
        for req_type in request_types:
            type_requests = [r for r in self.ai_request_history if r['request_type'] == req_type]
            successful_type = [r for r in type_requests if r['success']]
            request_types[req_type]['success_rate'] = len(successful_type) / len(type_requests)
        
        stats['request_type_distribution'] = request_types
        
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check of AI integration"""
        
        health_status = {
            'ai_bridge_running': self.ai_bridge.running,
            'active_providers': len([p for p in self.ai_bridge.providers.values() if p.is_available()]),
            'total_providers': len(self.ai_bridge.providers),
            'active_ai_requests': len(self.active_ai_requests),
            'collaboration_engine_available': self.collaboration_engine is not None,
            'overall_health': 'healthy'
        }
        
        # Check if we have at least one working provider
        if health_status['active_providers'] == 0:
            health_status['overall_health'] = 'unhealthy'
            health_status['issues'] = ['No active AI providers available']
        elif health_status['active_providers'] < 2:
            health_status['overall_health'] = 'degraded'
            health_status['issues'] = ['Limited AI providers available - collaboration may be limited']
        
        # Check AI bridge status
        if not health_status['ai_bridge_running']:
            health_status['overall_health'] = 'unhealthy'
            health_status['issues'] = health_status.get('issues', []) + ['AI Bridge is not running']
        
        return health_status
