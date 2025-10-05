
# 🏈 Sports Bar AI Assistant - Complete Installation Guide

## Overview

This guide covers the complete installation process for the Sports Bar AI Assistant, including automatic installation of all required drivers and dependencies, including **HDMI-CEC support (libCEC)** for TV control.

---

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 22.04 LTS or later
- **RAM**: Minimum 4GB (8GB recommended)
- **Storage**: 10GB free space
- **Network**: Internet connection for initial setup

### Hardware Requirements (Optional but Recommended)
- **HDMI-CEC Control**: Pulse-Eight USB CEC Adapter
- **IR Control**: Global Cache iTach IP2IR
- **Matrix Switcher**: Wolf Pack HDMI matrix
- **Audio Processor**: AtlasIED Atmosphere (AZM4/AZM8)

---

## 🚀 Quick Installation (Automated)

The installation script automatically installs ALL required dependencies, including:
- Node.js 18.x
- PostgreSQL database
- npm/Yarn package managers
- PM2 process manager
- **libCEC drivers for HDMI-CEC control**

### Step 1: Clone the Repository

```bash
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
```

### Step 2: Run the Installation Script

```bash
chmod +x install.sh
./install.sh
```

The script will automatically:
1. ✅ Install system dependencies (Node.js, PostgreSQL)
2. ✅ Install libCEC drivers for HDMI-CEC control
3. ✅ Install project dependencies
4. ✅ Set up the database
5. ✅ Build the application
6. ✅ Create necessary configuration files

### Step 3: Start the Application

```bash
npm start
```

Or for development mode:

```bash
npm run dev
```

### Step 4: Access the Application

Open your browser and navigate to:
- Local: http://localhost:3000
- Network: http://[your-server-ip]:3000

---

## 🔄 Updating from GitHub

To pull the latest updates from GitHub (including automatic libCEC installation if missing):

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
```

This script will:
1. Stop running processes
2. Pull latest changes
3. Check for and install libCEC if not already present
4. Update dependencies
5. Update database schema
6. Rebuild and restart the application

---

## 📺 HDMI-CEC Setup (Automatic)

### What Gets Installed

The installation script automatically installs:
- `cec-utils`: Command-line tools for CEC control
- `libcec4`: Core CEC library
- `libcec-dev`: Development headers (for future extensions)

### Hardware Setup

1. **Connect the Pulse-Eight USB CEC Adapter**:
   - Plug the adapter into any available USB port on your server
   - Connect HDMI cable from the adapter to your matrix switcher
   - Ensure your TVs are connected to the matrix and support HDMI-CEC

2. **Verify Installation**:
   ```bash
   cec-client -l
   ```
   
   You should see output showing your CEC adapter(s).

3. **Test CEC Communication**:
   ```bash
   echo "scan" | cec-client -s -d 1
   ```
   
   This will scan for CEC devices on the HDMI bus.

### Using CEC in the Application

Once installed, CEC controls are available in:
- **TV Management Page**: Individual TV power control
- **Matrix Configuration**: Select which matrix input has CEC connected
- **Bartender Remote**: Quick access to TV power controls

---

## 🗄️ Database Configuration

The installation script creates a PostgreSQL database with default credentials:
- **Database**: `sports_bar_ai`
- **User**: `sports_bar_user`
- **Password**: `sports_bar_pass`

To change these, edit the `.env` file after installation:

```bash
nano .env
```

Update the `DATABASE_URL`:
```
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/your_database?schema=public"
```

Then regenerate the database:
```bash
npx prisma generate
npx prisma db push
```

---

## 🔌 Hardware Integration

### 1. Matrix Switcher (Wolf Pack)
Configure your Wolf Pack matrix in the application:
- Go to **Settings** → **Matrix Configuration**
- Enter your matrix IP address
- Configure input/output mappings

### 2. Global Cache iTach (IR Control)
Configure IR devices for cable box control:
- Go to **Settings** → **IR Devices**
- Add your iTach IP address
- Configure device mappings (DirecTV, Fire TV, etc.)

### 3. AtlasIED Atmosphere (Audio)
Configure audio zones:
- Go to **Settings** → **Audio Configuration**
- Enter Atmosphere processor IP
- Map audio zones to matrix outputs

### 4. Pulse-Eight CEC Adapter (TV Power)
After automatic installation:
- Go to **Settings** → **Matrix Configuration**
- Select which input has CEC device connected
- Go to **TV Management** to control TV power

---

## 🛠️ Troubleshooting

### CEC Not Working

1. **Check USB Connection**:
   ```bash
   lsusb | grep -i pulse
   ```
   Should show the Pulse-Eight device.

2. **Check CEC Client**:
   ```bash
   cec-client -l
   ```
   Should list available adapters.

3. **Test Manually**:
   ```bash
   echo "scan" | cec-client -s -d 1
   echo "on 0" | cec-client -s -d 1
   echo "standby 0" | cec-client -s -d 1
   ```

4. **Check Permissions**:
   ```bash
   sudo usermod -a -G dialout $USER
   ```
   Log out and back in for changes to take effect.

### Application Won't Start

1. **Check Logs**:
   ```bash
   cat server.log
   ```

2. **Check Port 3000**:
   ```bash
   sudo lsof -i :3000
   ```

3. **Restart Services**:
   ```bash
   pkill -f "npm.*start"
   npm start
   ```

### Database Issues

1. **Reset Database**:
   ```bash
   npx prisma db push --force-reset
   ```

2. **Check PostgreSQL**:
   ```bash
   sudo systemctl status postgresql
   ```

---

## 📦 Manual Installation (Advanced)

If you prefer manual installation:

### 1. Install System Dependencies

```bash
# Update system
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install libCEC for HDMI-CEC
sudo apt install -y cec-utils libcec4 libcec-dev

