
# 🏈 Sports Bar TV Controller

Professional Audio/Video automation system designed specifically for sports bars and entertainment venues. This system provides centralized control of video matrices, audio processors, and lighting systems with intelligent bi-directional synchronization.

## 🎯 Features

### Core Functionality
- **Wolfpack Video Matrix Control** - TCP/IP control of video switching with preset management
- **Atlas Atmosphere Audio Processing** - REST API and WebSocket control of multi-zone audio
- **Bi-directional AV Sync** - Automatic synchronization between video and audio systems
- **Web Dashboard Interface** - Responsive touchscreen-friendly control panel
- **Real-time Event System** - Live updates and status monitoring
- **Preset Management** - One-click activation of complex AV scenarios

### 🤖 AI Agent System (NEW!)
- **Real-time Log Monitoring** - Continuous monitoring of system logs with intelligent pattern detection
- **AI-Powered Error Analysis** - Automatic error classification, root cause analysis, and fix suggestions
- **Automated System Management** - Self-healing capabilities with safe automated fixes
- **Intelligent Task Automation** - Automated content discovery, system maintenance, and optimization
- **Predictive Health Monitoring** - Proactive system health assessment and issue prevention
- **Smart Alerting System** - Context-aware alerts with actionable recommendations
- **Performance Analytics** - System performance tracking and optimization suggestions

### 🆕 Sports Content Discovery & Deep Linking
- **Multi-Platform Sports Content Discovery** - Fetch live and upcoming sports from Prime Video, ESPN+, Paramount+, Peacock, and Apple TV+
- **Intelligent Deep Linking** - Direct launch to specific games on Fire TV and other streaming devices
- **Real-time Sports Schedule API** - Integration with API-Sports.io and SportsDataIO for comprehensive sports data
- **Smart Content Recommendations** - AI-powered suggestions based on live games, trending content, and user preferences
- **Sports-Specific Dashboard** - Dedicated interface for employees to easily find and launch specific games
- **Advanced Search & Filtering** - Search by team, league, sport, or streaming provider
- **Live Game Notifications** - Real-time updates for currently live sports events

### Sports Bar Specific Features
- **Big Game Mode** - All TVs to main feed with high volume
- **Multi-Game Mode** - Different games on different zones
- **Chill Mode** - Background music and menu channels
- **Happy Hour Setup** - Mixed content with upbeat atmosphere
- **Closing Time** - Automated shutdown sequence

### Professional Features
- **Modular Architecture** - Easy to extend and maintain
- **Configuration Management** - YAML-based device and routing configuration
- **Comprehensive Logging** - Full audit trail of all operations
- **Docker Support** - Production-ready containerized deployment
- **Health Monitoring** - System status and device connectivity monitoring

## 🏗️ System Architecture

```
Sports Bar TV Controller/
├── agent/                      # 🤖 AI Agent System (NEW!)
│   ├── __init__.py             # AI agent package initialization
│   ├── monitor.py              # Real-time log monitoring with pattern detection
│   ├── analyzer.py             # AI-powered error analysis and fix suggestions
│   ├── tasks.py                # Intelligent task automation and content discovery
│   ├── system_manager.py       # Central AI system coordination and management
│   ├── requirements.txt        # AI agent specific dependencies
│   └── README.md               # AI agent documentation
├── devices/                    # Device control modules
│   ├── wolfpack_controller.py  # Wolfpack video matrix driver
│   ├── atlas_atmosphere.py     # Atlas DSP audio processor driver
│   └── ...
├── core/
│   ├── av_manager.py           # Coordination layer with bi-directional sync
│   └── event_bus.py            # Pub-sub event system
├── services/                   # 🆕 Sports content discovery services
│   ├── sports_schedule_service.py    # Sports API integration
│   ├── deep_link_builder.py          # Deep link generation
│   ├── content_discovery_manager.py  # Content orchestration
│   └── __init__.py
├── config/
│   ├── mappings.yaml           # Configuration for device mappings
│   ├── sports_config.yaml      # 🆕 Sports content configuration
│   └── ai_agent_config.yaml    # 🤖 AI agent configuration (NEW!)
├── ui/
│   ├── dashboard.py            # Flask web dashboard
│   ├── sports_content_dashboard.py   # 🆕 Sports content interface
│   ├── ai_agent_dashboard.py   # 🤖 AI agent monitoring dashboard (NEW!)
│   └── templates/              # Web interface templates
│       ├── sports_dashboard.html     # 🆕 Sports content UI
│       └── ai_agent_dashboard.html   # 🤖 AI agent UI (NEW!)
├── frontend/
│   ├── RoomLayout.js           # React component for room control
│   └── RoomLayout.css          # Styling for the interface
├── docs/                       # 🤖 Documentation (NEW!)
│   └── HARDWARE_REQUIREMENTS.md # Hardware specs for AI agent system
├── tests/                      # 🆕 Unit tests
│   └── test_sports_services.py # Sports service tests
└── main.py                     # Main application entry point
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Network access to Wolfpack matrix and Atlas Atmosphere processor
- Modern web browser for dashboard access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
   cd Sports-Bar-TV-Controller
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your devices and sports APIs**
   ```bash
   cp config/mappings.yaml.example config/mappings.yaml
   # Edit config/mappings.yaml with your device IP addresses and mappings
   
   # Configure sports content discovery (optional but recommended)
   export API_SPORTS_KEY="your_api_sports_key"
   export SPORTSDATA_IO_KEY="your_sportsdata_io_key"
   ```

4. **Run the system**
   ```bash
   python main.py
   ```

5. **Access the dashboards**
   - Main AV Control Dashboard: `http://localhost:5000`
   - Sports Content Discovery: `http://localhost:5000/sports`
   - AI Agent Dashboard: `http://localhost:5000/ai-agent` 🤖

