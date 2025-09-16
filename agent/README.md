
# AI Agent System for Sports Bar TV Controller

This AI Agent system provides intelligent monitoring, error analysis, and automated system management for the Sports Bar TV Controller. The system continuously monitors logs, analyzes errors, suggests fixes, and can automatically implement safe repairs.

## 🤖 Features

### Real-time Log Monitoring
- **Continuous Monitoring**: Watches log files in real-time using the watchdog library
- **Pattern Detection**: Identifies error patterns, connection issues, API failures, and device problems
- **Smart Filtering**: Rate limiting and deduplication to prevent alert spam
- **Multi-directory Support**: Monitors multiple log directories simultaneously

### AI-Powered Error Analysis
- **Intelligent Classification**: Automatically categorizes errors by type and severity
- **Root Cause Analysis**: Determines likely causes of system issues
- **Fix Suggestions**: Provides specific, actionable fix recommendations
- **Confidence Scoring**: Rates the reliability of analysis and suggestions

### Automated Task Management
- **Content Discovery**: Helps find and recommend sports content
- **System Maintenance**: Performs routine cleanup and health checks
- **Device Monitoring**: Checks device connectivity and status
- **Preset Optimization**: Analyzes usage patterns and suggests improvements

### Intelligent System Management
- **Coordinated Response**: Orchestrates all AI components for comprehensive system management
- **Automatic Fixes**: Safely implements low-risk fixes without human intervention
- **Alert System**: Notifies operators of critical issues requiring attention
- **Performance Tracking**: Monitors system health and agent effectiveness

## 🏗️ Architecture

```
agent/
├── __init__.py              # Package initialization
├── monitor.py               # Real-time log monitoring
├── analyzer.py              # AI error analysis and fix suggestions
├── tasks.py                 # Task automation and content discovery
├── system_manager.py        # Central coordination and management
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

### Component Overview

#### LogMonitor (`monitor.py`)
- Monitors log files using watchdog
- Detects error patterns with regex matching
- Provides real-time event callbacks
- Maintains error statistics and history

#### ErrorAnalyzer (`analyzer.py`)
- Analyzes log events for errors and issues
- Classifies error types and severity levels
- Generates fix suggestions with risk assessment
- Can implement safe automated fixes

#### TaskAutomator (`tasks.py`)
- Manages automated tasks and workflows
- Handles content discovery and recommendations
- Performs system maintenance operations
- Provides task scheduling and execution

#### SystemManager (`system_manager.py`)
- Coordinates all AI agent components
- Makes intelligent decisions about system actions
- Manages alerts and notifications
- Provides unified system status and metrics

## 🚀 Quick Start

### Installation

The AI agent system is integrated into the main Sports Bar TV Controller. Dependencies are automatically installed when you set up the main system.

```bash
# Install additional AI agent dependencies
pip install -r agent/requirements.txt
```

### Configuration

The AI agent system is configured through the main system configuration. Add AI agent settings to your configuration:

```yaml
# config/ai_agent_config.yaml
ai_agent:
  enabled: true
  
  # Log monitoring settings
  monitor_config:
    log_directories:
      - "logs/"
      - "backend/logs/"
    rate_limit_minutes: 5
    max_occurrences_per_window: 5
    history_hours: 24
    
  # Error analysis settings
  analyzer_config:
    llm_enabled: false  # Set to true when LLM integration is available
    auto_fix_enabled: true
    auto_fix_risk_threshold: "MEDIUM"
    
  # Task automation settings
  task_config:
    max_concurrent_tasks: 5
    task_timeout_seconds: 300
    content_refresh_minutes: 15
    
  # System management settings
  health_check_interval_minutes: 15
  maintenance_interval_hours: 24
```

### Usage

The AI agent system starts automatically with the main Sports Bar TV Controller:

```python
from agent import SystemManager

# Initialize and start the AI agent system
config = load_ai_config()  # Load your configuration
system_manager = SystemManager(config)

await system_manager.start()

# The system will now:
# - Monitor logs in real-time
# - Analyze errors and suggest fixes
# - Perform automated maintenance
# - Provide system health monitoring
```

## 📊 Monitoring and Status

### System Status API

Get comprehensive system status:

```python
status = system_manager.get_system_status()
print(f"Overall Health: {status.overall_health}")
print(f"Health Score: {status.health_score}/100")
print(f"Active Issues: {status.active_issues}")
print(f"Recommendations: {status.recommendations}")
```

### Recent Actions

View recent AI agent actions:

```python
actions = system_manager.get_recent_actions(hours=24)
for action in actions:
    print(f"{action['timestamp']}: {action['description']}")
