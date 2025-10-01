
# Sports Bar TV Controller - Installation Guide

This guide provides comprehensive instructions for installing and managing the Sports Bar TV Controller application on Ubuntu/Debian systems.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Installation](#quick-installation)
- [Manual Installation](#manual-installation)
- [Service Management](#service-management)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04 LTS or newer (or Debian 11+)
- **RAM**: Minimum 2GB (4GB recommended)
- **Disk Space**: At least 2GB free space
- **Network**: Internet connection for installation
- **User**: Root/sudo access required for installation

### Required Software (Installed Automatically)

The installation script will automatically install:
- Node.js 20.x LTS
- npm (Node Package Manager)
- Git
- SQLite3
- Build tools (gcc, g++, make)
- Python 3

---

## Quick Installation

### One-Click Installation

For a fresh Ubuntu/Debian system, use the automated installation script:

```bash
# Download the installation script
wget https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh

# Make it executable
chmod +x install.sh

# Run the installation (requires sudo)
sudo bash install.sh
```

The script will:
1. ✓ Check system compatibility
2. ✓ Install all required dependencies
3. ✓ Clone the repository
4. ✓ Install npm packages
5. ✓ Set up the database
6. ✓ Create environment configuration
7. ✓ Build the application
8. ✓ Install and start the systemd service

**Installation time**: Approximately 5-10 minutes depending on your internet connection.

---

## Manual Installation

If you prefer to install manually or need more control over the process:

### Step 1: Install System Dependencies

```bash
sudo apt-get update
sudo apt-get install -y curl wget git build-essential python3 python3-pip sqlite3 libsqlite3-dev
```

### Step 2: Install Node.js

```bash
# Add NodeSource repository for Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -

# Install Node.js
sudo apt-get install -y nodejs

# Verify installation
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x or higher
```

### Step 3: Clone the Repository

```bash
# Clone to /home/ubuntu directory
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
```

### Step 4: Install NPM Packages

```bash
npm install
```

### Step 5: Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy
```

### Step 6: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Generate a secure NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Edit .env file with your configuration
nano .env
```

**Required environment variables:**
- `DATABASE_URL`: Path to SQLite database (default: `file:./prisma/data/sports_bar.db`)
- `NEXTAUTH_SECRET`: Secure random string for authentication
- `NEXTAUTH_URL`: Your application URL (e.g., `http://192.168.1.25:3000`)

**Optional API keys** (add as needed):
- `ANTHROPIC_API_KEY`: For Claude AI features
- `OPENAI_API_KEY`: For OpenAI/ChatGPT features
- `XAI_API_KEY`: For xAI features
- `SOUNDTRACK_API_KEY`: For Soundtrack Your Brand integration
- `GITHUB_TOKEN`: For GitHub integration features

### Step 7: Build the Application

```bash
npm run build
```

### Step 8: Install Systemd Service

```bash
# Copy service file
sudo cp sportsbar-assistant.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable sportsbar-assistant

# Start the service
sudo systemctl start sportsbar-assistant
```

---

## Service Management

### Systemd Commands

The application runs as a systemd service named `sportsbar-assistant`.

#### Start the Service
```bash
sudo systemctl start sportsbar-assistant
```

#### Stop the Service
```bash
sudo systemctl stop sportsbar-assistant
```

#### Restart the Service
```bash
sudo systemctl restart sportsbar-assistant
```

#### Check Service Status
```bash
sudo systemctl status sportsbar-assistant
```

#### Enable Auto-Start on Boot
```bash
sudo systemctl enable sportsbar-assistant
```

#### Disable Auto-Start on Boot
```bash
sudo systemctl disable sportsbar-assistant
```

### Viewing Logs

#### Real-time Logs (Follow Mode)
```bash
sudo journalctl -u sportsbar-assistant -f
```

#### Recent Logs (Last 100 Lines)
```bash
sudo journalctl -u sportsbar-assistant -n 100
```

#### Logs Since Boot
```bash
sudo journalctl -u sportsbar-assistant -b
```

#### Logs for Specific Time Range
```bash
# Today's logs
sudo journalctl -u sportsbar-assistant --since today

# Last hour
sudo journalctl -u sportsbar-assistant --since "1 hour ago"

# Specific date range
sudo journalctl -u sportsbar-assistant --since "2025-01-01" --until "2025-01-02"
```

---

## Configuration

### Environment Variables

The application is configured via the `.env` file located at `/home/ubuntu/Sports-Bar-TV-Controller/.env`.

#### Core Configuration

```bash
# Database
DATABASE_URL="file:./prisma/data/sports_bar.db"

# Authentication
NEXTAUTH_SECRET="your-secure-random-string"
NEXTAUTH_URL="http://your-server-ip:3000"

# System
NODE_ENV="production"
PORT="3000"
```

#### AI Services Configuration

```bash
# AI API Keys (optional)
ANTHROPIC_API_KEY="your-anthropic-api-key"
OPENAI_API_KEY="your-openai-api-key"
XAI_API_KEY="your-xai-api-key"

# Local AI (optional)
LOCAL_AI_ENABLED="true"
LOCAL_AI_HOST="http://localhost:1234"
```

#### External Services (Optional)

```bash
# GitHub Integration
GITHUB_REPO_OWNER="dfultonthebar"
GITHUB_REPO_NAME="Sports-Bar-TV-Controller"
GITHUB_TOKEN="your-github-token"
GITHUB_BRANCH="main"

# Music Service
SOUNDTRACK_API_KEY="your-soundtrack-api-token"

# TV Guide Data
SPECTRUM_API_KEY="your-spectrum-api-key"
GRACENOTE_API_KEY="your-gracenote-api-key"

# Sports Data
ESPN_API_KEY="optional-espn-api-key"
SPORTS_RADAR_API_KEY="optional-sportsradar-api-key"
```

### Applying Configuration Changes

After modifying the `.env` file:

```bash
# Restart the service to apply changes
sudo systemctl restart sportsbar-assistant

# Verify the service started successfully
sudo systemctl status sportsbar-assistant
```

### Changing the Port

To run the application on a different port:

1. Edit `.env` file:
   ```bash
   PORT="8080"  # Change to your desired port
   ```

2. Update `NEXTAUTH_URL` to match:
   ```bash
   NEXTAUTH_URL="http://your-server-ip:8080"
   ```

3. Restart the service:
   ```bash
   sudo systemctl restart sportsbar-assistant
   ```

---

## Troubleshooting

### Service Won't Start

#### Check Service Status
```bash
sudo systemctl status sportsbar-assistant
```

#### View Error Logs
```bash
sudo journalctl -u sportsbar-assistant -n 50 --no-pager
```

#### Common Issues

**1. Port Already in Use**
```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill the process or change the port in .env
```

**2. Database Errors**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Reset database
npx prisma migrate reset

# Or recreate database
rm -f prisma/data/sports_bar.db
npx prisma migrate deploy
```

**3. Permission Issues**
```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu /home/ubuntu/Sports-Bar-TV-Controller

# Fix permissions
chmod 600 /home/ubuntu/Sports-Bar-TV-Controller/.env
```

**4. Missing Dependencies**
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npm install
npm run build
sudo systemctl restart sportsbar-assistant
```

### Application Not Accessible

#### Check if Service is Running
```bash
sudo systemctl status sportsbar-assistant
```

#### Check Firewall
```bash
# Allow port 3000 through firewall
sudo ufw allow 3000/tcp

# Check firewall status
sudo ufw status
```

#### Check Network Binding
```bash
# Verify the application is listening
sudo netstat -tlnp | grep 3000
```

### Database Issues

#### Reset Database
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
npx prisma migrate reset
sudo systemctl restart sportsbar-assistant
```

#### Backup Database
```bash
# Create backup
cp /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db \
   /home/ubuntu/sports_bar_backup_$(date +%Y%m%d_%H%M%S).db
```

#### Restore Database
```bash
# Restore from backup
cp /home/ubuntu/sports_bar_backup_YYYYMMDD_HHMMSS.db \
   /home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
sudo systemctl restart sportsbar-assistant
```

### Performance Issues

#### Check System Resources
```bash
# CPU and memory usage
top

# Disk space
df -h

# Service resource usage
systemctl status sportsbar-assistant
```

#### Optimize Database
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
sqlite3 prisma/data/sports_bar.db "VACUUM;"
```

### Update Application

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller

# Stop service
sudo systemctl stop sportsbar-assistant

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Rebuild application
npm run build

# Start service
sudo systemctl start sportsbar-assistant
```

---

## Uninstallation

To completely remove the Sports Bar TV Controller:

```bash
# Stop and disable service
sudo systemctl stop sportsbar-assistant
sudo systemctl disable sportsbar-assistant

# Remove service file
sudo rm /etc/systemd/system/sportsbar-assistant.service
sudo systemctl daemon-reload

# Remove application directory
sudo rm -rf /home/ubuntu/Sports-Bar-TV-Controller

# Optional: Remove Node.js (if not needed for other applications)
# sudo apt-get remove nodejs npm
```

---

## Additional Resources

- **GitHub Repository**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller
- **Issue Tracker**: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues
- **Next.js Documentation**: https://nextjs.org/docs
- **Prisma Documentation**: https://www.prisma.io/docs

---

## Support

If you encounter issues not covered in this guide:

1. Check the [GitHub Issues](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues)
2. Review the application logs: `sudo journalctl -u sportsbar-assistant -f`
3. Create a new issue with:
   - System information (`uname -a`, `node -v`, `npm -v`)
   - Error messages from logs
   - Steps to reproduce the issue

---

## License

This project is part of the Sports Bar TV Controller application. See the main repository for license information.