### Docker Deployment

For production deployment:

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f sportsbar-controller

# Stop services
docker-compose down
```

## 🤖 AI Agent System

### Overview

The AI Agent System provides intelligent monitoring, automated error analysis, and self-healing capabilities for the Sports Bar TV Controller. It continuously monitors system logs, detects issues, analyzes problems, and can automatically implement safe fixes without human intervention.

### Key Capabilities

#### 🔍 Real-time Log Monitoring
- **Continuous Monitoring**: Watches all system log files in real-time using advanced file system monitoring
- **Pattern Detection**: Identifies error patterns, connection issues, API failures, and device problems
- **Smart Filtering**: Rate limiting and deduplication to prevent alert spam
- **Multi-directory Support**: Monitors multiple log directories simultaneously

#### 🧠 AI-Powered Error Analysis
- **Intelligent Classification**: Automatically categorizes errors by type and severity
- **Root Cause Analysis**: Determines likely causes of system issues using pattern matching and context analysis
- **Fix Suggestions**: Provides specific, actionable fix recommendations with risk assessment
- **Confidence Scoring**: Rates the reliability of analysis and suggestions

#### 🔧 Automated System Management
- **Self-Healing**: Automatically implements low-risk fixes without human intervention
- **Safe Operations**: Risk assessment prevents dangerous automated changes
- **Rollback Capability**: Can undo changes if they don't resolve issues
- **Manual Override**: Operators can disable automation or approve high-risk fixes

#### 📋 Intelligent Task Automation
- **Content Discovery**: Automated sports content discovery and recommendation
- **System Maintenance**: Routine cleanup, health checks, and optimization
- **Device Monitoring**: Continuous device connectivity and status monitoring
- **Performance Analytics**: System performance tracking and optimization suggestions

### AI Agent Dashboard

Access the AI Agent dashboard at `http://localhost:5000/ai-agent` to:

1. **Monitor System Health** - Real-time system health overview with health score
2. **View Recent Events** - Browse recent log events and system activities
3. **Track Agent Actions** - See what the AI agent has done automatically
4. **Manage Tasks** - View active tasks and trigger manual operations
5. **Analyze Errors** - Review error analyses and implement suggested fixes
6. **Configure Settings** - Adjust AI agent behavior and thresholds

### Configuration

The AI agent is configured via `config/ai_agent_config.yaml`:

```yaml
ai_agent:
  enabled: true
  
  # Log monitoring settings
  monitor_config:
    log_directories:
      - "logs/"
      - "backend/logs/"
    rate_limit_minutes: 5
    max_occurrences_per_window: 5
    
  # Error analysis settings
  analyzer_config:
    auto_fix_enabled: true
    auto_fix_risk_threshold: "MEDIUM"
    
  # System management settings
  health_check_interval_minutes: 15
  maintenance_interval_hours: 24
```

### Hardware Requirements

The AI agent system has specific hardware requirements depending on the scale of deployment:

- **Small Setup (8 TVs)**: 16 GB RAM, 6-core CPU, integrated graphics
- **Medium Setup (20 TVs)**: 32 GB RAM, 8-core CPU, optional GPU for future LLM
- **Large Setup (50+ TVs)**: 64 GB RAM, 12+ core CPU, dedicated GPU for local LLM

See [Hardware Requirements](docs/HARDWARE_REQUIREMENTS.md) for detailed specifications.

### Automated Fixes

The AI agent can automatically implement various types of fixes:

#### Low-Risk (Automatic)
- Configuration adjustments
- Cache cleanup and log rotation
- Service health checks
- Network diagnostics

#### Medium-Risk (Configurable)
- Service restarts
- Device reconnection attempts
- Resource cleanup operations
- Configuration reloads

#### High-Risk (Manual Only)
- System reboots
- Major configuration changes
- Hardware interventions

### Future Enhancements

