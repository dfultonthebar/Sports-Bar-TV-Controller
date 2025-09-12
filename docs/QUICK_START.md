# Sports Bar TV Controller - Quick Start Guide

## 🚀 Get Running in 30 Minutes

This guide will get your Sports Bar TV Controller system up and running quickly for immediate use.

## ⚡ Prerequisites (5 minutes)

### Minimum Requirements
- Ubuntu 22.04 LTS server/desktop
- 4GB RAM, 20GB free disk space
- Network connection to your TVs/devices
- Root/sudo access

### Network Setup
```bash
# Set static IP (recommended)
sudo nano /etc/netplan/00-installer-config.yaml

network:
  version: 2
  ethernets:
    enp1s0:  # Your network interface
      addresses:
        - 192.168.1.10/24  # Change to your network
      gateway4: 192.168.1.1
      nameservers:
        addresses: [8.8.8.8, 8.8.4.4]

sudo netplan apply
```

## 🔧 One-Command Installation (15 minutes)

### Automated Installation
```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/scripts/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh

# The installer will:
# ✅ Install Python 3.11, Node.js 18, and all dependencies
# ✅ Create service user and directories
# ✅ Set up systemd services
# ✅ Configure Nginx reverse proxy
# ✅ Set up Redis cache
# ✅ Configure firewall
# ✅ Start all services
```

### Manual Installation (Alternative)
```bash
# If you prefer manual control
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
sudo ./scripts/setup_root_dirs.sh
sudo ./scripts/install.sh
```

## ⚙️ Basic Configuration (10 minutes)

### 1. Configure Your Devices
```bash
# Edit the device configuration
sudo nano /opt/sportsbar/app/config/mappings.yaml
```

**Quick Example Configuration:**
```yaml
global:
  refresh_interval: 30
  timeout: 10

rooms:
  main_bar:
    name: "Main Bar"
    displays:
      - id: "tv1"
        name: "Main TV 1"
        type: "samsung"        # or "lg"
        ip: "192.168.1.101"    # Your TV's IP
        port: 8001             # Samsung: 8001, LG: 3000
      - id: "tv2"
        name: "Main TV 2"
        type: "samsung"
        ip: "192.168.1.102"
        port: 8001

presets:
  big_game:
    name: "Big Game Mode"
    actions:
      - device: "all_tvs"
        action: "set_input"
        value: "hdmi1"
```

### 2. Enable TV Network Control

**Samsung TVs:**
1. Settings → General → Network → Expert Settings
2. Turn ON "Power On with Mobile"
3. Settings → General → External Device Manager
4. Turn ON "Device Connect Manager"

**LG TVs:**
1. Settings → Connection → Mobile TV On → ON
2. Settings → Connection → LG Connect Apps → ON

### 3. Test Basic Functionality
```bash
# Check if services are running
sudo systemctl status sportsbar-controller

# Test web interface
curl http://localhost:5000

# Check device connectivity
sudo /opt/sportsbar/scripts/status.sh
```

## 🌐 Access Your System

### Web Dashboards
- **Main Control**: `http://your-server-ip/`
- **Sports Content**: `http://your-server-ip/sports`
- **System Health**: `http://your-server-ip/health`

### Default Login
- No authentication required by default
- Access from any device on your network
- Mobile-friendly responsive design

## 🎯 Quick Device Setup

### Find Your TV IP Addresses
```bash
# Scan your network for devices
nmap -sn 192.168.1.0/24

# Or check your router's DHCP client list
# Look for Samsung, LG, or other TV manufacturers
```

### Test TV Control
```bash
# Samsung TV test
curl -X POST http://192.168.1.101:8001/api/v2/ \
  -H "Content-Type: application/json" \
  -d '{"method":"ms.remote.control","params":{"Cmd":"Click","DataOfCmd":"KEY_POWER"}}'

# LG TV test  
curl -X POST http://192.168.1.101:3000/udap/api/command \
  -H "Content-Type: application/json" \
  -d '{"id":"1","type":"request","uri":"ssap://system.launcher/launch"}'
```

