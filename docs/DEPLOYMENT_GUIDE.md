# Sports Bar TV Controller - Deployment Guide

## 📋 Overview

This guide covers different deployment scenarios for the Sports Bar TV Controller system, from small single-location bars to large multi-location enterprises.

## 🏗️ Deployment Architectures

### Single Location Deployment

#### Small Sports Bar (1-10 TVs)
```
┌─────────────────────────────────────────────────────────────┐
│                    Single Location Architecture              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   Router    │────│    Switch    │────│  Controller │    │
│  │ (Internet)  │    │   24-port    │    │   (NUC)     │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                              │                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   TV Zone   │    │  Audio Zone  │    │ Streaming   │    │
│  │   (6 TVs)   │    │  (Speakers)  │    │  Devices    │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Network: 192.168.1.0/24
Controller: 192.168.1.10
TVs: 192.168.1.100-105
Audio: 192.168.1.200
Streaming: 192.168.1.150-152
```

#### Medium Sports Bar (10-25 TVs)
```
┌─────────────────────────────────────────────────────────────┐
│                   Medium Location Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   Router    │────│ Core Switch  │────│ Controller  │    │
│  │ (Firewall)  │    │   48-port    │    │ Cluster (2) │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                              │                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │ Main Bar    │    │ Dining Area  │    │ Patio Area  │    │
│  │  (8 TVs)    │    │   (6 TVs)    │    │   (4 TVs)   │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │ HDMI Matrix │    │ Audio Matrix │    │ Streaming   │    │
│  │   (16x8)    │    │   (8 zones)  │    │ Farm (8)    │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Management VLAN: 192.168.10.0/24
Device VLAN: 192.168.20.0/24
Guest VLAN: 192.168.30.0/24
```

#### Large Sports Bar (25+ TVs)
```
┌─────────────────────────────────────────────────────────────┐
│                    Large Location Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │ Edge Router │────│ Core Switch  │────│ Controller  │    │
│  │ (Redundant) │    │ (Stacked)    │    │ HA Cluster  │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                              │                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │ Zone 1      │    │ Zone 2       │    │ Zone 3      │    │
│  │ Main Bar    │    │ Sports Lounge│    │ Private     │    │
│  │ (12 TVs)    │    │ (10 TVs)     │    │ Rooms (8)   │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │ Video Wall  │    │ Distributed  │    │ Streaming   │    │
│  │ Controller  │    │ Audio System │    │ Headend     │    │
│  │ (32x16)     │    │ (16 zones)   │    │ (16 devices)│    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Management: 10.0.10.0/24
AV Devices: 10.0.20.0/24
Streaming: 10.0.30.0/24
Guest WiFi: 10.0.100.0/24
```

### Multi-Location Deployment

#### Chain/Franchise Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Location Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌─────────────┐                          │
│                    │   Central   │                          │
│                    │ Management  │                          │
│                    │   Server    │                          │
│                    └─────────────┘                          │
│                           │                                 │
│        ┌──────────────────┼──────────────────┐              │
│        │                  │                  │              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Location A  │    │ Location B  │    │ Location C  │     │
│  │ Controller  │    │ Controller  │    │ Controller  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│        │                  │                  │              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ 15 TVs      │    │ 8 TVs       │    │ 22 TVs      │     │
│  │ 3 Zones     │    │ 2 Zones     │    │ 4 Zones     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Central Management: Cloud-based or datacenter
VPN Connections: Site-to-site IPsec tunnels
Monitoring: Centralized logging and alerting
Updates: Centralized configuration management
```

## 🚀 Installation Procedures

### Pre-Deployment Planning

#### Site Survey Checklist
```
Physical Infrastructure:
□ Electrical capacity and outlets mapped
□ Network cable runs planned and measured
□ Display mounting locations identified
□ Audio speaker placement designed
□ Equipment rack locations selected
□ HVAC considerations for equipment cooling

Network Infrastructure:
□ Internet bandwidth requirements calculated
□ Network topology designed
□ IP address scheme planned
□ VLAN configuration designed
□ Security policies defined
□ Firewall rules documented

