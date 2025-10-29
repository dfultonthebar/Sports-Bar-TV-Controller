# Sports Bar TV Controller - Comprehensive System Summary
**Generated:** October 18, 2025
**Repository:** https://github.com/dfultonthebar/Sports-Bar-TV-Controller

## 🎯 System Overview

A comprehensive web application for managing TV displays, matrix video routing, and sports content scheduling in sports bar environments.

### Technology Stack
- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL
- **Hardware Integration:** 
  - Wolfpack HDMI Matrix Switchers (HTTP API)
  - Atlas AZMP8 Audio Processor (HTTP API)
- **Process Management:** PM2
- **AI Integration:** Multiple providers (Ollama, Abacus AI, OpenAI, Anthropic, X.AI)

## 🔑 Quick Access

### Server Credentials
- **Host:** 24.123.87.42
- **SSH Port:** 224
- **Application Port:** 3000
- **Username:** ubuntu
- **Password:** 6809233DjD$$$ (THREE dollar signs)
- **SSH Command:** `ssh -p 224 ubuntu@24.123.87.42`
- **Application URL:** http://24.123.87.42:3000

### Project Paths
- **Production:** `/home/ubuntu/Sports-Bar-TV-Controller`
- **Development:** `/home/ubuntu/github_repos/Sports-Bar-TV-Controller`
- **PM2 Process:** `sports-bar-tv`

### Quick Deployment
```bash
ssh -p 224 ubuntu@24.123.87.42
cd /home/ubuntu/Sports-Bar-TV-Controller
git pull origin main
npm install
npx prisma generate
npm run build
pm2 restart sports-bar-tv
pm2 logs sports-bar-tv
```

## 📋 Core Features

### 1. Dashboard (Home)
- System status monitoring
- Quick access cards to all features
- Real-time operational status

### 2. Video Matrix / Matrix Control
- **Outputs 1-4 (TV 01-04):** Full matrix outputs with complete controls
- **Outputs 5-32:** Regular matrix outputs
- **Outputs 33-36 (Matrix 1-4):** Audio routing outputs for Atlas integration
- Configure 32 video sources
- TV selection system for automated schedules
- Real-time status monitoring

### 3. Atlas / Audio Control
- **Hardware:** Graystone AZMP8 (192.168.5.101)
- **Configuration:** 8 inputs, 8 outputs, 8 zones
- Multi-zone audio control
- Scene management
- Dynamic zone labels based on video input
- Configuration upload/download with timestamped backups

### 4. AI Hub
**Status:** ⚠️ PARTIALLY FUNCTIONAL
- **Working:** Chat interface, Enhanced Devices, Configuration, API Keys
- **Broken:** Q&A Training (500 error), Codebase Indexing (404 error)
- AI-powered assistance and insights
- Multiple AI provider support
- Device analytics and recommendations

### 5. Sports Guide
**Version:** 4.0.0 - Simplified Implementation
- **Data Source:** The Rail Media API ONLY
- Real-time sports TV guide
- Date range filtering
- Lineup filtering (SAT, DRTV, DISH, CABLE, STREAM)
- Search functionality
- Ollama AI integration for intelligent queries
- Comprehensive verbose logging

**API Configuration:**
- Provider: The Rail Media
- Endpoint: https://guide.thedailyrail.com/api/v1
- User ID: 258351
- API Key: Configured in `.env`

### 6. Streaming Platforms
- Platform account management
- Service configuration
- Integration settings

### 6.5. Global Cache IR Control
**Version:** 2.0 - With IR Learning Support
- **Device Management:** Add/manage Global Cache iTach devices
- **IR Learning:** Learn IR codes directly from physical remote controls
- **Multi-Port Support:** Configure 3 IR output ports per device
- **Real-time Testing:** Test device connectivity and IR transmission
- **Comprehensive Logging:** Verbose logging for debugging

**IR Learning Feature:**
- Capture IR signals from physical remotes
- Built-in IR receiver on iTach devices
- 60-second timeout per learning session
- Automatic code format conversion
- Save learned codes to IR devices

### 7. DirecTV Integration
**Status:** ✅ FULLY FUNCTIONAL (October 15, 2025)
- **Protocol:** SHEF (Set-top Box HTTP Exported Functionality) v1.12
- Receiver management and configuration
- Device connectivity testing
- Real-time device status monitoring
- Current channel and program information
- Matrix switcher integration

**Important Notes:**
- Subscription data NOT available via SHEF API
- Shows receiver ID, access card, software version, current channel
- Fixed subscription polling to handle API limitations correctly