# Install PM2 globally
sudo npm install -g pm2
```

### 2. Setup Database

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql << EOF
CREATE DATABASE sports_bar_ai;
CREATE USER sports_bar_user WITH PASSWORD 'sports_bar_pass';
GRANT ALL PRIVILEGES ON DATABASE sports_bar_ai TO sports_bar_user;
\q
EOF
```

### 3. Clone and Setup Project

```bash
cd /home/ubuntu
git clone https://github.com/dfultonthebar/Sports-Bar-TV-Controller.git
cd Sports-Bar-TV-Controller
npm install
```

### 4. Configure Environment

```bash
cat > .env << EOF
DATABASE_URL="postgresql://sports_bar_user:sports_bar_pass@localhost:5432/sports_bar_ai?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$(openssl rand -base64 32)"
NODE_ENV="production"
PORT=3000
EOF
```

### 5. Initialize Database

```bash
npx prisma generate
npx prisma db push
```

### 6. Build and Start

```bash
npm run build
npm start
```

---

## 🎯 Next Steps

After installation:

1. **Configure AI Keys**:
   - Go to `/ai-keys` in the application
   - Add API keys for Claude, ChatGPT, Grok, or local AI

2. **Upload Documentation**:
   - Go to the Chat interface
   - Upload your equipment manuals (PDF)
   - AI will use these for troubleshooting

3. **Configure Hardware**:
   - Set up matrix switcher
   - Configure IR devices
   - Test CEC controls

4. **Create Bar Layout**:
   - Go to **Layout Analysis**
   - Upload your bar floor plan
   - AI will analyze and optimize TV placement

---

## 📚 Additional Resources

- [CEC TV Discovery Guide](./CEC_TV_DISCOVERY_GUIDE.md)
- [Pulse-Eight Integration Guide](./pulse-eight-integration-guide.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [GitHub Repository](https://github.com/dfultonthebar/Sports-Bar-TV-Controller)

---

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs: `cat server.log`
3. Check GitHub issues: https://github.com/dfultonthebar/Sports-Bar-TV-Controller/issues

---

## ✅ Summary

**Everything is installed automatically**, including:
- ✅ Node.js and npm
- ✅ PostgreSQL database
- ✅ PM2 process manager
- ✅ **libCEC drivers for HDMI-CEC TV control**
- ✅ All project dependencies

**Just run `./install.sh` and you're ready to go!** 🎉

The CEC drivers will be installed automatically, so when you plug in your Pulse-Eight adapter, it will work immediately without any additional configuration.
