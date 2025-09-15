
"""
AI Bridge Test Suite
===================

Comprehensive tests for the AI-to-AI communication system.
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

# Import components to test
from ai_bridge import AIBridge, AITask, TaskType, TaskPriority
from ai_bridge.core.task_coordinator import TaskCoordinator, CoordinationStrategy
from ai_bridge.core.collaboration_engine import CollaborationEngine, WorkflowType
from ai_bridge.providers.base_provider import BaseAIProvider, AIResponse
from ai_bridge.utils.config_manager import ConfigManager
from ai_bridge.utils.metrics_collector import MetricsCollector

class MockAIProvider(BaseAIProvider):
    """Mock AI provider for testing"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.call_count = 0
        self.responses = []
        self.should_fail = False
        self.response_delay = 0.1
    
    async def process_task(self, task_type, prompt, context=None, requirements=None):
        self.call_count += 1
        
        if self.response_delay:
            await asyncio.sleep(self.response_delay)
        
        if self.should_fail:
            raise Exception("Mock provider failure")
        
        response = AIResponse(
            success=True,
            content=f"Mock response from {self.name} for: {prompt[:50]}...",
            confidence=0.8,
            metadata={'provider': self.name, 'call_count': self.call_count}
        )
        
        self.responses.append(response)
        return response
    
    async def health_check(self):
        return not self.should_fail
    
    async def close(self):
        pass

@pytest.fixture
def mock_providers():
    """Create mock providers for testing"""
    providers = {
        'mock_openai': MockAIProvider({
            'name': 'Mock OpenAI',
            'enabled': True,
            'api_key': 'test_key'
        }),
        'mock_anthropic': MockAIProvider({
            'name': 'Mock Anthropic',
            'enabled': True,
            'api_key': 'test_key'
        }),
        'mock_grok': MockAIProvider({
            'name': 'Mock Grok',
            'enabled': True,
            'api_key': 'test_key'
        })
    }
    return providers

@pytest.fixture
def config_manager():
    """Create test configuration manager"""
    return ConfigManager()

@pytest.fixture
async def ai_bridge(mock_providers):
    """Create AI bridge with mock providers"""
    with patch('ai_bridge.core.ai_bridge.ConfigManager') as mock_config:
        mock_config.return_value.get_provider_configs.return_value = {
            name: {'enabled': True, 'api_key': 'test'} 
            for name in mock_providers.keys()
        }
        mock_config.return_value.get.return_value = 3  # num_workers
        
        bridge = AIBridge()
        bridge.providers = mock_providers
        
        # Initialize provider health
        for name in mock_providers.keys():
            bridge.provider_health[name] = {
                'status': 'healthy',
                'last_check': time.time(),
                'success_rate': 1.0,
                'avg_response_time': 0.1,
                'total_requests': 0,
                'failed_requests': 0
            }
        
        await bridge.start()
        yield bridge
        await bridge.stop()