### 8. IR Device Setup & Global Cache Integration
**Version:** 1.0
- Comprehensive IR device management
- Global Cache iTach device integration
- IR code database integration
- Command management per device
- Matrix switcher integration
- Verbose logging throughout

**Features:**
- Add/Edit/Delete IR devices
- Link to Global Cache devices and ports
- Download IR codes from Global Cache database
- Matrix input channel assignment
- Device testing and validation

### 9. Remote Control
- Bartender Remote interface
- Quick TV and audio control
- Matrix status display
- Input source shortcuts

### 10. System Admin
- Wolfpack configuration and testing
- Matrix inputs/outputs management
- System logs viewing
- Backup management
- TODO task tracking

## 🔴 Active Issues

### Issue #1: Atlas Audio Processor Configuration Error
**Status:** 🔧 IN PROGRESS
**Error:** `TypeError: Cannot read properties of undefined (reading 'length')`
**Location:** Audio Control → Atlas System → Configuration tab
**Fix Applied:** Data normalization and defensive rendering with optional chaining

### Issue #2: AI Hub Q&A Training
**Status:** ❌ FAILING
**Error:** `Database error: Failed to create Q&A entry`
**Priority:** CRITICAL

### Issue #3: AI Hub Codebase Indexing
**Status:** ❌ FAILING  
**Error:** `GET /api/ai-assistant/index-codebase 404`
**Priority:** CRITICAL

## 📚 Essential Documentation

**Location:** `/home/ubuntu/Sports-Bar-TV-Controller/docs/`

### Must-Read Before Changes:
1. **COLOR_SCHEME_STANDARD.md** - Official color palette
2. **COLOR_STANDARDIZATION_SUMMARY.md** - Implementation summary
3. **SUBSCRIPTION_POLLING_IMPLEMENTATION.md** - Polling system details
4. **SYSTEM_OPTIMIZATION_SUMMARY.md** - System-wide optimizations
5. **SSH_OPTIMIZATION_GUIDE.md** - Efficient SSH connections

## 🗄️ Database Schema (Key Models)

- **MatrixOutput** - TV display outputs
- **MatrixInput** - Video sources
- **WolfpackConfig** - Matrix switcher configuration
- **AudioProcessor** - Atlas audio configuration
- **GlobalCacheDevice** - iTach IR devices
- **GlobalCachePort** - IR output ports
- **IRDevice** - IR-controlled devices
- **IRCommand** - IR command database
- **DirecTVReceiver** - DirecTV receiver configuration
- **IndexedFile** - AI Hub codebase files
- **QAPair** - AI Hub Q&A training data
- **TrainingDocument** - AI Hub training documents
- **ApiKey** - AI provider API keys
- **TODO** - Task management

## 🔧 Common Operations

### View Logs
```bash
pm2 logs sports-bar-tv
pm2 logs sports-bar-tv | grep "Sports-Guide"
pm2 logs sports-bar-tv | grep "GLOBAL CACHE"
```

### Database Operations
```bash
npx prisma generate
npx prisma migrate dev
npx prisma migrate deploy
npx prisma studio
```

### Test Connections
```bash
# Test Wolfpack matrix
curl -X POST http://24.123.87.42:3000/api/wolfpack/test-connection \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.100"}'

# Test Global Cache device
curl -X POST http://24.123.87.42:3000/api/globalcache/devices/[id]/test
```

## 🎨 UI/Styling Standards

**CRITICAL:** Always follow approved color schemes in documentation
- Prevents unreadable text and poor contrast
- Maintains consistent user experience
- Avoids UI regressions

## 🔐 Security Notes

- API keys stored in `.env` file (never in repository)
- Key masking in UI (first 8 + last 4 characters)
- Server-side only API calls
- Secure credential storage

## 📊 System Status

- **Overall:** Production Ready
- **AI Hub:** Partially Functional (2 critical issues)
- **Sports Guide:** Fully Functional
- **Matrix Control:** Fully Functional
- **Audio Control:** Fix in Progress
- **DirecTV Integration:** Fully Functional
- **IR Control:** Fully Functional

## 🚀 Future Enhancements

- Enhanced device insights with more data
- Batch Q&A generation for AI Hub
- Advanced diagnostic tools
- Multi-receiver coordination for DirecTV
- Macro commands for IR devices
- IR learning mode improvements

---

**For detailed information, refer to:**
- `SYSTEM_DOCUMENTATION.md` - Complete system documentation (4252 lines)
- `docs/` directory - Essential reference materials
- GitHub Issues - Bug tracking and feature requests

**Last Updated:** October 18, 2025
