
"""
OpenAI Provider
===============

Provider implementation for OpenAI's GPT models (GPT-4, GPT-3.5-turbo, etc.)
"""

import asyncio
import aiohttp
import json
import time
import logging
from typing import Dict, List, Any, Optional

from .base_provider import BaseAIProvider, AIResponse, TaskType

logger = logging.getLogger(__name__)

class OpenAIProvider(BaseAIProvider):
    """OpenAI GPT provider for AI-to-AI communication"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get('base_url', 'https://api.openai.com/v1')
        self.model = config.get('model', 'gpt-4')
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self.session is None or self.session.closed:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(headers=headers, timeout=timeout)
        return self.session
    
    async def process_task(
        self,
        task_type: TaskType,
        prompt: str,
        context: Dict[str, Any] = None,
        requirements: Dict[str, Any] = None
    ) -> AIResponse:
        """Process a task using OpenAI's API"""
        start_time = time.time()
        
        try:
            # Build the request
            system_prompt = self._build_system_prompt(task_type)
            user_prompt = self._build_user_prompt(prompt, context, requirements)
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
            
            # Add context messages if available
            if context and context.get('conversation_history'):
                for msg in context['conversation_history']:
                    messages.append(msg)
            
            request_data = {
                "model": self.model,
                "messages": messages,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "stream": False
            }
            
            # Add task-specific parameters
            if task_type == TaskType.CODE_GENERATION:
                request_data["temperature"] = 0.2  # Lower temperature for code
            elif task_type == TaskType.ANALYSIS:
                request_data["temperature"] = 0.1  # Very low for analysis
            
            # Make the API request
            session = await self._get_session()
            async with session.post(f"{self.base_url}/chat/completions", json=request_data) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result['choices'][0]['message']['content']
                    
                    # Extract structured information
                    structured_data = self._extract_structured_response(content, task_type)
                    
                    execution_time = time.time() - start_time
                    self._update_metrics(True, execution_time)
                    
                    return AIResponse(
                        success=True,
                        content=content,
                        confidence=structured_data.get('confidence', 0.8),
                        metadata={
                            'model': self.model,
                            'tokens_used': result.get('usage', {}).get('total_tokens', 0),
                            'provider': 'openai'
                        },
                        execution_time=execution_time,
                        diagnosis=structured_data.get('diagnosis'),
                        solutions=structured_data.get('solutions'),
                        insights=structured_data.get('insights'),
                        recommendations=structured_data.get('recommendations'),
                        code=structured_data.get('code')
                    )
                else:
                    error_text = await response.text()
                    logger.error(f"OpenAI API error {response.status}: {error_text}")
                    
                    execution_time = time.time() - start_time
                    self._update_metrics(False, execution_time)
                    
                    return AIResponse(
                        success=False,
                        content="",
                        error_message=f"API error {response.status}: {error_text}",
                        execution_time=execution_time
                    )
                    
        except asyncio.TimeoutError:
            execution_time = time.time() - start_time
            self._update_metrics(False, execution_time)
            
            return AIResponse(
                success=False,
                content="",
                error_message="Request timeout",
                execution_time=execution_time
            )
            
        except Exception as e:
            execution_time = time.time() - start_time
            self._update_metrics(False, execution_time)
            
            logger.error(f"OpenAI provider error: {e}")
            return AIResponse(
                success=False,
                content="",
                error_message=str(e),
                execution_time=execution_time
            )
    
    def _build_user_prompt(self, prompt: str, context: Dict[str, Any] = None, requirements: Dict[str, Any] = None) -> str:
        """Build user prompt with context and requirements"""
        user_prompt = prompt
        
        if context:
            context_str = "\n\nContext:\n"
            for key, value in context.items():
                if key != 'conversation_history':  # Skip conversation history
                    context_str += f"- {key}: {value}\n"
            user_prompt += context_str
        
        if requirements:
            req_str = "\n\nRequirements:\n"
            for key, value in requirements.items():
                req_str += f"- {key}: {value}\n"
            user_prompt += req_str
        
        return user_prompt
    
    async def health_check(self) -> bool:
        """Check OpenAI API health"""
        try:
            session = await self._get_session()
            
            # Simple test request
            test_data = {
                "model": self.model,
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 5
            }
            
            async with session.post(f"{self.base_url}/chat/completions", json=test_data) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            return False
    
    async def close(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def get_capabilities(self) -> List[TaskType]:
        """Get OpenAI capabilities"""
        return [
            TaskType.TROUBLESHOOTING,
            TaskType.CODE_GENERATION,
            TaskType.CODE_REVIEW,
            TaskType.ANALYSIS,
            TaskType.OPTIMIZATION,
            TaskType.DOCUMENTATION,
            TaskType.TESTING,
            TaskType.GENERAL
        ]
    
    def estimate_cost(self, prompt_length: int, max_tokens: int) -> float:
        """Estimate cost for OpenAI request"""
        # Rough cost estimation (as of 2024)
        if self.model.startswith('gpt-4'):
            input_cost_per_1k = 0.03
            output_cost_per_1k = 0.06
        else:  # GPT-3.5-turbo
            input_cost_per_1k = 0.001
            output_cost_per_1k = 0.002
        
        input_tokens = prompt_length // 4  # Rough estimation
        input_cost = (input_tokens / 1000) * input_cost_per_1k
        output_cost = (max_tokens / 1000) * output_cost_per_1k
        
        return input_cost + output_cost
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get OpenAI rate limits"""
        # Default rate limits for OpenAI (vary by tier)
        if self.model.startswith('gpt-4'):
            return {
                'requests_per_minute': 500,
                'tokens_per_minute': 30000,
                'requests_per_day': 10000
            }
        else:
            return {
                'requests_per_minute': 3500,
                'tokens_per_minute': 90000,
                'requests_per_day': 10000
            }
