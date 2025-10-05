# Sports Bar Assistant AI - Documentation

This folder contains all documentation for the Sports Bar TV Controller system. All markdown (.md) and PDF files have been consolidated here for easy access by the AI assistant and developers.

## 📚 Documentation Structure

### AI Knowledge Base Files
- `atlas-ai-knowledge-base.md` / `.pdf` - Atlas IED device integration knowledge
- `wolfpack-ai-knowledge-base.md` / `.pdf` - Wolfpack matrix switcher knowledge

### Installation & Setup
- `INSTALLATION_GUIDE.md` / `.pdf` - Complete installation instructions
- `AI_MODELS_SETUP.md` - AI model configuration
- `OLLAMA_SETUP_COMPLETE.md` - Local AI setup with Ollama
- `LOCAL_AI_INSTALLATION_COMPLETE.md` / `.pdf` - Local AI installation guide
- `GITHUB_UPDATE_AI_SETUP.md` - GitHub update configuration for AI

### Configuration Guides
- `CONFIG_README.md` - Configuration system overview (from config/ folder)
- `LOCAL_CONFIG_SYSTEM.md` / `.pdf` - Local configuration management
- `BACKUP_RESTORE_GUIDE.md` - Backup and restore procedures
- `BACKUP_RESTORE_SYSTEM.md` / `.pdf` - Complete backup system documentation
- `API_KEYS_BACKUP_GUIDE.md` / `.pdf` - API keys backup procedures

### Device Integration
- `ATLASIED_INTEGRATION_GUIDE.md` / `.pdf` - Atlas IED integration
- `ATLAS_PHYSICAL_CONFIGURATION.md` / `.pdf` - Physical device setup
- `ATLAS_IO_CONFIGURATION_SUMMARY.md` / `.pdf` - I/O configuration
- `CEC_INTEGRATION_GUIDE.md` / `.pdf` - HDMI-CEC integration
- `CEC_TV_DISCOVERY_GUIDE.md` / `.pdf` - TV discovery via CEC
- `UNIFIED_TV_CONTROL_GUIDE.md` / `.pdf` - Unified TV control system
- `pulse-eight-integration-guide.md` / `.pdf` - Pulse-Eight CEC adapter
- `cec-bridge-setup.md` - CEC bridge configuration

### Feature Documentation
- `AI_ASSISTANT_IMPLEMENTATION.md` / `.pdf` - AI assistant features
- `AI_ASSISTANT_QUICK_START.md` / `.pdf` - Quick start guide
- `AI_KNOWLEDGE_SYSTEM.md` / `.pdf` - Knowledge base system
- `AI_DOCUMENT_UPLOAD_FEATURE.md` / `.pdf` - Document upload functionality
- `AI_LOG_ANALYSIS_FEATURE.md` / `.pdf` - Log analysis features
- `CODEBASE_INDEXING_FEATURE.md` / `.pdf` - Code indexing system
- `PROFESSIONAL_TV_GUIDE_IMPLEMENTATION.md` / `.pdf` - TV guide features
- `GUIDE_DATA_IMPLEMENTATION.md` / `.pdf` - Guide data system

### UI & Styling
- `AI_STYLE_STANDARDIZATION.md` / `.pdf` - Style standards
- `COLOR_SCHEME_STANDARD.md` / `.pdf` - Color scheme documentation
- `SITE_WIDE_UI_IMPROVEMENTS.md` / `.pdf` - UI enhancement guide
- `TEXT_READABILITY_VISUAL_COMPARISON.md` / `.pdf` - Readability improvements
- `MATRIX_UI_IMPROVEMENTS.md` / `.pdf` - Matrix control UI
- `DEVICE_CONFIG_UI_IMPROVEMENTS.md` / `.pdf` - Device configuration UI

### Soundtrack Integration
- `SOUNDTRACK_INTEGRATION_GUIDE.md` / `.pdf` - Soundtrack.com integration
- `SOUNDTRACK_SETUP_GUIDE.md` / `.pdf` - Setup instructions
- `SOUNDTRACK_TROUBLESHOOTING.md` - Troubleshooting guide
- `SOUNDTRACK_API_TROUBLESHOOTING.md` / `.pdf` - API issues

### Scheduler & Automation
- `SMART_SCHEDULER_GUIDE.md` - Smart scheduling features
- `SCHEDULER_QUICK_START.md` - Quick start for scheduler
- `SCHEDULER_WOLFPACK_INTEGRATION.md` / `.pdf` - Wolfpack integration
- `SUBSCRIPTION_POLLING_IMPLEMENTATION.md` / `.pdf` - Subscription polling
- `WOLFPACK_MATRIX_INTEGRATION.md` / `.pdf` - Matrix integration details

### Channel & Preset Management
- `CHANNEL_PRESETS_ENHANCEMENTS.md` / `.pdf` - Channel preset features
- `CHANNEL_PRESET_QUICK_ACCESS.md` / `.pdf` - Quick access guide
- `CHANNEL_PRESETS_TROUBLESHOOTING.md` - Troubleshooting presets

### Update & Maintenance
- `UPDATE_SCRIPT_GUIDE.md` / `.pdf` - Update script documentation
- `UPDATE_SCRIPT_DOCUMENTATION.md` / `.pdf` - Detailed update docs
- `UPDATE_PROCESS.md` - Update process overview
- `UPDATE_ENHANCEMENTS.md` / `.pdf` - Update system enhancements
- `USER_DATA_PRESERVATION.md` / `.pdf` - Data preservation during updates

### Fix & Troubleshooting Guides
- `DATABASE_FIX_README.md` - Database repair procedures (from scripts/)
- `LIBCEC_PACKAGE_FIX.md` / `.pdf` - libCEC package issues
- `DEPLOYMENT_FIX_GUIDE.md` - Deployment troubleshooting
- `DATA_LOSS_FIX.md` - Data recovery procedures
- `ROOT_CAUSE_ANALYSIS.md` - System issue analysis

### Project Documentation
- `CHANGELOG.md` - Version history and changes
- `README_INSTALLATION.md` - Installation README
- `README_STYLE_TOOLS.md` - Style tools README
- `RECENT_UPDATES.md` - Latest updates summary
- `STATUS_UPDATE.md` - Current project status
- Various `*_SUMMARY.md` files - Feature summaries
- Various `*_FIX_*.md` files - Bug fix documentation

## 🤖 AI Assistant Integration

The AI assistant automatically loads all documentation from this folder through:
- **Knowledge Base Builder**: `scripts/build-knowledge-base.ts` scans this folder
- **AI Knowledge Library**: `src/lib/ai-knowledge.ts` loads the compiled knowledge base
- **Automatic Updates**: Run `npm run build-knowledge-base` to rebuild after adding docs

## 📝 Adding New Documentation

1. Place new `.md` or `.pdf` files in this `docs/` folder
2. Run `npm run build-knowledge-base` to update the AI knowledge base
3. The AI assistant will automatically have access to the new documentation

## 🔄 Updating Documentation

When you pull updates from GitHub:
- All documentation in this folder will be updated
- Your local configuration files remain safe (they're in `config/*.local.json`)
- Run `./update_from_github.sh` to safely update the system

## 📖 For Developers

- **Primary README**: See `../README.md` in the project root for main project documentation
- **Configuration**: See `CONFIG_README.md` for configuration system details
- **Installation**: See `INSTALLATION_GUIDE.md` for setup instructions

---

**Last Updated**: October 5, 2025  
**Documentation Count**: 180+ files  
**Purpose**: Centralized knowledge base for AI assistant and developers
