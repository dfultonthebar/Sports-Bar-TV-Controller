
# AI-to-AI Communication System Usage Guide

## Quick Start

### 1. Setup and Configuration

#### Environment Setup
```bash
# Set API keys for AI providers
export OPENAI_API_KEY="your_openai_api_key_here"
export ANTHROPIC_API_KEY="your_anthropic_api_key_here"
export GROK_API_KEY="your_grok_api_key_here"

# Optional: Configure AI Bridge settings
export AI_BRIDGE_ENABLED="true"
export AI_BRIDGE_MAX_CONCURRENT_TASKS="10"
```

#### Configuration Files
Edit `config/ai_services/providers.yaml` to customize provider settings:

```yaml
openai:
  enabled: true  # Auto-enabled when API key is set
  model: "gpt-4"
  max_tokens: 4000
  temperature: 0.7

anthropic:
  enabled: true
  model: "claude-3-sonnet-20240229"
  max_tokens: 4000
  temperature: 0.7

grok:
  enabled: true
  model: "grok-beta"
  max_tokens: 4000
  temperature: 0.7
```

### 2. Basic Usage

#### Starting the AI Bridge
```python
from ai_bridge import AIBridge

# Initialize and start the AI Bridge
bridge = AIBridge()
await bridge.start()

# Check system status
status = bridge.get_status()
print(f"AI Bridge running with {len(status['providers'])} providers")
```

#### Simple Task Submission
```python
from ai_bridge import AITask, TaskType, TaskPriority

# Create a troubleshooting task
task = AITask(
    task_id="debug_001",
    task_type=TaskType.TROUBLESHOOTING,
    priority=TaskPriority.HIGH,
    description="Server is returning 500 errors intermittently",
    context={
        "error_logs": "Internal Server Error at /api/users",
        "server_load": "CPU: 45%, Memory: 78%",
        "recent_changes": "Updated user authentication module"
    }
)

# Submit and get result
task_id = await bridge.submit_task(task)
result = await bridge.get_task_result(task_id, timeout=60)

if result['success']:
    print("Diagnosis:", result['primary_result'])
else:
    print("Task failed:", result.get('error'))
```

## Task Types and Use Cases

### 1. Troubleshooting Tasks

**Best for**: System issues, debugging, problem diagnosis

```python
troubleshooting_task = AITask(
    task_id="troubleshoot_git_conflict",
    task_type=TaskType.TROUBLESHOOTING,
    priority=TaskPriority.MEDIUM,
    description="Git merge conflict preventing deployment",
    context={
        "conflict_files": ["config/database.yml", "src/models/user.py"],
        "branches": "main <- feature/user-auth",
        "error_message": "CONFLICT (content): Merge conflict in config/database.yml"
    },
    requirements={
        "strategy": "parallel_consensus",  # Use multiple AIs
        "high_accuracy": True
    }
)
```

### 2. Code Generation Tasks

**Best for**: Creating new code, scripts, configurations

```python
code_gen_task = AITask(
    task_id="generate_api_endpoint",
    task_type=TaskType.CODE_GENERATION,
    priority=TaskPriority.MEDIUM,
    description="Create a REST API endpoint for user management",
    context={
        "framework": "Flask",
        "database": "PostgreSQL",
        "authentication": "JWT tokens"
    },
    requirements={
        "language": "Python",
        "include_tests": True,
        "include_documentation": True,
        "strategy": "sequential_refinement"  # Generate then refine
    }
)
```

### 3. Code Review Tasks

**Best for**: Reviewing existing code, security analysis, optimization

```python
code_review_task = AITask(
    task_id="review_auth_module",
    task_type=TaskType.CODE_REVIEW,
    priority=TaskPriority.HIGH,
    description="Security review of authentication module",
    context={
        "code_files": {
            "auth.py": "# Authentication code here...",
            "models.py": "# User model code here..."
        },
        "focus_areas": ["security", "performance", "maintainability"]
    },
    requirements={
        "security_focused": True,
        "strategy": "parallel_consensus"
    }
)
```

### 4. Analysis Tasks

**Best for**: Data analysis, performance analysis, system analysis

```python
analysis_task = AITask(
    task_id="analyze_performance",
    task_type=TaskType.ANALYSIS,
    priority=TaskPriority.MEDIUM,
    description="Analyze system performance bottlenecks",
    context={
        "metrics": {
            "response_times": [120, 340, 890, 450, 230],
            "cpu_usage": [45, 67, 89, 78, 56],
            "memory_usage": [2.1, 2.8, 3.4, 3.1, 2.6]
        },
        "time_period": "last 24 hours"
    },
    requirements={
        "include_recommendations": True,
        "strategy": "parallel_consensus"
    }
)
```

## Collaborative Workflows

