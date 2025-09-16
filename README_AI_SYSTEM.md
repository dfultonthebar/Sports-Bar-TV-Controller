
# AI System Enhancement for Sports Bar TV Controller

This document describes the enhanced AI system that provides interactive chat interface, system diagnosis capabilities, firewall configuration, and a rules-based framework for intelligent automation.

## Overview

The AI system enhancement includes:

1. **Interactive Chat Interface** - WebSocket-based real-time chat with AI assistant
2. **System Diagnosis** - Comprehensive system health monitoring and diagnostics
3. **Rules Engine** - Flexible YAML/JSON-based automation rules
4. **Firewall Management** - Programmatic UFW firewall configuration for AI services
5. **Integration Framework** - Seamless integration between all components

## Components

### 1. Chat Interface (`chat_interface.py`)

Enhanced chat system with:
- **SystemKnowledgeBase**: Comprehensive knowledge about TV control, network issues, and system operations
- **ChatAssistant**: AI-powered assistant for troubleshooting and guidance
- **Guided Troubleshooting**: Step-by-step problem resolution flows
- **Context-Aware Responses**: Intelligent responses based on system state

**Key Features:**
- TV control troubleshooting
- Network configuration help
- Cable box and IR control guidance
- System feature explanations
- Real-time problem diagnosis

### 2. WebSocket Chat Server (`websocket_chat.py`)

Real-time chat interface with:
- **FastAPI WebSocket Integration**: High-performance real-time communication
- **Connection Management**: Multi-client support with session tracking
- **System Integration**: Direct access to diagnostics and rules engine
- **Web Interface**: Built-in HTML chat interface
- **Background Monitoring**: Automatic system health alerts

**Endpoints:**
- `ws://localhost:8001/ws/{client_id}` - WebSocket chat endpoint
- `http://localhost:8001/` - Web chat interface
- `http://localhost:8001/api/health` - System health API
- `http://localhost:8001/api/stats` - Chat statistics

### 3. System Diagnosis (`system_diagnosis.py`)

Comprehensive system monitoring:
- **Performance Metrics**: CPU, memory, disk usage monitoring
- **Service Status**: Systemd service health checking
- **Network Diagnostics**: Interface status and connectivity testing
- **Port Connectivity**: Critical port accessibility testing
- **Health Scoring**: Overall system health assessment
- **Log Analysis**: Automated log file error detection

**Diagnostic Tests:**
- CPU usage monitoring
- Memory usage alerts
- Disk space warnings
- Service availability checks
- Network connectivity tests
- Internet connectivity validation

### 4. Rules Engine (`rules_engine.py`)

Flexible automation framework:
- **YAML/JSON Rules**: Human-readable rule definitions
- **Condition Evaluation**: Complex logical condition support
- **Action Execution**: Multiple action types (log, alert, execute, API calls)
- **Dynamic Loading**: Hot-reload of rule changes
- **Context-Aware**: Rules based on real-time system state
- **Extensible**: Custom action handlers and conditions

**Supported Operators:**
- Comparison: `eq`, `ne`, `gt`, `lt`, `gte`, `lte`
- Membership: `in`, `not_in`
- String: `contains`, `starts_with`, `ends_with`, `regex`

**Action Types:**
- `log`: Write to system logs
- `alert`: Generate system alerts
- `execute`: Run shell commands
- `api_call`: Make HTTP API calls
- `service_restart`: Restart system services
- `firewall_rule`: Modify firewall rules
- `notification`: Send notifications

### 5. Firewall Manager (`firewall_manager.py`)

Programmatic UFW management:
- **AI Service Ports**: Automatic configuration for AI services
- **Trusted Networks**: Secure access from defined IP ranges
- **Dynamic Rules**: Runtime firewall rule management
- **Security Monitoring**: Intrusion detection and blocking
- **Backup/Restore**: Firewall configuration backup
- **Dry Run Mode**: Safe testing of firewall changes

**AI Service Ports:**
- 8001: Chat Interface
- 8002: API Service
- 8003: WebSocket
- 8004: Diagnostics
- 8005: Rules Engine

## Installation and Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Firewall

```bash
# Make script executable
chmod +x scripts/configure_firewall.sh

# Configure firewall for AI services
sudo scripts/configure_firewall.sh

# Check firewall status
sudo scripts/configure_firewall.sh --status
```

### 3. Start AI Services

```bash
# Start WebSocket chat server
python backend/websocket_chat.py

# Or run in background
nohup python backend/websocket_chat.py &
```

### 4. Access Chat Interface

Open your browser and navigate to:
- `http://localhost:8001` - Web chat interface
- `http://localhost:8001/api/health` - System health API

## Usage Examples

### Chat Interface

The chat interface provides intelligent assistance for:

**TV Control Issues:**
- "My TV is not responding to commands"
- "How do I configure TV discovery?"
- "Cable box remote is not working"

**Network Problems:**
- "Network discovery is not finding devices"
- "How do I configure subnet ranges?"
- "Internet connectivity issues"

