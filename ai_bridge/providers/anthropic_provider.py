
"""
Anthropic Claude Provider
=========================

Provider implementation for Anthropic's Claude models
"""

import asyncio
import aiohttp
import json
import time
import logging
from typing import Dict, List, Any, Optional

from .base_provider import BaseAIProvider, AIResponse, TaskType

logger = logging.getLogger(__name__)

class AnthropicProvider(BaseAIProvider):
    """Anthropic Claude provider for AI-to-AI communication"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.base_url = config.get('base_url', 'https://api.anthropic.com/v1')
        self.model = config.get('model', 'claude-3-sonnet-20240229')
        self.session: Optional[aiohttp.ClientSession] = None
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self.session is None or self.session.closed:
            headers = {
                'x-api-key': self.api_key,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
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
        """Process a task using Anthropic's API"""
        start_time = time.time()
        
        try:
            # Build the request
            system_prompt = self._build_system_prompt(task_type)
            user_prompt = self._build_user_prompt(prompt, context, requirements)
            
            request_data = {
                "model": self.model,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": user_prompt}
                ]
            }
            
            # Add context messages if available
            if context and context.get('conversation_history'):
                messages = []
                for msg in context['conversation_history']:
                    # Convert OpenAI format to Anthropic format if needed
                    if msg.get('role') == 'assistant':
                        messages.append({"role": "assistant", "content": msg['content']})
                    elif msg.get('role') == 'user':
                        messages.append({"role": "user", "content": msg['content']})
                
                # Add the current user message
                messages.append({"role": "user", "content": user_prompt})
                request_data["messages"] = messages
            
            # Adjust parameters for task type
            if task_type == TaskType.CODE_GENERATION:
                request_data["temperature"] = 0.2
            elif task_type == TaskType.ANALYSIS:
                request_data["temperature"] = 0.1
            
            # Make the API request
            session = await self._get_session()
            async with session.post(f"{self.base_url}/messages", json=request_data) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result['content'][0]['text']
                    
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
                            'tokens_used': result.get('usage', {}).get('output_tokens', 0),
                            'provider': 'anthropic'
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
                    logger.error(f"Anthropic API error {response.status}: {error_text}")
                    
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
            
            logger.error(f"Anthropic provider error: {e}")
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
                if key != 'conversation_history':
                    context_str += f"- {key}: {value}\n"
            user_prompt += context_str
        
        if requirements:
            req_str = "\n\nRequirements:\n"
            for key, value in requirements.items():
                req_str += f"- {key}: {value}\n"
            user_prompt += req_str
        
        return user_prompt
    
    async def health_check(self) -> bool:
        """Check Anthropic API health"""
        try:
            session = await self._get_session()
            
            # Simple test request
            test_data = {
                "model": self.model,
                "max_tokens": 5,
                "messages": [{"role": "user", "content": "Hello"}]
            }
            
            async with session.post(f"{self.base_url}/messages", json=test_data) as response:
                return response.status == 200
                
        except Exception as e:
            logger.error(f"Anthropic health check failed: {e}")
            return False
    
    async def close(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def get_capabilities(self) -> List[TaskType]:
        """Get Anthropic capabilities"""
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
        """Estimate cost for Anthropic request"""
        # Rough cost estimation for Claude (as of 2024)
        if 'claude-3-opus' in self.model:
            input_cost_per_1k = 0.015
            output_cost_per_1k = 0.075
        elif 'claude-3-sonnet' in self.model:
            input_cost_per_1k = 0.003
            output_cost_per_1k = 0.015
        else:  # claude-3-haiku
            input_cost_per_1k = 0.00025
            output_cost_per_1k = 0.00125
        
        input_tokens = prompt_length // 4  # Rough estimation
        input_cost = (input_tokens / 1000) * input_cost_per_1k
        output_cost = (max_tokens / 1000) * output_cost_per_1k
        
        return input_cost + output_cost
    
    def get_rate_limits(self) -> Dict[str, Any]:
        """Get Anthropic rate limits"""
        return {
            'requests_per_minute': 1000,
            'tokens_per_minute': 100000,
            'requests_per_day': 10000
        }