class TestAIBridge:
    """Test AI Bridge core functionality"""
    
    @pytest.mark.asyncio
    async def test_bridge_initialization(self, ai_bridge):
        """Test AI bridge initialization"""
        assert ai_bridge.running
        assert len(ai_bridge.providers) == 3
        assert len(ai_bridge.worker_tasks) > 0
    
    @pytest.mark.asyncio
    async def test_simple_task_submission(self, ai_bridge):
        """Test basic task submission and processing"""
        task = AITask(
            task_id="test_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.MEDIUM,
            description="Test task for basic functionality"
        )
        
        task_id = await ai_bridge.submit_task(task)
        assert task_id == "test_001"
        assert task_id in ai_bridge.active_tasks
        
        # Wait for task completion
        result = await ai_bridge.get_task_result(task_id, timeout=5)
        
        assert result is not None
        assert result['success']
        assert 'primary_result' in result
    
    @pytest.mark.asyncio
    async def test_collaborative_task(self, ai_bridge):
        """Test collaborative task processing"""
        task = AITask(
            task_id="collab_001",
            task_type=TaskType.TROUBLESHOOTING,
            priority=TaskPriority.HIGH,
            description="Complex troubleshooting task requiring collaboration"
        )
        
        # Use collaboration
        result = await ai_bridge.collaborate_on_task(task, num_providers=2)
        
        assert result['success']
        assert result['provider_consensus'] >= 2
        assert 'primary_result' in result
    
    @pytest.mark.asyncio
    async def test_provider_failover(self, ai_bridge):
        """Test provider failover functionality"""
        # Make one provider fail
        ai_bridge.providers['mock_openai'].should_fail = True
        
        task = AITask(
            task_id="failover_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.MEDIUM,
            description="Test failover functionality",
            preferred_providers=['mock_openai', 'mock_anthropic']
        )
        
        task_id = await ai_bridge.submit_task(task)
        result = await ai_bridge.get_task_result(task_id, timeout=5)
        
        # Should still succeed with fallback provider
        assert result is not None
        assert result['success']
    
    @pytest.mark.asyncio
    async def test_task_timeout(self, ai_bridge):
        """Test task timeout handling"""
        # Make provider slow
        ai_bridge.providers['mock_openai'].response_delay = 10
        
        task = AITask(
            task_id="timeout_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.LOW,
            description="Test timeout handling",
            timeout_seconds=1
        )
        
        task_id = await ai_bridge.submit_task(task)
        result = await ai_bridge.get_task_result(task_id, timeout=2)
        
        # Should timeout or handle gracefully
        assert result is None or not result.get('success')

class TestTaskCoordinator:
    """Test Task Coordinator functionality"""
    
    @pytest.fixture
    def task_coordinator(self, mock_providers):
        return TaskCoordinator(mock_providers)
    
    def test_strategy_selection(self, task_coordinator):
        """Test coordination strategy selection"""
        # Test troubleshooting task
        task = AITask(
            task_id="strategy_001",
            task_type=TaskType.TROUBLESHOOTING,
            priority=TaskPriority.HIGH,
            description="Test strategy selection"
        )
        
        route = task_coordinator.route_task(task)
        assert route.strategy == CoordinationStrategy.PARALLEL_CONSENSUS
        assert len(route.primary_providers) >= 1
    
    def test_provider_selection(self, task_coordinator):
        """Test provider selection logic"""
        task = AITask(
            task_id="provider_001",
            task_type=TaskType.CODE_GENERATION,
            priority=TaskPriority.MEDIUM,
            description="Test provider selection"
        )
        
        route = task_coordinator.route_task(task)
        assert len(route.primary_providers) >= 1
        assert all(provider in task_coordinator.providers for provider in route.primary_providers)
    
    def test_load_balancing(self, task_coordinator):
        """Test load balancing functionality"""
        # Simulate high load on one provider
        task_coordinator.update_provider_load('mock_openai', active_tasks=10, queue_length=5)
        task_coordinator.update_provider_load('mock_anthropic', active_tasks=1, queue_length=0)
        
        task = AITask(
            task_id="load_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.LOW,
            description="Test load balancing"
        )
        
        route = task_coordinator.route_task(task)
        # Should prefer less loaded provider
        assert 'mock_anthropic' in route.primary_providers

