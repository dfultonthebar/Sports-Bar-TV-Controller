# Claude Code Context - Sports Bar TV Controller

## Project Overview

Sports bar management system for controlling TVs, audio, and streaming devices across multiple zones.

## Available Tools & Technologies

### Testing & Automation

#### Playwright
- **Installed**: ✅ Yes
- **Purpose**: Browser automation for UI testing, screenshots, and visual regression testing
- **Location**: `node_modules/playwright`
- **Usage Examples**:
  ```bash
  # Capture UI screenshots
  npx tsx scripts/capture-ui.ts

  # Capture specific component
  npx tsx scripts/capture-selector.ts

  # Run headless browser tests
  npx playwright test
  ```
- **Common Use Cases**:
  - UI screenshot capture for documentation
  - Visual regression testing
  - Automated UI testing
  - Form interaction testing
  - Navigation testing

### Development Stack

#### Frontend
- **Next.js 15**: App Router, React Server Components
- **React 19**: Latest stable version
- **TypeScript**: Full type safety
- **Tailwind CSS**: Utility-first styling with custom config
- **Lucide React**: Icon library

#### Backend
- **Node.js**: Runtime environment
- **Drizzle ORM**: Type-safe database operations
- **SQLite**: Primary database (`/home/ubuntu/sports-bar-data/production.db`)
- **PM2**: Process management for production

#### AI & Knowledge
- **Ollama**: Local LLM server (llama3.2:3b model)
- **AI Assistant**: Enhanced chat with codebase knowledge
- **Q&A Worker**: Background processing for AI training data

### Hardware Integration

#### Video Matrix
- **Atlas Wolf Pack**: HDMI matrix switcher
- **Connection**: Persistent WebSocket connection
- **API**: `/api/matrix/*`

#### Audio
- **Atlas Audio Processor**: Multi-zone audio control
- **Soundtrack Your Brand**: Commercial music streaming
- **API**: `/api/audio-processor`, `/api/soundtrack/*`

#### Device Control
- **DirecTV**: IP-based control
- **Fire TV**: ADB over network
- **CEC**: Cable box power control via HDMI-CEC
- **IR Devices**: Global Cache iTach

### Scripts

#### UI Testing
```bash
# Capture all UI pages
npx tsx scripts/capture-ui.ts

# Capture remote selector specifically
npx tsx scripts/capture-selector.ts
```

#### Database
```bash
# Generate Q&A training data
npx tsx scripts/generate-qa-with-claude.ts

# Import n8n workflows
node scripts/import-n8n-workflow.js
```

#### Development
```bash
# Build production
npm run build:server

# Run development server
npm run dev

# Restart PM2 service
pm2 restart sports-bar-tv-controller
```

### Important Paths

- **Database**: `/home/ubuntu/sports-bar-data/production.db`
- **Backups**: `/home/ubuntu/sports-bar-data/backups/`
- **Screenshots**: `/tmp/ui-screenshots/`
- **Working Dir**: `/home/ubuntu/Sports-Bar-TV-Controller/`

### Environment

- **Platform**: Linux (Ubuntu)
- **Port**: 3001 (main application)
- **Ollama Port**: 11434 (AI model server)

### Common Commands

```bash
# Check system status
pm2 status
pm2 logs sports-bar-tv-controller

# Build and restart
npm run build:server && pm2 restart sports-bar-tv-controller

# Database query
sqlite3 /home/ubuntu/sports-bar-data/production.db

# Test API endpoints
curl http://localhost:3001/api/health

# Capture UI screenshots
npx tsx scripts/capture-ui.ts
```

### Recent Enhancements

1. **UI Modernization** (2025-10-31)
   - Glassmorphism design system
   - Animated status indicators
   - Dynamic gradient backgrounds
   - Playwright screenshot automation

2. **AI Training System**
   - Q&A generation worker
   - Codebase knowledge integration
   - Enhanced chat API

3. **Fire TV Integration**
   - Streaming guide with 3-day events
   - App shortcuts
   - ADB-based remote control

### Notes for Claude

- **Playwright is available**: Use for UI testing and screenshot capture
- **Always build before restart**: `npm run build:server && pm2 restart`
- **Database location**: Never hardcode, use environment variable
- **Port 3001**: Main application runs here
- **PM2 approved commands**: build, restart, status, logs, stop, start, delete
- **Screenshots go to**: `/tmp/ui-screenshots/` by convention

### UI Enhancement Guidelines

When enhancing UI components:
1. Use Playwright to capture before/after screenshots
2. Apply glassmorphism with `backdrop-blur-xl bg-white/5`
3. Add smooth transitions (`transition-all duration-300`)
4. Use gradient text for headers
5. Include hover effects with scale transformations
6. Add animated status indicators when relevant
7. Document changes in `/docs/UI-ENHANCEMENTS.md`

### Testing Workflow

1. Make changes to component
2. Build: `npm run build:server`
3. Restart: `pm2 restart sports-bar-tv-controller`
4. Capture screenshots: `npx tsx scripts/capture-ui.ts`
5. Verify visual changes
6. Commit if approved

---

*Last Updated: 2025-10-31*
*Maintained by: Claude Code Assistant*