- **LLM Integration**: Advanced natural language processing for error analysis
- **Machine Learning**: Pattern recognition and predictive maintenance
- **Advanced Automation**: More sophisticated automated fixes
- **External Integrations**: REST API for monitoring systems

## 🏈 Sports Content Discovery

### Overview

The Sports Content Discovery system allows employees to easily find and launch specific sports content across multiple streaming platforms without manually navigating through apps. This feature is particularly valuable for sports bars that need to quickly switch to specific games during busy periods.

### Supported Streaming Services

- **Prime Video** - Thursday Night Football, NFL content
- **ESPN+** - NBA, MLB, NHL, MLS, College Sports
- **Paramount+** - UEFA Champions League, NFL on CBS, College Football
- **Peacock** - Premier League, Olympics, WWE
- **Apple TV+** - MLS Season Pass, MLB Friday Night Baseball

### Key Features

#### 🔍 Smart Content Discovery
- **Live Games**: Automatically detects currently live sports events
- **Upcoming Games**: Shows games starting within the next 24 hours
- **Trending Content**: AI-powered recommendations based on popularity and timing
- **Prime Time Games**: Highlights evening games (6 PM - 11 PM)
- **Weekend Games**: Special focus on Saturday and Sunday games

#### 🔗 Deep Linking Technology
- **Fire TV Integration**: Direct launch to specific content on Amazon Fire TV devices
- **Universal Deep Links**: Support for multiple streaming platforms
- **Intelligent Fallbacks**: Graceful handling when content is unavailable
- **Validation System**: Ensures deep links are properly formatted

#### 🎯 Advanced Search & Filtering
- **Team Search**: Find games by team name (e.g., "Patriots", "Lakers")
- **League Search**: Filter by league (NFL, NBA, MLB, NHL, etc.)
- **Sport Search**: Browse by sport type
- **Provider Search**: Filter by streaming service
- **Real-time Results**: Instant search with auto-complete

#### 📊 Analytics & Insights
- **Usage Statistics**: Track most-launched content
- **Performance Metrics**: Monitor API response times
- **Content Availability**: Real-time status of streaming services
- **Employee Usage**: Track which games are most popular

### Sports Content Dashboard

Access the sports dashboard at `http://localhost:5000/sports` to:

1. **View Live Games** - See all currently live sports with one-click launch
2. **Browse Upcoming Games** - Plan ahead with upcoming game schedules
3. **Search Content** - Quickly find specific teams or games
4. **Launch Content** - Direct launch to Fire TV with confirmation dialog
5. **Monitor Status** - View system statistics and service health

### API Integration

The system integrates with multiple sports data providers:

#### API-Sports.io
- **Coverage**: 100+ sports leagues worldwide
- **Update Frequency**: Real-time updates every 15 seconds
- **Features**: Live scores, fixtures, team information
- **Free Tier**: 100 requests per day

#### SportsDataIO
- **Coverage**: Major US sports (NFL, NBA, MLB, NHL)
- **Features**: Live feeds, projections, advanced statistics
- **Update Frequency**: Real-time during games
- **Enterprise Grade**: High reliability and performance

### Configuration

Sports content discovery is configured via `config/sports_config.yaml`:

```yaml
# API Configuration
sports_api:
  api_keys:
    api_sports: "${API_SPORTS_KEY}"
    sportsdata_io: "${SPORTSDATA_IO_KEY}"
  cache_duration_minutes: 30

# Streaming Providers
streaming_providers:
  prime_video:
    enabled: true
    priority: 100
  espn_plus:
    enabled: true
    priority: 90

# Content Discovery Settings
content_discovery:
  default_results:
    live: 10
    upcoming: 20
    search: 15
```

### Environment Variables

Set these environment variables for API access:

```bash
# Required for comprehensive sports data
export API_SPORTS_KEY="your_api_sports_key"
export SPORTSDATA_IO_KEY="your_sportsdata_io_key"

# Optional for enhanced ESPN integration
export ESPN_API_KEY="your_espn_api_key"
```

### Deep Link Examples

The system generates platform-specific deep links:

```bash
# Prime Video Thursday Night Football
amzns://apps/android?asin=B00ZV9RDKK#Intent;action=android.intent.action.VIEW;S.contentId=tnf_12345;end

# ESPN+ NBA Game
amzns://apps/android?asin=B00KQPQHPQ#Intent;action=android.intent.action.VIEW;S.contentId=nba_game_67890;end

# Paramount+ Champions League
amzns://apps/android?asin=B08KQZXHPX#Intent;action=android.intent.action.VIEW;S.contentId=ucl_match_54321;end
```

## ⚙️ Configuration

### Device Configuration

Edit `config/mappings.yaml` to configure your devices:

```yaml
devices:
  wolfpack:
    host: "192.168.1.70"
    port: 5000
  
  atmosphere:
    host: "192.168.1.50"
    port: 80

mappings:
  - video_output: 1
    audio_zone: 1
    name: "Main Bar TV"
  - video_output: 2
    audio_zone: 2
    name: "Patio TV"
  # ... more mappings

presets:
  - id: 1
    name: "Big Game Mode"
    description: "All TVs to main ESPN feed"
    video_routes:
      1: 1  # Output 1 -> Input 1 (ESPN)
      2: 1  # Output 2 -> Input 1 (ESPN)
    audio_routes:
      1: 1  # Zone 1 -> Source 1 (ESPN Audio)
      2: 1  # Zone 2 -> Source 1 (ESPN Audio)
    # ... more configuration
```

### Input/Source Definitions

The system supports up to 8 video inputs and 8 audio sources:

**Video Inputs:**
1. ESPN HD
2. Fox Sports 1
3. NBC Sports
4. Local Broadcast
5. CNN
6. Weather Channel
7. Music Videos
8. Menu Channel

**Audio Sources:**
1. ESPN Audio
2. Fox Sports Audio
3. NBC Sports Audio
4. Local Audio
5. CNN Audio
6. Weather Audio
7. Background Music
8. Ambient/Menu Audio

## 🎮 Usage

### Web Dashboard

The web dashboard provides:

- **Status Indicators** - Real-time device connectivity status
- **Sync Toggle** - Enable/disable bi-directional AV sync
- **Quick Presets** - One-click activation of common scenarios
- **Individual TV Controls** - Manual control of each TV's video input and audio
- **Volume Controls** - Per-zone volume adjustment and mute controls

### API Endpoints

The system exposes REST API endpoints for integration:

- `GET /api/status` - Get system status
- `POST /api/preset/{id}` - Recall a preset
- `POST /api/sync` - Toggle sync mode
- `POST /api/manual_route` - Manual video routing
- `POST /api/volume` - Set zone volume
- `POST /api/mute` - Toggle zone mute

### Command Line Options

```bash
python main.py --help

Options:
  --config, -c     Configuration file path (default: config/mappings.yaml)
  --host           Dashboard host address (default: 0.0.0.0)
  --port, -p       Dashboard port (default: 5000)
  --debug, -d      Enable debug mode
  --log-level      Set logging level (DEBUG, INFO, WARNING, ERROR)
```

## 🔧 Advanced Features

### Bi-directional Sync

The system automatically synchronizes video and audio routing:

- **Video → Audio**: When video input changes, corresponding audio source is routed
- **Audio → Video**: When audio source changes, corresponding video input is switched
- **User Control**: Sync can be enabled/disabled via web interface

### Event System

Real-time events are published for:
- Video route changes
- Audio route changes
- Volume adjustments
- Mute state changes
- Preset activations
- Device connectivity changes

### Preset Management

Presets store complete AV configurations including:
- Video input routing for all outputs
- Audio source routing for all zones
- Volume levels for each zone
- Mute states for each zone

### Automation Features

- **Time-based Scheduling** - Automatic preset activation based on time
- **Commercial Detection** - Volume ducking during commercial breaks (optional)
- **Pattern Learning** - Learn from staff actions to suggest optimizations

## 🛠️ Development

### Project Structure

- `devices/` - Device-specific control modules
- `core/` - Core system logic and coordination
- `ui/` - Web interface and dashboard
- `config/` - Configuration files and templates
- `frontend/` - React components and styling
- `tests/` - Unit and integration tests

### Adding New Devices

1. Create a new device controller in `devices/`
2. Implement the standard device interface
3. Add device configuration to `mappings.yaml`
4. Update the AV Manager to include the new device

### Testing

```bash
# Run unit tests
pytest tests/

# Run integration tests
pytest tests/integration/

# Run with coverage
pytest --cov=. tests/
```

## 📊 Monitoring

### Health Checks

The system provides health check endpoints:
- `/api/status` - Overall system health
- Device connectivity monitoring
- Real-time performance metrics

### Logging

Comprehensive logging includes:
- All device commands and responses
- User actions and preset activations
- System errors and warnings
- Performance metrics

### Production Monitoring

The production Docker setup includes:
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **Fluentd** - Log aggregation
- **Nginx** - Reverse proxy and load balancing

## 🔒 Security

- Non-root container execution
- Network isolation via Docker networks
- Configuration file validation
- Input sanitization for all API endpoints
- HTTPS support via Nginx reverse proxy

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Issues**: [GitHub Issues](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues)
- **Documentation**: [Wiki](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/wiki)
- **Email**: support@sportsbarcontroller.com

## 🙏 Acknowledgments

- Wolfpack for their professional video matrix systems
- Atlas Sound for their Atmosphere audio processing platform
- The sports bar industry for inspiring this automation solution

---

**Built with ❤️ for the sports bar industry**