class TestCollaborationEngine:
    """Test Collaboration Engine functionality"""
    
    @pytest.fixture
    def collaboration_engine(self, mock_providers):
        return CollaborationEngine(mock_providers)
    
    @pytest.mark.asyncio
    async def test_peer_review_workflow(self, collaboration_engine):
        """Test peer review workflow"""
        task = AITask(
            task_id="peer_001",
            task_type=TaskType.CODE_GENERATION,
            priority=TaskPriority.MEDIUM,
            description="Generate a simple function"
        )
        
        result = await collaboration_engine.execute_collaborative_workflow(
            workflow_type=WorkflowType.PEER_REVIEW,
            task=task,
            provider_assignments={
                'primary': 'mock_openai',
                'reviewer_1': 'mock_anthropic',
                'reviewer_2': 'mock_grok'
            }
        )
        
        assert result.success
        assert result.final_result is not None
        assert len(result.step_results) >= 3  # initial + 2 reviews + refinement
        assert result.confidence_score > 0
    
    @pytest.mark.asyncio
    async def test_debate_consensus_workflow(self, collaboration_engine):
        """Test debate consensus workflow"""
        task = AITask(
            task_id="debate_001",
            task_type=TaskType.ANALYSIS,
            priority=TaskPriority.HIGH,
            description="Analyze architectural decision"
        )
        
        result = await collaboration_engine.execute_collaborative_workflow(
            workflow_type=WorkflowType.DEBATE_CONSENSUS,
            task=task
        )
        
        assert result.success
        assert result.final_result is not None
        assert result.confidence_score > 0
    
    @pytest.mark.asyncio
    async def test_custom_workflow(self, collaboration_engine):
        """Test custom workflow creation"""
        from ai_bridge.core.collaboration_engine import WorkflowStep
        
        custom_steps = [
            WorkflowStep(
                step_id="analyze",
                step_type="analyze",
                provider_name="analyzer",
                task_type=TaskType.ANALYSIS,
                prompt_template="Analyze: {task_description}"
            ),
            WorkflowStep(
                step_id="synthesize",
                step_type="synthesize",
                provider_name="synthesizer",
                task_type=TaskType.GENERAL,
                prompt_template="Synthesize: {analyze}",
                depends_on=["analyze"]
            )
        ]
        
        success = await collaboration_engine.create_custom_workflow("test_workflow", custom_steps)
        assert success
        assert "test_workflow" in collaboration_engine.workflow_templates

class TestConfigManager:
    """Test Configuration Manager"""
    
    def test_default_config_loading(self):
        """Test default configuration loading"""
        config_manager = ConfigManager()
        
        assert config_manager.get('ai_bridge.enabled') is True
        assert config_manager.get('processing.num_workers') == 3
        assert config_manager.get('nonexistent.key', 'default') == 'default'
    
    def test_provider_config_management(self):
        """Test provider configuration management"""
        config_manager = ConfigManager()
        
        # Test provider configuration
        provider_configs = config_manager.get_provider_configs()
        assert 'openai' in provider_configs
        assert 'anthropic' in provider_configs
        assert 'grok' in provider_configs
        
        # Test provider enablement check
        # Should be False without API keys
        assert not config_manager.is_provider_enabled('openai')
    
    def test_config_validation(self):
        """Test configuration validation"""
        config_manager = ConfigManager()
        
        issues = config_manager.validate_config()
        assert 'errors' in issues
        assert 'warnings' in issues
        
        # Should have error about no enabled providers
        assert any('No AI providers' in error for error in issues['errors'])

