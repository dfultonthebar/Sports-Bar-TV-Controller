# 🏈 Sports Bar TV Controller

**Professional AI-Enhanced Audio/Video Automation System**

A comprehensive automation platform designed specifically for sports bars and entertainment venues, featuring advanced AI monitoring, AI-to-AI communication, intelligent installation management, and seamless multi-platform sports content discovery.

## 🎯 Core Features

### 🤖 Advanced AI System
- **AI-to-AI Communication Bridge** - Distributed AI network with OpenAI, Claude, and Grok integration
- **Enhanced AI Installation Monitor** - Proactive monitoring with automated git conflict resolution
- **AI API Configuration Interface** - Web-based management of AI service credentials and settings
- **Intelligent Task Automation** - Automated content discovery, system maintenance, and optimization
- **Predictive Health Monitoring** - Proactive system health assessment and issue prevention
- **Smart Self-Healing** - Automated error detection, analysis, and resolution

### 🎮 Professional AV Control
- **Wolfpack Video Matrix Control** - TCP/IP control of video switching with preset management
- **Atlas Atmosphere Audio Processing** - REST API and WebSocket control of multi-zone audio
- **Bi-directional AV Sync** - Automatic synchronization between video and audio systems
- **Web Dashboard Interface** - Responsive touchscreen-friendly control panel
- **Real-time Event System** - Live updates and status monitoring
- **Preset Management** - One-click activation of complex AV scenarios

### 🏈 Sports Content Discovery
- **Multi-Platform Integration** - Prime Video, ESPN+, Paramount+, Peacock, Apple TV+
- **Intelligent Deep Linking** - Direct launch to specific games on Fire TV and streaming devices
- **Real-time Sports Schedule API** - Integration with API-Sports.io and SportsDataIO
- **Smart Content Recommendations** - AI-powered suggestions based on live games and trends
- **Advanced Search & Filtering** - Search by team, league, sport, or streaming provider
- **Live Game Notifications** - Real-time updates for currently live sports events

### 🚀 One-Click Installation
- **Automated System Setup** - Complete Ubuntu/Debian installation with dependencies
- **AI-Monitored Installation** - Real-time monitoring and automatic issue resolution
- **Git Conflict Resolution** - Intelligent handling of configuration conflicts during updates
- **Service Management** - Systemd services with automatic startup and monitoring
- **Security Hardening** - Firewall configuration, user management, and secure defaults
- **Production-Ready Deployment** - Docker support with Nginx reverse proxy

## 🏗️ System Architecture