```

### System Metrics

Get detailed system metrics:

```python
metrics = system_manager.get_system_metrics()
print(f"Uptime: {metrics['uptime_seconds']} seconds")
print(f"Active Tasks: {metrics['active_tasks']}")
print(f"Error Rate: {metrics['log_health']['recent_errors']}")
```

## 🔧 Error Detection Patterns

The system detects various types of errors:

### Connection Errors
- Device connectivity issues
- Network timeouts
- Service unavailability

### Authentication Errors
- Invalid credentials
- Expired API keys
- Permission denied

### Resource Errors
- Memory exhaustion
- Disk space issues
- CPU overload

### Device Errors
- Wolfpack matrix issues
- Atlas processor problems
- Hardware failures

### API Errors
- Rate limiting
- Service errors
- Invalid responses

## 🛠️ Automated Fixes

The system can automatically implement safe fixes:

### Low-Risk Fixes (Automatic)
- Configuration adjustments
- Cache cleanup
- Log rotation
- Service health checks

### Medium-Risk Fixes (Configurable)
- Service restarts
- Device reconnection
- Resource cleanup
- Network diagnostics

### High-Risk Fixes (Manual Only)
- System reboots
- Configuration changes
- Hardware interventions

## 📈 Task Automation

### Content Discovery Tasks
- **Live Game Discovery**: Find currently live sports events
- **Content Recommendations**: Suggest relevant content based on trends
- **Deep Link Generation**: Create direct links to streaming content
- **Cache Updates**: Refresh sports data and content information

### Maintenance Tasks
- **Health Checks**: Comprehensive system health assessment
- **Log Cleanup**: Remove old log files to free disk space
- **Cache Cleanup**: Clear temporary data and caches
- **Device Status**: Check connectivity and status of all devices

### Analysis Tasks
- **Error Pattern Analysis**: Identify recurring error patterns
- **Performance Analysis**: Analyze system performance metrics
- **Usage Pattern Analysis**: Study user behavior and system usage
- **Preset Optimization**: Suggest improvements to AV presets

## 🚨 Alerting System

### Alert Levels
- **INFO**: General information and successful operations
- **WARNING**: Issues that may need attention but don't affect operation
- **HIGH**: Problems that impact system functionality
- **CRITICAL**: Severe issues requiring immediate attention

### Alert Callbacks

Register custom alert handlers:

```python
async def custom_alert_handler(alert_data):
    severity = alert_data['severity']
    description = alert_data['description']
    
    if severity == 'CRITICAL':
        # Send email, SMS, or push notification
        await send_critical_alert(description)
    elif severity == 'HIGH':
        # Log to monitoring system
        await log_to_monitoring(alert_data)

system_manager.add_alert_callback(custom_alert_handler)
```

## 🔍 Troubleshooting

### Common Issues

#### Agent Not Starting
```bash
# Check log files for errors
tail -f logs/sportsbar_av.log

# Verify dependencies
pip install -r agent/requirements.txt

# Check configuration
python -c "import yaml; print(yaml.safe_load(open('config/ai_agent_config.yaml')))"
```

#### High Memory Usage
```bash
# Check system resources
python -c "from agent.system_manager import SystemManager; sm = SystemManager(); print(sm.get_system_metrics())"

# Clean up old data
# The system automatically cleans up, but you can force it:
# system_manager._cleanup_old_data()
```

#### False Positive Alerts
```yaml
# Adjust rate limiting in config
monitor_config:
  rate_limit_minutes: 10  # Increase from 5
  max_occurrences_per_window: 3  # Decrease from 5
```

### Debug Mode

Enable debug logging for troubleshooting:

```python
import logging
logging.getLogger('agent').setLevel(logging.DEBUG)
```

## 🔮 Future Enhancements

### Planned Features
- **LLM Integration**: Advanced natural language processing for error analysis
- **Machine Learning**: Pattern recognition and predictive maintenance
- **Advanced Automation**: More sophisticated automated fixes
- **Integration APIs**: REST API for external monitoring systems
- **Dashboard UI**: Web interface for AI agent management

### LLM Integration (Coming Soon)
```python
# Future LLM-powered analysis
analyzer_config:
  llm_enabled: true
  llm_model: "gpt-4"
  llm_api_key: "${OPENAI_API_KEY}"
```

## 📝 Contributing

To contribute to the AI agent system:

1. **Add New Error Patterns**: Extend the error detection patterns in `monitor.py`
2. **Implement New Tasks**: Add task types in `tasks.py`
3. **Enhance Analysis**: Improve error analysis logic in `analyzer.py`
4. **Add Integrations**: Create new alert or monitoring integrations

### Example: Adding a New Error Pattern

```python
# In monitor.py, add to _initialize_error_patterns()
ErrorPattern(
    name="custom_error",
    pattern=re.compile(r"your_custom_pattern", re.IGNORECASE),
    severity="MEDIUM",
    description="Description of your custom error",
    suggested_action="What to do when this error occurs"
)
```

## 📄 License

This AI agent system is part of the Sports Bar TV Controller project and follows the same MIT license.

---

**Built with 🤖 for intelligent sports bar automation**