class TestMetricsCollector:
    """Test Metrics Collector"""
    
    @pytest.fixture
    def metrics_collector(self):
        return MetricsCollector()
    
    def test_metric_recording(self, metrics_collector):
        """Test basic metric recording"""
        metrics_collector.record_metric('test_metric', 42.0, {'tag': 'value'})
        
        summary = metrics_collector.get_metric_summary('test_metric')
        assert summary['latest'] == 42.0
        assert summary['count'] == 1
    
    def test_counter_increment(self, metrics_collector):
        """Test counter functionality"""
        metrics_collector.increment_counter('test_counter', 5)
        metrics_collector.increment_counter('test_counter', 3)
        
        assert metrics_collector.counters['test_counter'] == 8
    
    def test_gauge_setting(self, metrics_collector):
        """Test gauge functionality"""
        metrics_collector.set_gauge('test_gauge', 75.5)
        
        assert metrics_collector.gauges['test_gauge'] == 75.5
    
    def test_task_metrics_recording(self, metrics_collector):
        """Test task-specific metrics recording"""
        task_data = {
            'success': True,
            'execution_time': 2.5,
            'provider': 'test_provider',
            'task_type': 'test_type'
        }
        
        metrics_collector.record_task_metrics(task_data)
        
        assert metrics_collector.counters['tasks_completed'] == 1
        
        # Check response time metric
        response_time_summary = metrics_collector.get_metric_summary('response_time_ms')
        assert response_time_summary['latest'] == 2500  # 2.5s in ms
    
    def test_performance_report(self, metrics_collector):
        """Test performance report generation"""
        # Record some metrics
        metrics_collector.increment_counter('tasks_completed', 10)
        metrics_collector.increment_counter('tasks_failed', 2)
        metrics_collector.record_metric('response_time_ms', 1500)
        metrics_collector.set_gauge('queue_size', 5)
        
        report = metrics_collector.get_performance_report()
        
        assert 'system_health' in report
        assert 'performance_metrics' in report
        assert 'alerts' in report
        assert 'recommendations' in report
        
        # Check error rate calculation
        if 'error_rate' in report['performance_metrics']:
            expected_error_rate = 2 / 12  # 2 failed out of 12 total
            assert abs(report['performance_metrics']['error_rate'] - expected_error_rate) < 0.01

class TestIntegration:
    """Integration tests"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_workflow(self, ai_bridge):
        """Test complete end-to-end workflow"""
        # Create a complex task
        task = AITask(
            task_id="e2e_001",
            task_type=TaskType.TROUBLESHOOTING,
            priority=TaskPriority.HIGH,
            description="Complex system issue requiring multiple AI perspectives",
            context={
                "error_logs": ["Error 1", "Error 2"],
                "system_metrics": {"cpu": 80, "memory": 90},
                "recent_changes": ["Change 1", "Change 2"]
            }
        )
        
        # Submit task
        task_id = await ai_bridge.submit_task(task)
        
        # Wait for completion
        result = await ai_bridge.get_task_result(task_id, timeout=10)
        
        # Verify result
        assert result is not None
        assert result['success']
        assert 'primary_result' in result
        
        # Check that providers were called
        total_calls = sum(provider.call_count for provider in ai_bridge.providers.values())
        assert total_calls > 0
        
        # Check metrics were recorded
        status = ai_bridge.get_status()
        assert status['tasks']['completed'] >= 1
    
    @pytest.mark.asyncio
    async def test_system_resilience(self, ai_bridge):
        """Test system resilience under various failure conditions"""
        # Test with all providers failing except one
        ai_bridge.providers['mock_openai'].should_fail = True
        ai_bridge.providers['mock_anthropic'].should_fail = True
        # Keep mock_grok working
        
        task = AITask(
            task_id="resilience_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.MEDIUM,
            description="Test system resilience"
        )
        
        task_id = await ai_bridge.submit_task(task)
        result = await ai_bridge.get_task_result(task_id, timeout=5)
        
        # Should still work with one provider
        assert result is not None
        assert result['success']
    
    @pytest.mark.asyncio
    async def test_concurrent_tasks(self, ai_bridge):
        """Test handling of concurrent tasks"""
        tasks = []
        
        # Submit multiple tasks concurrently
        for i in range(5):
            task = AITask(
                task_id=f"concurrent_{i}",
                task_type=TaskType.GENERAL,
                priority=TaskPriority.LOW,
                description=f"Concurrent test task {i}"
            )
            task_id = await ai_bridge.submit_task(task)
            tasks.append(task_id)
        
        # Wait for all tasks to complete
        results = []
        for task_id in tasks:
            result = await ai_bridge.get_task_result(task_id, timeout=10)
            results.append(result)
        
        # All tasks should complete successfully
        successful_results = [r for r in results if r and r.get('success')]
        assert len(successful_results) == len(tasks)

# Test fixtures and utilities
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
