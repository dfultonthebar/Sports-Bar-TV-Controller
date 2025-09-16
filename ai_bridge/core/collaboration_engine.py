
"""
Collaboration Engine
====================

Advanced collaborative AI workflows for complex problem-solving tasks.
Orchestrates multi-step, multi-provider workflows for enhanced capabilities.
"""

import asyncio
import logging
import time
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
import json

from .ai_bridge import AITask, TaskPriority
from ..providers.base_provider import TaskType, AIResponse, BaseAIProvider

logger = logging.getLogger(__name__)

class WorkflowType(Enum):
    """Types of collaborative workflows"""
    PEER_REVIEW = "peer_review"                    # Multiple AIs review each other's work
    DEBATE_CONSENSUS = "debate_consensus"          # AIs debate to reach consensus
    HIERARCHICAL_REFINEMENT = "hierarchical_refinement"  # Chain of refinement
    PARALLEL_SYNTHESIS = "parallel_synthesis"     # Parallel processing + synthesis
    EXPERT_CONSULTATION = "expert_consultation"   # Route to specialized experts
    ITERATIVE_IMPROVEMENT = "iterative_improvement"  # Multiple rounds of improvement

@dataclass
class WorkflowStep:
    """Represents a step in a collaborative workflow"""
    step_id: str
    step_type: str
    provider_name: str
    task_type: TaskType
    prompt_template: str
    depends_on: List[str] = field(default_factory=list)
    parallel_group: Optional[str] = None
    timeout_seconds: int = 300
    retry_count: int = 2

@dataclass
class WorkflowResult:
    """Result of a collaborative workflow"""
    workflow_id: str
    success: bool
    final_result: Any
    step_results: Dict[str, AIResponse]
    execution_time: float
    total_cost: float
    confidence_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)

