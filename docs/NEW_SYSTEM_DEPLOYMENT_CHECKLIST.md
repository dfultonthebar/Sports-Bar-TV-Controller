# New System Deployment Checklist

Complete guide for deploying Sports Bar TV Controller to a new system.

---

## Quick Start (Single Line Install)

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

That's it! The installer handles everything automatically.

---

## Pre-Deployment Checklist

### Hardware Requirements

**Recommended System: GMKtec NucBox G5**
- [ ] **CPU**: Intel N97 (4-core, up to 3.6GHz)
- [ ] **RAM**: 12GB LPDDR5 (sufficient for app)
- [ ] **Storage**: 256GB M.2 SSD (expandable)
- [ ] **Ports**: 3x USB 3.2, Dual HDMI, MicroSD
- [ ] **Network**: Gigabit Ethernet
- [ ] **Power**: USB-C power adapter

**Alternative: Intel NUC13 or similar mini PC**
- [ ] **RAM**: 8GB minimum (16GB recommended)
- [ ] **Storage**: 256GB SSD minimum
- [ ] **USB Ports**: 2+ USB ports for CEC adapters

### Network Equipment

- [ ] **Network Switch**: Managed gigabit switch (if multiple devices)
- [ ] **Static IP Range**: Reserve IPs for all devices (192.168.x.100-199)
- [ ] **Internet**: Stable internet connection for API access

### Control Hardware (Per Bar Setup)

| Device | Quantity | Purpose | Network/Connection |
|--------|----------|---------|-------------------|
| Pulse-Eight USB CEC Adapter | 1-4 | Cable box CEC control | USB |
| Global Cache iTach IP2IR | 1-2 | IR blasting | Ethernet (192.168.x.x:4998) |
| Wolf Pack Matrix | 1 | HDMI routing | Ethernet (192.168.5.100:5000) |
| DirecTV Receivers | 1-8 | Satellite TV | Ethernet (192.168.x.121-128:8080) |
| Fire TV Cubes | 1-4 | Streaming | Ethernet/WiFi (192.168.x.131-134:5555) |
| Spectrum Cable Boxes | 1-4 | Cable TV | IR control only (no network) |

---

## Installation Steps

### Step 1: Prepare the System

```bash
# Fresh Ubuntu 22.04 LTS installation recommended
# Ensure SSH access is configured

# Login as ubuntu user
ssh ubuntu@<system-ip>

# Update system first
sudo apt update && sudo apt upgrade -y
```

### Step 2: Run One-Line Installer

```bash
# Default installation to ~/Sports-Bar-TV-Controller
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

**Alternative options:**

```bash
# Custom installation directory
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/opt/sportsbar bash

# Reinstall (removes existing installation first)
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force
```

### Step 3: Wait for Installation (15-30 minutes)

The installer will:
1. Install system packages (build tools, SQLite, ADB, CEC utils)
2. Install Node.js 20
3. Install Ollama AI with 4 models
4. Install Tailscale for remote access
5. Clone the repository
6. Install npm dependencies
7. Configure environment
8. Setup database
9. Build application
10. Start PM2 service

### Step 4: Configure Tailscale (Remote Access)

```bash
# Setup Tailscale for remote SSH access
sudo tailscale up --ssh

# Follow the URL to authenticate
# Note the Tailscale IP (100.x.x.x) for remote access
```

---

## Post-Installation Configuration

### Step 5: Verify Installation

```bash
# Check application is running
pm2 status

# Check web interface
curl -s http://localhost:3001 | head -5

# Check port is listening
ss -tuln | grep 3001
```

**Expected Output:**
```
┌─────────────────────────────────────────┐
│ App name │ status │ memory │ cpu │
├─────────────────────────────────────────┤
│ sports-bar-tv-controller │ online │ 200MB │ 0% │
└─────────────────────────────────────────┘
```

### Step 6: Configure Matrix Switcher

1. Open web interface: `http://<system-ip>:3001`
2. Navigate to **Device Config** → **Matrix**
3. Add Wolf Pack matrix:
   - IP: `192.168.5.100`
   - Port: `5000`
   - Size: Select matrix size (8x8, 16x16, etc.)

