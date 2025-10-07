
# 🏈 Sports Bar AI Assistant

AI-powered assistant for sports bar AV system management, troubleshooting, and matrix control.

## 🚀 Quick Installation

Get started with a single command! This one-line installer will automatically set up everything you need:

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

### Installation Location

**By default, the application installs to your home directory:**
- Installation path: `$HOME/Sports-Bar-TV-Controller`
- Runs as your current user (no separate service user needed)
- Simple permissions - no sudo required for most operations

**For custom installation location:**
```bash
# Install to a specific directory
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/custom/path bash

# System-wide installation (creates service user)
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/opt/sportsbar bash
```

### Prerequisites
- **Operating System**: Ubuntu 20.04+ or Debian 11+ (64-bit)
- **User Access**: sudo privileges recommended (but not required for home directory install)
- **Network**: Active internet connection
- **Disk Space**: At least 2GB free space

### What Gets Installed
The installer automatically handles:
- ✅ Node.js 20.x (via NodeSource repository)
- ✅ SQLite database (no separate database server needed)
- ✅ All project dependencies
- ✅ System service configuration (optional, requires sudo)
- ✅ Automatic startup on boot (optional)

### After Installation
Once complete, access your application at:
- **Local**: http://localhost:3000
- **Network**: http://[your-server-ip]:3000

**If systemd service was configured:**
```bash
sudo systemctl status sportsbar-assistant    # Check status
sudo systemctl restart sportsbar-assistant   # Restart service
sudo systemctl stop sportsbar-assistant      # Stop service
sudo systemctl start sportsbar-assistant     # Start service
```

**If running manually (no systemd service):**
```bash
cd ~/Sports-Bar-TV-Controller
npm start                          # Start in production mode
# or
npm run dev                        # Start in development mode
```

---

## ✅ **YARN ISSUES PERMANENTLY FIXED!**

**No more yarn configuration conflicts!** This project now uses npm consistently.

## 🔄 **Updating from GitHub (Recommended)**

Use the automated update script to pull latest changes without any yarn issues:

```bash
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh
```

**Note:** If you installed to a custom location, replace `~/Sports-Bar-TV-Controller` with your installation directory.

This script automatically:
- **Creates automatic backup** of all your settings
- Stops running processes
- Pulls latest changes from GitHub  
- Installs dependencies with npm (no yarn conflicts)
- Updates database schema if needed
- Rebuilds and restarts the application
- **Optionally runs system benchmark** to track performance

### Update Options

```bash
# Standard update
./update_from_github.sh

# Skip AI checks for faster updates
./update_from_github.sh --skip-ai

# Update with full system benchmark
./update_from_github.sh --benchmark

# Update with quick benchmark (~5 minutes)
./update_from_github.sh --benchmark-quick
```

### 📊 System Benchmarking

Track your system's performance over time with built-in benchmarking:

**During Updates:**
- The update script will prompt you to run a benchmark (optional)
- Choose full benchmark (~15-20 min) or quick benchmark (~5 min)
- Results are saved to `benchmark-reports/` directory

**Manual Benchmarking:**
```bash
# Full benchmark
./scripts/system-benchmark.sh

# Quick benchmark
./scripts/system-benchmark.sh --quick
```

**What's Measured:**
- Hardware specifications (CPU, RAM, disk, GPU, network)
- CPU performance (single-core, multi-core)
- Disk I/O (sequential, random read/write)
- Memory bandwidth
- PostgreSQL performance
- Ollama AI response times
- Next.js application response times
- System health (temperature, load, processes)

**Use Cases:**
- Establish baseline before hardware upgrades
- Track performance degradation over time
- Compare systems (old vs new hardware)
- Monitor impact of software updates
- Troubleshoot performance issues

### ❓ Do My Settings Persist After Updates?

**YES!** Your configurations persist automatically. The database file (`prisma/dev.db`) is protected by `.gitignore` and never overwritten by updates.

**You do NOT need to manually restore settings after normal updates.**

📖 **For complete details, see:** [UPDATE_PROCESS.md](./UPDATE_PROCESS.md)

### 🛡️ Backup & Restore

Automatic backups are created before every update as a safety net. You only need to restore if:
- A migration fails and corrupts the database (rare)
- You accidentally delete important configurations
- You want to rollback after an update

📖 **For restore procedures, see:** [BACKUP_RESTORE_GUIDE.md](./BACKUP_RESTORE_GUIDE.md)

## 🚀 **Fresh Installation**

For a completely clean installation:

```bash
cd ~
./fresh_install.sh
```

## 🔧 **One-time Yarn Fix (If Needed)**

If you're updating from an old installation that still has yarn issues:

```bash
cd ~/Sports-Bar-TV-Controller
./permanent_fix_yarn.sh
```

This converts your existing installation to use npm permanently.

## 📋 **Manual Update Process**

If you prefer manual control:

```bash
cd ~/Sports-Bar-TV-Controller
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
- `scripts/` - Utility scripts including system benchmark
- `benchmark-reports/` - System benchmark results and comparisons

## 🔑 **Features**

- AI-powered chat for AV troubleshooting
- Document upload and analysis
- API key management for multiple AI providers
- Matrix control system integration
- System enhancement tools
- Wolf Pack matrix control
- **System Performance Benchmarking** (NEW!)
  - Track performance over time
  - Compare before/after hardware upgrades
  - Quick and full benchmark modes
  - Detailed reports in Markdown and JSON formats
- **HDMI-CEC control for TVs via Pulse-Eight USB CEC Adapter**
  - Power control (on/standby) for individual TVs or broadcast to all
  - Device discovery and monitoring
- **🤖 AI Code Assistant**
  - Local AI-powered code analysis and improvements
  - Automated dependency management with one-command setup
  - Risk-based change approval system
  - Automatic backups and PR creation
  - See [ai-assistant/README.md](./ai-assistant/README.md) for details

## 🤖 **AI Code Assistant - Quick Setup**

Get started with the AI Code Assistant in one command:

```bash
cd ~/Sports-Bar-TV-Controller
npm run setup:ai
```

This will automatically:
- ✓ Install Ollama (if needed)
- ✓ Pull the DeepSeek Coder AI model
- ✓ Configure all dependencies
- ✓ Verify system readiness

**Check if everything is ready:**
```bash
npm run check:ai
```

**Access the AI Assistant:**
- Dashboard: http://localhost:3000/ai-assistant

For more details, see [ai-assistant/README.md](./ai-assistant/README.md)
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

## 📊 **Benchmark Reports**

Benchmark reports are stored in `benchmark-reports/` directory:
- `baseline-report-YYYYMMDD-HHMMSS.md` - Human-readable Markdown format
- `baseline-report-YYYYMMDD-HHMMSS.json` - Machine-readable JSON format
- `comparison-template.md` - Template for comparing two systems

**Viewing Reports:**
```bash
# View latest report
cat $(ls -t benchmark-reports/baseline-report-*.md | head -1)

# Compare two reports
diff benchmark-reports/baseline-report-20251007-*.md benchmark-reports/baseline-report-20251008-*.md
```

---

**No more yarn headaches - just smooth updates!** 🎉
