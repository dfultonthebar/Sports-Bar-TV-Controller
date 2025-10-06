# 🏈 Sports Bar AI Assistant - Complete Installation Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Requirements](#system-requirements)
3. [Prerequisites](#prerequisites)
4. [Quick Installation (Recommended)](#quick-installation-recommended)
5. [Manual Installation](#manual-installation)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Building the Application](#building-the-application)
9. [Running the Application](#running-the-application)
10. [PM2 Process Management](#pm2-process-management)
11. [Systemd Service Setup](#systemd-service-setup)
12. [Knowledge Base Initialization](#knowledge-base-initialization)
13. [Hardware Integration](#hardware-integration)
14. [Troubleshooting](#troubleshooting)
15. [Updating the Application](#updating-the-application)
16. [Backup and Restore](#backup-and-restore)

---

## Overview

The Sports Bar AI Assistant is a comprehensive AV system management platform that provides:
- AI-powered troubleshooting and assistance
- Matrix switcher control (Wolf Pack HDMI)
- HDMI-CEC TV power control (via Pulse-Eight adapter)
- IR device control (Global Cache iTach)
- Audio processor integration (AtlasIED Atmosphere)
- TV guide and sports scheduling
- Document analysis and knowledge base
- Multi-provider AI support (Claude, ChatGPT, Grok, Local AI)

This guide will walk you through deploying the application on a fresh computer from scratch.

---

## System Requirements

### Minimum Requirements
- **Operating System**: Ubuntu 20.04 LTS or newer (Ubuntu 22.04 LTS recommended)
- **CPU**: 2 cores (4 cores recommended)
- **RAM**: 4GB minimum (8GB recommended for optimal performance)
- **Storage**: 10GB free disk space (20GB recommended)
- **Network**: Stable internet connection for installation and API access

### Recommended Specifications
- **Operating System**: Ubuntu 22.04 LTS
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 20GB+ SSD
- **Network**: Gigabit Ethernet connection

### Supported Operating Systems
- Ubuntu 20.04 LTS
- Ubuntu 22.04 LTS (Recommended)
- Ubuntu 24.04 LTS
- Debian 11 (Bullseye)
- Debian 12 (Bookworm)

---

## Prerequisites

### Required Software (Installed Automatically)
The installation script will automatically install:
- **Node.js 20.x LTS** - JavaScript runtime
- **npm** - Node package manager
- **Git** - Version control
- **SQLite3** - Database engine
- **Build tools** - gcc, g++, make for native modules
- **Python 3** - For AI analysis scripts
- **libCEC** - HDMI-CEC control library (optional, for TV power control)

### User Permissions
- Root/sudo access required for installation
- Regular user account (ubuntu) for running the application

### Network Requirements
- Port 3000 must be available (default application port)
- Outbound internet access for:
  - Package downloads
  - AI API calls (Claude, OpenAI, xAI)
  - GitHub repository access
  - TV guide data APIs

---

## Quick Installation (Recommended)

### Step 1: Download and Run Installation Script

For a completely automated installation on a fresh system:

```bash
# Navigate to home directory
cd /home/ubuntu

# Download the installation script
wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh

# Make it executable
chmod +x install.sh

# Run the installation (requires sudo)
sudo bash install.sh
```

### What the Script Does

The automated installation script performs the following steps:

1. ✅ **System Check** - Verifies OS compatibility (Ubuntu/Debian)
2. ✅ **Dependencies** - Installs Node.js 20.x, npm, git, build tools, SQLite3
3. ✅ **Repository** - Clones the project from GitHub
4. ✅ **NPM Packages** - Installs all Node.js dependencies
5. ✅ **Database** - Sets up SQLite database with Prisma
6. ✅ **Environment** - Creates .env file with secure defaults
7. ✅ **Build** - Compiles the Next.js application
8. ✅ **Service** - Installs and starts systemd service
9. ✅ **Verification** - Checks that the service is running

**Installation Time**: Approximately 5-10 minutes depending on internet speed.

### Step 2: Access the Application

After installation completes, access the application at:

```
http://localhost:3000          # Local access
http://[your-server-ip]:3000   # Network access
```

The installation script will display your server's IP address.

### Step 3: Configure API Keys

Edit the environment file to add your API keys:

```bash
nano /home/ubuntu/Sports-Bar-TV-Controller/.env
```

Add your API keys (see [Environment Configuration](#environment-configuration) section).

Then restart the service:

```bash
sudo systemctl restart sportsbar-assistant
```

---

## Manual Installation

If you prefer manual control or the automated script fails, follow these steps:

### Step 1: Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Step 2: Install System Dependencies

```bash
# Install basic tools
sudo apt-get install -y curl wget git build-essential

# Install Python 3 and pip
sudo apt-get install -y python3 python3-pip

# Install SQLite3
sudo apt-get install -y sqlite3 libsqlite3-dev

# Install additional build dependencies
sudo apt-get install -y ca-certificates gnupg lsb-release
```

### Step 3: Install Node.js 20.x LTS

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node -v    # Should show v20.x.x
npm -v     # Should show 10.x.x or higher
```

### Step 4: Clone the Repository

```bash
# Navigate to home directory
cd /home/ubuntu

# Clone the repository
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git

# Navigate to project directory
cd Sports-Bar-TV-Controller

# Verify you're on the main branch
git branch
```

### Step 5: Install Node.js Dependencies

```bash
# Install all npm packages (this may take 5-10 minutes)
npm install

# Verify installation
npm list --depth=0
```

### Step 6: Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Create database directory
mkdir -p prisma/data

# Run database migrations
npx prisma migrate deploy

# If migrations fail, push schema directly
npx prisma db push --accept-data-loss
```

### Step 7: Create Environment File

```bash
# Copy example environment file
cp .env.example .env

# Generate secure NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Edit .env file
nano .env
```

Update the following in `.env`:
- Replace `your-nextauth-secret-here` with the generated secret
- Update `NEXTAUTH_URL` with your server's IP address
- Add your API keys (see [Environment Configuration](#environment-configuration))

### Step 8: Build the Application

```bash
# Build Next.js application for production
npm run build

# This creates an optimized production build in .next directory
```

### Step 9: Test the Application

```bash
# Start the application in production mode
npm start

# The application should start on port 3000
# Press Ctrl+C to stop
```

### Step 10: Set Up Process Management

Choose either PM2 or systemd (systemd recommended for production):

**Option A: PM2 (Process Manager)**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

**Option B: Systemd Service (Recommended)**
```bash
# Copy service file
sudo cp sportsbar-assistant.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable sportsbar-assistant

# Start the service
sudo systemctl start sportsbar-assistant

# Check status
sudo systemctl status sportsbar-assistant
```

---

## Environment Configuration

The application uses environment variables for configuration. All settings are stored in the `.env` file.

### Required Environment Variables

```bash
# Database Configuration
DATABASE_URL="file:./prisma/data/sports_bar.db"

# Authentication (REQUIRED)
NEXTAUTH_SECRET="your-secure-random-string-here"
NEXTAUTH_URL="http://192.168.1.25:3000"

# System Configuration
NODE_ENV="production"
PORT="3000"
```

### AI Provider API Keys (Optional but Recommended)

```bash
# Anthropic Claude
ANTHROPIC_API_KEY="sk-ant-api03-..."

# OpenAI ChatGPT
OPENAI_API_KEY="sk-..."

# xAI Grok
XAI_API_KEY="xai-..."
```

### Local AI Configuration (Optional)

```bash
# Enable local AI (LM Studio, Ollama, etc.)
LOCAL_AI_ENABLED="true"
LOCAL_AI_HOST="http://localhost:1234"

# Ollama specific settings
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama2"
```

### GitHub Integration (Optional)

```bash
GITHUB_REPO_OWNER="dfultonthebar"
GITHUB_REPO_NAME="Sports-Bar-TV-Controller"
GITHUB_TOKEN="ghp_..."
GITHUB_BRANCH="main"
```

### Music Service Integration (Optional)

```bash
# Soundtrack Your Brand
SOUNDTRACK_API_TOKEN="your-soundtrack-api-token"
```

### TV Guide Data Sources (Optional)

```bash
# Spectrum Business API
SPECTRUM_BUSINESS_API_KEY="your-spectrum-api-key"
SPECTRUM_BUSINESS_ACCOUNT_ID="your-account-id"
SPECTRUM_BUSINESS_BASE_URL="https://api.spectrum.com"
SPECTRUM_BUSINESS_REGION="your-region"

# Gracenote API
GRACENOTE_API_KEY="your-gracenote-api-key"
GRACENOTE_PARTNER_ID="your-partner-id"
GRACENOTE_USER_ID="your-user-id"
GRACENOTE_BASE_URL="https://data.tmsapi.com"
```

### Sports Data APIs (Optional)

```bash
ESPN_API_KEY="optional-espn-api-key"
SPORTS_RADAR_API_KEY="optional-sportsradar-api-key"
```

### NFHS Network (Optional)

```bash
# Only needed for live NFHS data syncing
# By default, uses mock data for demonstration
NFHS_USERNAME="your-nfhs-username"
NFHS_PASSWORD="your-nfhs-password"
NFHS_LOCATION="Green Bay, Wisconsin"
```

### Security Configuration (Optional)

```bash
# Encryption key for sensitive data
ENCRYPTION_KEY="your-32-character-encryption-key"
```

### Generating Secure Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

### Getting Your Server IP Address

```bash
# Get local IP address
hostname -I | awk '{print $1}'

# Or use ip command
ip addr show | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | cut -d/ -f1
```

---

## Database Setup

The application uses SQLite as its database, managed by Prisma ORM.

### Database Location

```
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

### Database Schema

The database includes tables for:
- **Users** - Authentication and user management
- **Equipment** - AV equipment inventory
- **Documents** - Uploaded manuals and documentation
- **ApiKey** - Encrypted API key storage
- **ChatSession** - AI chat history
- **MatrixConfiguration** - Matrix switcher settings
- **MatrixInput/Output** - Input/output channel configuration
- **MatrixRoute** - Current routing state
- **MatrixScene** - Saved routing presets
- **AudioProcessor** - AtlasIED Atmosphere configuration
- **AudioZone** - Audio zone settings
- **IRDevice** - Global Cache iTach devices
- **ChannelPreset** - Saved channel configurations
- **UsageTracking** - System usage analytics
- **TestLog** - System test results
- **IndexedFile** - Knowledge base file index

### Prisma Commands

```bash
# Generate Prisma client (after schema changes)
npx prisma generate

# View database in Prisma Studio
npx prisma studio

# Run migrations
npx prisma migrate deploy

# Push schema changes (development)
npx prisma db push

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Create a new migration
npx prisma migrate dev --name migration_name
```

### Database Backup

```bash
# Create backup
cp /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
   /home/ubuntu/sports_bar_backup_$(date +%Y%m%d_%H%M%S).db

# Restore from backup
cp /home/ubuntu/sports_bar_backup_YYYYMMDD_HHMMSS.db \
   /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

### Database Maintenance

```bash
# Optimize database (reduce file size)
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "VACUUM;"

# Check database integrity
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "PRAGMA integrity_check;"

# View database size
ls -lh /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

---

## Building the Application

### Production Build

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Build the application
npm run build

# This creates an optimized production build
# Output is stored in .next directory
```

### Build Output

The build process:
1. Compiles TypeScript to JavaScript
2. Optimizes React components
3. Generates static pages where possible
4. Creates optimized bundles
5. Processes CSS with Tailwind

### Build Verification

```bash
# Check build output
ls -la .next/

# View build info
cat .next/build-manifest.json

# Check for errors
npm run build 2>&1 | grep -i error
```

### Rebuilding After Changes

```bash
# After code changes
npm run build

# After dependency changes
npm install
npm run build

# After database schema changes
npx prisma generate
npm run build
```

---

## Running the Application

### Development Mode

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Start development server (with hot reload)
npm run dev

# Access at http://localhost:3000
```

Development mode features:
- Hot module replacement (instant updates)
- Detailed error messages
- Source maps for debugging
- Not optimized for performance

### Production Mode

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Start production server
npm start

# Access at http://localhost:3000
```

Production mode features:
- Optimized performance
- Minified code
- Production error handling
- Better security

### Running in Background

```bash
# Using nohup
nohup npm start > server.log 2>&1 &

# View logs
tail -f server.log

# Stop the process
pkill -f "npm.*start"
```

### Checking if Application is Running

```bash
# Check if port 3000 is in use
sudo lsof -i :3000

# Check Node.js processes
ps aux | grep node

# Test HTTP response
curl http://localhost:3000
```

---

## PM2 Process Management

PM2 is a production process manager for Node.js applications.

### Installing PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 -v
```

### PM2 Configuration

The project includes `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'sports-bar-tv-controller',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### PM2 Commands

```bash
# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop sports-bar-tv-controller

# Restart application
pm2 restart sports-bar-tv-controller

# Delete from PM2
pm2 delete sports-bar-tv-controller

# View status
pm2 status

# View logs
pm2 logs sports-bar-tv-controller

# View real-time logs
pm2 logs sports-bar-tv-controller --lines 100

# Monitor resources
pm2 monit
```

### PM2 Startup Script

```bash
# Generate startup script
pm2 startup

# This will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Run the command it outputs

# Save current PM2 process list
pm2 save

# Now PM2 will start on boot
```

### PM2 Management

```bash
# List all processes
pm2 list

# Show detailed info
pm2 show sports-bar-tv-controller

# Flush logs
pm2 flush

# Reload (zero-downtime restart)
pm2 reload sports-bar-tv-controller

# Update PM2
npm install -g pm2@latest
pm2 update
```

---

## Systemd Service Setup

Systemd is the recommended way to run the application in production.

### Service File

The project includes `sportsbar-assistant.service`:

```ini
[Unit]
Description=Sports Bar TV Controller Assistant
Documentation=https://github.com/dfultonthebar/Sports-Bar-TV-Controller
After=network.target

[Service]
Type=simple
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/Sports-Bar-TV-Controller
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sportsbar-assistant

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/ubuntu/Sports-Bar-TV-Controller

[Install]
WantedBy=multi-user.target
```

### Installing the Service

```bash
# Copy service file
sudo cp /home/ubuntu/Sports-Bar-TV-Controller/sportsbar-assistant.service \
        /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service (start on boot)
sudo systemctl enable sportsbar-assistant

# Start service
sudo systemctl start sportsbar-assistant
```

### Systemd Commands

```bash
# Start service
sudo systemctl start sportsbar-assistant

# Stop service
sudo systemctl stop sportsbar-assistant

# Restart service
sudo systemctl restart sportsbar-assistant

# Check status
sudo systemctl status sportsbar-assistant

# Enable auto-start on boot
sudo systemctl enable sportsbar-assistant

# Disable auto-start
sudo systemctl disable sportsbar-assistant

# View service configuration
systemctl cat sportsbar-assistant
```

### Viewing Logs

```bash
# Real-time logs (follow mode)
sudo journalctl -u sportsbar-assistant -f

# Last 100 lines
sudo journalctl -u sportsbar-assistant -n 100

# Logs since boot
sudo journalctl -u sportsbar-assistant -b

# Logs for today
sudo journalctl -u sportsbar-assistant --since today

# Logs for specific time range
sudo journalctl -u sportsbar-assistant --since "2025-01-01" --until "2025-01-02"

# Logs with priority (errors only)
sudo journalctl -u sportsbar-assistant -p err

# Export logs to file
sudo journalctl -u sportsbar-assistant > service-logs.txt
```

### Service Troubleshooting

```bash
# Check if service is active
systemctl is-active sportsbar-assistant

# Check if service is enabled
systemctl is-enabled sportsbar-assistant

# View service dependencies
systemctl list-dependencies sportsbar-assistant

# Reload service file after changes
sudo systemctl daemon-reload
sudo systemctl restart sportsbar-assistant
```

---

## Knowledge Base Initialization

The AI assistant uses a knowledge base built from uploaded documents.

### Building the Knowledge Base

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Run knowledge base build script
npm run build-knowledge-base

# Or use the shell script
./build-knowledge-base.sh
```

### What Gets Indexed

The knowledge base indexes:
- Uploaded PDF manuals
- Equipment documentation
- Configuration files
- System logs
- Previous chat conversations

### Knowledge Base Location

```
/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

Knowledge is stored in the `IndexedFile` and `Document` tables.

### Uploading Documents

1. Access the application web interface
2. Navigate to the AI Chat page
3. Click "Upload Document"
4. Select PDF files (equipment manuals, guides, etc.)
5. Wait for processing to complete

### Verifying Knowledge Base

```bash
# Check indexed files
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  "SELECT COUNT(*) FROM IndexedFile;"

# View indexed documents
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
  "SELECT filename, uploadedAt FROM Document ORDER BY uploadedAt DESC LIMIT 10;"
```

### Rebuilding Knowledge Base

```bash
# If knowledge base becomes corrupted
cd /home/ubuntu/Sports-Bar-TV-Controller

# Clear existing index
sqlite3 prisma/data/sports_bar.db "DELETE FROM IndexedFile;"

# Rebuild from documents
npm run build-knowledge-base
```

---

## Hardware Integration

### Matrix Switcher (Wolf Pack HDMI)

**Configuration Steps:**

1. Connect matrix switcher to network
2. Note the IP address (e.g., 192.168.1.100)
3. Access application → Settings → Matrix Configuration
4. Add matrix configuration:
   - Name: "Main Bar Matrix"
   - IP Address: 192.168.1.100
   - TCP Port: 5000 (default)
   - UDP Port: 4000 (default)
5. Configure inputs and outputs
6. Test connection

**Supported Commands:**
- Input/output routing
- Scene recall
- Status queries
- Preset management

### HDMI-CEC TV Control (Pulse-Eight)

**Hardware Requirements:**
- Pulse-Eight USB CEC Adapter
- HDMI connection to matrix switcher
- CEC-enabled TVs

**Installation:**

```bash
# Install libCEC drivers
sudo apt-get install -y cec-utils libcec4 libcec-dev

# Verify adapter is detected
lsusb | grep -i pulse

# Test CEC communication
cec-client -l

# Scan for CEC devices
echo "scan" | cec-client -s -d 1
```

**Configuration:**

1. Plug in Pulse-Eight adapter
2. Connect HDMI to matrix input
3. Access application → Settings → Matrix Configuration
4. Set "CEC Input Channel" to the input with adapter
5. Go to TV Management to control TVs

**CEC Commands:**
- Power on/off individual TVs
- Broadcast power to all TVs
- TV discovery and identification
- Input switching

### IR Control (Global Cache iTach)

**Supported Devices:**
- DirecTV receivers
- Cable boxes
- Fire TV devices
- Other IR-controlled equipment

**Configuration:**

1. Connect iTach to network
2. Note IP address
3. Access application → Settings → IR Devices
4. Add device:
   - Name: "Cable Box 1"
   - Type: "DirecTV" / "Cable" / "FireTV"
   - IP Address: 192.168.1.101
   - Port: 4998 (default)
5. Test IR commands

### Audio Processor (AtlasIED Atmosphere)

**Supported Models:**
- AZM4 (4-zone mixer)
- AZM8 (8-zone mixer)
- AZMP4 (4-zone with paging)
- AZMP8 (8-zone with paging)

**Configuration:**

1. Connect Atmosphere to network
2. Note IP address
3. Access application → Settings → Audio Configuration
4. Add processor:
   - Name: "Main Bar Audio"
   - Model: "AZM8"
   - IP Address: 192.168.1.102
   - Port: 80 (default)
5. Configure zones
6. Map zones to matrix outputs

**Audio Features:**
- Volume control per zone
- Source selection
- Mute/unmute
- Preset recall
- Paging (AZMP models)

---

## Troubleshooting

### Application Won't Start

**Check Service Status:**
```bash
sudo systemctl status sportsbar-assistant
```

**Check Logs:**
```bash
sudo journalctl -u sportsbar-assistant -n 50
```

**Common Issues:**

1. **Port 3000 Already in Use**
   ```bash
   # Find what's using port 3000
   sudo lsof -i :3000
   
   # Kill the process
   sudo kill -9 <PID>
   
   # Or change port in .env
   PORT=8080
   ```

2. **Database Errors**
   ```bash
   # Reset database
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npx prisma migrate reset
   
   # Or recreate
   rm -f prisma/data/sports_bar.db
   npx prisma migrate deploy
   ```

3. **Permission Issues**
   ```bash
   # Fix ownership
   sudo chown -R ubuntu:ubuntu /home/ubuntu/Sports-Bar-TV-Controller
   
   # Fix .env permissions
   chmod 600 /home/ubuntu/Sports-Bar-TV-Controller/.env
   ```

4. **Missing Dependencies**
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   npm install
   npm run build
   sudo systemctl restart sportsbar-assistant
   ```

### Cannot Access Application

**Check Firewall:**
```bash
# Allow port 3000
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status
```

**Check Network Binding:**
```bash
# Verify application is listening
sudo netstat -tlnp | grep 3000

# Or use ss command
sudo ss -tlnp | grep 3000
```

**Test Locally:**
```bash
curl http://localhost:3000
```

### CEC Control Not Working

**Check USB Connection:**
```bash
lsusb | grep -i pulse
```

**Check CEC Client:**
```bash
cec-client -l
```

**Test Manually:**
```bash
# Scan for devices
echo "scan" | cec-client -s -d 1

# Power on TV
echo "on 0" | cec-client -s -d 1

# Power off TV
echo "standby 0" | cec-client -s -d 1
```

**Check Permissions:**
```bash
# Add user to dialout group
sudo usermod -a -G dialout ubuntu

# Log out and back in for changes to take effect
```

### Database Issues

**Check Database File:**
```bash
ls -la /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

**Test Database Connection:**
```bash
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "SELECT COUNT(*) FROM User;"
```

**Repair Database:**
```bash
# Check integrity
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "PRAGMA integrity_check;"

# Vacuum (optimize)
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "VACUUM;"
```

### Performance Issues

**Check System Resources:**
```bash
# CPU and memory
top

# Disk space
df -h

# Disk I/O
iostat -x 1

# Network
iftop
```

**Check Application Resources:**
```bash
# If using PM2
pm2 monit

# If using systemd
systemctl status sportsbar-assistant
```

**Optimize Database:**
```bash
sqlite3 /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db "VACUUM;"
```

### AI Features Not Working

**Check API Keys:**
```bash
# Verify .env file has API keys
grep -E "(ANTHROPIC|OPENAI|XAI)_API_KEY" /home/ubuntu/Sports-Bar-TV-Controller/.env
```

**Test API Connectivity:**
```bash
# Test Anthropic API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-sonnet-20240229","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
```

**Check Logs for API Errors:**
```bash
sudo journalctl -u sportsbar-assistant | grep -i "api\|error"
```

---

## Updating the Application

### Using Update Script (Recommended)

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Run update script
./update_from_github.sh
```

The update script automatically:
1. Creates backup of current installation
2. Stops running processes
3. Pulls latest changes from GitHub
4. Installs new dependencies
5. Runs database migrations
6. Rebuilds application
7. Restarts services

### Manual Update Process

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Stop service
sudo systemctl stop sportsbar-assistant

# Backup database
cp prisma/data/sports_bar.db prisma/data/sports_bar.db.backup

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Rebuild application
npm run build

# Start service
sudo systemctl start sportsbar-assistant

# Check status
sudo systemctl status sportsbar-assistant
```

### Checking for Updates

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Fetch latest from GitHub
git fetch origin

# Check if updates available
git status

# View changes
git log HEAD..origin/main --oneline
```

### Rolling Back Updates

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Stop service
sudo systemctl stop sportsbar-assistant

# View commit history
git log --oneline

# Rollback to specific commit
git reset --hard <commit-hash>

# Restore database backup
cp prisma/data/sports_bar.db.backup prisma/data/sports_bar.db

# Rebuild
npm install
npm run build

# Start service
sudo systemctl start sportsbar-assistant
```

---

## Backup and Restore

### Creating Backups

**Full Backup Script:**
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_DIR="/home/ubuntu/Sports-Bar-TV-Controller"

mkdir -p $BACKUP_DIR

# Backup database
cp $PROJECT_DIR/prisma/data/sports_bar.db \
   $BACKUP_DIR/sports_bar_${TIMESTAMP}.db

# Backup .env file
cp $PROJECT_DIR/.env \
   $BACKUP_DIR/env_${TIMESTAMP}.backup

# Backup configuration files
tar -czf $BACKUP_DIR/config_${TIMESTAMP}.tar.gz \
   -C $PROJECT_DIR \
   config/ data/

echo "Backup created: $BACKUP_DIR/*_${TIMESTAMP}*"
```

**Automated Backups with Cron:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /home/ubuntu/backup-script.sh

# Add weekly backup on Sunday at 3 AM
0 3 * * 0 /home/ubuntu/backup-script.sh
```

### Restoring from Backup

**Restore Database:**
```bash
# Stop service
sudo systemctl stop sportsbar-assistant

# Restore database
cp /home/ubuntu/backups/sports_bar_YYYYMMDD_HHMMSS.db \
   /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db

# Start service
sudo systemctl start sportsbar-assistant
```

**Restore Configuration:**
```bash
# Stop service
sudo systemctl stop sportsbar-assistant

# Restore .env
cp /home/ubuntu/backups/env_YYYYMMDD_HHMMSS.backup \
   /home/ubuntu/Sports-Bar-TV-Controller/.env

# Restore config files
tar -xzf /home/ubuntu/backups/config_YYYYMMDD_HHMMSS.tar.gz \
   -C /home/ubuntu/Sports-Bar-TV-Controller/

# Start service
sudo systemctl start sportsbar-assistant
```

### Backup Best Practices

1. **Regular Backups**: Schedule daily automated backups
2. **Multiple Locations**: Store backups on different drives/servers
3. **Test Restores**: Periodically test backup restoration
4. **Version Control**: Keep multiple backup versions
5. **Document Changes**: Note what changed between backups

---

## Additional Resources

### Documentation Files

- `README.md` - Project overview and quick start
- `docs/INSTALLATION_GUIDE.md` - Detailed installation guide
- `docs/README_INSTALLATION.md` - Service management guide
- `docs/CEC_TV_DISCOVERY_GUIDE.md` - HDMI-CEC setup
- `docs/AI_BACKEND_SETUP.md` - AI configuration
- `docs/BACKUP_RESTORE_GUIDE.md` - Backup procedures

### Useful Commands Reference

```bash
# Service Management
sudo systemctl start sportsbar-assistant
sudo systemctl stop sportsbar-assistant
sudo systemctl restart sportsbar-assistant
sudo systemctl status sportsbar-assistant

# Logs
sudo journalctl -u sportsbar-assistant -f
sudo journalctl -u sportsbar-assistant -n 100

# Database
npx prisma studio
npx prisma migrate deploy
sqlite3 prisma/data/sports_bar.db

# Application
npm run dev          # Development mode
npm run build        # Build for production
npm start            # Start production server

# PM2
pm2 start ecosystem.config.js
pm2 stop sports-bar-tv-controller
pm2 restart sports-bar-tv-controller
pm2 logs sports-bar-tv-controller
```

### Getting Help

1. **Check Logs**: Always start with application logs
2. **GitHub Issues**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
3. **Documentation**: Review docs/ directory
4. **System Logs**: Check systemd journal for errors

### Support Information

- **Repository**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller
- **Issue Tracker**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs

---

## Summary Checklist

Use this checklist to verify your installation:

- [ ] System requirements met (Ubuntu 20.04+, 4GB RAM, 10GB storage)
- [ ] Node.js 20.x installed
- [ ] Repository cloned to /home/ubuntu/Sports-Bar-TV-Controller
- [ ] NPM dependencies installed
- [ ] Database created and migrated
- [ ] .env file configured with required variables
- [ ] API keys added (at least one AI provider)
- [ ] Application built successfully
- [ ] Service running (systemd or PM2)
- [ ] Application accessible at http://localhost:3000
- [ ] Firewall configured (port 3000 open)
- [ ] Knowledge base initialized
- [ ] Hardware devices configured (if applicable)
- [ ] Backups configured
- [ ] Documentation reviewed

---

## Quick Reference Card

**Installation:**
```bash
cd /home/ubuntu
wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh
chmod +x install.sh
sudo bash install.sh
```

**Access:**
```
http://localhost:3000
http://[your-ip]:3000
```

**Service Control:**
```bash
sudo systemctl start sportsbar-assistant
sudo systemctl stop sportsbar-assistant
sudo systemctl restart sportsbar-assistant
sudo systemctl status sportsbar-assistant
```

**Logs:**
```bash
sudo journalctl -u sportsbar-assistant -f
```

**Update:**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
```

**Backup:**
```bash
cp prisma/data/sports_bar.db ~/sports_bar_backup_$(date +%Y%m%d).db
```

---

**Installation Complete!** 🎉

You now have a fully functional Sports Bar AI Assistant installation. Access the application and start configuring your AV system!