### Step 7: Configure Input Devices

#### DirecTV Receivers
1. Navigate to **Device Config** → **DirecTV**
2. For each receiver:
   - Name: `Direct TV 1`, `Direct TV 2`, etc.
   - IP Address: `192.168.5.121`, `192.168.5.122`, etc.
   - Port: `8080`
   - Matrix Input: `5`, `6`, etc.

#### Fire TV Cubes
1. Navigate to **Device Config** → **Fire TV**
2. For each device:
   - Name: `Amazon 1`, `Amazon 2`, etc.
   - IP Address: `192.168.5.131`, `192.168.5.132`, etc.
   - Port: `5555`
   - Matrix Input: `13`, `14`, etc.

#### Cable Boxes (IR Control)
1. Navigate to **Device Config** → **IR Devices**
2. Add Global Cache device first:
   - IP: `192.168.5.140`
   - Port: `4998`
3. Add each cable box:
   - Name: `Cable Box 1`, etc.
   - Device Type: `Cable Box`
   - Matrix Input: `1`, `2`, etc.
   - Global Cache: Select the device
4. **Learn IR Codes**:
   - Select cable box → Click "Learn IR"
   - Learn all digit buttons (0-9) + navigation

### Step 8: Configure Matrix Outputs (TVs)

1. Navigate to **Matrix Control**
2. Configure each output:
   - Output 1: `TV 1 - Main Bar`
   - Output 2: `TV 2 - Pool Area`
   - etc.

### Step 9: Upload Floor Plan Layout

1. Navigate to **Layout Editor**
2. Upload floor plan image (PNG/JPG)
3. Click on TVs to assign output numbers
4. Save layout

### Step 10: Create Channel Presets

1. Navigate to **Sports Guide Config**
2. Add favorite sports channels:
   - ESPN (Ch 27/206)
   - Fox Sports 1 (Ch 75/219)
   - NFL Network (Ch 212)
   - etc.

---

## Hardware Connection Guide

### Pulse-Eight CEC Adapter Setup

```bash
# Verify CEC adapter is detected
cec-client -l

# Expected output:
# libCEC version: 6.0.2
# Found devices: 1
# device:              1
# com port:            /dev/ttyACM0
# vendor id:           2548
```

**Connection:**
1. Connect Pulse-Eight USB to NUC
2. Connect HDMI output to cable box HDMI
3. Adapter acts as HDMI pass-through

### Global Cache iTach Setup

```bash
# Verify iTach is reachable
nc -zv 192.168.5.140 4998

# Expected: Connection to 192.168.5.140 4998 port [tcp/*] succeeded!
```

**Connection:**
1. Connect iTach to network switch
2. Configure static IP via iTach web interface
3. Connect IR emitter cables to cable boxes

### Fire TV ADB Setup

```bash
# Enable ADB on Fire TV:
# Settings → My Fire TV → Developer Options → ADB Debugging: ON

# Connect from NUC
adb connect 192.168.5.131:5555

# Verify connection
adb devices
```

### Wolf Pack Matrix Setup

```bash
# Verify matrix is reachable
nc -zv 192.168.5.100 5000

# Test command (get status)
echo "status" | nc 192.168.5.100 5000
```

---

## Network Configuration

### Recommended IP Scheme

| Device Type | IP Range | Example |
|-------------|----------|---------|
| NUC Controller | .100 | 192.168.5.100 |
| Wolf Pack Matrix | .100 | 192.168.5.100 |
| DirecTV Receivers | .121-.128 | 192.168.5.121 |
| Fire TV Cubes | .131-.134 | 192.168.5.131 |
| Global Cache | .140-.141 | 192.168.5.140 |
| Cable Boxes | N/A (IR) | N/A |

### Firewall Rules (if applicable)

```bash
# Allow web interface
sudo ufw allow 3001/tcp

# Allow Tailscale
sudo ufw allow 41641/udp
```

---