```
Sports Bar TV Controller/
├── 🤖 AI Systems/
│   ├── ai_bridge/                    # AI-to-AI Communication System
│   │   ├── core/                     # Core AI bridge functionality
│   │   │   ├── ai_bridge.py          # Main AI bridge coordinator
│   │   │   ├── collaboration_engine.py # Multi-AI collaboration
│   │   │   └── task_coordinator.py   # Task distribution and management
│   │   ├── providers/                # AI service providers
│   │   │   ├── openai_provider.py    # OpenAI GPT integration
│   │   │   ├── anthropic_provider.py # Claude integration
│   │   │   ├── grok_provider.py      # Grok integration
│   │   │   └── base_provider.py      # Provider interface
│   │   ├── integration/              # System integrations
│   │   │   └── system_manager_integration.py
│   │   └── utils/                    # Utilities
│   │       ├── config_manager.py     # Configuration management
│   │       └── metrics_collector.py  # Performance metrics
│   ├── ai_monitor/                   # Enhanced AI Installation Monitor
│   │   ├── installation_monitor.py   # Real-time installation monitoring
│   │   ├── git_conflict_resolver.py  # Automated git conflict resolution
│   │   ├── rule_engine.py           # Event-driven rule processing
│   │   └── action_executor.py       # Automated action execution
│   └── agent/                       # Legacy AI agent system
│       ├── monitor.py               # Log monitoring with pattern detection
│       ├── analyzer.py              # AI-powered error analysis
│       ├── tasks.py                 # Task automation
│       └── system_manager.py        # System coordination
├── 🎮 AV Control/
│   ├── devices/                     # Device control modules
│   │   ├── wolfpack_controller.py   # Wolfpack video matrix driver
│   │   ├── atlas_atmosphere.py      # Atlas DSP audio processor driver
│   │   └── ...
│   ├── core/
│   │   ├── av_manager.py            # AV coordination with bi-directional sync
│   │   └── event_bus.py             # Pub-sub event system
├── 🏈 Sports Content/
│   ├── services/                    # Sports content discovery services
│   │   ├── sports_schedule_service.py    # Sports API integration
│   │   ├── deep_link_builder.py          # Deep link generation
│   │   ├── content_discovery_manager.py  # Content orchestration
│   │   └── __init__.py
├── 🌐 Web Interface/
│   ├── ui/
│   │   ├── dashboard.py             # Main Flask web dashboard
│   │   ├── sports_content_dashboard.py   # Sports content interface
│   │   ├── ai_agent_dashboard.py    # AI agent monitoring dashboard
│   │   ├── ai_api_config_manager.py # AI API configuration interface
│   │   └── templates/               # Web interface templates
│   │       ├── main_dashboard.html       # Main AV control interface
│   │       ├── sports_dashboard.html     # Sports content UI
│   │       ├── ai_agent_dashboard.html   # AI agent monitoring UI
│   │       └── ai_api_config.html        # AI API configuration UI
├── ⚙️ Configuration/
│   ├── config/
│   │   ├── mappings.yaml            # Device mappings and presets
│   │   ├── sports_config.yaml       # Sports content configuration
│   │   ├── ai_services/             # AI service configurations
│   │   │   ├── ai_bridge_config.yaml     # AI bridge settings
│   │   │   └── providers.yaml            # AI provider configurations
│   │   └── rules/                   # AI monitoring rules
│   │       └── installation_rules.yaml   # Installation monitoring rules
├── 📚 Documentation/
│   ├── docs/
│   │   ├── INSTALLATION.md          # Comprehensive installation guide
│   │   ├── DEPLOYMENT_GUIDE.md      # Production deployment guide
│   │   ├── HARDWARE_REQUIREMENTS.md # Hardware specifications
│   │   ├── QUICK_START.md           # Quick start guide
│   │   └── ai_communication/        # AI system documentation
│   │       ├── AI_COMMUNICATION_ARCHITECTURE.md
│   │       └── USAGE_GUIDE.md
├── 🔧 Installation & Setup/
│   ├── scripts/
│   │   ├── install.sh               # Enhanced one-click installer
│   │   └── setup_root_dirs.sh       # Directory setup script
│   ├── setup_ai_bridge.py           # AI bridge setup script
│   └── requirements_ai_bridge.txt   # AI bridge dependencies
├── 🧪 Testing/
│   ├── tests/
│   │   ├── test_ai_bridge.py        # AI bridge tests
│   │   ├── test_ai_api_config.py    # AI API configuration tests
│   │   └── test_sports_services.py  # Sports service tests
└── main.py                          # Main application entry point
```

## 🚀 One-Click Installation

### Prerequisites
- **Operating System**: Ubuntu 22.04 LTS (recommended) or Ubuntu 20.04 LTS
- **Hardware**: 4GB+ RAM, 2+ CPU cores, 20GB+ storage
- **Network**: Internet connection for package downloads and API access
- **Permissions**: sudo/root access for system installation

### Quick Installation

**Option 1: Direct Installation (Recommended)**
```bash
# Download and run the enhanced installer with AI monitoring
curl -fsSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh | sudo bash
```

**Option 2: Manual Installation**
```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Run the installer
sudo ./scripts/install.sh
```

**Option 3: Git Conflict Handling**
```bash
# Keep local configurations (recommended for existing installations)
sudo GIT_UPDATE_MODE=keep_local ./scripts/install.sh

# Force update from GitHub (overwrites local changes)
sudo GIT_UPDATE_MODE=update_from_github ./scripts/install.sh

# Interactive mode (default - prompts for conflict resolution)
sudo ./scripts/install.sh
```

### What the Installer Does

The enhanced installation script automatically:

#### 🤖 **AI-Monitored Installation Process**
- **Real-time Monitoring**: AI system monitors installation progress and detects issues
- **Automatic Error Resolution**: Intelligent handling of common installation problems
- **Git Conflict Resolution**: Automated resolution of configuration conflicts during updates
- **Installation Phase Tracking**: Monitors git pulls, package installs, service setup
- **Self-Healing**: Automatic retry and fix mechanisms for failed operations

#### 🔧 **System Setup**
- **Dependencies**: Installs Python 3.11+, Node.js 18+, Nginx, Redis, SQLite
- **User Management**: Creates `sportsbar` service user and `Controller` admin user
- **Directory Structure**: Sets up `/opt/sportsbar` with proper permissions
- **Service Configuration**: Creates systemd services for automatic startup
- **Security**: Configures firewall rules and secure defaults

#### 🌐 **Web Services**
- **Nginx Configuration**: Reverse proxy setup with SSL support
- **Service Management**: Systemd services for all components
- **Log Management**: Centralized logging with rotation
- **Health Monitoring**: Service health checks and restart policies

