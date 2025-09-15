
"""
AI Bridge Usage Examples
========================

Comprehensive examples demonstrating how to use the AI-to-AI communication system
for various tasks and scenarios.
"""

import asyncio
import logging
import os
from typing import Dict, Any

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import AI Bridge components
from ai_bridge import AIBridge, AITask, TaskType, TaskPriority
from ai_bridge.core.collaboration_engine import CollaborationEngine, WorkflowType
from ai_bridge.integration.system_manager_integration import SystemManagerAIIntegration

async def example_basic_troubleshooting():
    """Example: Basic troubleshooting with single AI provider"""
    print("\n=== Example 1: Basic Troubleshooting ===")
    
    # Initialize AI Bridge
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Create troubleshooting task
        task = AITask(
            task_id="troubleshoot_001",
            task_type=TaskType.TROUBLESHOOTING,
            priority=TaskPriority.HIGH,
            description="Application is returning 500 errors intermittently",
            context={
                "error_logs": [
                    "2024-01-15 10:30:15 ERROR: Database connection timeout",
                    "2024-01-15 10:30:16 ERROR: Failed to execute query: SELECT * FROM users",
                    "2024-01-15 10:30:17 ERROR: Connection pool exhausted"
                ],
                "system_metrics": {
                    "cpu_usage": 45,
                    "memory_usage": 78,
                    "database_connections": 95,
                    "response_time_avg": 2.5
                },
                "recent_changes": [
                    "Updated user authentication module",
                    "Increased database connection pool size",
                    "Added new API endpoints"
                ]
            }
        )
        
        # Submit task
        task_id = await bridge.submit_task(task)
        print(f"Submitted troubleshooting task: {task_id}")
        
        # Get result
        result = await bridge.get_task_result(task_id, timeout=60)
        
        if result and result.get('success'):
            print("Troubleshooting Result:")
            print(f"Primary Solution: {result['primary_result']}")
            if result.get('alternative_results'):
                print("Alternative Solutions:")
                for provider, solution in result['alternative_results'].items():
                    print(f"  {provider}: {solution}")
        else:
            print("Troubleshooting failed:", result.get('error') if result else "Timeout")
    
    finally:
        await bridge.stop()