## Troubleshooting

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs sports-bar-tv-controller

# Check for port conflicts
ss -tuln | grep 3001

# Restart application
pm2 restart sports-bar-tv-controller
```

### Database Issues

```bash
# Check database exists
ls -la /home/ubuntu/sports-bar-data/

# Reset database (WARNING: loses all data)
rm -f /home/ubuntu/sports-bar-data/production.db*
cd ~/Sports-Bar-TV-Controller && npm run db:push
pm2 restart sports-bar-tv-controller
```

### CEC Not Working

```bash
# Check adapter detection
cec-client -l

# Check permissions (add user to dialout group)
sudo usermod -a -G dialout $USER
# Then logout/login

# Test CEC command
echo "scan" | cec-client -s -d 1
```

### Fire TV Not Connecting

```bash
# Check ADB is enabled on Fire TV device
# Settings → My Fire TV → Developer Options → ADB Debugging: ON

# Reconnect
adb disconnect 192.168.5.131
adb connect 192.168.5.131:5555

# Check connected devices
adb devices
```

### IR Commands Not Sending

```bash
# Test iTach connectivity
nc -zv 192.168.5.140 4998

# Check IR emitter placement (must be on cable box IR sensor)
# Re-learn IR codes if commands aren't working
```

---

## Maintenance Commands

### Daily Operations

```bash
# Check status
pm2 status

# View logs
pm2 logs sports-bar-tv-controller --lines 100

# Restart if needed
pm2 restart sports-bar-tv-controller
```

### Updates

```bash
# Update from GitHub
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh

# Or manual update
git pull
npm install
npm run build
pm2 restart sports-bar-tv-controller
```

### Backups

```bash
# Backup database
cp /home/ubuntu/sports-bar-data/production.db \
   /home/ubuntu/sports-bar-data/backups/production.db.$(date +%Y%m%d)

# Backup device configs
cp -r ~/Sports-Bar-TV-Controller/apps/web/data \
   ~/sports-bar-data/backups/data-$(date +%Y%m%d)
```

---

## Quick Reference

### URLs

| Function | URL |
|----------|-----|
| Main Interface | http://<ip>:3001 |
| Remote Control | http://<ip>:3001/remote |
| Matrix Control | http://<ip>:3001/matrix-control |
| Device Config | http://<ip>:3001/device-config |
| Sports Guide | http://<ip>:3001/sports-guide |
| System Admin | http://<ip>:3001/system-admin |

### PM2 Commands

```bash
pm2 status                     # Show status
pm2 logs                       # View logs
pm2 restart sports-bar-tv-controller  # Restart
pm2 stop sports-bar-tv-controller     # Stop
pm2 start sports-bar-tv-controller    # Start
```

### Useful Diagnostics

```bash
# System resources
htop

# Disk usage
df -h

# Network connections
netstat -tuln

# PM2 monit
pm2 monit
```

---

## Support

- **GitHub Issues**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
- **Documentation**: See `/docs` folder in repository
- **Logs Location**: `pm2 logs` or `/tmp/sportsbar-install-*.log`

---

## Checklist Summary

### Pre-Installation
- [ ] Ubuntu 22.04 LTS installed
- [ ] SSH access configured
- [ ] Network configured with static IPs

### Installation
- [ ] Run one-line installer
- [ ] Verify PM2 status shows "online"
- [ ] Web interface accessible at :3001

### Hardware Setup
- [ ] Wolf Pack matrix configured
- [ ] DirecTV receivers added
- [ ] Fire TV devices connected via ADB
- [ ] Cable boxes added with IR codes learned
- [ ] CEC adapters detected

### Configuration
- [ ] Matrix inputs/outputs labeled
- [ ] Channel presets created
- [ ] Floor plan uploaded
- [ ] Tailscale connected for remote access

### Testing
- [ ] Can change DirecTV channels
- [ ] Can change Cable Box channels (IR)
- [ ] Can control Fire TV
- [ ] Matrix routing works
- [ ] Remote interface works on phones

---

*Last Updated: January 2026*
