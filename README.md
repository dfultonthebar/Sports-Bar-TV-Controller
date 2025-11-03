[![CI/CD Pipeline](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/dfultonthebar/Sports-Bar-TV-Controller/actions/workflows/ci-cd.yml)


# 🏈 Sports Bar AI Assistant

AI-powered assistant for sports bar AV system management, troubleshooting, and matrix control.

## 🆕 Latest Updates

### Audio Control Center & Soundtrack Integration (October 2024)
**NEW**: Unified audio management system with commercial music streaming

- ✅ **Soundtrack Your Brand Integration** - Commercial music streaming for bars/restaurants
  - Now playing display with album art
  - Play/pause control for bartender remote
  - Zone-specific music management
  - Direct integration with AtlasIED audio processors
- ✅ **Audio Control Center** - Single interface for all audio management
  - Atlas audio processor configuration & monitoring
  - AI-powered gain control and optimization
  - Real-time audio level monitoring
  - Zone-specific audio control
- ✅ **CEC Cable Box Control** - Enhanced TV control with cable box integration
  - Direct CEC communication with cable boxes
  - Channel tuning via HDMI-CEC
  - Automated power management
  - Integration with channel presets
- ✅ **System Health Dashboard** - Real-time monitoring of all subsystems
  - Soundtrack API status monitoring
  - Atlas audio processor health checks
  - Database and service status tracking
  - Quick action buttons for common tasks

**See**:
- [Soundtrack Integration Guide](docs/SOUNDTRACK_INTEGRATION_GUIDE.md)
- [CEC Cable Box Setup](docs/CEC_CABLE_BOX_IMPLEMENTATION.md)
- [Audio Control Center Guide](docs/ATLAS_CONFIGURATION_SUMMARY.md)

### TV Position Detection Fix
**Fixed**: TVs are now positioned correctly based on actual layout images using AI vision analysis.

- ✅ Real AI vision integration (OpenAI GPT-4 Vision / Anthropic Claude Vision)
- ✅ Accurate x/y coordinate detection from uploaded images
- ✅ Supports 25+ TVs with precise positioning
- ✅ Fallback grid positioning when API keys not configured

**See**: [TV Position Detection Fix Documentation](docs/TV_POSITION_DETECTION_FIX.md)

**Setup**: Run `./scripts/setup-vision-api.sh` to configure AI vision API keys

---

## 🚀 **Quick Start - One-Line Installer**

Get your Sports Bar TV Controller up and running in minutes with our automated installer:

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

**That's it!** The installer handles everything automatically:
- ✅ Node.js v22 installation
- ✅ Ollama AI platform with 4 optimized models
- ✅ SQLite database setup and migration
- ✅ Knowledge base building (2,700+ AI training chunks)
- ✅ Application build and deployment
- ✅ Optional systemd service configuration

**Installation Time:** 5-10 minutes (depending on internet speed)

**Access your application at:** http://localhost:3000

---

## 📋 **System Requirements**

### Minimum Requirements
- **Operating System:** Ubuntu 20.04+ or Debian 11+ (64-bit)
- **CPU:** 2 cores (4+ recommended for AI features)
- **RAM:** 4GB (8GB+ recommended for AI features)
- **Disk Space:** 10GB free (20GB+ recommended)
- **Network:** Active internet connection for installation

### Recommended for Production
- **CPU:** Intel NUC13ANHi5 or equivalent (4+ cores)
- **RAM:** 16GB+ for optimal AI performance
- **Disk:** SSD with 50GB+ free space
- **Network:** Gigabit Ethernet

### Supported Hardware
- **Matrix Switchers:** Wolf Pack HDMI matrices
- **IR Control:** Global Cache iTach IP2IR (cable boxes, DirecTV, Fire TV)
- **Audio Processors:** AtlasIED Atmosphere (AZM4/AZM8)
- **CEC Control:** Pulse-Eight USB CEC Adapter for TV power control
- **TVs:** Any HDMI-CEC capable displays

---

## 🎯 **Installation Options**

### Default Installation (Home Directory)
Installs to `$HOME/Sports-Bar-TV-Controller` with your user permissions:

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

**Benefits:**
- No sudo required for most operations
- Simple permissions management
- Easy to update and maintain
- Runs as your current user

### Custom Installation Directory
Install to any location you prefer:

```bash
# Install to custom directory
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/custom/path bash

# System-wide installation (creates service user)
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | INSTALL_DIR=/opt/sportsbar bash
```

### Skip Ollama Installation
If you already have Ollama installed:

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | SKIP_OLLAMA=true bash
```

### Specify Branch
Install from a specific branch:

```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | REPO_BRANCH=develop bash
```

---

## 📦 **What Gets Installed**

### Core Components
1. **Node.js v22.x** - Latest LTS version via NodeSource repository
2. **SQLite Database** - Lightweight, embedded database (no separate server needed)
3. **Application Dependencies** - All npm packages automatically installed
4. **Ollama AI Platform** - Local AI inference engine
5. **AI Models** (4 models, ~15GB total):
   - `llama3.2:latest` - General purpose AI (2GB)
   - `llama2:latest` - Fallback model (3.8GB)
   - `mistral:latest` - Fast responses (4.1GB)
   - `phi3:mini` - Lightweight model (2.3GB)

### AI Features
- **Knowledge Base:** 2,700+ training chunks from documentation
- **Q&A Generation:** Automatic question-answer pairs for troubleshooting
- **Code Analysis:** AI-powered code review and improvements
- **Chatbot Streaming:** Real-time AI responses
- **Tool Integration:** File system access and code execution

### Optional Components
- **Systemd Service** - Automatic startup on boot (requires sudo)
- **libCEC Drivers** - For HDMI-CEC TV control via Pulse-Eight adapter

---

## ✅ **Post-Installation**

### Verify Installation

```bash
# Check application status
curl http://localhost:3000

# Check AI system
curl http://localhost:3000/api/ai/status

# Check Ollama models
ollama list
```

### Access the Application

- **Local Access:** http://localhost:3000
- **Network Access:** http://[your-server-ip]:3000

### Default Pages
- **Home:** Dashboard and quick actions
- **AI Hub:** Chat with AI assistant
- **Matrix Control:** HDMI matrix switching
- **Device Config:** Configure TVs, audio, and IR devices
- **CEC Discovery:** Detect and control HDMI-CEC devices

### Managing the Service

**If systemd service was configured:**

```bash
# Check status
sudo systemctl status sportsbar-assistant

# Start/Stop/Restart
sudo systemctl start sportsbar-assistant
sudo systemctl stop sportsbar-assistant
sudo systemctl restart sportsbar-assistant

# View logs
sudo journalctl -u sportsbar-assistant -f
```

**If running manually:**

```bash
cd ~/Sports-Bar-TV-Controller
npm start                    # Production mode
# or
npm run dev                  # Development mode with hot reload
```

---

## 🔄 **Updating Your Installation**

### Automated Update (Recommended)

Use the built-in update script that handles everything safely:

```bash
cd ~/Sports-Bar-TV-Controller
./update_from_github.sh
```

**The update script automatically:**
- ✅ Creates backup of your settings and database
- ✅ Stops running processes
- ✅ Pulls latest changes from GitHub
- ✅ Installs new dependencies
- ✅ Updates database schema
- ✅ Rebuilds the application
- ✅ Restarts services

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

### Manual Update

If you prefer manual control:

```bash
cd ~/Sports-Bar-TV-Controller
git pull origin main
npm install
npm run db:generate
npm run db:push
npm run build
npm start
```

### Settings Persistence

**Your settings are automatically preserved!** The database file (`prisma/data/sports_bar.db`) is protected by `.gitignore` and never overwritten by updates.

You do NOT need to manually restore settings after normal updates.

📖 **For complete update details, see:** [UPDATE_PROCESS.md](./UPDATE_PROCESS.md)

---

## 🧠 **Teaching the AI About New Features**

**Important:** After adding features or fixes, update the AI Assistant's knowledge!

### Quick Method (With Claude Code)
When working with Claude Code, simply say:
```
"We just added [feature]. Generate Q&As to teach the local AI about it."
```

Claude will read your documentation and generate high-quality Q&A pairs in minutes.

### Automatic Reminder
After every `git commit` with `feat:` or `fix:`, you'll see a reminder to update AI training.

### Full Workflow
See [WORKFLOW.md](./WORKFLOW.md) for complete details on the development process.

**Current Q&A Count:** 87 entries

---

## 🛠️ **Troubleshooting**

### Installation Issues

#### Problem: Installation fails with "USER: unbound variable"
**Solution:** This is fixed in the latest version. Re-run the installer:
```bash
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash
```

#### Problem: Node.js installation fails
**Solution:** Manually install Node.js v22:
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Problem: Ollama models fail to download
**Solution:** Download models manually:
```bash
ollama pull llama3.2:latest
ollama pull llama2:latest
ollama pull mistral:latest
ollama pull phi3:mini
```

#### Problem: Permission denied errors
**Solution:** Fix directory permissions:
```bash
sudo chown -R $USER:$USER ~/Sports-Bar-TV-Controller
chmod -R 755 ~/Sports-Bar-TV-Controller
```

### Runtime Issues

#### Problem: Application won't start
**Solution:** Check logs and restart:
```bash
# Check for errors
cd ~/Sports-Bar-TV-Controller
npm run build

# Check port availability
sudo lsof -i :3000

# Restart application
npm start
```

#### Problem: AI features not working
**Solution:** Verify Ollama and knowledge base:
```bash
# Check Ollama status
systemctl status ollama

# Verify models
ollama list

# Rebuild knowledge base
cd ~/Sports-Bar-TV-Controller
npm run build:kb
```

#### Problem: Database errors
**Solution:** Reset and migrate database:
```bash
cd ~/Sports-Bar-TV-Controller
npm run db:push
npm run build:kb
```

#### Problem: Port 3000 already in use
**Solution:** Change port or kill existing process:
```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process (replace PID)
kill -9 <PID>

# Or change port in .env
echo "PORT=3001" >> .env
```

### Checking Logs

```bash
# Application logs
cd ~/Sports-Bar-TV-Controller
tail -f logs/app.log

# Systemd service logs
sudo journalctl -u sportsbar-assistant -f

# Ollama logs
sudo journalctl -u ollama -f

# Installation logs
ls -lt /tmp/sportsbar-install-*.log | head -1
```

### Rebuilding Knowledge Base

If AI responses are poor or outdated:

```bash
cd ~/Sports-Bar-TV-Controller
npm run build:kb
```

This rebuilds the AI knowledge base from all documentation files.

### Complete Reinstall

If all else fails, perform a fresh installation:

```bash
# Backup your database
cp ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db ~/sports_bar.db.backup

# Remove old installation
rm -rf ~/Sports-Bar-TV-Controller

# Fresh install
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash

# Restore database (optional)
cp ~/sports_bar.db.backup ~/Sports-Bar-TV-Controller/prisma/data/sports_bar.db
```

---

## 🎯 **Key Features**

For complete API documentation, see **[API Reference Guide](./docs/API_REFERENCE.md)**.

### AI-Powered Assistant
- **Natural Language Chat:** Ask questions about your AV system
- **Troubleshooting:** Get instant help with technical issues
- **Documentation Search:** AI searches through all manuals and guides
- **Code Analysis:** Automated code review and improvements
- **Streaming Responses:** Real-time AI chat with typing indicators

### Matrix Control
- **HDMI Switching:** Control Wolf Pack matrix switchers
- **Input Selection:** Route any source to any display
- **Preset Management:** Save and recall favorite configurations
- **Bulk Operations:** Control multiple displays simultaneously

### Device Management
- **TV Control:** HDMI-CEC power control via Pulse-Eight adapter
- **IR Control:** Cable boxes, DirecTV, Fire TV via Global Cache
- **CEC Cable Box Control:** Direct HDMI-CEC communication with cable boxes for channel tuning
- **Audio Processing:** AtlasIED Atmosphere zone control with AI-powered optimization
- **Device Discovery:** Automatic detection of HDMI-CEC devices
- **Unified TV Control:** Intelligent fallback between CEC, IR, and Fire TV control methods

### Automation & Scheduling
- **Channel Presets:** Pre-configure channels for quick access
- **Scheduled Events:** Automatic switching at specific times
- **Bulk Updates:** Update multiple devices at once
- **Backup/Restore:** Save and restore configurations

### Audio & Music Management
- **Soundtrack Your Brand:** Commercial music streaming integration
- **Audio Control Center:** Unified interface for all audio systems
- **Atlas AI Monitoring:** Real-time audio level analysis and optimization
- **Zone Control:** Independent volume and routing for multiple audio zones
- **Now Playing:** Track information and album art display
- **Bartender Controls:** Simplified music control for staff

### System Monitoring
- **System Health Dashboard:** Real-time monitoring of all subsystems
- **Performance Benchmarking:** Track system performance over time
- **Health Checks:** Monitor CPU, memory, disk, network, and external APIs
- **AI Performance:** Measure AI response times
- **Hardware Specs:** Detailed system information
- **Service Status:** Database, Soundtrack API, Atlas processors, and more

---

## 📊 **System Benchmarking**

Track your system's performance over time with built-in benchmarking:

### During Updates

The update script will prompt you to run a benchmark (optional):
- **Full benchmark:** ~15-20 minutes, comprehensive testing
- **Quick benchmark:** ~5 minutes, essential metrics only

Results are saved to `benchmark-reports/` directory.

### Manual Benchmarking

```bash
# Full benchmark
./scripts/system-benchmark.sh

# Quick benchmark
./scripts/system-benchmark.sh --quick
```

### What's Measured

- **Hardware:** CPU, RAM, disk, GPU, network specifications
- **CPU Performance:** Single-core and multi-core benchmarks
- **Disk I/O:** Sequential and random read/write speeds
- **Memory:** Bandwidth and latency tests
- **Database:** SQLite query performance
- **Ollama AI:** Model loading and response times
- **Application:** Next.js page load times
- **System Health:** Temperature, load average, processes

### Use Cases

- Establish baseline before hardware upgrades
- Track performance degradation over time
- Compare systems (old vs new hardware)
- Monitor impact of software updates
- Troubleshoot performance issues

### Viewing Reports

```bash
# View latest report
cat $(ls -t benchmark-reports/baseline-report-*.md | head -1)

# Compare two reports
diff benchmark-reports/baseline-report-20251007-*.md benchmark-reports/baseline-report-20251008-*.md
```

---

## 🤖 **AI Code Assistant**

Integrated AI-powered code analysis and improvements:

### Quick Setup

```bash
cd ~/Sports-Bar-TV-Controller
npm run setup:ai
```

This automatically:
- ✓ Installs Ollama (if needed)
- ✓ Pulls the DeepSeek Coder AI model
- ✓ Configures all dependencies
- ✓ Verifies system readiness

### Check Readiness

```bash
npm run check:ai
```

### Access the AI Assistant

- **Dashboard:** http://localhost:3000/ai-assistant

### Features

- **Code Analysis:** Automated code review
- **Dependency Management:** One-command setup
- **Risk-Based Approval:** Safety checks before changes
- **Automatic Backups:** Before any modifications
- **PR Creation:** Automatic pull request generation

📖 **For complete details, see:** [ai-assistant/README.md](./ai-assistant/README.md)

---

## 🔌 **HDMI-CEC Control**

Control TV power via HDMI-CEC using Pulse-Eight USB CEC Adapter:

### Requirements

- **Pulse-Eight USB CEC Adapter** connected to your server
- HDMI connection from server to matrix switcher
- TVs that support HDMI-CEC (most modern TVs)

### Features

- Power control (on/standby) for individual TVs
- Broadcast power commands to all TVs
- Device discovery and monitoring
- Automatic driver installation (libCEC)
- Integrated with matrix input selection

### Setup

The installer automatically installs libCEC drivers. Just:
1. Plug in your Pulse-Eight adapter
2. Connect HDMI from server to matrix
3. Run CEC discovery from the UI
4. Control TVs from Device Config page

---

## 📁 **Project Structure**

```
Sports-Bar-TV-Controller/
├── src/
│   ├── app/              # Next.js pages and API routes
│   ├── components/       # React components
│   └── lib/              # Utility functions and configurations
├── prisma/
│   ├── schema.ts     # Database schema
│   └── data/             # SQLite database files
├── scripts/              # Utility scripts
│   ├── system-benchmark.sh
│   ├── build-knowledge-base.ts
│   └── verify-ai-system.ts
├── docs/                 # Documentation
├── benchmark-reports/    # Performance benchmark results
├── .ai-assistant/        # AI code assistant files
├── install.sh            # One-line installer
└── update_from_github.sh # Update script
```

---

## 🔧 **Development**

### Start Development Server

```bash
cd ~/Sports-Bar-TV-Controller
npm run dev
```

Access at: http://localhost:3000

### Build for Production

```bash
npm run build
npm start
```

### Database Operations

```bash
# Generate Drizzle migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio
```

### Rebuild Knowledge Base

```bash
npm run build:kb
```

---

## 📖 **Additional Documentation**

- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Complete API endpoint documentation
- **[HARDWARE_CONFIGURATION.md](./docs/HARDWARE_CONFIGURATION.md)** - Hardware setup and configuration guide
- **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions
- **[NUC_DEPLOYMENT.md](./NUC_DEPLOYMENT.md)** - Intel NUC-specific deployment guide
- **[UPDATE_PROCESS.md](./UPDATE_PROCESS.md)** - Detailed update procedures
- **[BACKUP_RESTORE_GUIDE.md](./BACKUP_RESTORE_GUIDE.md)** - Backup and restore procedures
- **[ai-assistant/README.md](./ai-assistant/README.md)** - AI Code Assistant documentation

---

## 🆘 **Getting Help**

### Check Documentation
1. Read the troubleshooting section above
2. Check the [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
3. Review installation logs in `/tmp/sportsbar-install-*.log`

### Check Logs
```bash
# Application logs
tail -f ~/Sports-Bar-TV-Controller/logs/app.log

# Service logs
sudo journalctl -u sportsbar-assistant -f

# Ollama logs
sudo journalctl -u ollama -f
```

### Common Issues
- **Port conflicts:** Change port in `.env` file
- **Permission errors:** Run `sudo chown -R $USER:$USER ~/Sports-Bar-TV-Controller`
- **AI not working:** Verify Ollama with `ollama list`
- **Database errors:** Run `npm run db:push`

### Create an Issue
If you encounter a bug or have a feature request:
1. Check existing issues on GitHub
2. Create a new issue with:
   - Detailed description
   - Steps to reproduce
   - System information
   - Relevant logs

---

## 🎉 **Success!**

Your Sports Bar TV Controller is now installed and ready to use!

**Next Steps:**
1. Access the application at http://localhost:3000
2. Configure your devices in Device Config
3. Set up matrix switching presets
4. Try the AI assistant for troubleshooting
5. Run a system benchmark to establish baseline

**Enjoy your AI-powered AV control system!** 🏈📺🎮

---

## 📝 **Version Information**

- **Installer Version:** 2.0
- **Node.js:** v22.x
- **Ollama:** Latest stable
- **AI Models:** llama3.2, llama2, mistral, phi3:mini
- **Last Updated:** October 2025

---

## 🙏 **Acknowledgments**

Built with:
- Next.js 14
- React 18
- Drizzle ORM
- Ollama AI
- TypeScript
- Tailwind CSS

---

**No more yarn headaches - just smooth updates!** 🎉

## Uninstall

To uninstall the Sports Bar TV Controller:

```bash
cd ~/Sports-Bar-TV-Controller
./uninstall.sh
```

For more options and detailed instructions, see [UNINSTALL_GUIDE.md](UNINSTALL_GUIDE.md).

### Quick Uninstall Options

```bash
# Interactive uninstall (asks for confirmation)
./uninstall.sh

# Non-interactive uninstall
./uninstall.sh --yes

# Keep dependencies (Node.js and Ollama)
./uninstall.sh --yes --keep-nodejs --keep-ollama

# Backup before uninstall
./uninstall.sh --backup --yes

# See what would be removed (dry run)
./uninstall.sh --dry-run
```

### Reinstall

To reinstall the application:

```bash
# Quick reinstall (keeps dependencies)
./install.sh --reinstall --force

# Or one-line from GitHub
curl -sSL https://raw.githubusercontent.com/dfultonthebar/Sports-Bar-TV-Controller/main/install.sh | bash -s -- --reinstall --force
```