#### 🏈 **Sports Content Integration**
- **API Configuration**: Sets up sports data API integrations
- **Deep Link Support**: Configures Fire TV and streaming device integration
- **Content Discovery**: Initializes sports content discovery services

### Default Access Information

After installation, access the system using:

**Web Dashboards:**
- **Main AV Control**: `http://your-server-ip` or `http://localhost`
- **Sports Content**: `http://your-server-ip/sports`
- **AI Agent Dashboard**: `http://your-server-ip/ai-agent`
- **AI API Configuration**: `http://your-server-ip/ai-config`

**Default Credentials:**
- **Controller User**: `Controller` / `6809233DjD$$$`
- **Service User**: `sportsbar` (system service account)

**Service Management:**
```bash
# Check service status
sudo systemctl status sportsbar-controller

# Start/stop services
sudo systemctl start sportsbar-controller
sudo systemctl stop sportsbar-controller

# View logs
sudo journalctl -u sportsbar-controller -f
```

## 🤖 AI System Features

### AI-to-AI Communication Bridge

The AI Bridge enables the Sports Bar TV Controller to leverage multiple AI services for enhanced problem-solving capabilities.

#### **Supported AI Providers**
- **OpenAI GPT-4/GPT-3.5** - General intelligence and code generation
- **Anthropic Claude** - Advanced reasoning and analysis
- **Grok (X.AI)** - Real-time information and creative solutions
- **Extensible Architecture** - Easy addition of new AI providers

#### **Key Capabilities**
- **Collaborative Problem Solving** - Multiple AIs work together on complex issues
- **Task Distribution** - Intelligent routing of tasks to appropriate AI services
- **Context Sharing** - AIs share context and build on each other's solutions
- **Performance Monitoring** - Real-time metrics and success rate tracking
- **Automatic Failover** - Seamless switching between AI providers

#### **Configuration**
Access the AI API Configuration interface at `http://your-server-ip/ai-config` to:
- **Manage API Keys** - Securely store and manage AI service credentials
- **Configure Providers** - Enable/disable AI services and set priorities
- **Monitor Usage** - Track API usage, costs, and performance metrics
- **Test Connections** - Verify AI service connectivity and functionality

### Enhanced AI Installation Monitor

Advanced monitoring system that provides proactive installation management and automated issue resolution.

#### **Core Features**
- **Real-time Process Monitoring** - Monitors git, npm, pip, docker operations
- **Git Conflict Resolution** - Intelligent handling of merge conflicts and repository issues
- **Installation Phase Tracking** - Tracks progress through installation phases
- **Event-Driven Rule Engine** - 2,000+ lines of sophisticated rule processing logic
- **Automated Self-Healing** - Automatic resolution of common installation problems
- **Risk-Based Actions** - Classifies actions by risk level (LOW/MEDIUM/HIGH/CRITICAL)

#### **Monitoring Capabilities**
- **File System Watching** - Monitors critical installation files and directories
- **Process Monitoring** - Tracks installation processes and detects failures
- **Network Connectivity** - Monitors network issues during package downloads
- **Service Health** - Continuous monitoring of system services
- **Resource Usage** - Tracks CPU, memory, and disk usage during installation

#### **Automatic Fixes**
The system can automatically resolve:
- **Git Conflicts** - Intelligent merge conflict resolution with backup strategies
- **Permission Issues** - Automatic permission fixes for files and directories
- **Network Problems** - Retry mechanisms for network-related failures
- **Service Failures** - Automatic service restart and recovery
- **Dependency Issues** - Resolution of package dependency conflicts

### AI Agent Dashboard

Comprehensive monitoring interface accessible at `http://your-server-ip/ai-agent`:

#### **System Health Overview**
- **Health Score** - Real-time system health assessment (0-100)
- **Active Monitoring** - Current monitoring status and active processes
- **Resource Usage** - CPU, memory, and disk usage metrics
- **Service Status** - Status of all system services and components

#### **Event Monitoring**
- **Recent Events** - Browse recent log events and system activities
- **Error Analysis** - AI-powered error classification and analysis
- **Fix Suggestions** - Actionable recommendations for resolving issues
- **Event Filtering** - Filter events by type, severity, and time range

#### **Task Management**
- **Active Tasks** - View currently running automated tasks
- **Task History** - Browse completed tasks and their outcomes
- **Manual Triggers** - Manually trigger specific maintenance tasks
- **Task Scheduling** - Configure automated task schedules

