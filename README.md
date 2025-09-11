
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
├── devices/                    # Device control modules
│   ├── wolfpack_controller.py  # Wolfpack video matrix driver
│   ├── atlas_atmosphere.py     # Atlas DSP audio processor driver
│   └── ...
├── core/
│   ├── av_manager.py           # Coordination layer with bi-directional sync
│   └── event_bus.py            # Pub-sub event system
├── config/
│   └── mappings.yaml           # Configuration for device mappings
├── ui/
│   ├── dashboard.py            # Flask web dashboard
│   └── templates/              # Web interface templates
├── frontend/
│   ├── RoomLayout.js           # React component for room control
│   └── RoomLayout.css          # Styling for the interface
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

3. **Configure your devices**
   ```bash
   cp config/mappings.yaml.example config/mappings.yaml
   # Edit config/mappings.yaml with your device IP addresses and mappings
   ```

4. **Run the system**
   ```bash
   python main.py
   ```

5. **Access the dashboard**
   Open your browser to `http://localhost:5000`

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
