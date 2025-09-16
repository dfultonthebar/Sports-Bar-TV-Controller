# Sports Bar TV Controller - Installation Fixes

## Overview
This document outlines the critical fixes applied to ensure the Sports Bar TV Controller works out of the box after installation.

## Fixes Applied

### 1. Firewall Configuration Fix
**Problem**: Ports 5000 and 3001 were blocked by UFW firewall, preventing access to the main dashboard and AI agent service.

**Solution**: Updated installer script to automatically configure firewall rules:
- Port 5000: Main Dashboard
- Port 3001: AI Agent Service  
- Port 80/443: HTTP/HTTPS
- Port 8000/8080: Development/Alternative access

**Files Modified**:
- `scripts/install.sh` - Added UFW firewall configuration

### 2. Constructor Error Handling Fix
**Problem**: Backend service initialization could fail and crash the application during startup.

**Solution**: Added try-catch error handling in the SportsBarController constructor to gracefully handle backend service initialization failures.

**Files Modified**:
- `main.py` - Enhanced constructor with error handling for backend services

### 3. Systemd Service File Creation
**Problem**: No systemd service file was provided for proper system integration.

**Solution**: Created a comprehensive systemd service file with proper security settings.

**Files Created**:
- `scripts/sportsbar-controller.service` - Complete systemd service configuration

### 4. Enhanced Installer Script
**Problem**: Installation process was incomplete and didn't handle all system requirements.

**Solution**: Created comprehensive installer script that:
- Installs all system dependencies
- Configures Python virtual environment
- Sets up firewall rules
- Creates necessary directories and config files
- Installs and enables systemd service
- Provides clear post-installation instructions

**Files Created**:
- `scripts/install.sh` - Complete installation automation

## Installation Instructions

### Quick Install
```bash
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
chmod +x scripts/install.sh
./scripts/install.sh
```

### Manual Service Management
```bash
# Start the service
sudo systemctl start sportsbar-controller.service

# Check status
sudo systemctl status sportsbar-controller.service

# View logs
sudo journalctl -u sportsbar-controller.service -f

# Stop the service
sudo systemctl stop sportsbar-controller.service
```

### Access Points
After installation, the application will be available at:
- Main Dashboard: http://localhost:5000
- AI Agent Interface: http://localhost:3001

## Firewall Ports
The following ports are automatically configured:
- 5000/tcp - Main Dashboard (CRITICAL)
- 3001/tcp - AI Agent Service (CRITICAL)
- 80/tcp - HTTP
- 443/tcp - HTTPS
- 8000/tcp - Development
- 8080/tcp - Alternative HTTP

## Troubleshooting

### If ports are still blocked:
```bash
sudo ufw allow 5000/tcp
sudo ufw allow 3001/tcp
sudo ufw reload
```

### If service fails to start:
```bash
sudo journalctl -u sportsbar-controller.service -n 50
```

### Manual startup:
```bash
cd /opt/sportsbar-controller
source venv/bin/activate
python main.py --host 0.0.0.0 --port 5000
```

## Security Improvements
- Service runs as non-root user (ubuntu)
- Restricted file system access
- Private temporary directories
- No new privileges allowed

## Testing
After installation, verify functionality:
1. Check service status: `sudo systemctl status sportsbar-controller.service`
2. Test main dashboard: `curl http://localhost:5000`
3. Test AI agent: `curl http://localhost:3001`
4. Check firewall: `sudo ufw status`

## Future Installations
These fixes ensure that future installations will work out of the box without manual intervention for:
- Firewall configuration
- Service setup
- Directory creation
- Dependency installation
- System integration

All fixes have been tested and verified to work on Ubuntu systems.