### 1. Peer Review Workflow

Use multiple AIs to review and improve solutions:

```python
from ai_bridge import CollaborationEngine, WorkflowType

collab = CollaborationEngine(bridge.providers)

# Execute peer review for code generation
result = await collab.execute_collaborative_workflow(
    workflow_type=WorkflowType.PEER_REVIEW,
    task=code_gen_task,
    provider_assignments={
        'primary': 'openai',      # Initial code generation
        'reviewer_1': 'anthropic', # Security and quality review
        'reviewer_2': 'grok'       # Performance and optimization review
    }
)

print("Final solution:", result.final_result)
print("Confidence score:", result.confidence_score)
```

### 2. Debate Consensus Workflow

Use AIs to debate and reach consensus on complex issues:

```python
debate_task = AITask(
    task_id="architecture_decision",
    task_type=TaskType.ANALYSIS,
    priority=TaskPriority.HIGH,
    description="Choose between microservices vs monolithic architecture",
    context={
        "current_system": "Monolithic Flask application",
        "team_size": 8,
        "expected_growth": "3x users in next year",
        "constraints": ["limited DevOps resources", "tight timeline"]
    }
)

result = await collab.execute_collaborative_workflow(
    workflow_type=WorkflowType.DEBATE_CONSENSUS,
    task=debate_task,
    provider_assignments={
        'debater_1': 'anthropic',  # Argue for microservices
        'debater_2': 'openai',     # Argue for monolith
        'moderator': 'grok'        # Synthesize consensus
    }
)
```

### 3. Sequential Refinement Workflow

Chain AIs for iterative improvement:

```python
result = await collab.execute_collaborative_workflow(
    workflow_type=WorkflowType.HIERARCHICAL_REFINEMENT,
    task=code_gen_task,
    provider_assignments={
        'generator': 'openai',        # Fast initial generation
        'technical_expert': 'anthropic', # Technical review
        'security_expert': 'grok',    # Security review
        'integrator': 'anthropic'     # Final integration
    }
)
```

## Integration with System Manager

### Automatic AI Assistance

The AI Bridge integrates with the existing System Manager to provide automatic assistance:

```python
# System Manager automatically uses AI Bridge for complex issues
system_manager = EnhancedSystemManager(config)

# AI Bridge is automatically triggered for:
# - Git merge conflicts
# - Installation failures
# - Performance issues
# - Security alerts

# Manual triggers
result = await system_manager.resolve_git_conflicts()
health_check = system_manager.trigger_installation_health_check()
```

### API Endpoints

Access AI Bridge functionality via REST API:

```bash
# Get AI Bridge status
curl http://localhost:8000/api/ai-bridge/status

# Get provider health
curl http://localhost:8000/api/ai-bridge/providers

# Trigger collaborative troubleshooting
curl -X POST http://localhost:8000/api/ai-bridge/collaborate \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "troubleshooting",
    "description": "Database connection issues",
    "workflow_type": "parallel_consensus"
  }'
```

## Advanced Configuration

### Custom Workflows

Create custom collaborative workflows:

```python
from ai_bridge import WorkflowStep

# Define custom workflow steps
custom_steps = [
    WorkflowStep(
        step_id="initial_analysis",
        step_type="analyze",
        provider_name="primary_analyzer",
        task_type=TaskType.ANALYSIS,
        prompt_template="Analyze this problem: {task_description}"
    ),
    WorkflowStep(
        step_id="solution_generation",
        step_type="generate",
        provider_name="solution_generator",
        task_type=TaskType.CODE_GENERATION,
        prompt_template="Generate solution based on analysis: {initial_analysis}",
        depends_on=["initial_analysis"]
    ),
    WorkflowStep(
        step_id="validation",
        step_type="validate",
        provider_name="validator",
        task_type=TaskType.CODE_REVIEW,
        prompt_template="Validate this solution: {solution_generation}",
        depends_on=["solution_generation"]
    )
]

# Register custom workflow
await collab.create_custom_workflow("custom_problem_solving", custom_steps)
```

### Provider Selection Strategies

Configure how providers are selected for tasks:

```yaml
# In config/ai_services/ai_bridge_config.yaml
coordination:
  provider_specializations:
    openai:
      - code_generation
      - documentation
    anthropic:
      - analysis
      - code_review
    grok:
      - monitoring
      - optimization
  
  selection_strategy: quality_optimized  # or cost_optimized, speed_optimized
```

### Cost Management

Monitor and control AI usage costs:

```python
# Get cost estimates
task_cost = bridge.estimate_task_cost(task)
print(f"Estimated cost: ${task_cost:.4f}")

# Set budget limits
bridge.set_budget_limit(daily_limit=10.00)  # $10 per day

# Get usage statistics
usage_stats = bridge.get_usage_statistics()
print(f"Today's usage: ${usage_stats['daily_cost']:.2f}")
```

