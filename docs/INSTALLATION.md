# Sports Bar TV Controller - Installation Guide

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Hardware Requirements](#hardware-requirements)
3. [Network Requirements](#network-requirements)
4. [Pre-Installation Checklist](#pre-installation-checklist)
5. [Installation Methods](#installation-methods)
6. [Post-Installation Configuration](#post-installation-configuration)
7. [Service Management](#service-management)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)
10. [Security Considerations](#security-considerations)

## 🖥️ System Requirements

### Operating System
- **Primary**: Ubuntu 22.04 LTS (Recommended)
- **Alternative**: Ubuntu 20.04 LTS, Debian 11/12
- **Architecture**: x86_64 (Intel/AMD 64-bit)
- **Alternative**: ARM64 (Raspberry Pi 4, Apple Silicon)

### Software Requirements
- **Python**: 3.11+ (automatically installed)
- **Node.js**: 18+ (automatically installed)
- **Database**: SQLite (included) or PostgreSQL/MySQL (optional)
- **Web Server**: Nginx (automatically installed)
- **Cache**: Redis (automatically installed)

### System Resources
- **Minimum RAM**: 2GB
- **Recommended RAM**: 4GB+
- **Storage**: 10GB free space minimum
- **Recommended Storage**: 50GB+ for logs and media
- **CPU**: 2+ cores recommended

## 🔧 Hardware Requirements

### Core System
- **Computer**: Mini PC, NUC, or dedicated server
- **Examples**: 
  - Intel NUC 11/12 series
  - Raspberry Pi 4 (4GB+ RAM)
  - Dell OptiPlex Micro
  - HP EliteDesk Mini
  - Custom build with Ubuntu support

### Network Infrastructure
- **Ethernet**: Gigabit recommended (100Mbps minimum)
- **WiFi**: 802.11ac or better (if using wireless)
- **Network Switch**: Managed switch recommended for VLAN support
- **Router**: Business-grade with QoS support

### Display Hardware
- **TVs/Displays**: Network-enabled displays (Samsung, LG, Sony)
- **Streaming Devices**: 
  - Amazon Fire TV Cube/Stick 4K Max
  - Apple TV 4K
  - Roku Ultra
  - NVIDIA Shield TV
- **HDMI Matrix**: 4x4 or 8x8 HDMI matrix switcher (optional)

### Audio/Video Equipment
- **Audio Processor**: DBX ZonePro, BSS Audio, or similar
- **Video Matrix**: Atlona, Extron, or Crestron matrix switchers
- **Control Interfaces**: 
  - RS-232/RS-485 for legacy equipment
  - IP control for modern equipment
  - IR blasters for older devices

### Recommended Complete Setup
```
Control Computer (Ubuntu 22.04)
├── Intel NUC 12 Pro (i5, 16GB RAM, 512GB SSD)
├── Gigabit Ethernet connection
└── UPS backup power

Network Infrastructure
├── Business Router (UniFi Dream Machine)
├── Managed Switch (24-port Gigabit)
├── WiFi 6 Access Points
└── VLAN segmentation

Display System
├── 6x Samsung QM75R Commercial Displays
├── 3x Amazon Fire TV Cube (4K)
├── 8x4 HDMI Matrix (Atlona AT-UHD-EX-70-2PS)
└── Cable management system

Audio System
├── DBX ZonePro 1260m Audio Processor
├── 8-zone amplifier system
├── Ceiling speakers per zone
└── Wireless microphone system

Streaming Services
├── YouTube TV subscription
├── ESPN+ subscription
├── Prime Video subscription
├── Paramount+ subscription
└── Peacock Premium subscription
```

## 🌐 Network Requirements

### Network Configuration
- **IP Range**: Dedicated subnet recommended (e.g., 192.168.100.0/24)
- **DHCP**: Static IP reservations for all devices
- **DNS**: Local DNS server or reliable external DNS
- **NTP**: Network time synchronization

### Port Requirements
| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Web Dashboard | 80 | HTTP | Main interface |
| Web Dashboard (SSL) | 443 | HTTPS | Secure interface |
| Application | 5000 | HTTP | Flask application |
| Backend API | 8000 | HTTP | FastAPI backend |
| Redis | 6379 | TCP | Cache/sessions |
| SSH | 22 | TCP | Remote management |

### Device Network Requirements
- **Samsung TVs**: Port 8001 (WebSocket), Port 8002 (HTTP)
- **LG TVs**: Port 3000 (WebSocket), Port 8080 (HTTP)
- **Fire TV**: Port 5555 (ADB), mDNS discovery
- **Audio Processors**: Various (RS-232 over IP, Telnet, HTTP)

### Firewall Configuration
```bash
# Allow web traffic
ufw allow 80/tcp
ufw allow 443/tcp

# Allow SSH (restrict to management network)
ufw allow from 192.168.1.0/24 to any port 22

# Allow application ports (local network only)
ufw allow from 192.168.0.0/16 to any port 5000
ufw allow from 10.0.0.0/8 to any port 5000

# Allow device communication
ufw allow from 192.168.100.0/24 to any port 8001
ufw allow from 192.168.100.0/24 to any port 8002
```

## ✅ Pre-Installation Checklist

### System Preparation
- [ ] Fresh Ubuntu 22.04 LTS installation
- [ ] System fully updated (`apt update && apt upgrade`)
- [ ] Root/sudo access available
- [ ] Internet connectivity verified
- [ ] Minimum 10GB free disk space
- [ ] Static IP address configured
- [ ] Hostname set appropriately

### Network Preparation
- [ ] All devices connected to network
- [ ] Device IP addresses documented
- [ ] Network connectivity to all devices verified
- [ ] Firewall rules planned
- [ ] DNS resolution working

### Account Setup
- [ ] Sports API accounts created (optional):
  - [API-Sports.io](https://api-sports.io/) account
  - [SportsDataIO](https://sportsdata.io/) account
- [ ] Streaming service subscriptions active
- [ ] Fire TV devices registered to Amazon account

## 🚀 Installation Methods

### Method 1: Automated Installation (Recommended)

1. **Download the installation script**:
   ```bash
   wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh
   chmod +x install.sh
   ```

2. **Run the installation**:
   ```bash
   sudo ./install.sh
   ```

3. **Follow the prompts** and wait for completion (15-30 minutes)

The automated installer will:
- Install all system dependencies (Python 3.11, Node.js 18, Nginx, Redis)
- Create system users:
  - **Controller user**: `Controller` with password `6809233DjD$$$` and sudo permissions
  - **Service user**: `sportsbar` (system service account)
- Set up systemd services for automatic startup
- Configure Nginx reverse proxy with security headers
- Set up firewall rules (UFW) with appropriate port access
- Configure log rotation for system maintenance
- Create complete directory structure in `/opt/sportsbar/`

**Post-Installation Access:**
- **Web Dashboard**: `http://your-server-ip` (port 80)
- **SSH Access**: Use the `Controller` user for system administration
- **Service Management**: `sudo systemctl status sportsbar-controller`

### Method 2: Manual Installation

1. **Clone the repository**:
   ```bash
   sudo mkdir -p /opt/sportsbar
   cd /opt/sportsbar
   sudo git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git app
   ```

2. **Run setup scripts**:
   ```bash
   cd app
   sudo ./scripts/setup_root_dirs.sh
   sudo ./scripts/install.sh
   ```

### Method 3: Docker Installation

1. **Install Docker and Docker Compose**:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt install docker-compose
   ```

2. **Clone and start**:
   ```bash
   git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
   cd Sports-Bar-TV-Controller
   sudo docker-compose up -d
   ```

## ⚙️ Post-Installation Configuration

### 1. Device Configuration

Edit the device mappings file:
```bash
sudo nano /opt/sportsbar/app/config/mappings.yaml
```

Example configuration:
```yaml
global:
  refresh_interval: 30
  timeout: 10
  retry_attempts: 3

rooms:
  main_bar:
    name: "Main Bar Area"
    displays:
      - id: "tv1"
        name: "Main TV 1"
        type: "samsung"
        ip: "192.168.100.101"
        port: 8001
      - id: "tv2"
        name: "Main TV 2"
        type: "lg"
        ip: "192.168.100.102"
        port: 8080
    
    audio:
      - id: "main_audio"
        name: "Main Bar Audio"
        type: "dbx"
        ip: "192.168.100.201"
        port: 5000

presets:
  big_game:
    name: "Big Game Mode"
    actions:
      - device: "all_tvs"
        action: "set_input"
        value: "hdmi1"
      - device: "main_audio"
        action: "set_volume"
        value: 80
```

### 2. Sports API Configuration (Optional)

Set up environment variables for sports content discovery:
```bash
# Add to /etc/environment or /opt/sportsbar/config/environment
export API_SPORTS_KEY="your_api_sports_key"
export SPORTSDATA_IO_KEY="your_sportsdata_io_key"
export ESPN_API_KEY="your_espn_api_key"
```

### 3. SSL Certificate Setup (Recommended)

Install Let's Encrypt certificate:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 4. Network Security

Configure firewall and fail2ban:
```bash
# Enable firewall
sudo ufw enable

# Configure fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 🔧 Service Management

### Starting Services
```bash
# Start all services
sudo systemctl start sportsbar-controller
sudo systemctl start sportsbar-backend  # if applicable
sudo systemctl start nginx
sudo systemctl start redis-server

# Enable auto-start on boot
sudo systemctl enable sportsbar-controller
sudo systemctl enable nginx
sudo systemctl enable redis-server
```

### Checking Status
```bash
# Check service status
sudo systemctl status sportsbar-controller

# View logs
sudo journalctl -u sportsbar-controller -f

# Check application logs
tail -f /opt/sportsbar/logs/application/sportsbar.log

# Run status check script
sudo /opt/sportsbar/scripts/status.sh
```

### Restarting Services
```bash
# Restart main application
sudo systemctl restart sportsbar-controller

# Restart web server
sudo systemctl restart nginx

# Restart all services
sudo systemctl restart sportsbar-controller nginx redis-server
```

## 🔍 Troubleshooting

### Common Issues

#### Service Won't Start
```bash
# Check service status
sudo systemctl status sportsbar-controller

# Check logs for errors
sudo journalctl -u sportsbar-controller --no-pager -l

# Check configuration
sudo /opt/sportsbar/app/venv/bin/python -m py_compile /opt/sportsbar/app/main.py
```

#### Can't Access Web Interface
```bash
# Check if service is listening
sudo netstat -tlnp | grep :5000

# Check nginx configuration
sudo nginx -t

# Check firewall
sudo ufw status

# Test local access
curl http://localhost:5000
```

#### Device Connection Issues
```bash
# Test device connectivity
ping 192.168.100.101

# Test specific ports
telnet 192.168.100.101 8001

# Check device logs
tail -f /opt/sportsbar/logs/application/devices.log
```

#### Sports API Issues
```bash
# Check API keys
echo $API_SPORTS_KEY

# Test API connectivity
curl -H "X-API-Key: $API_SPORTS_KEY" "https://api-sports.io/v1/status"

# Check sports service logs
tail -f /opt/sportsbar/logs/sports/sports_api.log
```

### Log Locations
- **Application Logs**: `/opt/sportsbar/logs/application/`
- **System Logs**: `/var/log/sportsbar/`
- **Nginx Logs**: `/var/log/nginx/`
- **System Journal**: `journalctl -u sportsbar-controller`

### Performance Issues
```bash
# Check system resources
htop
df -h
free -h

# Check network connectivity
iftop
netstat -i

# Monitor application performance
sudo /opt/sportsbar/scripts/status.sh
```

## 🔄 Maintenance

### Regular Maintenance Tasks

#### Daily
- Check service status
- Monitor disk space
- Review error logs

#### Weekly
- Update system packages
- Backup configuration
- Check security logs

#### Monthly
- Update application
- Review performance metrics
- Clean old logs

### Backup Procedures

#### Automated Backup
```bash
# Run backup script
sudo /opt/sportsbar/scripts/backup.sh

# Schedule daily backups
echo "0 2 * * * /opt/sportsbar/scripts/backup.sh" | sudo crontab -
```

#### Manual Backup
```bash
# Backup configuration
sudo tar -czf sportsbar-config-$(date +%Y%m%d).tar.gz /opt/sportsbar/config

# Backup application data
sudo tar -czf sportsbar-data-$(date +%Y%m%d).tar.gz /opt/sportsbar/data

# Backup logs
sudo tar -czf sportsbar-logs-$(date +%Y%m%d).tar.gz /opt/sportsbar/logs
```

### Update Procedures

#### Application Updates
```bash
# Run update script
sudo /opt/sportsbar/scripts/update.sh

# Or manual update
cd /opt/sportsbar/app
sudo -u sportsbar git pull origin main
sudo systemctl restart sportsbar-controller
```

#### System Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade

# Reboot if kernel updated
sudo reboot
```

## 🔒 Security Considerations

### Network Security
- Use VLANs to segment device traffic
- Implement network access control (NAC)
- Regular security audits
- Monitor network traffic

### Application Security
- Change default passwords
- Use strong API keys
- Enable HTTPS with valid certificates
- Regular security updates

### Access Control
- Limit SSH access to management network
- Use key-based SSH authentication
- Implement role-based access control
- Regular access reviews

### Monitoring
- Set up log monitoring
- Implement intrusion detection
- Monitor system resources
- Alert on service failures

## 📞 Support

### Getting Help
- **Documentation**: Check this guide and README.md
- **Logs**: Always check logs first
- **GitHub Issues**: Report bugs and feature requests
- **Community**: Join discussions and share experiences

### Useful Commands
```bash
# Quick status check
sudo /opt/sportsbar/scripts/status.sh

# View recent logs
sudo journalctl -u sportsbar-controller --since "1 hour ago"

# Test configuration
sudo /opt/sportsbar/app/venv/bin/python /opt/sportsbar/app/main.py --test-config

# Restart everything
sudo systemctl restart sportsbar-controller nginx redis-server
```

---

## 📝 Installation Summary

After successful installation, you should have:

✅ **System Services Running**:
- Sports Bar TV Controller (port 5000)
- Nginx reverse proxy (port 80/443)
- Redis cache server (port 6379)

✅ **Directory Structure**:
- Application: `/opt/sportsbar/app/`
- Configuration: `/opt/sportsbar/config/`
- Logs: `/opt/sportsbar/logs/`
- Data: `/opt/sportsbar/data/`

✅ **Web Interfaces**:
- Main Dashboard: `http://your-server-ip/`
- Sports Content: `http://your-server-ip/sports`
- System Status: `http://your-server-ip/health`

✅ **Management Tools**:
- Status check: `/opt/sportsbar/scripts/status.sh`
- Backup: `/opt/sportsbar/scripts/backup.sh`
- Update: `/opt/sportsbar/scripts/update.sh`

**Next Steps**: Configure your devices, set up sports APIs, and start controlling your sports bar's AV system!