Equipment Procurement:
□ Hardware specifications finalized
□ Vendor quotes obtained
□ Delivery schedules coordinated
□ Installation team scheduled
□ Testing procedures defined
□ Go-live date planned
```

### Phase 1: Infrastructure Setup

#### Network Infrastructure
```bash
# 1. Configure core network equipment
# Router/Firewall Configuration
configure terminal
interface GigabitEthernet0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
exit

# VLAN Configuration
vlan 10
 name MANAGEMENT
vlan 20
 name AV_DEVICES
vlan 30
 name STREAMING
vlan 100
 name GUEST_WIFI

# 2. Configure managed switches
# Access ports for devices
interface range GigabitEthernet1/0/1-24
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast

# Trunk ports for APs and uplinks
interface GigabitEthernet1/0/25
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,100
```

#### Power Infrastructure
```bash
# UPS Configuration
# Connect critical equipment to UPS:
# - Controller computer
# - Core network switch
# - Primary displays (at least 2)
# - Audio processor

# Power monitoring setup
# Install power monitoring on main circuits
# Configure alerts for power issues
# Test UPS runtime under load
```

### Phase 2: Equipment Installation

#### Controller Setup
```bash
# 1. Install Ubuntu 22.04 LTS on controller hardware
# 2. Configure static IP address
sudo nano /etc/netplan/00-installer-config.yaml

network:
  version: 2
  ethernets:
    enp1s0:
      addresses:
        - 192.168.1.10/24
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]

sudo netplan apply

# 3. Run installation script
wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh
chmod +x install.sh
sudo ./install.sh
```

#### Display Configuration
```bash
# Samsung TV Setup
# Enable network control on each TV:
# Settings > General > Network > Expert Settings > Power On with Mobile = On
# Settings > General > External Device Manager > Device Connect Manager = On

# Test connectivity
curl -X POST http://192.168.20.101:8001/api/v2/ \
  -H "Content-Type: application/json" \
  -d '{"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":"KEY_POWER","Option":"false","TypeOfRemote":"SendRemoteKey"}}'

# LG TV Setup
# Enable network control:
# Settings > Connection > Mobile TV On = On
# Settings > Connection > LG Connect Apps = On

# Test connectivity
curl -X POST http://192.168.20.102:3000/udap/api/command \
  -H "Content-Type: application/json" \
  -d '{"id":"1","type":"request","uri":"ssap://system.launcher/launch","payload":{"id":"netflix"}}'
```

#### Audio System Setup
```bash
# DBX ZonePro Configuration
# Connect via Ethernet to 192.168.20.200
# Use DBX System Architect software for initial setup

# Basic zone configuration:
# Zone 1: Main Bar (Speakers 1-4)
# Zone 2: Dining Area (Speakers 5-8)
# Zone 3: Patio (Speakers 9-12)

# Configure presets:
# Preset 1: Normal operation (balanced levels)
# Preset 2: Big game mode (main bar louder)
# Preset 3: Late night (reduced levels)
```

### Phase 3: Software Configuration

#### Device Mapping Configuration
```yaml
# /opt/sportsbar/app/config/mappings.yaml
global:
  refresh_interval: 30
  timeout: 10
  retry_attempts: 3

rooms:
  main_bar:
    name: "Main Bar"
    displays:
      - id: "main_tv_1"
        name: "Main TV 1"
        type: "samsung"
        ip: "192.168.20.101"
        port: 8001
        mac: "aa:bb:cc:dd:ee:01"
      - id: "main_tv_2"
        name: "Main TV 2"
        type: "samsung"
        ip: "192.168.20.102"
        port: 8001
        mac: "aa:bb:cc:dd:ee:02"
    
    audio:
      - id: "main_audio"
        name: "Main Bar Audio"
        type: "dbx"
        ip: "192.168.20.200"
        port: 5000

  dining_area:
    name: "Dining Area"
    displays:
      - id: "dining_tv_1"
        name: "Dining TV 1"
        type: "lg"
        ip: "192.168.20.103"
        port: 3000
        mac: "aa:bb:cc:dd:ee:03"

