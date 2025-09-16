
"""
Base AI Provider Interface
==========================

Abstract base class for all AI service providers, defining the common interface
for communication with external AI services.
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import time

class TaskType(Enum):
    """Types of tasks that can be processed by AI providers"""
    TROUBLESHOOTING = "troubleshooting"
    CODE_GENERATION = "code_generation"
    CODE_REVIEW = "code_review"
    ANALYSIS = "analysis"
    OPTIMIZATION = "optimization"
    DOCUMENTATION = "documentation"
    TESTING = "testing"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"
    GENERAL = "general"

@dataclass
class AIResponse:
    """Standard response format from AI providers"""
    success: bool
    content: str
    confidence: float = 0.0
    metadata: Dict[str, Any] = None
    error_message: Optional[str] = None
    execution_time: float = 0.0
    
    # Task-specific fields
    diagnosis: Optional[str] = None
    solutions: Optional[List[str]] = None
    insights: Optional[List[str]] = None
    recommendations: Optional[List[str]] = None
    code: Optional[str] = None
    tests: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

class BaseAIProvider(ABC):
    """
    Abstract base class for AI service providers.
    
    All AI providers must implement this interface to ensure consistent
    communication and task processing capabilities.
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = config.get('name', self.__class__.__name__)
        self.enabled = config.get('enabled', True)
        self.api_key = config.get('api_key')
        self.base_url = config.get('base_url')
        self.model = config.get('model')
        self.max_tokens = config.get('max_tokens', 4000)
        self.temperature = config.get('temperature', 0.7)
        self.timeout = config.get('timeout', 30)
        
        # Performance tracking
        self.request_count = 0
        self.success_count = 0
        self.total_response_time = 0.0
        self.last_request_time = 0.0
        
    @abstractmethod
    async def process_task(
        self,
        task_type: TaskType,
        prompt: str,
        context: Dict[str, Any] = None,
        requirements: Dict[str, Any] = None
    ) -> AIResponse:
        """
        Process a task using the AI provider.
        
        Args:
            task_type: Type of task to process
            prompt: Main prompt/description for the task
            context: Additional context information
            requirements: Specific requirements for the task
            
        Returns:
            AIResponse object with the result
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """
        Check if the provider is healthy and responsive.
        
        Returns:
            True if healthy, False otherwise
        """
        pass
    
    @abstractmethod
    async def close(self):
        """Clean up resources and close connections"""
        pass
    
    def _build_system_prompt(self, task_type: TaskType) -> str:
        """Build system prompt based on task type"""
        base_prompt = f"""You are an expert AI assistant specializing in {task_type.value} tasks. 
You are part of a distributed AI network working collaboratively to solve complex problems.

Your responses should be:
- Accurate and technically sound
- Well-structured and clear
- Include confidence levels for your recommendations
- Provide actionable solutions when possible
"""
        
        task_specific_prompts = {
            TaskType.TROUBLESHOOTING: """
Focus on:
- Systematic problem diagnosis
- Root cause analysis
- Step-by-step solution procedures
- Risk assessment for proposed fixes
- Alternative approaches if primary solution fails
""",
            TaskType.CODE_GENERATION: """
Focus on:
- Clean, maintainable code
- Proper error handling
- Security best practices
- Performance considerations
- Comprehensive documentation
""",
            TaskType.CODE_REVIEW: """
Focus on:
- Code quality assessment
- Security vulnerability detection
- Performance optimization opportunities
- Best practice compliance
- Maintainability improvements
""",
            TaskType.ANALYSIS: """
Focus on:
- Data-driven insights
- Pattern recognition
- Trend analysis
- Risk assessment
- Strategic recommendations
""",
            TaskType.OPTIMIZATION: """
Focus on:
- Performance bottleneck identification
- Resource utilization improvements
- Scalability enhancements
- Cost optimization opportunities
- Monitoring and measurement strategies
"""
        }
        
        specific_prompt = task_specific_prompts.get(task_type, "")
        return base_prompt + specific_prompt
    
    def _extract_structured_response(self, response_text: str, task_type: TaskType) -> Dict[str, Any]:
        """Extract structured information from response text"""
        # This is a simplified implementation
        # In practice, you might use more sophisticated parsing
        
        result = {
            'content': response_text,
            'confidence': 0.8  # Default confidence
        }
        
        # Task-specific extraction logic
        if task_type == TaskType.TROUBLESHOOTING:
            # Look for diagnosis and solutions
            if "diagnosis:" in response_text.lower():
                parts = response_text.lower().split("diagnosis:")
                if len(parts) > 1:
                    result['diagnosis'] = parts[1].split("solution")[0].strip()
            
            # Extract solutions
            solutions = []
            if "solution" in response_text.lower():
                # Simple extraction - in practice, use more sophisticated parsing
                solution_parts = response_text.split("solution")
                for part in solution_parts[1:]:
                    solution = part.split("\n")[0].strip()
                    if solution:
                        solutions.append(solution)
            result['solutions'] = solutions
            
        elif task_type == TaskType.CODE_GENERATION:
            # Extract code blocks
            import re
            code_blocks = re.findall(r'```(?:python|javascript|bash|sql)?\n(.*?)\n```', response_text, re.DOTALL)
            if code_blocks:
                result['code'] = code_blocks[0]
        
        return result
    
    def _update_metrics(self, success: bool, response_time: float):
        """Update provider performance metrics"""
        self.request_count += 1
        self.total_response_time += response_time
        self.last_request_time = time.time()
        
        if success:
            self.success_count += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get provider performance metrics"""
        if self.request_count == 0:
            return {
                'request_count': 0,
                'success_rate': 0.0,
                'avg_response_time': 0.0,
                'last_request_time': 0.0
            }
        
        return {
            'request_count': self.request_count,
            'success_rate': self.success_count / self.request_count,
            'avg_response_time': self.total_response_time / self.request_count,
            'last_request_time': self.last_request_time
        }
    
    def is_available(self) -> bool:
        """Check if provider is available for processing"""
        return self.enabled and bool(self.api_key)
    
    def get_capabilities(self) -> List[TaskType]:
        """Get list of task types this provider can handle"""
        # Default: all task types
        return list(TaskType)
    
    def estimate_cost(self, prompt_length: int, max_tokens: int) -> float:
        """Estimate cost for processing a request"""
        # Default implementation - override in specific providers
        return 0.0
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get rate limit information"""
        return {
            'requests_per_minute': self.config.get('rate_limit_rpm', 60),
            'tokens_per_minute': self.config.get('rate_limit_tpm', 100000),
            'requests_per_day': self.config.get('rate_limit_rpd', 1000)
        }