#### **Configuration Management**
- **AI Settings** - Configure AI agent behavior and thresholds
- **Monitoring Rules** - Manage monitoring rules and alert thresholds
- **Auto-Fix Settings** - Configure automatic fix behavior and risk levels
- **Notification Settings** - Configure alert notifications and channels

## 🏈 Sports Content Discovery

### Multi-Platform Integration

Comprehensive sports content discovery across major streaming platforms:

#### **Supported Streaming Services**
- **Prime Video** - Thursday Night Football, NFL content, exclusive games
- **ESPN+** - NBA, MLB, NHL, MLS, College Sports, UFC, boxing
- **Paramount+** - UEFA Champions League, NFL on CBS, College Football
- **Peacock** - Premier League, Olympics, WWE, Notre Dame football
- **Apple TV+** - MLS Season Pass, MLB Friday Night Baseball

#### **Content Discovery Features**
- **Live Games** - Real-time detection of currently live sports events
- **Upcoming Games** - Games starting within the next 24 hours
- **Trending Content** - AI-powered recommendations based on popularity
- **Prime Time Games** - Highlights evening games (6 PM - 11 PM)
- **Weekend Specials** - Enhanced focus on Saturday and Sunday games

### Deep Linking Technology

Advanced deep linking system for seamless content access:

#### **Fire TV Integration**
- **Direct Launch** - Launch specific content directly on Fire TV devices
- **Universal Deep Links** - Support for multiple streaming platforms
- **Intelligent Fallbacks** - Graceful handling when content is unavailable
- **Link Validation** - Ensures deep links are properly formatted and functional

#### **Supported Devices**
- **Amazon Fire TV** - All generations and Fire TV Stick models
- **Android TV** - Google TV and Android TV devices
- **Roku** - Roku streaming devices (limited support)
- **Apple TV** - Apple TV 4K and HD models (limited support)

### Sports Content Dashboard

Access the sports dashboard at `http://your-server-ip/sports`:

#### **Live Games Section**
- **Currently Live** - All live sports with one-click launch buttons
- **Game Information** - Teams, scores, time remaining, streaming platform
- **Quick Launch** - Direct launch to Fire TV with confirmation dialog
- **Status Indicators** - Visual indicators for game status and availability

#### **Upcoming Games**
- **24-Hour Schedule** - Games starting within the next day
- **Advanced Scheduling** - Plan ahead with detailed game schedules
- **Reminder System** - Set reminders for important games
- **Filtering Options** - Filter by sport, league, team, or streaming service

#### **Search and Discovery**
- **Advanced Search** - Search by team name, league, sport, or streaming provider
- **Auto-Complete** - Intelligent search suggestions as you type
- **Saved Searches** - Save frequently used search queries
- **Search History** - Browse previous searches and results

#### **Analytics and Insights**
- **Usage Statistics** - Track most-launched content and popular games
- **Performance Metrics** - Monitor API response times and service health
- **Content Availability** - Real-time status of streaming services
- **Employee Usage** - Track which games and content are most popular

### API Integration

#### **Sports Data Providers**
- **API-Sports.io** - 100+ sports leagues worldwide with real-time updates
- **SportsDataIO** - Major US sports (NFL, NBA, MLB, NHL) with advanced statistics
- **ESPN API** - Comprehensive sports data and live scores
- **Custom Aggregation** - Intelligent data aggregation from multiple sources

#### **Configuration**
```bash
# Set API keys for sports data access
export API_SPORTS_KEY="your_api_sports_key"
export SPORTSDATA_IO_KEY="your_sportsdata_io_key"
export ESPN_API_KEY="your_espn_api_key"  # Optional
```

## 🎮 Professional AV Control

### Video Matrix Control

#### **Wolfpack Video Matrix Integration**
- **TCP/IP Control** - Direct network control of Wolfpack video matrices
- **Real-time Switching** - Instant video routing with confirmation feedback
- **Preset Management** - Store and recall complex routing configurations
- **Status Monitoring** - Real-time monitoring of matrix status and connections

#### **Supported Models**
- **Wolfpack 4K Series** - 4K60 HDMI matrices with HDR support
- **Wolfpack HD Series** - 1080p HDMI matrices for standard installations
- **Custom Configurations** - Support for custom matrix configurations

### Audio Processing

#### **Atlas Atmosphere Integration**
- **REST API Control** - HTTP-based control of Atlas DSP processors
- **WebSocket Support** - Real-time audio status updates
- **Multi-Zone Audio** - Independent control of multiple audio zones
- **Volume Management** - Per-zone volume control with mute functionality

#### **Audio Features**
- **Zone Control** - Independent audio zones with source selection
- **Volume Automation** - Automated volume adjustments based on content
- **Audio Sync** - Synchronization with video switching for seamless AV
- **Preset Audio** - Audio configurations stored with video presets