async def example_collaborative_code_generation():
    """Example: Collaborative code generation with multiple AI providers"""
    print("\n=== Example 2: Collaborative Code Generation ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Initialize collaboration engine
        collab = CollaborationEngine(bridge.providers)
        
        # Create code generation task
        task = AITask(
            task_id="codegen_001",
            task_type=TaskType.CODE_GENERATION,
            priority=TaskPriority.MEDIUM,
            description="Create a REST API endpoint for user management with authentication",
            context={
                "framework": "Flask",
                "database": "PostgreSQL",
                "authentication": "JWT tokens",
                "requirements": [
                    "CRUD operations for users",
                    "Input validation",
                    "Error handling",
                    "Security best practices",
                    "Unit tests"
                ]
            },
            requirements={
                "language": "Python",
                "include_tests": True,
                "include_documentation": True
            }
        )
        
        # Execute peer review workflow
        result = await collab.execute_collaborative_workflow(
            workflow_type=WorkflowType.PEER_REVIEW,
            task=task,
            provider_assignments={
                'primary': 'openai',      # Initial code generation
                'reviewer_1': 'anthropic', # Security and quality review
                'reviewer_2': 'grok'       # Performance review
            }
        )
        
        if result.success:
            print("Collaborative Code Generation Result:")
            print(f"Final Solution:\n{result.final_result}")
            print(f"Confidence Score: {result.confidence_score:.2f}")
            print(f"Execution Time: {result.execution_time:.2f}s")
            print(f"Total Cost: ${result.total_cost:.4f}")
            
            print("\nStep Results:")
            for step_id, step_result in result.step_results.items():
                print(f"  {step_id}: {step_result.content[:100]}...")
        else:
            print("Collaborative code generation failed:", result.metadata.get('error'))
    
    finally:
        await bridge.stop()

async def example_debate_consensus():
    """Example: AI debate for architectural decisions"""
    print("\n=== Example 3: AI Debate for Architecture Decision ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        collab = CollaborationEngine(bridge.providers)
        
        # Create architecture decision task
        task = AITask(
            task_id="architecture_001",
            task_type=TaskType.ANALYSIS,
            priority=TaskPriority.HIGH,
            description="Choose between microservices vs monolithic architecture for our application",
            context={
                "current_system": "Monolithic Flask application with 50k lines of code",
                "team_size": 8,
                "expected_growth": "3x users and 2x features in next year",
                "current_issues": [
                    "Deployment takes 15 minutes",
                    "Difficult to scale individual components",
                    "Technology stack limitations"
                ],
                "constraints": [
                    "Limited DevOps resources (1 person)",
                    "Tight timeline (6 months)",
                    "Budget constraints",
                    "Team has limited microservices experience"
                ],
                "requirements": [
                    "Improved scalability",
                    "Faster deployment",
                    "Better fault isolation",
                    "Technology flexibility"
                ]
            }
        )
        
        # Execute debate consensus workflow
        result = await collab.execute_collaborative_workflow(
            workflow_type=WorkflowType.DEBATE_CONSENSUS,
            task=task,
            provider_assignments={
                'debater_1': 'anthropic',  # Argue for microservices
                'debater_2': 'openai',     # Argue for monolith
                'moderator': 'grok'        # Synthesize consensus
            }
        )
        
        if result.success:
            print("Architecture Decision Result:")
            print(f"Consensus Recommendation:\n{result.final_result}")
            print(f"Confidence Score: {result.confidence_score:.2f}")
            
            print("\nDebate Steps:")
            for step_id, step_result in result.step_results.items():
                print(f"  {step_id}: {step_result.content[:150]}...")
        else:
            print("Architecture debate failed:", result.metadata.get('error'))
    
    finally:
        await bridge.stop()

async def example_system_manager_integration():
    """Example: Using AI Bridge through System Manager integration"""
    print("\n=== Example 4: System Manager Integration ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Initialize system manager integration
        sm_integration = SystemManagerAIIntegration(bridge)
        
        # Example 1: Troubleshoot system issue
        print("Troubleshooting system issue...")
        troubleshoot_result = await sm_integration.troubleshoot_system_issue(
            issue_description="High memory usage causing application slowdown",
            error_logs=[
                "Memory usage at 95%",
                "Garbage collection taking too long",
                "Application response time increased to 5 seconds"
            ],
            system_metrics={
                "memory_usage_percent": 95,
                "cpu_usage_percent": 60,
                "gc_time_ms": 500,
                "response_time_ms": 5000
            },
            recent_changes=[
                "Added new caching layer",
                "Increased batch processing size",
                "Updated to new framework version"
            ]
        )
        
        if troubleshoot_result['success']:
            print("Troubleshooting successful:")
            print(f"Solution: {troubleshoot_result['result']}")
            print(f"Confidence: {troubleshoot_result['confidence']:.2f}")
        else:
            print("Troubleshooting failed:", troubleshoot_result['error'])
        
        # Example 2: Performance analysis
        print("\nAnalyzing performance issue...")
        performance_result = await sm_integration.analyze_performance_issue(
            performance_data={
                "response_times": [120, 340, 890, 450, 230, 670, 1200],
                "cpu_usage": [45, 67, 89, 78, 56, 82, 95],
                "memory_usage": [2.1, 2.8, 3.4, 3.1, 2.6, 3.8, 4.2],
                "database_queries": [150, 200, 350, 280, 180, 320, 450],
                "error_rate": [0.1, 0.2, 0.8, 0.5, 0.1, 0.6, 1.2]
            },
            time_range="2 hours"
        )
        
        if performance_result['success']:
            print("Performance analysis successful:")
            print(f"Analysis: {performance_result['result']}")
        else:
            print("Performance analysis failed:", performance_result['error'])
        
        # Example 3: Configuration optimization
        print("\nOptimizing system configuration...")
        optimization_result = await sm_integration.optimize_system_configuration(
            current_config={
                "database": {
                    "connection_pool_size": 20,
                    "query_timeout": 30,
                    "max_connections": 100
                },
                "cache": {
                    "max_memory": "512MB",
                    "ttl": 3600,
                    "eviction_policy": "lru"
                },
                "web_server": {
                    "worker_processes": 4,
                    "max_requests": 1000,
                    "timeout": 30
                }
            },
            performance_goals={
                "target_response_time": 200,  # ms
                "target_throughput": 1000,    # requests/second
                "target_memory_usage": 70     # percent
            },
            constraints={
                "max_memory": "8GB",
                "max_cpu_cores": 8,
                "budget_limit": 500  # dollars/month
            }
        )
        
        if optimization_result['success']:
            print("Configuration optimization successful:")
            print(f"Recommendations: {optimization_result['result']}")
        else:
            print("Configuration optimization failed:", optimization_result['error'])
        
        # Get integration statistics
        stats = sm_integration.get_ai_assistance_stats()
        print(f"\nAI Assistance Statistics:")
        print(f"Total requests: {stats['total_requests']}")
        print(f"Success rate: {stats['success_rate']:.1%}")
        print(f"Collaboration rate: {stats['collaboration_rate']:.1%}")
        print(f"Average execution time: {stats['average_execution_time']:.2f}s")
        print(f"Average confidence: {stats['average_confidence']:.2f}")
    
    finally:
        await bridge.stop()

async def example_cost_optimization():
    """Example: Cost-optimized AI usage"""
    print("\n=== Example 5: Cost Optimization ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Create a cost-sensitive task
        task = AITask(
            task_id="cost_opt_001",
            task_type=TaskType.DOCUMENTATION,
            priority=TaskPriority.LOW,
            description="Generate API documentation for user management endpoints",
            context={
                "api_endpoints": [
                    "GET /api/users",
                    "POST /api/users",
                    "PUT /api/users/{id}",
                    "DELETE /api/users/{id}"
                ],
                "authentication": "JWT Bearer token",
                "response_formats": ["JSON"],
                "error_codes": [400, 401, 403, 404, 500]
            },
            requirements={
                "cost_sensitive": True,
                "format": "markdown",
                "include_examples": True
            }
        )
        
        # Submit task with cost optimization
        task_id = await bridge.submit_task(task)
        result = await bridge.get_task_result(task_id, timeout=60)
        
        if result and result.get('success'):
            print("Cost-optimized documentation generation:")
            print(f"Result: {result['primary_result'][:200]}...")
            print(f"Provider used: {result.get('provider_consensus', 'unknown')}")
            
            # Estimate cost (if available)
            if 'cost_estimate' in result:
                print(f"Estimated cost: ${result['cost_estimate']:.4f}")
        else:
            print("Documentation generation failed")
    
    finally:
        await bridge.stop()

async def example_monitoring_and_metrics():
    """Example: Monitoring AI Bridge performance"""
    print("\n=== Example 6: Monitoring and Metrics ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Submit several tasks to generate metrics
        tasks = []
        for i in range(5):
            task = AITask(
                task_id=f"metric_test_{i}",
                task_type=TaskType.GENERAL,
                priority=TaskPriority.LOW,
                description=f"Test task {i} for metrics collection",
                context={"test_number": i}
            )
            task_id = await bridge.submit_task(task)
            tasks.append(task_id)
        
        # Wait for tasks to complete
        await asyncio.sleep(10)
        
        # Get system status
        status = bridge.get_status()
        print("System Status:")
        print(f"  Running: {status['running']}")
        print(f"  Active tasks: {status['tasks']['active']}")
        print(f"  Completed tasks: {status['tasks']['completed']}")
        print(f"  Queued tasks: {status['tasks']['queued']}")
        print(f"  Workers: {status['workers']}")
        
        print("\nProvider Status:")
        for provider_name, provider_status in status['providers'].items():
            print(f"  {provider_name}:")
            print(f"    Status: {provider_status['status']}")
            print(f"    Success rate: {provider_status['success_rate']:.1%}")
            print(f"    Avg response time: {provider_status['avg_response_time']:.2f}s")
        
        # Get performance report
        performance_report = bridge.metrics.get_performance_report()
        print(f"\nSystem Health: {performance_report['system_health']}")
        print(f"Uptime: {performance_report['uptime_seconds']:.0f} seconds")
        
        if performance_report['alerts']:
            print("Alerts:")
            for alert in performance_report['alerts']:
                print(f"  {alert['type']}: {alert['message']} ({alert['severity']})")
        
        if performance_report['recommendations']:
            print("Recommendations:")
            for rec in performance_report['recommendations']:
                print(f"  - {rec}")
    
    finally:
        await bridge.stop()

async def example_error_handling():
    """Example: Error handling and recovery"""
    print("\n=== Example 7: Error Handling and Recovery ===")
    
    bridge = AIBridge()
    await bridge.start()
    
    try:
        # Create a task that might fail
        task = AITask(
            task_id="error_test_001",
            task_type=TaskType.CODE_GENERATION,
            priority=TaskPriority.MEDIUM,
            description="Generate code with intentionally problematic requirements",
            context={
                "requirements": "Create a function that does everything perfectly with no bugs",
                "constraints": "Must be only 1 line of code and solve all problems"
            },
            max_attempts=3,
            timeout_seconds=30
        )
        
        task_id = await bridge.submit_task(task)
        result = await bridge.get_task_result(task_id, timeout=45)
        
        if result:
            if result.get('success'):
                print("Task succeeded despite challenging requirements:")
                print(f"Result: {result['primary_result']}")
            else:
                print("Task failed as expected:")
                print(f"Error: {result.get('error')}")
        else:
            print("Task timed out")
        
        # Test provider fallback
        print("\nTesting provider fallback...")
        
        # Create task with preferred provider that might not be available
        fallback_task = AITask(
            task_id="fallback_test_001",
            task_type=TaskType.GENERAL,
            priority=TaskPriority.LOW,
            description="Simple test task",
            preferred_providers=["nonexistent_provider", "openai", "anthropic"]
        )
        
        task_id = await bridge.submit_task(fallback_task)
        result = await bridge.get_task_result(task_id, timeout=30)
        
        if result and result.get('success'):
            print("Fallback successful - task completed with available provider")
        else:
            print("Fallback failed")
    
    finally:
        await bridge.stop()

async def main():
    """Run all examples"""
    print("AI Bridge Examples")
    print("==================")
    
    # Check if API keys are configured
    api_keys_configured = []
    for provider in ['OPENAI', 'ANTHROPIC', 'GROK']:
        if os.getenv(f'{provider}_API_KEY'):
            api_keys_configured.append(provider.lower())
    
    if not api_keys_configured:
        print("Warning: No API keys configured. Set environment variables:")
        print("  export OPENAI_API_KEY='your_key'")
        print("  export ANTHROPIC_API_KEY='your_key'")
        print("  export GROK_API_KEY='your_key'")
        print("\nRunning examples in demo mode...")
    else:
        print(f"Configured providers: {', '.join(api_keys_configured)}")
    
    # Run examples
    examples = [
        example_basic_troubleshooting,
        example_collaborative_code_generation,
        example_debate_consensus,
        example_system_manager_integration,
        example_cost_optimization,
        example_monitoring_and_metrics,
        example_error_handling
    ]
    
    for example_func in examples:
        try:
            await example_func()
        except Exception as e:
            print(f"Example {example_func.__name__} failed: {e}")
        
        print("\n" + "="*50)
        await asyncio.sleep(1)  # Brief pause between examples

if __name__ == "__main__":
    asyncio.run(main())
