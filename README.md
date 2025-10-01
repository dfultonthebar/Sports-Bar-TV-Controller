# 🏈 Sports Bar AI Assistant

AI-powered assistant for sports bar AV system management, troubleshooting, and matrix control.

## ✅ **YARN ISSUES PERMANENTLY FIXED!**

**No more yarn configuration conflicts!** This project now uses npm consistently.

## 🔄 **Updating from GitHub (Recommended)**

Use the automated update script to pull latest changes without any yarn issues:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
```

This script automatically:
- Stops running processes
- Pulls latest changes from GitHub  
- Installs dependencies with npm (no yarn conflicts)
- Updates database schema if needed
- Rebuilds and restarts the application

## 🚀 **Fresh Installation**

For a completely clean installation:

```bash
cd /home/ubuntu
./fresh_install.sh
```

## 🔧 **One-time Yarn Fix (If Needed)**

If you're updating from an old installation that still has yarn issues:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./permanent_fix_yarn.sh
```

This converts your existing installation to use npm permanently.

## 📋 **Manual Update Process**

If you prefer manual control:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull origin main
npm install
npx prisma generate
npx prisma db push
npm run build
npm start
```

## 🌐 **Access Your Application**

After installation/update, access at:
- Local: http://localhost:3000
- Network: http://[your-ip]:3000

## 📁 **Project Structure**

- `src/app/` - Next.js application pages and components
- `prisma/` - Database schema and migrations
- `lib/` - Utility functions and configurations
- `components/` - Reusable UI components

## 🔑 **Features**

- AI-powered chat for AV troubleshooting
- Document upload and analysis
- API key management for multiple AI providers
- Matrix control system integration
- System enhancement tools
- Wolf Pack matrix control
- **HDMI-CEC control for TVs via Pulse-Eight USB CEC Adapter**
  - Power control (on/standby) for individual TVs or broadcast to all
  - Device discovery and monitoring
  - Integrated with matrix input selection
  - Automatic driver installation (libCEC)

## 🛠️ **Development**

```bash
npm run dev    # Start development server
npm run build  # Build for production
npm start      # Start production server
```

## 🔌 **Hardware Requirements**

### HDMI-CEC Control
For TV power control via HDMI-CEC, you'll need:
- **Pulse-Eight USB CEC Adapter** connected to your server
- HDMI connection from the server to your matrix switcher
- TVs that support HDMI-CEC (most modern TVs)

The installation script automatically installs **libCEC** drivers. Just plug in your Pulse-Eight adapter and the system will detect it!

### Supported Hardware
- **Matrix Switchers**: Wolf Pack HDMI matrices
- **IR Control**: Global Cache iTach IP2IR (for cable boxes, DirecTV, Fire TV)
- **Audio Processors**: AtlasIED Atmosphere (AZM4/AZM8)
- **TVs**: Any HDMI-CEC capable displays

## 📦 **Package Manager**

This project uses **npm** exclusively to avoid yarn version conflicts. All scripts and documentation assume npm usage.

---

**No more yarn headaches - just smooth updates!** 🎉