## Monitoring and Troubleshooting

### System Health Monitoring

```python
# Get comprehensive system status
status = bridge.get_status()
print("System Status:", status['running'])
print("Active Providers:", len(status['providers']))
print("Queue Size:", status['tasks']['queued'])

# Get performance metrics
metrics = bridge.metrics.get_performance_report()
print("System Health:", metrics['system_health'])
print("Average Response Time:", metrics['performance_metrics']['avg_response_time_ms'])
```

### Provider Health Checks

```python
# Check individual provider health
for provider_name, provider in bridge.providers.items():
    health = await provider.health_check()
    print(f"{provider_name}: {'Healthy' if health else 'Unhealthy'}")

# Get detailed provider metrics
provider_stats = bridge.get_provider_statistics()
for name, stats in provider_stats.items():
    print(f"{name}: {stats['success_rate']:.1%} success rate")
```

### Debugging Failed Tasks

```python
# Get task execution history
task_history = bridge.get_task_history(limit=10)
for task_record in task_history:
    if not task_record['success']:
        print(f"Failed task {task_record['task_id']}: {task_record['error']}")

# Enable debug logging
import logging
logging.getLogger('ai_bridge').setLevel(logging.DEBUG)
```

## Best Practices

### 1. Task Design

- **Clear Descriptions**: Provide detailed, specific task descriptions
- **Rich Context**: Include relevant context information
- **Appropriate Priority**: Set realistic task priorities
- **Reasonable Timeouts**: Allow sufficient time for complex tasks

### 2. Provider Selection

- **Match Specializations**: Use providers suited for specific task types
- **Consider Costs**: Balance quality needs with cost constraints
- **Monitor Performance**: Track provider performance and adjust accordingly
- **Plan for Failures**: Always have fallback providers configured

### 3. Collaborative Workflows

- **Choose Appropriate Workflows**: Match workflow types to problem complexity
- **Provider Diversity**: Use different providers for different perspectives
- **Validate Results**: Always validate AI-generated solutions
- **Human Oversight**: Maintain human oversight for critical decisions

### 4. Performance Optimization

- **Batch Similar Tasks**: Group similar tasks for efficiency
- **Cache Results**: Cache frequently requested information
- **Monitor Metrics**: Regularly review performance metrics
- **Optimize Configurations**: Adjust settings based on usage patterns

### 5. Security and Safety

- **Validate Inputs**: Always validate and sanitize inputs
- **Review AI Outputs**: Review AI-generated code and solutions
- **Limit Permissions**: Use least-privilege access for AI operations
- **Audit Logs**: Maintain comprehensive audit logs

## Troubleshooting Common Issues

### Provider Connection Issues

```python
# Check API keys
for provider_name in ['openai', 'anthropic', 'grok']:
    api_key = os.getenv(f'{provider_name.upper()}_API_KEY')
    if not api_key:
        print(f"Missing API key for {provider_name}")

# Test provider connectivity
for provider_name, provider in bridge.providers.items():
    try:
        health = await provider.health_check()
        print(f"{provider_name}: {'OK' if health else 'FAILED'}")
    except Exception as e:
        print(f"{provider_name}: ERROR - {e}")
```

### High Response Times

```python
# Check provider performance
metrics = bridge.metrics.get_all_metrics_summary()
for provider in bridge.providers:
    response_time = metrics['metrics'].get(f'provider_{provider}_avg_response_time', {})
    if response_time.get('average', 0) > 30:  # > 30 seconds
        print(f"High response time for {provider}: {response_time['average']:.1f}s")
```

### Task Failures

```python
# Analyze failed tasks
failed_tasks = [t for t in bridge.get_task_history() if not t['success']]
error_types = {}
for task in failed_tasks:
    error = task.get('error', 'Unknown')
    error_types[error] = error_types.get(error, 0) + 1

print("Common errors:")
for error, count in sorted(error_types.items(), key=lambda x: x[1], reverse=True):
    print(f"  {error}: {count} occurrences")
```

## Support and Resources

### Documentation
- [Architecture Guide](AI_COMMUNICATION_ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [Configuration Reference](CONFIGURATION_REFERENCE.md)

### Monitoring
- System metrics available at `/api/ai-bridge/metrics`
- Health checks at `/api/ai-bridge/health`
- Performance dashboard integration

### Getting Help
- Check system logs for detailed error information
- Review provider documentation for API-specific issues
- Monitor system metrics for performance insights
- Use debug mode for detailed execution traces

The AI-to-AI Communication System provides powerful capabilities for enhanced problem-solving and automation. Start with simple tasks and gradually explore more advanced collaborative workflows as you become familiar with the system.
