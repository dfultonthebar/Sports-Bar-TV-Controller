# Sports Bar TV Controller - Comprehensive Installation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Pre-Installation Checklist](#pre-installation-checklist)
4. [One-Click Installation](#one-click-installation)
5. [AI-Enhanced Installation Process](#ai-enhanced-installation-process)
6. [Post-Installation Configuration](#post-installation-configuration)
7. [Feature Configuration](#feature-configuration)
8. [Service Management](#service-management)
9. [Troubleshooting](#troubleshooting)
10. [Advanced Configuration](#advanced-configuration)
11. [Security Setup](#security-setup)
12. [Maintenance and Updates](#maintenance-and-updates)

## 🎯 Overview

The Sports Bar TV Controller features a revolutionary **AI-Enhanced One-Click Installation** system that automatically handles complex deployment scenarios, resolves configuration conflicts, and provides real-time monitoring throughout the installation process.

### 🤖 AI-Enhanced Installation Features

- **Real-time Installation Monitoring** - AI system monitors every step of the installation
- **Automatic Error Resolution** - Intelligent handling of common installation problems
- **Git Conflict Resolution** - Automated resolution of configuration conflicts during updates
- **Self-Healing Installation** - Automatic retry and fix mechanisms for failed operations
- **Proactive Issue Detection** - Identifies and resolves issues before they cause failures
- **Installation Phase Tracking** - Detailed progress tracking through all installation phases

### 🚀 What Gets Installed

The one-click installer automatically sets up:

#### **Core System Components**
- **Python 3.11+** - Latest Python runtime with all required packages
- **Node.js 18+** - JavaScript runtime for frontend components
- **Nginx** - High-performance web server and reverse proxy
- **Redis** - In-memory data store for caching and sessions
- **SQLite** - Lightweight database for system data

#### **AI System Components**
- **AI-to-AI Communication Bridge** - Multi-provider AI integration system
- **Enhanced AI Installation Monitor** - Proactive installation monitoring
- **AI API Configuration Interface** - Web-based AI service management
- **Intelligent Task Automation** - Automated system maintenance and optimization

#### **Sports Content System**
- **Multi-Platform Sports Discovery** - Integration with major streaming services
- **Deep Linking Technology** - Direct launch to Fire TV and streaming devices
- **Real-time Sports Data APIs** - Integration with API-Sports.io and SportsDataIO
- **Smart Content Recommendations** - AI-powered content suggestions

#### **Professional AV Control**
- **Wolfpack Video Matrix Control** - Professional video switching system
- **Atlas Atmosphere Audio Processing** - Multi-zone audio control
- **Bi-directional AV Sync** - Intelligent audio/video synchronization
- **Preset Management System** - One-click activation of complex AV scenarios

## 🖥️ System Requirements

### Operating System Requirements

#### **Primary (Recommended)**
- **Ubuntu 22.04 LTS** - Latest long-term support release
- **Architecture**: x86_64 (Intel/AMD 64-bit)
- **Kernel**: 5.15+ (automatically updated during installation)

#### **Alternative Supported**
- **Ubuntu 20.04 LTS** - Previous LTS release (fully supported)
- **Debian 11/12** - Stable Debian releases
- **Architecture**: ARM64 (Raspberry Pi 4, Apple Silicon with limitations)

### Hardware Requirements

#### **Minimum Requirements**
- **CPU**: 2 cores, 2.0 GHz (Intel i3 or AMD equivalent)
- **RAM**: 4 GB (2 GB absolute minimum)
- **Storage**: 20 GB free space
- **Network**: 100 Mbps Ethernet connection
- **Graphics**: Integrated graphics sufficient

#### **Recommended for Small Setup (8-12 TVs)**
- **CPU**: 4 cores, 2.5 GHz (Intel i5 or AMD Ryzen 5)
- **RAM**: 8 GB
- **Storage**: 50 GB SSD
- **Network**: Gigabit Ethernet
- **Graphics**: Integrated graphics

#### **Recommended for Medium Setup (20-30 TVs)**
- **CPU**: 6 cores, 3.0 GHz (Intel i7 or AMD Ryzen 7)
- **RAM**: 16 GB
- **Storage**: 100 GB SSD
- **Network**: Gigabit Ethernet
- **Graphics**: Dedicated GPU (optional, for future AI features)

#### **Recommended for Large Setup (50+ TVs)**
- **CPU**: 8+ cores, 3.5 GHz (Intel i9 or AMD Ryzen 9)
- **RAM**: 32 GB
- **Storage**: 200 GB NVMe SSD
- **Network**: Gigabit Ethernet with redundancy
- **Graphics**: Dedicated GPU (recommended for local AI processing)

### Network Requirements

#### **Network Infrastructure**
- **Internet Connection**: Broadband with 50+ Mbps download
- **Local Network**: Gigabit Ethernet switch
- **IP Address**: Static IP recommended for server
- **Firewall**: Configurable firewall (UFW supported)

#### **Device Network Access**
- **Wolfpack Matrix**: TCP/IP access on port 5000
- **Atlas Atmosphere**: HTTP/WebSocket access on port 80
- **Fire TV Devices**: Network access for deep linking
- **Streaming Services**: Internet access for content discovery

#### **Port Requirements**
- **HTTP**: Port 80 (redirects to HTTPS)
- **HTTPS**: Port 443 (main web interface)
- **SSH**: Port 22 (for remote administration)
- **AI Services**: Ports 3001-3002 (AI monitoring and communication)
- **Custom Ports**: Configurable for specific device requirements

## ✅ Pre-Installation Checklist

### System Preparation

#### **1. System Access**
- [ ] **Root/Sudo Access** - Administrative privileges required
- [ ] **SSH Access** - Remote access configured (if installing remotely)
- [ ] **Internet Connection** - Stable internet connection for package downloads
- [ ] **System Updates** - Run `sudo apt update && sudo apt upgrade` before installation

#### **2. Network Configuration**
- [ ] **Static IP** - Configure static IP address for the server
- [ ] **DNS Configuration** - Ensure proper DNS resolution
- [ ] **Firewall Rules** - Document any existing firewall rules
- [ ] **Port Availability** - Ensure required ports are available

#### **3. Hardware Verification**
- [ ] **Device Connectivity** - Verify network access to Wolfpack and Atlas devices
- [ ] **Device IP Addresses** - Document IP addresses of all AV devices
- [ ] **Fire TV Setup** - Ensure Fire TV devices are on the same network
- [ ] **Streaming Accounts** - Verify access to streaming service accounts

#### **4. API Keys and Credentials**
- [ ] **Sports API Keys** - Obtain API keys from API-Sports.io and SportsDataIO
- [ ] **AI Service Keys** - Obtain API keys for OpenAI, Anthropic, Grok (optional)
- [ ] **Streaming Credentials** - Verify streaming service account access
- [ ] **Device Credentials** - Collect any required device authentication

### Information Gathering

#### **Device Information**
```bash
# Document this information before installation:

# Wolfpack Video Matrix
WOLFPACK_IP="192.168.1.70"
WOLFPACK_PORT="5000"
WOLFPACK_MODEL="4K-HDMI-8x8"

# Atlas Atmosphere Processor
ATLAS_IP="192.168.1.50"
ATLAS_PORT="80"
ATLAS_ZONES="8"

# Fire TV Devices
FIRE_TV_DEVICES=("192.168.1.100" "192.168.1.101" "192.168.1.102")

# Network Configuration
SERVER_IP="192.168.1.10"
SUBNET="192.168.1.0/24"
GATEWAY="192.168.1.1"
DNS_SERVERS=("8.8.8.8" "8.8.4.4")
```

#### **API Keys**
```bash
# Collect these API keys before installation:

# Sports Data APIs (Required for sports content discovery)
export API_SPORTS_KEY="your_api_sports_io_key"
export SPORTSDATA_IO_KEY="your_sportsdata_io_key"

# AI Service APIs (Optional but recommended)
export OPENAI_API_KEY="your_openai_api_key"
export ANTHROPIC_API_KEY="your_anthropic_api_key"
export GROK_API_KEY="your_grok_api_key"

# ESPN API (Optional)
export ESPN_API_KEY="your_espn_api_key"
```

## 🚀 One-Click Installation

### Installation Methods

#### **Method 1: Direct Installation (Recommended)**

The fastest and most reliable installation method with full AI monitoring:

```bash
# Download and run the AI-enhanced installer
curl -fsSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh | sudo bash
```

#### **Method 2: Manual Download and Install**

For environments where direct execution is not allowed:

```bash
# Download the installer
wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh

# Make executable and run
chmod +x install.sh
sudo ./install.sh
```

#### **Method 3: Git Clone and Install**

For development or customization:

```bash
# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller

# Run the installer
sudo ./scripts/install.sh
```

### Git Conflict Handling Options

The installer includes intelligent git conflict resolution with three modes:

#### **Interactive Mode (Default)**
```bash
# Prompts for conflict resolution decisions
sudo ./scripts/install.sh
```

#### **Keep Local Configurations**
```bash
# Preserves existing configurations, skips git updates
sudo GIT_UPDATE_MODE=keep_local ./scripts/install.sh
```

#### **Force GitHub Update**
```bash
# Updates from GitHub, backs up and overwrites local changes
sudo GIT_UPDATE_MODE=update_from_github ./scripts/install.sh
```

### Installation Process Overview

The AI-enhanced installer performs these steps automatically:

#### **Phase 1: System Preparation (2-3 minutes)**
1. **System Analysis** - AI analyzes system configuration and requirements
2. **Dependency Check** - Verifies system dependencies and package availability
3. **User Creation** - Creates `sportsbar` service user and `Controller` admin user
4. **Directory Setup** - Creates `/opt/sportsbar` directory structure with proper permissions
5. **Log Initialization** - Sets up logging for installation monitoring

#### **Phase 2: AI System Bootstrap (1-2 minutes)**
1. **AI Monitor Startup** - Starts AI installation monitor for real-time monitoring
2. **Rule Engine Initialization** - Loads installation monitoring rules
3. **Conflict Resolver Setup** - Initializes git conflict resolution system
4. **Self-Healing Activation** - Enables automatic error resolution

#### **Phase 3: Package Installation (5-10 minutes)**
1. **System Updates** - Updates package repositories and system packages
2. **Python Installation** - Installs Python 3.11+ with development tools
3. **Node.js Installation** - Installs Node.js 18+ and npm
4. **Database Setup** - Installs and configures SQLite and Redis
5. **Web Server Setup** - Installs and configures Nginx

#### **Phase 4: Application Deployment (3-5 minutes)**
1. **Repository Clone** - Clones application repository with sparse checkout
2. **Dependency Installation** - Installs Python and Node.js dependencies
3. **AI Bridge Setup** - Configures AI-to-AI communication system
4. **Sports Content Setup** - Initializes sports content discovery services
5. **Configuration Generation** - Creates default configuration files

#### **Phase 5: Service Configuration (2-3 minutes)**
1. **Systemd Services** - Creates and enables systemd service files
2. **Nginx Configuration** - Configures reverse proxy and SSL settings
3. **Firewall Setup** - Configures UFW firewall rules
4. **Log Rotation** - Sets up log rotation for all services
5. **Health Checks** - Configures service health monitoring

#### **Phase 6: Final Verification (1-2 minutes)**
1. **Service Startup** - Starts all system services
2. **Health Verification** - Verifies all services are running correctly
3. **Web Interface Test** - Tests web interface accessibility
4. **AI System Test** - Verifies AI systems are operational
5. **Installation Report** - Generates comprehensive installation report

## 🤖 AI-Enhanced Installation Process

### Real-Time Installation Monitoring

The AI system provides comprehensive monitoring throughout the installation:

#### **Installation Monitor Features**
- **Process Monitoring** - Monitors git, npm, pip, docker, and system processes
- **File System Watching** - Watches critical installation files and directories
- **Network Monitoring** - Monitors network connectivity and package downloads
- **Resource Monitoring** - Tracks CPU, memory, and disk usage during installation
- **Error Detection** - Real-time detection of installation errors and issues

#### **Automatic Error Resolution**

The AI system can automatically resolve common installation issues:

##### **Git-Related Issues**
- **Merge Conflicts** - Intelligent resolution of configuration merge conflicts
- **Repository Issues** - Automatic handling of repository corruption or access issues
- **Branch Problems** - Resolution of branch conflicts and synchronization issues
- **Permission Issues** - Automatic fixing of git permission problems

##### **Package Installation Issues**
- **Dependency Conflicts** - Resolution of package dependency conflicts
- **Network Timeouts** - Automatic retry with exponential backoff
- **Disk Space Issues** - Automatic cleanup of temporary files and caches
- **Permission Problems** - Automatic fixing of file and directory permissions

##### **Service Configuration Issues**
- **Port Conflicts** - Automatic detection and resolution of port conflicts
- **Configuration Errors** - Automatic correction of common configuration mistakes
- **Service Startup Issues** - Automatic service restart and dependency resolution
- **Database Issues** - Automatic database initialization and repair

### Installation Monitoring Dashboard

During installation, access the real-time monitoring dashboard:

```bash
# Monitor installation progress
curl http://localhost:3002/status

# View installation logs
tail -f /var/log/sportsbar-install.log

# Check AI monitor status
curl http://localhost:3002/ai-status
```

#### **Monitoring Endpoints**
- **`/status`** - Overall installation status and progress
- **`/ai-status`** - AI system status and active monitoring
- **`/logs`** - Real-time installation logs
- **`/errors`** - Current errors and resolution attempts
- **`/metrics`** - Installation performance metrics

### Self-Healing Capabilities

The AI system includes sophisticated self-healing capabilities:

#### **Automatic Recovery Actions**
- **Service Restart** - Automatic restart of failed services
- **Configuration Repair** - Automatic repair of corrupted configuration files
- **Permission Fixing** - Automatic correction of file and directory permissions
- **Network Recovery** - Automatic network connectivity recovery
- **Resource Cleanup** - Automatic cleanup of system resources

#### **Risk Assessment**
All automatic actions are classified by risk level:

- **LOW Risk** - Automatic execution without user intervention
- **MEDIUM Risk** - Automatic execution with logging and notification
- **HIGH Risk** - User confirmation required before execution
- **CRITICAL Risk** - Manual intervention required

## 🔧 Post-Installation Configuration

### Initial System Access

After successful installation, access the system using:

#### **Web Interfaces**
- **Main Dashboard**: `http://your-server-ip` or `https://your-server-ip`
- **Sports Content**: `http://your-server-ip/sports`
- **AI Agent Dashboard**: `http://your-server-ip/ai-agent`
- **AI API Configuration**: `http://your-server-ip/ai-config`

#### **Default Credentials**
- **Controller User**: Username `Controller`, Password `6809233DjD$$$`
- **Service User**: `sportsbar` (system service account, no login)

#### **SSH Access**
```bash
# SSH as Controller user
ssh Controller@your-server-ip

# Switch to service user for maintenance
sudo su - sportsbar
```

### Service Status Verification

Verify all services are running correctly:

```bash
# Check main application service
sudo systemctl status sportsbar-controller

# Check all related services
sudo systemctl status nginx redis-server

# View service logs
sudo journalctl -u sportsbar-controller -f

# Check AI monitoring service
sudo systemctl status sportsbar-ai-monitor
```

### Initial Configuration Steps

#### **1. Device Configuration**

Edit the device configuration file:

```bash
sudo nano /opt/sportsbar/app/config/mappings.yaml
```

Configure your devices:

```yaml
devices:
  wolfpack:
    host: "192.168.1.70"  # Your Wolfpack IP
    port: 5000
    model: "4K-HDMI-8x8"
    timeout: 10
  
  atmosphere:
    host: "192.168.1.50"  # Your Atlas IP
    port: 80
    zones: 8
    timeout: 5

# Define TV/Zone mappings
mappings:
  - video_output: 1
    audio_zone: 1
    name: "Main Bar TV"
    location: "Bar Area"
  - video_output: 2
    audio_zone: 2
    name: "Patio TV"
    location: "Outdoor Patio"
  # Add more mappings as needed

# Define input sources
video_inputs:
  1: "ESPN HD"
  2: "Fox Sports 1"
  3: "NBC Sports"
  4: "Local Broadcast"
  5: "CNN"
  6: "Weather Channel"
  7: "Music Videos"
  8: "Menu Channel"

audio_sources:
  1: "ESPN Audio"
  2: "Fox Sports Audio"
  3: "NBC Sports Audio"
  4: "Local Audio"
  5: "CNN Audio"
  6: "Weather Audio"
  7: "Background Music"
  8: "Ambient Audio"
```

#### **2. Sports Content Configuration**

Configure sports content discovery:

```bash
sudo nano /opt/sportsbar/app/config/sports_config.yaml
```

Set up API keys and preferences:

```yaml
sports_api:
  api_keys:
    api_sports: "${API_SPORTS_KEY}"
    sportsdata_io: "${SPORTSDATA_IO_KEY}"
    espn: "${ESPN_API_KEY}"
  
  cache_duration_minutes: 30
  rate_limit_requests_per_minute: 60
  timeout_seconds: 10

streaming_providers:
  prime_video:
    enabled: true
    priority: 100
    name: "Prime Video"
  espn_plus:
    enabled: true
    priority: 90
    name: "ESPN+"
  paramount_plus:
    enabled: true
    priority: 80
    name: "Paramount+"
  peacock:
    enabled: true
    priority: 70
    name: "Peacock"
  apple_tv_plus:
    enabled: true
    priority: 60
    name: "Apple TV+"

content_discovery:
  default_results:
    live: 10
    upcoming: 20
    search: 15
  auto_refresh_minutes: 5
  prime_time_start: "18:00"
  prime_time_end: "23:00"
```

#### **3. AI System Configuration**

Configure AI services through the web interface at `http://your-server-ip/ai-config` or edit the configuration file:

```bash
sudo nano /opt/sportsbar/app/config/ai_services/ai_bridge_config.yaml
```

Configure AI providers:

```yaml
ai_bridge:
  enabled: true
  max_concurrent_tasks: 10
  task_timeout_seconds: 300
  retry_attempts: 3

providers:
  openai:
    enabled: true
    model: "gpt-4"
    max_tokens: 4000
    temperature: 0.7
    priority: 100
    cost_per_token: 0.00003
  
  anthropic:
    enabled: true
    model: "claude-3-sonnet-20240229"
    max_tokens: 4000
    temperature: 0.7
    priority: 90
    cost_per_token: 0.000015
  
  grok:
    enabled: false  # Enable when you have API access
    model: "grok-beta"
    max_tokens: 4000
    temperature: 0.7
    priority: 80
    cost_per_token: 0.00002

collaboration:
  enabled: true
  consensus_threshold: 0.8
  max_collaboration_rounds: 3
  voting_weight_by_priority: true

monitoring:
  metrics_enabled: true
  performance_tracking: true
  cost_tracking: true
  alert_on_high_costs: true
  daily_cost_limit: 50.00
```

### Environment Variables Setup

Set up environment variables for API keys:

```bash
# Create environment file
sudo nano /opt/sportsbar/app/.env

# Add API keys
API_SPORTS_KEY=your_api_sports_io_key
SPORTSDATA_IO_KEY=your_sportsdata_io_key
ESPN_API_KEY=your_espn_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GROK_API_KEY=your_grok_api_key

# Set proper permissions
sudo chmod 600 /opt/sportsbar/app/.env
sudo chown sportsbar:sportsbar /opt/sportsbar/app/.env
```

### Service Restart

After configuration changes, restart the services:

```bash
# Restart main application
sudo systemctl restart sportsbar-controller

# Restart AI monitoring
sudo systemctl restart sportsbar-ai-monitor

# Restart web server
sudo systemctl restart nginx

# Check all services are running
sudo systemctl status sportsbar-controller sportsbar-ai-monitor nginx redis-server
```

## 🎯 Feature Configuration

### Preset Configuration

Create custom presets for common scenarios:

```yaml
presets:
  - id: 1
    name: "Big Game Mode"
    description: "All TVs to main ESPN feed with high volume"
    video_routes:
      1: 1  # All outputs to ESPN
      2: 1
      3: 1
      4: 1
    audio_routes:
      1: 1  # All zones to ESPN audio
      2: 1
      3: 1
      4: 1
    volume_levels:
      1: 80
      2: 80
      3: 75
      4: 75
    mute_states:
      1: false
      2: false
      3: false
      4: false

  - id: 2
    name: "Multi-Game Mode"
    description: "Different games on different zones"
    video_routes:
      1: 1  # Main bar - ESPN
      2: 2  # Patio - Fox Sports
      3: 3  # Dining - NBC Sports
      4: 4  # Private room - Local
    audio_routes:
      1: 1  # Main bar audio
      2: 2  # Patio audio
      3: 7  # Dining - background music
      4: 4  # Private room audio
    volume_levels:
      1: 75
      2: 70
      3: 40
      4: 65

  - id: 3
    name: "Chill Mode"
    description: "Background music and menu channels"
    video_routes:
      1: 7  # Music videos
      2: 8  # Menu channel
      3: 6  # Weather
      4: 5  # CNN
    audio_routes:
      1: 7  # Background music
      2: 8  # Ambient
      3: 7  # Background music
      4: 8  # Ambient
    volume_levels:
      1: 45
      2: 35
      3: 40
      4: 30
```

### Automation Rules Configuration

Configure AI monitoring and automation rules:

```bash
sudo nano /opt/sportsbar/app/config/rules/installation_rules.yaml
```

Example automation rules:

```yaml
rules:
  - name: "Auto Game Switch"
    description: "Automatically switch to live games during prime time"
    trigger:
      type: "schedule"
      time: "18:00"
      days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    condition:
      type: "live_games_available"
      minimum_games: 1
    action:
      type: "activate_preset"
      preset_id: 1
    enabled: true
    risk_level: "LOW"

  - name: "Volume Adjustment"
    description: "Adjust volume based on crowd noise detection"
    trigger:
      type: "audio_level"
      threshold: 75
      duration_seconds: 30
    action:
      type: "adjust_volume"
      adjustment: "+5"
      max_volume: 85
    enabled: true
    risk_level: "LOW"

  - name: "Service Recovery"
    description: "Automatically restart failed services"
    trigger:
      type: "service_failure"
      services: ["sportsbar-controller", "nginx", "redis-server"]
    action:
      type: "restart_service"
      max_attempts: 3
      backoff_seconds: 30
    enabled: true
    risk_level: "MEDIUM"
```

### Fire TV Deep Linking Configuration

Configure Fire TV devices for deep linking:

```bash
sudo nano /opt/sportsbar/app/config/fire_tv_config.yaml
```

```yaml
fire_tv_devices:
  - name: "Main Bar Fire TV"
    ip_address: "192.168.1.100"
    mac_address: "AA:BB:CC:DD:EE:FF"
    location: "Main Bar"
    enabled: true
  
  - name: "Patio Fire TV"
    ip_address: "192.168.1.101"
    mac_address: "AA:BB:CC:DD:EE:FG"
    location: "Patio"
    enabled: true

deep_link_templates:
  prime_video: "amzns://apps/android?asin=B00ZV9RDKK#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"
  espn_plus: "amzns://apps/android?asin=B00KQPQHPQ#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"
  paramount_plus: "amzns://apps/android?asin=B08KQZXHPX#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"
  peacock: "amzns://apps/android?asin=B08KQZXHPY#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"
  apple_tv_plus: "amzns://apps/android?asin=B08KQZXHPZ#Intent;action=android.intent.action.VIEW;S.contentId={content_id};end"

launch_settings:
  timeout_seconds: 10
  retry_attempts: 3
  confirmation_required: true
  log_launches: true
```

## 🔧 Service Management

### Systemd Service Control

The system uses systemd for service management:

#### **Main Services**
```bash
# Sports Bar Controller (main application)
sudo systemctl start sportsbar-controller
sudo systemctl stop sportsbar-controller
sudo systemctl restart sportsbar-controller
sudo systemctl status sportsbar-controller

# AI Monitoring Service
sudo systemctl start sportsbar-ai-monitor
sudo systemctl stop sportsbar-ai-monitor
sudo systemctl restart sportsbar-ai-monitor
sudo systemctl status sportsbar-ai-monitor

# Web Server (Nginx)
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx

# Redis Cache
sudo systemctl start redis-server
sudo systemctl stop redis-server
sudo systemctl restart redis-server
sudo systemctl status redis-server
```

#### **Service Logs**
```bash
# View real-time logs
sudo journalctl -u sportsbar-controller -f
sudo journalctl -u sportsbar-ai-monitor -f
sudo journalctl -u nginx -f

# View recent logs
sudo journalctl -u sportsbar-controller --since "1 hour ago"
sudo journalctl -u sportsbar-ai-monitor --since "1 hour ago"

# View logs with specific priority
sudo journalctl -u sportsbar-controller -p err
sudo journalctl -u sportsbar-ai-monitor -p warning
```

### Service Configuration Files

#### **Main Application Service**
```bash
# View service configuration
sudo cat /etc/systemd/system/sportsbar-controller.service

# Edit service configuration
sudo systemctl edit sportsbar-controller

# Reload after changes
sudo systemctl daemon-reload
sudo systemctl restart sportsbar-controller
```

#### **AI Monitoring Service**
```bash
# View AI monitor service configuration
sudo cat /etc/systemd/system/sportsbar-ai-monitor.service

# Edit AI monitor service
sudo systemctl edit sportsbar-ai-monitor

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart sportsbar-ai-monitor
```

### Health Monitoring

#### **Service Health Checks**
```bash
# Check all services at once
sudo systemctl is-active sportsbar-controller sportsbar-ai-monitor nginx redis-server

# Detailed health check
curl http://localhost/api/health
curl http://localhost:3002/health

# Check service dependencies
sudo systemctl list-dependencies sportsbar-controller
```

#### **Automated Health Monitoring**
The AI system continuously monitors service health and can automatically:
- Restart failed services
- Clear log files when they become too large
- Monitor resource usage and alert on high usage
- Detect and resolve common service issues

## 🔍 Troubleshooting

### Common Installation Issues

#### **Issue: Installation Fails with Permission Errors**

**Symptoms:**
- Permission denied errors during installation
- Files cannot be created in `/opt/sportsbar`
- Service startup failures

**AI Auto-Fix:**
The AI system automatically detects and fixes permission issues:

```bash
# Manual fix if AI auto-fix fails
sudo chown -R sportsbar:sportsbar /opt/sportsbar
sudo chmod -R 755 /opt/sportsbar
sudo chmod -R 644 /opt/sportsbar/app/config/*.yaml
```

**Prevention:**
- Always run installer with `sudo`
- Ensure `/opt` directory is writable
- Check disk space before installation

#### **Issue: Git Conflicts During Installation**

**Symptoms:**
- Installation stops with git merge conflicts
- Configuration files show conflict markers
- Services fail to start due to invalid configuration

**AI Auto-Fix:**
The Enhanced AI Installation Monitor automatically resolves git conflicts:

```bash
# Check git conflict resolution status
curl http://localhost:3002/git-status

# View conflict resolution log
sudo tail -f /var/log/sportsbar-git-conflicts.log
```

**Manual Resolution:**
```bash
cd /opt/sportsbar/app
sudo -u sportsbar git status
sudo -u sportsbar git diff
sudo -u sportsbar git add .
sudo -u sportsbar git commit -m "Resolve installation conflicts"
```

#### **Issue: Service Startup Failures**

**Symptoms:**
- Services fail to start after installation
- Web interface not accessible
- AI monitoring not responding

**AI Auto-Fix:**
The AI system automatically diagnoses and fixes service issues:

```bash
# Check AI diagnosis
curl http://localhost:3002/service-diagnosis

# View auto-fix attempts
sudo journalctl -u sportsbar-ai-monitor --since "10 minutes ago"
```

**Manual Diagnosis:**
```bash
# Check service status
sudo systemctl status sportsbar-controller --no-pager -l

# Check service logs
sudo journalctl -u sportsbar-controller --since "5 minutes ago"

# Check configuration
sudo -u sportsbar python /opt/sportsbar/app/main.py --check-config
```

#### **Issue: Network Connectivity Problems**

**Symptoms:**
- Cannot access device APIs
- Sports content not loading
- AI services not responding

**AI Auto-Fix:**
The AI system monitors network connectivity and attempts automatic fixes:

```bash
# Check network diagnosis
curl http://localhost:3002/network-status

# Test device connectivity
curl http://localhost/api/device-status
```

**Manual Diagnosis:**
```bash
# Test device connectivity
ping 192.168.1.70  # Wolfpack IP
ping 192.168.1.50  # Atlas IP

# Test API connectivity
curl -v http://192.168.1.70:5000/status
curl -v http://192.168.1.50/api/status

# Check firewall rules
sudo ufw status verbose
```

### AI System Troubleshooting

#### **Issue: AI Services Not Responding**

**Symptoms:**
- AI API configuration interface not loading
- AI monitoring not detecting issues
- AI-to-AI communication failures

**Diagnosis:**
```bash
# Check AI bridge status
curl http://localhost:3001/status

# Check AI monitor status
curl http://localhost:3002/status

# View AI service logs
sudo journalctl -u sportsbar-ai-monitor -f
```

**Resolution:**
```bash
# Restart AI services
sudo systemctl restart sportsbar-ai-monitor

# Check AI configuration
sudo -u sportsbar python /opt/sportsbar/app/setup_ai_bridge.py --check

# Test AI providers
curl -X POST http://localhost:3001/test-providers
```

#### **Issue: AI API Key Configuration Problems**

**Symptoms:**
- AI providers showing as unavailable
- API key validation failures
- High API costs or rate limiting

**Resolution:**
1. Access AI configuration interface: `http://your-server-ip/ai-config`
2. Verify API keys are correctly entered
3. Test each provider connection
4. Check API usage and limits
5. Review cost tracking and budgets

### Sports Content Troubleshooting

#### **Issue: Sports Content Not Loading**

**Symptoms:**
- Sports dashboard shows no content
- API errors in logs
- Deep links not working

**Diagnosis:**
```bash
# Test sports APIs
curl "http://localhost/api/sports/live-games"
curl "http://localhost/api/sports/upcoming-games"

# Check API keys
sudo -u sportsbar python -c "
import os
print('API-Sports Key:', os.getenv('API_SPORTS_KEY', 'Not Set'))
print('SportsDataIO Key:', os.getenv('SPORTSDATA_IO_KEY', 'Not Set'))
"

# View sports service logs
sudo journalctl -u sportsbar-controller | grep -i sports
```

**Resolution:**
1. Verify API keys are set correctly in environment variables
2. Check API rate limits and usage
3. Test API connectivity manually
4. Review sports configuration file
5. Restart services after configuration changes

#### **Issue: Deep Linking Not Working**

**Symptoms:**
- Fire TV devices not responding to deep links
- Content not launching on streaming devices
- Deep link validation failures

**Diagnosis:**
```bash
# Test Fire TV connectivity
ping 192.168.1.100  # Fire TV IP

# Test deep link generation
curl "http://localhost/api/sports/deep-link/prime-video/game123"

# Check Fire TV configuration
sudo cat /opt/sportsbar/app/config/fire_tv_config.yaml
```

**Resolution:**
1. Verify Fire TV devices are on the same network
2. Check Fire TV IP addresses and connectivity
3. Ensure streaming apps are installed on Fire TV devices
4. Test deep link templates manually
5. Review deep linking logs for errors

### Performance Troubleshooting

#### **Issue: High Resource Usage**

**Symptoms:**
- High CPU or memory usage
- Slow web interface response
- Service timeouts

**AI Auto-Fix:**
The AI system monitors resource usage and can automatically:
- Clean up temporary files and caches
- Restart resource-intensive processes
- Optimize configuration for better performance

**Manual Diagnosis:**
```bash
# Check system resources
htop
free -h
df -h

# Check service resource usage
sudo systemctl status sportsbar-controller
ps aux | grep python

# Check AI system resource usage
curl http://localhost:3002/metrics
```

**Resolution:**
1. Review system requirements and upgrade hardware if needed
2. Optimize configuration for your hardware
3. Disable unnecessary features or providers
4. Implement log rotation and cleanup
5. Monitor and tune AI system parameters

## 🔒 Security Setup

### Firewall Configuration

The installer automatically configures UFW firewall:

```bash
# Check firewall status
sudo ufw status verbose

# Default rules created by installer:
# - Allow SSH (port 22)
# - Allow HTTP (port 80)
# - Allow HTTPS (port 443)
# - Allow AI services (ports 3001-3002)
# - Deny all other incoming traffic
```

#### **Custom Firewall Rules**
```bash
# Allow specific device access
sudo ufw allow from 192.168.1.70 to any port 5000  # Wolfpack
sudo ufw allow from 192.168.1.50 to any port 80    # Atlas

# Allow Fire TV subnet
sudo ufw allow from 192.168.1.100/24

# Block specific IPs
sudo ufw deny from 192.168.1.200
```

### SSL/TLS Configuration

#### **Self-Signed Certificate (Default)**
The installer creates a self-signed certificate for HTTPS:

```bash
# Certificate location
ls -la /etc/ssl/certs/sportsbar-controller.*

# Nginx SSL configuration
sudo cat /etc/nginx/sites-available/sportsbar-controller
```

#### **Let's Encrypt Certificate (Recommended for Production)**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### User Security

#### **Password Security**
```bash
# Change default Controller password
sudo passwd Controller

# Set strong password policy
sudo nano /etc/security/pwquality.conf
```

#### **SSH Security**
```bash
# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Use SSH keys instead of passwords
ssh-keygen -t rsa -b 4096
ssh-copy-id Controller@your-server-ip

# Restart SSH service
sudo systemctl restart ssh
```

### API Security

#### **API Key Management**
- Store API keys in environment variables, not configuration files
- Use the AI API configuration interface for secure key management
- Regularly rotate API keys
- Monitor API usage for unusual activity

#### **Access Control**
```bash
# Restrict API access by IP
sudo nano /etc/nginx/sites-available/sportsbar-controller

# Add IP restrictions:
location /api/ {
    allow 192.168.1.0/24;
    deny all;
    proxy_pass http://localhost:5000;
}
```

### Data Protection

#### **Configuration Backup**
```bash
# Create backup script
sudo nano /opt/sportsbar/scripts/backup-config.sh

#!/bin/bash
BACKUP_DIR="/opt/sportsbar/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r /opt/sportsbar/app/config "$BACKUP_DIR/"
cp /opt/sportsbar/app/.env "$BACKUP_DIR/"
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Make executable and run
sudo chmod +x /opt/sportsbar/scripts/backup-config.sh
sudo /opt/sportsbar/scripts/backup-config.sh
```

#### **Log Security**
```bash
# Secure log files
sudo chmod 640 /var/log/sportsbar-*.log
sudo chown sportsbar:adm /var/log/sportsbar-*.log

# Configure log rotation
sudo nano /etc/logrotate.d/sportsbar-controller
```

## 🔄 Maintenance and Updates

### Regular Maintenance Tasks

#### **Daily Maintenance (Automated by AI)**
- Log file rotation and cleanup
- Service health checks
- Resource usage monitoring
- API usage tracking
- Security scan for unusual activity

#### **Weekly Maintenance**
```bash
# System updates
sudo apt update && sudo apt upgrade

# Check service logs for errors
sudo journalctl -u sportsbar-controller --since "1 week ago" | grep -i error

# Backup configuration
sudo /opt/sportsbar/scripts/backup-config.sh

# Check disk space
df -h
```

#### **Monthly Maintenance**
```bash
# Full system backup
sudo tar -czf /opt/sportsbar/backups/full-backup-$(date +%Y%m%d).tar.gz /opt/sportsbar

# Review and rotate API keys
# Access AI configuration interface to update keys

# Performance review
curl http://localhost:3002/performance-report

# Security audit
sudo lynis audit system
```

### System Updates

#### **Application Updates**
The AI system can automatically handle application updates:

```bash
# Check for updates
cd /opt/sportsbar/app
sudo -u sportsbar git fetch origin

# AI-assisted update (recommended)
sudo GIT_UPDATE_MODE=keep_local /opt/sportsbar/app/scripts/install.sh

# Manual update
sudo -u sportsbar git pull origin main
sudo systemctl restart sportsbar-controller
```

#### **System Package Updates**
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Update Python packages
sudo -u sportsbar pip install -r /opt/sportsbar/app/requirements.txt --upgrade
sudo -u sportsbar pip install -r /opt/sportsbar/app/requirements_ai_bridge.txt --upgrade

# Restart services after updates
sudo systemctl restart sportsbar-controller sportsbar-ai-monitor
```

### Monitoring and Alerting

#### **Health Monitoring**
```bash
# Check overall system health
curl http://localhost/api/health

# Check AI system health
curl http://localhost:3002/health

# Check service status
sudo systemctl is-active sportsbar-controller sportsbar-ai-monitor nginx redis-server
```

#### **Performance Monitoring**
```bash
# System performance
htop
iotop
nethogs

# Application performance
curl http://localhost:3002/metrics
curl http://localhost/api/metrics
```

#### **Log Monitoring**
```bash
# Real-time log monitoring
sudo tail -f /var/log/sportsbar-controller.log
sudo tail -f /var/log/sportsbar-ai-monitor.log

# Error log analysis
sudo grep -i error /var/log/sportsbar-*.log | tail -20
```

### Backup and Recovery

#### **Configuration Backup**
```bash
# Automated daily backup (set up by installer)
sudo crontab -l | grep backup

# Manual backup
sudo /opt/sportsbar/scripts/backup-config.sh
```

#### **Full System Backup**
```bash
# Create full backup
sudo tar --exclude='/opt/sportsbar/app/.git' \
         --exclude='/opt/sportsbar/logs' \
         -czf /backup/sportsbar-full-$(date +%Y%m%d).tar.gz \
         /opt/sportsbar

# Database backup (if using external database)
sudo -u sportsbar pg_dump sportsbar_db > /backup/sportsbar-db-$(date +%Y%m%d).sql
```

#### **Recovery Procedures**
```bash
# Restore from backup
sudo systemctl stop sportsbar-controller sportsbar-ai-monitor
sudo tar -xzf /backup/sportsbar-full-20231215.tar.gz -C /
sudo systemctl start sportsbar-controller sportsbar-ai-monitor

# Restore configuration only
sudo tar -xzf /backup/sportsbar-config-20231215.tar.gz -C /opt/sportsbar/app/
sudo systemctl restart sportsbar-controller
```

---

## 📞 Support and Resources

### Getting Help

#### **Self-Service Resources**
1. **AI Agent Dashboard** - `http://your-server-ip/ai-agent` for real-time system diagnostics
2. **Installation Logs** - `/var/log/sportsbar-install.log` for installation troubleshooting
3. **Service Logs** - `sudo journalctl -u sportsbar-controller -f` for runtime issues
4. **Health Checks** - `curl http://localhost/api/health` for system status

#### **Community Support**
- **GitHub Issues** - [Report bugs and request features](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues)
- **GitHub Discussions** - [Community Q&A and discussions](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/discussions)
- **Documentation** - [Comprehensive guides and tutorials](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/wiki)

#### **Professional Support**
- **Email Support** - support@sportsbarcontroller.com
- **Installation Services** - Professional installation and configuration
- **Training Services** - Staff training and system optimization
- **Maintenance Contracts** - Ongoing support and maintenance

### Additional Resources

#### **Hardware Vendors**
- **Wolfpack** - Video matrix systems and technical support
- **Atlas Sound** - Atmosphere audio processing and integration support
- **Fire TV** - Amazon Fire TV devices and deep linking documentation

#### **API Providers**
- **API-Sports.io** - Sports data API documentation and support
- **SportsDataIO** - Professional sports data and integration guides
- **OpenAI** - AI service documentation and best practices
- **Anthropic** - Claude AI integration and usage guidelines

---

**🏈 Sports Bar TV Controller - Professional AI-Enhanced AV Automation**

*Complete installation guide for the most advanced sports bar automation system available.*