**System Diagnostics:**
- "Check system health"
- "Run diagnostics"
- "What services are running?"

### Rules Engine

Create custom automation rules in YAML:

```yaml
# backend/rules/custom_rule.yaml
id: high_cpu_alert
name: High CPU Usage Alert
description: Alert when CPU usage is high
category: system_health
enabled: true
conditions:
  - field: system.cpu_percent
    operator: gt
    value: 80.0
actions:
  - type: log
    parameters:
      message: "High CPU usage: {system.cpu_percent}%"
      level: warning
  - type: alert
    parameters:
      message: "CPU usage is high at {system.cpu_percent}%"
      severity: medium
```

### System Diagnosis

Programmatic health checking:

```python
from backend.system_diagnosis import SystemDiagnostics

diagnostics = SystemDiagnostics()

# Get system metrics
metrics = diagnostics.get_system_metrics()
print(f"CPU: {metrics.cpu_percent}%")

# Run comprehensive diagnostics
results = diagnostics.run_comprehensive_diagnostics()
for result in results:
    print(f"{result.test_name}: {result.status}")

# Get health summary
health = diagnostics.get_system_health_summary()
print(f"Overall Status: {health['overall_status']}")
```

### Firewall Management

Programmatic firewall control:

```python
from backend.firewall_manager import FirewallManager

fw = FirewallManager()

# Configure AI service access
results = fw.configure_ai_service_access()

# Allow specific IP access
fw.allow_port(8001, 'tcp', from_ip='192.168.1.100')

# Get AI service status
status = fw.get_ai_service_status()
```

## Configuration

### Rules Directory Structure

```
backend/rules/
├── system_monitoring.yaml    # System health rules
├── tv_control.yaml          # TV control automation
├── security.yaml            # Security rules
└── custom_rules.yaml        # Your custom rules
```

### Environment Variables

```bash
# Optional configuration
export AI_CHAT_PORT=8001
export RULES_DIRECTORY=backend/rules
export LOG_LEVEL=INFO
export FIREWALL_DRY_RUN=false
```

## Testing

Run the comprehensive test suite:

```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run all tests
pytest tests/test_ai_system.py -v

# Run specific test categories
pytest tests/test_ai_system.py::TestChatInterface -v
pytest tests/test_ai_system.py::TestSystemDiagnostics -v
pytest tests/test_ai_system.py::TestRulesEngine -v
pytest tests/test_ai_system.py::TestFirewallManager -v
```

## Security Considerations

1. **Firewall Configuration**: AI services are restricted to trusted networks
2. **Command Execution**: Rules engine command execution requires careful rule design
3. **Access Control**: WebSocket connections should be authenticated in production
4. **Log Security**: Sensitive information should not be logged in rules
5. **Network Isolation**: Consider running AI services on isolated network segments

## Monitoring and Maintenance

### Log Files

Monitor these log files for system health:
- `/var/log/syslog` - System logs
- `backend/logs/ai_service.log` - AI service logs
- `backend/logs/chat_interface.log` - Chat interface logs

### Health Checks

Regular health monitoring:
```bash
# Check system health via API
curl http://localhost:8001/api/health

# Check firewall status
sudo scripts/configure_firewall.sh --validate

# Test AI service connectivity
sudo scripts/configure_firewall.sh --test
```

### Rule Management

Best practices for rules:
1. Test rules in development environment first
2. Use descriptive rule IDs and names
3. Set appropriate severity levels
4. Monitor rule execution logs
5. Regular review and cleanup of unused rules

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check firewall configuration
   - Verify port 8001 is accessible
   - Check service logs

2. **Rules Not Executing**
   - Verify YAML syntax
   - Check rule conditions
   - Review execution logs

3. **System Diagnostics Failing**
   - Check system permissions
   - Verify required services are running
   - Review diagnostic logs

4. **Firewall Configuration Issues**
   - Run with `--dry-run` first
   - Check UFW installation
   - Verify sudo permissions

### Debug Mode

Enable debug logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Future Enhancements

Planned improvements:
1. **Machine Learning Integration**: Predictive system health analysis
2. **Advanced Authentication**: OAuth2/JWT authentication for WebSocket
3. **Distributed Monitoring**: Multi-node system monitoring
4. **Mobile Interface**: Mobile-responsive chat interface
5. **Integration APIs**: REST APIs for external system integration
6. **Advanced Rules**: Complex rule chaining and dependencies
7. **Performance Optimization**: Caching and performance improvements

## Contributing

To contribute to the AI system:
1. Follow the existing code structure
2. Add comprehensive tests for new features
3. Update documentation
4. Ensure security best practices
5. Test firewall configurations thoroughly

## Support

For support and questions:
1. Check the troubleshooting section
2. Review system logs
3. Test with dry-run mode
4. Validate configurations
5. Check network connectivity

This AI system enhancement provides a robust foundation for intelligent automation and monitoring of the Sports Bar TV Controller system.