class CollaborationEngine:
    """
    Advanced collaboration engine for multi-AI workflows.
    
    Features:
    - Complex workflow orchestration
    - Peer review and consensus building
    - Iterative refinement processes
    - Expert consultation routing
    - Quality assurance and validation
    """
    
    def __init__(self, providers: Dict[str, BaseAIProvider], config: Dict[str, Any] = None):
        self.providers = providers
        self.config = config or {}
        
        # Workflow templates
        self.workflow_templates = self._initialize_workflow_templates()
        
        # Active workflows
        self.active_workflows: Dict[str, Dict[str, Any]] = {}
        
        # Collaboration history
        self.collaboration_history: List[Dict[str, Any]] = []
        
        # Quality metrics
        self.quality_metrics = {
            'consensus_accuracy': 0.85,
            'peer_review_improvement': 0.20,
            'iterative_convergence': 0.90
        }
    
    def _initialize_workflow_templates(self) -> Dict[str, List[WorkflowStep]]:
        """Initialize predefined workflow templates"""
        templates = {}
        
        # Peer Review Workflow
        templates[WorkflowType.PEER_REVIEW.value] = [
            WorkflowStep(
                step_id="initial_solution",
                step_type="generate",
                provider_name="primary",
                task_type=TaskType.CODE_GENERATION,
                prompt_template="Generate a solution for: {task_description}"
            ),
            WorkflowStep(
                step_id="peer_review_1",
                step_type="review",
                provider_name="reviewer_1",
                task_type=TaskType.CODE_REVIEW,
                prompt_template="Review this solution and provide feedback: {initial_solution}",
                depends_on=["initial_solution"]
            ),
            WorkflowStep(
                step_id="peer_review_2",
                step_type="review",
                provider_name="reviewer_2",
                task_type=TaskType.CODE_REVIEW,
                prompt_template="Review this solution and provide feedback: {initial_solution}",
                depends_on=["initial_solution"]
            ),
            WorkflowStep(
                step_id="final_refinement",
                step_type="refine",
                provider_name="primary",
                task_type=TaskType.CODE_GENERATION,
                prompt_template="Refine the solution based on peer feedback: {initial_solution}\nFeedback 1: {peer_review_1}\nFeedback 2: {peer_review_2}",
                depends_on=["peer_review_1", "peer_review_2"]
            )
        ]
        
        # Debate Consensus Workflow
        templates[WorkflowType.DEBATE_CONSENSUS.value] = [
            WorkflowStep(
                step_id="position_1",
                step_type="analyze",
                provider_name="debater_1",
                task_type=TaskType.ANALYSIS,
                prompt_template="Analyze this problem and present your position: {task_description}",
                parallel_group="initial_positions"
            ),
            WorkflowStep(
                step_id="position_2",
                step_type="analyze",
                provider_name="debater_2",
                task_type=TaskType.ANALYSIS,
                prompt_template="Analyze this problem and present your position: {task_description}",
                parallel_group="initial_positions"
            ),
            WorkflowStep(
                step_id="counter_argument_1",
                step_type="debate",
                provider_name="debater_1",
                task_type=TaskType.ANALYSIS,
                prompt_template="Counter the following position with your arguments: {position_2}",
                depends_on=["position_2"]
            ),
            WorkflowStep(
                step_id="counter_argument_2",
                step_type="debate",
                provider_name="debater_2",
                task_type=TaskType.ANALYSIS,
                prompt_template="Counter the following position with your arguments: {position_1}",
                depends_on=["position_1"]
            ),
            WorkflowStep(
                step_id="consensus_synthesis",
                step_type="synthesize",
                provider_name="moderator",
                task_type=TaskType.ANALYSIS,
                prompt_template="Synthesize a consensus from these debate positions:\nPosition 1: {position_1}\nCounter 1: {counter_argument_1}\nPosition 2: {position_2}\nCounter 2: {counter_argument_2}",
                depends_on=["counter_argument_1", "counter_argument_2"]
            )
        ]
        
        # Hierarchical Refinement Workflow
        templates[WorkflowType.HIERARCHICAL_REFINEMENT.value] = [
            WorkflowStep(
                step_id="draft_solution",
                step_type="generate",
                provider_name="generator",
                task_type=TaskType.CODE_GENERATION,
                prompt_template="Create a draft solution for: {task_description}"
            ),
            WorkflowStep(
                step_id="technical_review",
                step_type="review",
                provider_name="technical_expert",
                task_type=TaskType.CODE_REVIEW,
                prompt_template="Perform technical review focusing on correctness and performance: {draft_solution}",
                depends_on=["draft_solution"]
            ),
            WorkflowStep(
                step_id="security_review",
                step_type="review",
                provider_name="security_expert",
                task_type=TaskType.CODE_REVIEW,
                prompt_template="Perform security review focusing on vulnerabilities: {draft_solution}",
                depends_on=["draft_solution"]
            ),
            WorkflowStep(
                step_id="final_integration",
                step_type="integrate",
                provider_name="integrator",
                task_type=TaskType.CODE_GENERATION,
                prompt_template="Integrate feedback and create final solution:\nOriginal: {draft_solution}\nTechnical feedback: {technical_review}\nSecurity feedback: {security_review}",
                depends_on=["technical_review", "security_review"]
            )
        ]
        
        return templates
    
    async def execute_collaborative_workflow(
        self,
        workflow_type: WorkflowType,
        task: AITask,
        provider_assignments: Optional[Dict[str, str]] = None
    ) -> WorkflowResult:
        """
        Execute a collaborative workflow with multiple AI providers.
        
        Args:
            workflow_type: Type of collaborative workflow
            task: The task to process collaboratively
            provider_assignments: Optional mapping of workflow roles to specific providers
            
        Returns:
            WorkflowResult with comprehensive results
        """
        workflow_id = f"{workflow_type.value}_{task.task_id}_{int(time.time())}"
        start_time = time.time()
        
        logger.info(f"Starting collaborative workflow {workflow_id}")
        
        try:
            # Get workflow template
            workflow_steps = self.workflow_templates.get(workflow_type.value, [])
            if not workflow_steps:
                raise ValueError(f"No template found for workflow type: {workflow_type.value}")
            
            # Assign providers to workflow roles
            assigned_providers = self._assign_providers_to_workflow(workflow_steps, provider_assignments)
            
            # Execute workflow steps
            step_results = await self._execute_workflow_steps(
                workflow_id, workflow_steps, assigned_providers, task
            )
            
            # Synthesize final result
            final_result = self._synthesize_workflow_result(workflow_type, step_results, task)
            
            # Calculate metrics
            execution_time = time.time() - start_time
            total_cost = sum(
                result.metadata.get('cost', 0.0) 
                for result in step_results.values() 
                if hasattr(result, 'metadata')
            )
            confidence_score = self._calculate_workflow_confidence(step_results)
            
            # Create workflow result
            workflow_result = WorkflowResult(
                workflow_id=workflow_id,
                success=True,
                final_result=final_result,
                step_results=step_results,
                execution_time=execution_time,
                total_cost=total_cost,
                confidence_score=confidence_score,
                metadata={
                    'workflow_type': workflow_type.value,
                    'task_type': task.task_type.value,
                    'provider_assignments': assigned_providers,
                    'step_count': len(workflow_steps)
                }
            )
            
            # Record collaboration history
            self.collaboration_history.append({
                'workflow_id': workflow_id,
                'workflow_type': workflow_type.value,
                'task_type': task.task_type.value,
                'success': True,
                'execution_time': execution_time,
                'confidence_score': confidence_score,
                'timestamp': time.time()
            })
            
            logger.info(f"Collaborative workflow {workflow_id} completed successfully")
            return workflow_result
            
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Collaborative workflow {workflow_id} failed: {e}")
            
            return WorkflowResult(
                workflow_id=workflow_id,
                success=False,
                final_result=None,
                step_results={},
                execution_time=execution_time,
                total_cost=0.0,
                confidence_score=0.0,
                metadata={'error': str(e)}
            )
    
    def _assign_providers_to_workflow(
        self, 
        workflow_steps: List[WorkflowStep], 
        provider_assignments: Optional[Dict[str, str]]
    ) -> Dict[str, str]:
        """Assign specific providers to workflow roles"""
        assignments = {}
        
        # Extract unique provider roles from workflow
        roles = set(step.provider_name for step in workflow_steps)
        
        # Use provided assignments or auto-assign
        for role in roles:
            if provider_assignments and role in provider_assignments:
                assignments[role] = provider_assignments[role]
            else:
                # Auto-assign based on role and provider capabilities
                assignments[role] = self._auto_assign_provider_for_role(role)
        
        return assignments
    
    def _auto_assign_provider_for_role(self, role: str) -> str:
        """Automatically assign a provider for a workflow role"""
        # Role-based provider preferences
        role_preferences = {
            'primary': ['openai', 'anthropic', 'grok'],
            'generator': ['openai', 'grok'],
            'reviewer_1': ['anthropic', 'openai'],
            'reviewer_2': ['grok', 'anthropic'],
            'technical_expert': ['anthropic', 'openai'],
            'security_expert': ['anthropic', 'grok'],
            'integrator': ['openai', 'anthropic'],
            'debater_1': ['grok', 'anthropic'],
            'debater_2': ['openai', 'grok'],
            'moderator': ['anthropic', 'openai']
        }
        
        preferences = role_preferences.get(role, list(self.providers.keys()))
        
        # Find first available provider from preferences
        for provider_name in preferences:
            if provider_name in self.providers and self.providers[provider_name].is_available():
                return provider_name
        
        # Fallback to any available provider
        for provider_name, provider in self.providers.items():
            if provider.is_available():
                return provider_name
        
        raise ValueError(f"No available provider for role: {role}")
    
    async def _execute_workflow_steps(
        self,
        workflow_id: str,
        workflow_steps: List[WorkflowStep],
        provider_assignments: Dict[str, str],
        task: AITask
    ) -> Dict[str, AIResponse]:
        """Execute workflow steps with dependency management"""
        step_results = {}
        completed_steps = set()
        
        # Track active workflows
        self.active_workflows[workflow_id] = {
            'steps': workflow_steps,
            'assignments': provider_assignments,
            'results': step_results,
            'start_time': time.time()
        }
        
        try:
            # Execute steps in dependency order
            while len(completed_steps) < len(workflow_steps):
                # Find steps ready to execute
                ready_steps = []
                for step in workflow_steps:
                    if step.step_id not in completed_steps:
                        # Check if all dependencies are completed
                        if all(dep in completed_steps for dep in step.depends_on):
                            ready_steps.append(step)
                
                if not ready_steps:
                    raise ValueError("Workflow deadlock: no steps ready to execute")
                
                # Group parallel steps
                parallel_groups = {}
                sequential_steps = []
                
                for step in ready_steps:
                    if step.parallel_group:
                        if step.parallel_group not in parallel_groups:
                            parallel_groups[step.parallel_group] = []
                        parallel_groups[step.parallel_group].append(step)
                    else:
                        sequential_steps.append(step)
                
                # Execute parallel groups
                for group_name, group_steps in parallel_groups.items():
                    group_tasks = []
                    for step in group_steps:
                        task_coroutine = self._execute_workflow_step(
                            step, provider_assignments, task, step_results
                        )
                        group_tasks.append((step.step_id, task_coroutine))
                    
                    # Execute parallel steps
                    group_results = await asyncio.gather(
                        *[task_coro for _, task_coro in group_tasks],
                        return_exceptions=True
                    )
                    
                    # Process results
                    for (step_id, _), result in zip(group_tasks, group_results):
                        if isinstance(result, Exception):
                            logger.error(f"Step {step_id} failed: {result}")
                            raise result
                        step_results[step_id] = result
                        completed_steps.add(step_id)
                
                # Execute sequential steps
                for step in sequential_steps:
                    result = await self._execute_workflow_step(
                        step, provider_assignments, task, step_results
                    )
                    step_results[step.step_id] = result
                    completed_steps.add(step.step_id)
            
            return step_results
            
        finally:
            # Clean up active workflow tracking
            if workflow_id in self.active_workflows:
                del self.active_workflows[workflow_id]
    
    async def _execute_workflow_step(
        self,
        step: WorkflowStep,
        provider_assignments: Dict[str, str],
        task: AITask,
        previous_results: Dict[str, AIResponse]
    ) -> AIResponse:
        """Execute a single workflow step"""
        provider_name = provider_assignments[step.provider_name]
        provider = self.providers[provider_name]
        
        # Build step prompt from template
        prompt = self._build_step_prompt(step, task, previous_results)
        
        # Create step context
        step_context = {
            'workflow_step': step.step_id,
            'step_type': step.step_type,
            'original_task': task.description,
            'previous_results': {
                step_id: result.content for step_id, result in previous_results.items()
            }
        }
        
        # Execute step
        logger.info(f"Executing workflow step {step.step_id} with provider {provider_name}")
        
        result = await provider.process_task(
            task_type=step.task_type,
            prompt=prompt,
            context=step_context,
            requirements=task.requirements
        )
        
        return result
    
    def _build_step_prompt(
        self,
        step: WorkflowStep,
        task: AITask,
        previous_results: Dict[str, AIResponse]
    ) -> str:
        """Build prompt for workflow step using template and previous results"""
        # Start with template
        prompt = step.prompt_template
        
        # Replace task description
        prompt = prompt.replace('{task_description}', task.description)
        
        # Replace previous step results
        for step_id, result in previous_results.items():
            placeholder = f'{{{step_id}}}'
            if placeholder in prompt:
                prompt = prompt.replace(placeholder, result.content)
        
        # Add context if available
        if task.context:
            context_str = "\n\nAdditional Context:\n"
            for key, value in task.context.items():
                context_str += f"- {key}: {value}\n"
            prompt += context_str
        
        return prompt
    
    def _synthesize_workflow_result(
        self,
        workflow_type: WorkflowType,
        step_results: Dict[str, AIResponse],
        task: AITask
    ) -> Any:
        """Synthesize final result from workflow step results"""
        if workflow_type == WorkflowType.PEER_REVIEW:
            # Return the final refined solution
            if 'final_refinement' in step_results:
                return step_results['final_refinement'].content
            elif 'initial_solution' in step_results:
                return step_results['initial_solution'].content
        
        elif workflow_type == WorkflowType.DEBATE_CONSENSUS:
            # Return the consensus synthesis
            if 'consensus_synthesis' in step_results:
                return step_results['consensus_synthesis'].content
        
        elif workflow_type == WorkflowType.HIERARCHICAL_REFINEMENT:
            # Return the final integrated solution
            if 'final_integration' in step_results:
                return step_results['final_integration'].content
        
        # Default: return the last step result
        if step_results:
            last_step = max(step_results.keys())
            return step_results[last_step].content
        
        return None
    
    def _calculate_workflow_confidence(self, step_results: Dict[str, AIResponse]) -> float:
        """Calculate overall confidence score for workflow"""
        if not step_results:
            return 0.0
        
        # Average confidence from all steps
        confidences = [
            result.confidence for result in step_results.values()
            if hasattr(result, 'confidence') and result.confidence > 0
        ]
        
        if not confidences:
            return 0.5  # Default confidence
        
        base_confidence = sum(confidences) / len(confidences)
        
        # Bonus for multiple successful steps (collaboration benefit)
        collaboration_bonus = min(0.2, len(step_results) * 0.05)
        
        return min(1.0, base_confidence + collaboration_bonus)
    
    async def create_custom_workflow(
        self,
        workflow_name: str,
        steps: List[WorkflowStep]
    ) -> bool:
        """Create a custom workflow template"""
        try:
            # Validate workflow steps
            self._validate_workflow_steps(steps)
            
            # Store custom workflow
            self.workflow_templates[workflow_name] = steps
            
            logger.info(f"Created custom workflow: {workflow_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create custom workflow {workflow_name}: {e}")
            return False
    
    def _validate_workflow_steps(self, steps: List[WorkflowStep]):
        """Validate workflow step dependencies and structure"""
        step_ids = {step.step_id for step in steps}
        
        for step in steps:
            # Check dependency references
            for dep in step.depends_on:
                if dep not in step_ids:
                    raise ValueError(f"Step {step.step_id} depends on non-existent step: {dep}")
            
            # Check for circular dependencies (simplified check)
            if step.step_id in step.depends_on:
                raise ValueError(f"Step {step.step_id} has circular dependency on itself")
    
    def get_collaboration_stats(self) -> Dict[str, Any]:
        """Get collaboration statistics and performance metrics"""
        if not self.collaboration_history:
            return {'total_workflows': 0}
        
        successful_workflows = [w for w in self.collaboration_history if w['success']]
        
        stats = {
            'total_workflows': len(self.collaboration_history),
            'successful_workflows': len(successful_workflows),
            'success_rate': len(successful_workflows) / len(self.collaboration_history),
            'average_execution_time': sum(w['execution_time'] for w in successful_workflows) / len(successful_workflows) if successful_workflows else 0,
            'average_confidence': sum(w['confidence_score'] for w in successful_workflows) / len(successful_workflows) if successful_workflows else 0,
            'workflow_type_distribution': {},
            'active_workflows': len(self.active_workflows)
        }
        
        # Workflow type distribution
        for workflow in self.collaboration_history:
            workflow_type = workflow['workflow_type']
            if workflow_type not in stats['workflow_type_distribution']:
                stats['workflow_type_distribution'][workflow_type] = 0
            stats['workflow_type_distribution'][workflow_type] += 1
        
        return stats