## 🏈 Sports Content Setup (Optional)

### Get API Keys (Free Tiers Available)
1. **API-Sports.io**: [Sign up](https://api-sports.io/) - 100 requests/day free
2. **SportsDataIO**: [Sign up](https://sportsdata.io/) - Free trial available

### Configure Sports APIs
```bash
# Add to system environment
sudo nano /etc/environment

# Add these lines:
API_SPORTS_KEY="your_api_sports_key"
SPORTSDATA_IO_KEY="your_sportsdata_io_key"

# Restart service to load new keys
sudo systemctl restart sportsbar-controller
```

### Test Sports Features
- Visit `http://your-server-ip/sports`
- Search for teams or games
- Test deep linking to streaming services

## 🔥 Common Quick Fixes

### Service Won't Start
```bash
# Check what's wrong
sudo journalctl -u sportsbar-controller --no-pager -l

# Common fixes:
sudo systemctl restart sportsbar-controller
sudo systemctl restart nginx
sudo systemctl restart redis-server
```

### Can't Access Web Interface
```bash
# Check if service is listening
sudo netstat -tlnp | grep :5000

# Check firewall
sudo ufw status

# Allow access from your network
sudo ufw allow from 192.168.1.0/24 to any port 5000
```

### TV Won't Respond
```bash
# Check network connectivity
ping 192.168.1.101

# Check if TV port is open
telnet 192.168.1.101 8001

# Verify TV network settings are enabled
```

## 📱 Mobile Access

### Responsive Design
- Works on phones, tablets, and desktops
- Touch-friendly controls
- Optimized for quick access during busy periods

### Bookmark These URLs
- Main Dashboard: `http://your-server-ip/`
- Sports Dashboard: `http://your-server-ip/sports`

## 🎮 Basic Usage

### Control Individual TVs
1. Open web dashboard
2. Select room/zone
3. Choose TV
4. Change input, volume, or power

### Use Presets
1. Click "Presets" in dashboard
2. Select preset (e.g., "Big Game Mode")
3. All configured devices will change simultaneously

### Sports Content Discovery
1. Go to Sports Dashboard
2. Browse live games or search for teams
3. Click "Launch" to open on Fire TV/streaming device

## 🔧 Essential Commands

```bash
# Check system status
sudo /opt/sportsbar/scripts/status.sh

# View logs
sudo journalctl -u sportsbar-controller -f

# Restart services
sudo systemctl restart sportsbar-controller

# Update application
sudo /opt/sportsbar/scripts/update.sh

# Backup configuration
sudo /opt/sportsbar/scripts/backup.sh
```

## 📞 Need Help?

### Check Logs First
```bash
# Application logs
tail -f /opt/sportsbar/logs/application/sportsbar.log

# System logs
sudo journalctl -u sportsbar-controller --since "1 hour ago"

# Nginx logs
tail -f /var/log/nginx/error.log
```

### Common Issues
- **Port conflicts**: Change port in config if 5000 is in use
- **Permission errors**: Check file ownership with `ls -la /opt/sportsbar/`
- **Network issues**: Verify all devices are on same network
- **TV control fails**: Double-check TV network settings

### Get Support
- Check the full [Installation Guide](INSTALLATION.md)
- Review [Hardware Requirements](HARDWARE_REQUIREMENTS.md)
- Check GitHub issues for similar problems

## 🎉 You're Ready!

Your Sports Bar TV Controller is now running and ready to manage your venue's AV system. The web interface provides intuitive control over all your displays and audio zones.

**Next Steps:**
1. Add more devices to your configuration
2. Create custom presets for different scenarios
3. Set up sports API keys for content discovery
4. Configure SSL for secure access
5. Set up automated backups

**Pro Tips:**
- Bookmark the web interface on staff devices
- Create presets for common scenarios (game day, closing time, etc.)
- Use the sports dashboard during busy periods for quick game switching
- Monitor the system health page for any issues

Enjoy your automated sports bar experience! 🍻📺🏈
