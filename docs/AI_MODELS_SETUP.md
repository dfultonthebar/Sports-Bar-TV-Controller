
# AI Models Setup and Management

## Overview

The Sports Bar AI Assistant uses **Ollama** for local AI capabilities. This document explains the AI models used and how they're automatically managed.

## Automatic Setup

When you run the update script, all required AI models are **automatically downloaded**:

```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
./update_from_github.sh
```

This script will:
1. ✅ Install Ollama (if not already installed)
2. ✅ Start the Ollama service
3. ✅ Download all required AI models
4. ✅ Verify models are ready

## Required Models

The system uses three AI models for different purposes:

### 1. **llama3.2** (Primary Model)
- **Purpose**: Style analysis, component evaluation, AI-powered features
- **Size**: ~2GB
- **Speed**: Fast
- **Quality**: High accuracy
- **Used For**:
  - Color scheme standardization
  - Component style analysis
  - UI/UX recommendations
  - Code quality checks

### 2. **llama2** (Backup Model)
- **Purpose**: Device diagnostics, system troubleshooting
- **Size**: ~3.8GB
- **Speed**: Moderate
- **Quality**: Excellent reasoning
- **Used For**:
  - Hardware diagnostics
  - Error pattern analysis
  - Log analysis
  - Device configuration recommendations

### 3. **mistral** (Fast Model)
- **Purpose**: Quick queries, real-time responses
- **Size**: ~4.1GB
- **Speed**: Very fast
- **Quality**: Good for quick tasks
- **Used For**:
  - Quick troubleshooting
  - Real-time device status
  - Fast API responses
  - Chat-style interactions

## Manual Model Management

### Check Installed Models
```bash
ollama list
```

### Pull a Specific Model
```bash
ollama pull llama3.2
ollama pull llama2
ollama pull mistral
```

### Test a Model
```bash
ollama run llama3.2
# Type your question and press Enter
# Type /bye to exit
```

### Remove a Model (if needed)
```bash
ollama rm llama3.2
```

### Check Ollama Service Status
```bash
pgrep ollama    # Returns process ID if running
```

### Start Ollama Service Manually
```bash
ollama serve &
```

### Stop Ollama Service
```bash
pkill ollama
```

## Model Storage

Models are stored in:
- **Linux**: `~/.ollama/models/`
- **macOS**: `~/.ollama/models/`

Each model requires disk space:
- llama3.2: ~2GB
- llama2: ~3.8GB
- mistral: ~4.1GB
- **Total**: ~10GB

## Troubleshooting

### Models Not Downloading

If models fail to download during setup:

1. **Check internet connection**:
   ```bash
   ping -c 3 ollama.com
   ```

2. **Check Ollama service**:
   ```bash
   pgrep ollama || ollama serve &
   ```

3. **Manually pull models**:
   ```bash
   ollama pull llama3.2
   ollama pull llama2
   ollama pull mistral
   ```

### Style Analysis Not Working

1. **Verify Ollama is running**:
   ```bash
   ollama list
   ```

2. **Check required model exists**:
   ```bash
   ollama list | grep llama3.2
   ```

3. **Manually run analyzer**:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller
   node scripts/ai-style-analyzer.js
   ```

### Disk Space Issues

If you're low on disk space, you can remove unused models:

```bash
# Keep only the primary model for style analysis
ollama rm llama2
ollama rm mistral

# Or check disk usage
du -sh ~/.ollama/models/
```

## AI Features Using These Models

### 1. **Style Analysis** (`llama3.2`)
- Automatic component style checking
- Color scheme consistency
- UI/UX recommendations
- Located: `./scripts/run-style-analysis.sh`

### 2. **Device Diagnostics** (`llama2`)
- Wolf Pack troubleshooting
- Atlas audio analysis
- CEC device detection
- DirecTV/Fire TV configuration

### 3. **Quick Queries** (`mistral`)
- Fast API responses
- Real-time device status
- Chat-style troubleshooting
- System health checks

## Performance Tips

### Speed Up Model Loading
Models are loaded into memory on first use. To pre-load:

```bash
ollama run llama3.2 <<< "test" > /dev/null
ollama run llama2 <<< "test" > /dev/null
ollama run mistral <<< "test" > /dev/null
```

### Reduce Memory Usage
Only keep models you're actively using:

```bash
# For style analysis only
ollama list | grep -v llama3.2 | awk '{print $1}' | xargs -I {} ollama rm {}
```

### Check Resource Usage
```bash
# See Ollama memory usage
ps aux | grep ollama

# See model disk usage
du -sh ~/.ollama/models/*
```

## Integration with GitHub Updates

The `update_from_github.sh` script ensures:

1. ✅ Ollama is installed before any AI features run
2. ✅ All required models are available
3. ✅ Models are updated if new versions exist
4. ✅ Service is running before analysis starts
5. ✅ Errors are logged if downloads fail

This means **you never have to manually manage AI models** - they're handled automatically during updates.

## CI/CD and Deployment

If deploying to production:

```bash
# In your deployment script
./update_from_github.sh

# Or install AI separately
./install-local-ai.sh
```

The system will work with or without AI models:
- **With models**: Full AI features enabled
- **Without models**: Falls back to cloud AI (if API keys configured)

## Support

For AI model issues:
1. Check logs: `ai-style-analysis.log`
2. Run diagnostics: `npm run test-ai`
3. Check service: `ollama ps`
4. Review reports: `ai-style-reports/`

## Additional Resources

- **Ollama Documentation**: https://ollama.com/docs
- **Model Library**: https://ollama.com/library
- **Community Models**: https://ollama.com/library

---

**Last Updated**: October 1, 2025
**Maintained By**: Sports Bar AI Assistant Team