### Bi-directional AV Sync

#### **Intelligent Synchronization**
- **Video → Audio** - Automatic audio source switching when video changes
- **Audio → Video** - Automatic video switching when audio source changes
- **User Control** - Enable/disable sync via web interface
- **Conflict Resolution** - Intelligent handling of sync conflicts

#### **Sync Features**
- **Real-time Sync** - Instant synchronization with minimal delay
- **Manual Override** - Temporary sync disable for manual control
- **Preset Integration** - Sync settings stored with presets
- **Event Logging** - Complete audit trail of sync operations

## 🌐 Web Dashboard Interface

### Main AV Control Dashboard

Access at `http://your-server-ip`:

#### **Status Overview**
- **Device Status** - Real-time connectivity status for all devices
- **System Health** - Overall system health and performance metrics
- **Active Presets** - Currently active preset configurations
- **Recent Activity** - Log of recent system activities and changes

#### **Control Interface**
- **TV Grid Layout** - Visual representation of all TVs and their current inputs
- **Quick Presets** - One-click activation of common scenarios
- **Individual Controls** - Manual control of each TV's video input and audio
- **Volume Controls** - Per-zone volume sliders with mute buttons

#### **Advanced Features**
- **Sync Toggle** - Enable/disable bi-directional AV synchronization
- **Preset Management** - Create, edit, and delete preset configurations
- **Device Configuration** - Configure device settings and mappings
- **System Settings** - Access system-wide configuration options

### Sports Content Dashboard

Access at `http://your-server-ip/sports`:

#### **Live Content**
- **Live Games Grid** - Visual grid of all currently live sports
- **Game Details** - Team information, scores, and streaming platform
- **Launch Controls** - One-click launch buttons for each game
- **Status Indicators** - Visual indicators for game status and availability

#### **Content Discovery**
- **Search Interface** - Advanced search with filters and auto-complete
- **Upcoming Games** - Scheduled games with launch preparation
- **Trending Content** - AI-recommended content based on popularity
- **Favorites** - Save frequently accessed teams and games

### AI Agent Dashboard

Access at `http://your-server-ip/ai-agent`:

#### **System Monitoring**
- **Health Score** - Real-time system health assessment
- **Active Processes** - Currently running AI processes and tasks
- **Resource Usage** - CPU, memory, and disk usage metrics
- **Service Status** - Status of all AI services and components

#### **Event Management**
- **Recent Events** - Browse and filter recent system events
- **Error Analysis** - AI-powered error classification and solutions
- **Action History** - Log of automated actions taken by the AI system
- **Manual Controls** - Trigger manual AI actions and maintenance tasks

### AI API Configuration

Access at `http://your-server-ip/ai-config`:

#### **Provider Management**
- **API Key Management** - Securely store and manage AI service credentials
- **Provider Configuration** - Enable/disable AI services and set priorities
- **Connection Testing** - Test connectivity to AI services
- **Usage Monitoring** - Track API usage, costs, and rate limits

#### **System Configuration**
- **AI Bridge Settings** - Configure AI-to-AI communication parameters
- **Task Routing** - Configure how tasks are distributed to AI providers
- **Performance Tuning** - Optimize AI system performance and response times
- **Security Settings** - Configure security and access controls

## ⚙️ Configuration

### Device Configuration

Edit `/opt/sportsbar/app/config/mappings.yaml`:

```yaml
devices:
  wolfpack:
    host: "192.168.1.70"
    port: 5000
    model: "4K-HDMI-8x8"
  
  atmosphere:
    host: "192.168.1.50"
    port: 80
    zones: 8

mappings:
  - video_output: 1
    audio_zone: 1
    name: "Main Bar TV"
    location: "Bar Area"
  - video_output: 2
    audio_zone: 2
    name: "Patio TV"
    location: "Outdoor Patio"

presets:
  - id: 1
    name: "Big Game Mode"
    description: "All TVs to main ESPN feed with high volume"
    video_routes:
      1: 1  # All outputs to ESPN input
      2: 1
      3: 1
    audio_routes:
      1: 1  # All zones to ESPN audio
      2: 1
      3: 1
    volume_levels:
      1: 75
      2: 75
      3: 75
```

### Sports Content Configuration

Edit `/opt/sportsbar/app/config/sports_config.yaml`:

```yaml
sports_api:
  api_keys:
    api_sports: "${API_SPORTS_KEY}"
    sportsdata_io: "${SPORTSDATA_IO_KEY}"
    espn: "${ESPN_API_KEY}"
  cache_duration_minutes: 30
  rate_limit_requests_per_minute: 60

streaming_providers:
  prime_video:
    enabled: true
    priority: 100
    deep_link_template: "amzns://apps/android?asin=B00ZV9RDKK#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"
  espn_plus:
    enabled: true
    priority: 90
    deep_link_template: "amzns://apps/android?asin=B00KQPQHPQ#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"

content_discovery:
  default_results:
    live: 10
    upcoming: 20
    search: 15
  auto_refresh_minutes: 5
```

### AI System Configuration

Edit `/opt/sportsbar/app/config/ai_services/ai_bridge_config.yaml`:

```yaml
ai_bridge:
  enabled: true
  max_concurrent_tasks: 10
  task_timeout_seconds: 300
  
providers:
  openai:
    enabled: true
    model: "gpt-4"
    max_tokens: 4000
    temperature: 0.7
    priority: 100
  
  anthropic:
    enabled: true
    model: "claude-3-sonnet-20240229"
    max_tokens: 4000
    temperature: 0.7
    priority: 90
  
  grok:
    enabled: false
    model: "grok-beta"
    max_tokens: 4000
    temperature: 0.7
    priority: 80

collaboration:
  enabled: true
  consensus_threshold: 0.8
  max_collaboration_rounds: 3
  
monitoring:
  metrics_enabled: true
  performance_tracking: true
  cost_tracking: true
```

## 🔧 Advanced Features

### Preset Management

#### **Preset Types**
- **Big Game Mode** - All TVs to main feed with high volume
- **Multi-Game Mode** - Different games on different zones
- **Chill Mode** - Background music and menu channels
- **Happy Hour Setup** - Mixed content with upbeat atmosphere
- **Closing Time** - Automated shutdown sequence

#### **Preset Features**
- **Video Routing** - Complete video input configuration for all outputs
- **Audio Routing** - Audio source selection for all zones
- **Volume Levels** - Specific volume levels for each zone
- **Mute States** - Mute configuration for each zone
- **Scheduling** - Time-based automatic preset activation

### Event System

#### **Real-time Events**
- **Video Route Changes** - Notifications when video routing changes
- **Audio Route Changes** - Notifications when audio routing changes
- **Volume Adjustments** - Real-time volume change notifications
- **Preset Activations** - Notifications when presets are activated
- **Device Status** - Device connectivity and status changes

#### **Event Integration**
- **WebSocket Support** - Real-time event streaming to web clients
- **API Webhooks** - HTTP callbacks for external system integration
- **Logging Integration** - All events logged for audit and analysis
- **Custom Handlers** - Support for custom event handling logic

### Automation Features

#### **Time-based Automation**
- **Scheduled Presets** - Automatic preset activation based on time
- **Game Schedule Integration** - Automatic switching based on sports schedules
- **Business Hours** - Different configurations for open/closed hours
- **Special Events** - Custom automation for special events and holidays

#### **Intelligent Automation**
- **Pattern Learning** - Learn from staff actions to suggest optimizations
- **Predictive Switching** - Anticipate content needs based on schedules
- **Load Balancing** - Distribute content across zones for optimal experience
- **Energy Management** - Automatic power management for off-hours

## 🛠️ Development and Customization

### Project Structure

#### **Core Components**
- **`devices/`** - Device-specific control modules with driver implementations
- **`core/`** - Core system logic, coordination, and event management
- **`ai_bridge/`** - AI-to-AI communication system and provider integrations
- **`ai_monitor/`** - Enhanced AI monitoring and installation management
- **`services/`** - Sports content discovery and external service integrations
- **`ui/`** - Web interface, dashboards, and API endpoints

#### **Configuration**
- **`config/`** - System configuration files and templates
- **`config/ai_services/`** - AI system configuration and provider settings
- **`config/rules/`** - AI monitoring rules and automation logic

#### **Documentation**
- **`docs/`** - Comprehensive documentation and guides
- **`docs/ai_communication/`** - AI system architecture and usage guides

### Adding New Features

#### **New Device Support**
1. Create device controller in `devices/` directory
2. Implement standard device interface with connection management
3. Add device configuration to `mappings.yaml`
4. Update AV Manager to include new device integration
5. Add device-specific UI controls to web dashboard

#### **New AI Providers**
1. Create provider class in `ai_bridge/providers/`
2. Implement `BaseProvider` interface with authentication and API calls
3. Add provider configuration to `providers.yaml`
4. Update AI bridge configuration to include new provider
5. Test provider integration and add to documentation