presets:
  big_game:
    name: "Big Game Mode"
    description: "All main TVs to primary feed, high volume"
    actions:
      - device: "main_tv_1"
        action: "set_input"
        value: "hdmi1"
      - device: "main_tv_2"
        action: "set_input"
        value: "hdmi1"
      - device: "main_audio"
        action: "set_preset"
        value: "big_game"
        
  multi_game:
    name: "Multi Game Mode"
    description: "Different games on different TVs"
    actions:
      - device: "main_tv_1"
        action: "set_input"
        value: "hdmi1"
      - device: "main_tv_2"
        action: "set_input"
        value: "hdmi2"
      - device: "dining_tv_1"
        action: "set_input"
        value: "hdmi3"
```

#### Sports API Configuration
```bash
# Configure sports content discovery
sudo nano /etc/environment

# Add API keys
API_SPORTS_KEY="your_api_sports_key_here"
SPORTSDATA_IO_KEY="your_sportsdata_io_key_here"
ESPN_API_KEY="your_espn_api_key_here"

# Restart services to load new environment
sudo systemctl restart sportsbar-controller
```

### Phase 4: Testing and Validation

#### System Testing Checklist
```bash
# 1. Network connectivity test
sudo /opt/sportsbar/scripts/status.sh

# 2. Device control test
# Test each TV power on/off
# Test input switching
# Test volume control

# 3. Preset testing
# Test each preset configuration
# Verify all devices respond correctly
# Check timing and synchronization

# 4. Sports content test
# Verify API connectivity
# Test content discovery
# Test deep linking to streaming services

# 5. Web interface test
# Access main dashboard
# Test sports content dashboard
# Verify mobile responsiveness

# 6. Performance test
# Load test with multiple concurrent users
# Monitor system resources
# Test under peak usage scenarios
```

## 🔧 Configuration Management

### Environment-Specific Configurations

#### Development Environment
```yaml
# config/environments/development.yaml
environment: development
debug: true
log_level: DEBUG

database:
  type: sqlite
  path: /opt/sportsbar/data/dev.db

sports_api:
  cache_duration_minutes: 5  # Short cache for testing
  
network:
  allowed_hosts: ["localhost", "127.0.0.1", "192.168.1.0/24"]
  
features:
  enable_debug_toolbar: true
  enable_test_devices: true
```

#### Production Environment
```yaml
# config/environments/production.yaml
environment: production
debug: false
log_level: INFO

database:
  type: postgresql
  host: localhost
  port: 5432
  name: sportsbar_prod
  
sports_api:
  cache_duration_minutes: 30
  
network:
  allowed_hosts: ["sportsbar.local", "192.168.20.10"]
  
security:
  enable_https: true
  ssl_cert_path: /etc/ssl/certs/sportsbar.crt
  ssl_key_path: /etc/ssl/private/sportsbar.key
  
features:
  enable_analytics: true
  enable_monitoring: true
```

### Configuration Templates

#### Small Venue Template
```yaml
# templates/small_venue.yaml
global:
  venue_type: small
  max_displays: 10
  max_zones: 3

default_presets:
  - name: "Game Time"
    priority: 100
  - name: "Normal"
    priority: 50
  - name: "Closing"
    priority: 25

streaming_services:
  - prime_video
  - espn_plus
  - youtube_tv

audio_zones:
  - main_bar
  - dining
```

#### Large Venue Template
```yaml
# templates/large_venue.yaml
global:
  venue_type: large
  max_displays: 50
  max_zones: 10

default_presets:
  - name: "Big Game"
    priority: 100
  - name: "Multi Game"
    priority: 90
  - name: "Normal Operations"
    priority: 50
  - name: "Late Night"
    priority: 30
  - name: "Closing"
    priority: 10

streaming_services:
  - prime_video
  - espn_plus
  - paramount_plus
  - peacock
  - apple_tv
  - youtube_tv
  - hulu_live

audio_zones:
  - main_bar
  - sports_lounge
  - dining_room
  - patio
  - private_rooms
  - vip_area