#### **Custom Automation Rules**
1. Define rules in `config/rules/installation_rules.yaml`
2. Implement rule logic in `ai_monitor/rule_engine.py`
3. Add action handlers in `ai_monitor/action_executor.py`
4. Test rule execution and add monitoring
5. Document new automation capabilities

### Testing

#### **Unit Tests**
```bash
# Run all unit tests
pytest tests/

# Run specific test modules
pytest tests/test_ai_bridge.py
pytest tests/test_sports_services.py
pytest tests/test_ai_api_config.py

# Run with coverage reporting
pytest --cov=. tests/
```

#### **Integration Tests**
```bash
# Test AI bridge integration
python -m pytest tests/test_ai_bridge.py -v

# Test sports content discovery
python -m pytest tests/test_sports_services.py -v

# Test device integration
python -m pytest tests/test_device_integration.py -v
```

#### **Manual Testing**
```bash
# Test AI bridge functionality
python examples/ai_bridge_examples.py

# Test sports content discovery
python -c "from services.sports_schedule_service import SportsScheduleService; sss = SportsScheduleService(); print(sss.get_live_games())"

# Test device connectivity
python -c "from devices.wolfpack_controller import WolfpackController; wc = WolfpackController('192.168.1.70'); print(wc.get_status())"
```

## 📊 Monitoring and Analytics

### System Health Monitoring

#### **Health Metrics**
- **System Health Score** - Overall system health (0-100)
- **Device Connectivity** - Real-time device connection status
- **Service Status** - Status of all system services and components
- **Resource Usage** - CPU, memory, disk, and network utilization
- **API Performance** - Response times and success rates for external APIs

#### **Performance Analytics**
- **Response Times** - Average response times for all system operations
- **Error Rates** - Error rates for device operations and API calls
- **Usage Statistics** - Most used presets, content, and features
- **Trend Analysis** - Historical performance trends and patterns

### AI System Monitoring

#### **AI Performance Metrics**
- **Task Success Rates** - Success rates for AI-powered tasks and operations
- **Response Times** - Average response times for AI provider APIs
- **Cost Tracking** - API usage costs and budget monitoring
- **Provider Performance** - Comparative performance of different AI providers

#### **Automation Monitoring**
- **Rule Execution** - Success rates and performance of automation rules
- **Self-Healing Actions** - Automated fixes and their success rates
- **Installation Monitoring** - Real-time installation progress and issue resolution
- **Git Conflict Resolution** - Automated git conflict resolution statistics

### Sports Content Analytics

#### **Content Usage**
- **Most Launched Content** - Popular games and content by launch frequency
- **Peak Usage Times** - Times of highest system usage and content access
- **Platform Performance** - Performance and availability of streaming platforms
- **Search Analytics** - Most searched teams, leagues, and content

#### **Business Intelligence**
- **Customer Engagement** - Content that drives the most customer engagement
- **Revenue Correlation** - Correlation between content and revenue metrics
- **Operational Efficiency** - Time savings from automated content discovery
- **Staff Usage Patterns** - How staff use the system throughout the day

## 🔒 Security and Compliance

### Security Features

#### **Access Control**
- **User Authentication** - Secure user authentication with role-based access
- **API Security** - API key management and secure credential storage
- **Network Security** - Firewall configuration and network isolation
- **Service Isolation** - Containerized services with limited privileges

#### **Data Protection**
- **Credential Encryption** - Encrypted storage of API keys and sensitive data
- **Secure Communication** - HTTPS/TLS encryption for all web traffic
- **Audit Logging** - Comprehensive logging of all system access and changes
- **Backup Security** - Encrypted backups with secure storage

### Compliance

#### **Industry Standards**
- **PCI DSS** - Payment card industry compliance for customer data
- **GDPR** - General Data Protection Regulation compliance for EU customers
- **SOC 2** - Service Organization Control 2 compliance for service providers
- **HIPAA** - Health Insurance Portability and Accountability Act (if applicable)

#### **Best Practices**
- **Regular Updates** - Automated security updates and patch management
- **Vulnerability Scanning** - Regular security vulnerability assessments
- **Penetration Testing** - Periodic penetration testing and security audits
- **Incident Response** - Documented incident response procedures

## 🚀 Production Deployment

### Docker Deployment

#### **Production Docker Setup**
```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# View service logs
docker-compose logs -f sportsbar-controller

# Scale services
docker-compose up -d --scale sportsbar-controller=3

# Stop all services
docker-compose down
```

#### **Docker Services**
- **sportsbar-controller** - Main application container
- **nginx** - Reverse proxy and load balancer
- **redis** - Caching and session storage
- **prometheus** - Metrics collection and monitoring
- **grafana** - Visualization and dashboards