```

## 📊 Monitoring and Maintenance

### Monitoring Setup

#### System Monitoring
```bash
# Install monitoring tools
sudo apt install prometheus node-exporter grafana

# Configure Prometheus
sudo nano /etc/prometheus/prometheus.yml

global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'sportsbar-controller'
    static_configs:
      - targets: ['localhost:5000']
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

# Configure Grafana dashboards
# Import dashboard for system metrics
# Create custom dashboard for AV device status
```

#### Application Monitoring
```python
# Add to main.py for health checks
from flask import jsonify
import psutil
import redis

@app.route('/health')
def health_check():
    """System health check endpoint"""
    try:
        # Check Redis connectivity
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        redis_status = "healthy"
    except:
        redis_status = "unhealthy"
    
    # Check system resources
    cpu_percent = psutil.cpu_percent(interval=1)
    memory_percent = psutil.virtual_memory().percent
    disk_percent = psutil.disk_usage('/').percent
    
    # Check device connectivity
    device_status = check_device_connectivity()
    
    health_data = {
        "status": "healthy" if redis_status == "healthy" else "degraded",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "redis": redis_status,
            "devices": device_status
        },
        "resources": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
            "disk_percent": disk_percent
        }
    }
    
    return jsonify(health_data)
```

### Maintenance Procedures

#### Daily Maintenance
```bash
#!/bin/bash
# daily_maintenance.sh

# Check service status
systemctl is-active sportsbar-controller || systemctl restart sportsbar-controller

# Check disk space
DISK_USAGE=$(df /opt/sportsbar | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "WARNING: Disk usage is ${DISK_USAGE}%" | mail -s "Disk Space Alert" admin@sportsbar.com
fi

# Rotate logs
logrotate /etc/logrotate.d/sportsbar

# Backup configuration
tar -czf /opt/sportsbar/backups/daily/config_$(date +%Y%m%d).tar.gz /opt/sportsbar/config/

# Test device connectivity
python3 /opt/sportsbar/scripts/device_health_check.py
```

#### Weekly Maintenance
```bash
#!/bin/bash
# weekly_maintenance.sh

# Update system packages
apt update && apt list --upgradable

# Check for application updates
cd /opt/sportsbar/app
git fetch origin
if [ $(git rev-list HEAD...origin/main --count) -gt 0 ]; then
    echo "Updates available" | mail -s "Application Updates Available" admin@sportsbar.com
fi

# Performance analysis
python3 /opt/sportsbar/scripts/performance_report.py

# Security scan
lynis audit system --quiet
```

## 🔒 Security Hardening

### Network Security
```bash
# Configure firewall rules
ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# Allow SSH from management network only
ufw allow from 192.168.10.0/24 to any port 22

# Allow web access from local networks
ufw allow from 192.168.0.0/16 to any port 80
ufw allow from 192.168.0.0/16 to any port 443

# Allow device communication
ufw allow from 192.168.20.0/24 to any port 5000

# Enable firewall
ufw enable
```

### Application Security
```bash
# Set secure file permissions
chmod 600 /opt/sportsbar/config/*.yaml
chmod 600 /etc/sportsbar/*
chown -R sportsbar:sportsbar /opt/sportsbar/

# Configure SSL/TLS
certbot --nginx -d sportsbar.yourdomain.com

# Set up fail2ban
sudo nano /etc/fail2ban/jail.local

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
```

## 📈 Scaling Considerations

### Horizontal Scaling
```yaml
# Load balancer configuration for multiple controllers
upstream sportsbar_backend {
    server 192.168.20.10:5000 weight=3;
    server 192.168.20.11:5000 weight=2;
    server 192.168.20.12:5000 backup;
}

server {
    listen 80;
    server_name sportsbar.local;
    
    location / {
        proxy_pass http://sportsbar_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Database Scaling
```yaml
# PostgreSQL configuration for larger deployments
# /etc/postgresql/14/main/postgresql.conf

max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Enable connection pooling
# Install pgbouncer for connection management
```

This deployment guide provides comprehensive procedures for implementing the Sports Bar TV Controller system across various venue sizes and configurations.