### High Availability Setup

#### **Load Balancing**
- **Nginx Load Balancer** - Distribute traffic across multiple application instances
- **Health Checks** - Automatic health checking and failover
- **Session Persistence** - Sticky sessions for consistent user experience
- **SSL Termination** - SSL/TLS termination at the load balancer

#### **Database Clustering**
- **PostgreSQL Cluster** - High-availability PostgreSQL setup
- **Read Replicas** - Read-only replicas for improved performance
- **Automatic Failover** - Automatic database failover and recovery
- **Backup and Recovery** - Automated backup and point-in-time recovery

### Monitoring and Alerting

#### **Production Monitoring**
- **Prometheus** - Metrics collection and time-series database
- **Grafana** - Visualization dashboards and alerting
- **Fluentd** - Log aggregation and forwarding
- **Jaeger** - Distributed tracing and performance monitoring

#### **Alerting**
- **System Alerts** - Alerts for system health and performance issues
- **Application Alerts** - Alerts for application errors and failures
- **Business Alerts** - Alerts for business-critical events and metrics
- **Integration** - Integration with PagerDuty, Slack, and email notifications

## 🤝 Contributing

### Development Setup

#### **Local Development**
```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements_ai_bridge.txt

# Set up development configuration
cp config/mappings.yaml.example config/mappings.yaml
cp config/sports_config.yaml.example config/sports_config.yaml

# Run in development mode
python main.py --debug
```

#### **Development Tools**
- **Code Formatting** - Black code formatter with pre-commit hooks
- **Linting** - Flake8 and pylint for code quality
- **Type Checking** - mypy for static type checking
- **Testing** - pytest with coverage reporting

### Contribution Guidelines

#### **Pull Request Process**
1. **Fork the Repository** - Create a fork of the main repository
2. **Create Feature Branch** - Create a feature branch from main
3. **Implement Changes** - Implement your changes with tests
4. **Run Tests** - Ensure all tests pass and coverage is maintained
5. **Submit Pull Request** - Submit PR with detailed description

#### **Code Standards**
- **Python Style** - Follow PEP 8 style guidelines
- **Documentation** - Document all functions and classes
- **Testing** - Include unit tests for all new functionality
- **Type Hints** - Use type hints for all function signatures

#### **Review Process**
- **Automated Checks** - All PRs must pass automated checks
- **Code Review** - At least one maintainer review required
- **Testing** - Manual testing for UI and integration changes
- **Documentation** - Update documentation for new features

## 📝 License and Support

### License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Support

#### **Community Support**
- **GitHub Issues** - [Report bugs and request features](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues)
- **GitHub Discussions** - [Community discussions and Q&A](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/discussions)
- **Documentation** - [Comprehensive documentation and guides](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/wiki)

#### **Professional Support**
- **Email Support** - support@sportsbarcontroller.com
- **Professional Services** - Custom installation and configuration services
- **Training** - Staff training and system optimization services
- **Maintenance** - Ongoing maintenance and support contracts

#### **Getting Help**
1. **Check Documentation** - Review the comprehensive documentation first
2. **Search Issues** - Search existing GitHub issues for similar problems
3. **Create Issue** - Create a detailed issue with logs and configuration
4. **Community Discussion** - Ask questions in GitHub Discussions
5. **Professional Support** - Contact professional support for urgent issues

## 🙏 Acknowledgments

### Technology Partners
- **Wolfpack** - Professional video matrix systems and excellent API documentation
- **Atlas Sound** - Atmosphere audio processing platform and technical support
- **OpenAI** - GPT models for AI-powered system intelligence
- **Anthropic** - Claude AI for advanced reasoning and analysis
- **X.AI** - Grok AI for real-time information and creative solutions

### Open Source Community
- **Flask** - Web framework for dashboard and API development
- **React** - Frontend framework for responsive user interfaces
- **Docker** - Containerization platform for production deployment
- **Nginx** - High-performance web server and reverse proxy
- **Redis** - In-memory data structure store for caching and sessions

### Sports Data Providers
- **API-Sports.io** - Comprehensive sports data API with global coverage
- **SportsDataIO** - Professional sports data with advanced statistics
- **ESPN** - Sports content and schedule information

### Industry Inspiration
- **Sports Bar Industry** - Inspiration and feedback from sports bar owners and operators
- **AV Integration Community** - Professional AV integrators and system designers
- **Open Source Community** - Contributors and maintainers of open source projects

---

**🏈 Built with ❤️ for the Sports Bar Industry**

*Empowering sports bars with intelligent automation, AI-enhanced monitoring, and seamless content discovery for the ultimate fan experience.*
