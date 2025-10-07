
# Performance Optimization Guide

## Overview
This document describes the performance optimizations applied to the Sports Bar TV Controller application to improve AI response times and reduce system load.

## Problem Statement
- **AI Response Times**: 45-60 seconds with knowledge base context
- **System Temperature**: 83-100°C (high thermal load)
- **Knowledge Base Size**: 6MB (very large, causing slow processing)
- **Hardware**: Intel Core i5-7200U (2 cores, 4 threads) with Intel HD Graphics 620

## GPU Acceleration Investigation

### Findings
After thorough research, we determined that:

1. **Ollama does NOT natively support Intel integrated GPUs** (HD Graphics 620)
2. Intel GPU support requires IPEX-LLM (Intel Extension for PyTorch), which:
   - Is complex to set up and configure
   - Requires Intel oneAPI Base Toolkit
   - May not provide significant benefits for older integrated GPUs
   - Is primarily designed for newer Intel Arc GPUs and data center GPUs

3. **Recommendation**: Focus on CPU optimization instead
   - More practical and maintainable
   - Better suited for the i5-7200U processor
   - Avoids complex dependencies and potential instability

### Why Not GPU Acceleration?
- Intel HD Graphics 620 is a 7th generation integrated GPU (2016)
- IPEX-LLM support is experimental for older iGPUs
- Setup complexity outweighs potential benefits
- CPU optimization provides more reliable improvements

## Optimizations Applied

### 1. Knowledge Base Optimization

**Before:**
- Size: 6.0 MB
- Chunks: 2,709
- Files: 121 (with duplicates)

**Optimizations:**
- Removed 53 exact duplicate chunks
- Removed 341 near-duplicate chunks (PDF/MD pairs of same files)
- Removed 14 chunks with minimal content (<50 characters)
- Compressed verbose content (excessive whitespace, separator lines)

**After:**
- Size: 4.4 MB (27% reduction)
- Chunks: 2,301 (15% reduction)
- Files: 121 (deduplicated)

**Impact:**
- Faster knowledge base loading
- Reduced memory footprint
- Quicker semantic search
- Lower CPU usage during AI queries

**Backup:**
- Original backed up to: `data/ai-knowledge-base.backup.YYYYMMDD_HHMMSS.json`

### 2. Ollama CPU Optimization

**Configuration File:** `/etc/systemd/system/ollama.service.d/optimization.conf`

**Settings Applied:**
```bash
# Limit parallel requests to reduce CPU contention
OLLAMA_NUM_PARALLEL=2

# Keep only one model loaded in memory
OLLAMA_MAX_LOADED_MODELS=1

# Enable flash attention for faster inference
OLLAMA_FLASH_ATTENTION=1

# Optimize thread count for i5-7200U (2 cores, 4 threads)
OMP_NUM_THREADS=4
GOMAXPROCS=4

# Limit request queue
OLLAMA_MAX_QUEUE=2

# Keep model loaded to avoid reload overhead
OLLAMA_KEEP_ALIVE=30m

# Reduce context window for faster responses
OLLAMA_NUM_CTX=2048

# Increase process priority
Nice=-5
IOSchedulingClass=realtime
CPUAffinity=0-3
```

**Impact:**
- Reduced CPU context switching
- Better thread utilization
- Faster inference with smaller context window
- Reduced model loading overhead
- Higher process priority for AI tasks

### 3. Performance Monitoring System

**Components:**

1. **performance-monitor.sh** - Collects metrics every 2 minutes:
   - CPU usage (overall and per-process)
   - Memory usage
   - System temperature
   - Ollama process stats
   - PM2 application stats
   - API response times

2. **view-performance.sh** - Dashboard for viewing metrics:
   - Current system status
   - Recent metrics (last 10 entries)
   - Recent alerts
   - 24-hour statistics
   - Average CPU, temperature, and memory

3. **Systemd Timer** - Automated monitoring:
   - Runs every 2 minutes
   - Starts automatically on boot
   - Logs to `/home/ubuntu/Sports-Bar-TV-Controller/logs/`

**Alert Thresholds:**
- CPU Usage: >90%
- Temperature: >90°C
- Memory Usage: >90%
- Ollama API Response: >1000ms

**Log Files:**
- Metrics: `logs/performance-metrics.log`
- Alerts: `logs/performance-alerts.log`
- Auto-rotation: Keeps last 10,000 metric entries, 5,000 alert entries

## Installation & Usage

### Apply Optimizations

1. **Optimize Ollama (requires sudo):**
   ```bash
   cd ~/Sports-Bar-TV-Controller
   sudo ./scripts/optimize-ollama.sh
   ```

2. **Install Monitoring (requires sudo):**
   ```bash
   sudo ./scripts/install-monitoring.sh
   ```

### View Performance

```bash
# View performance dashboard
./scripts/view-performance.sh

# View real-time logs
journalctl -u sports-bar-monitor -f

# Check timer status
systemctl status sports-bar-monitor.timer
```

### Manage Monitoring

```bash
# Stop monitoring
sudo systemctl stop sports-bar-monitor.timer

# Start monitoring
sudo systemctl start sports-bar-monitor.timer

# Disable monitoring (won't start on boot)
sudo systemctl disable sports-bar-monitor.timer

# Enable monitoring (starts on boot)
sudo systemctl enable sports-bar-monitor.timer
```

## Expected Improvements

### Response Time
- **Before**: 45-60 seconds with knowledge base
- **Expected After**: 20-35 seconds (40-50% improvement)
- Factors:
  - Smaller knowledge base (faster search)
  - Reduced context window (faster inference)
  - Optimized thread usage

### System Temperature
- **Before**: 83-100°C under load
- **Expected After**: 70-85°C under load
- Factors:
  - Better CPU scheduling
  - Reduced parallel processing
  - More efficient resource usage

### CPU Usage
- **Before**: High sustained load during AI queries
- **Expected After**: More balanced load distribution
- Factors:
  - Limited parallel requests
  - Optimized thread count
  - Higher process priority

## Monitoring & Maintenance

### Daily Checks
1. Run `./scripts/view-performance.sh` to check system health
2. Review alerts in `logs/performance-alerts.log`
3. Monitor temperature trends

### Weekly Maintenance
1. Review 24-hour statistics for patterns
2. Check for recurring alerts
3. Verify Ollama service is running optimally

### Monthly Tasks
1. Review and archive old log files
2. Test AI response times with sample queries
3. Consider further optimizations based on metrics

## Troubleshooting

### High Temperature Persists
1. Check CPU thermal paste
2. Clean system fans and vents
3. Improve case airflow
4. Consider reducing `OLLAMA_NUM_PARALLEL` to 1

### Slow AI Responses
1. Check if multiple models are loaded: `ollama list`
2. Verify Ollama optimization is active: `systemctl show ollama --property=Environment`
3. Test with smaller model: `ollama pull llama3.2:1b`
4. Reduce context window further: `OLLAMA_NUM_CTX=1024`

### Monitoring Not Working
1. Check timer status: `systemctl status sports-bar-monitor.timer`
2. Check service logs: `journalctl -u sports-bar-monitor -n 50`
3. Verify script permissions: `ls -l scripts/*.sh`
4. Reinstall: `sudo ./scripts/install-monitoring.sh`

## Reverting Changes

### Revert Ollama Optimization
```bash
sudo rm /etc/systemd/system/ollama.service.d/optimization.conf
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### Revert Knowledge Base
```bash
cd ~/Sports-Bar-TV-Controller
# Find backup file
ls -lh data/ai-knowledge-base.backup.*
# Restore (replace YYYYMMDD_HHMMSS with actual timestamp)
cp data/ai-knowledge-base.backup.YYYYMMDD_HHMMSS.json data/ai-knowledge-base.json
```

### Remove Monitoring
```bash
sudo systemctl stop sports-bar-monitor.timer
sudo systemctl disable sports-bar-monitor.timer
sudo rm /etc/systemd/system/sports-bar-monitor.service
sudo rm /etc/systemd/system/sports-bar-monitor.timer
sudo systemctl daemon-reload
```

## Additional Optimization Ideas

### Future Considerations
1. **Model Selection**: Switch to smaller models for simple queries
   - `llama3.2:1b` for basic questions
   - `llama3.2:3b` for complex troubleshooting

2. **Response Caching**: Implement caching for common questions
   - Store frequent queries and responses
   - Reduce AI processing for repeated questions

3. **Load Balancing**: Implement request queuing
   - Prevent multiple simultaneous AI requests
   - Show loading indicator to users

4. **Hardware Upgrade**: Consider if performance is still insufficient
   - Add dedicated GPU (NVIDIA GTX 1650 or better)
   - Upgrade to CPU with more cores
   - Increase RAM to 32GB

## Performance Metrics

### Baseline (Before Optimization)
- Knowledge Base Size: 6.0 MB
- Knowledge Base Chunks: 2,709
- AI Response Time: 45-60 seconds
- CPU Temperature: 83-100°C
- CPU Usage: High sustained load

### After Optimization
- Knowledge Base Size: 4.4 MB (-27%)
- Knowledge Base Chunks: 2,301 (-15%)
- AI Response Time: To be measured
- CPU Temperature: To be measured
- CPU Usage: To be measured

### Measurement Commands
```bash
# Test AI response time
time curl -X POST http://localhost:11434/api/generate \
  -d '{"model":"llama3.2:3b","prompt":"What is the capital of France?","stream":false}'

# Check CPU temperature
sensors | grep -i core

# Monitor CPU usage
top -bn1 | grep "Cpu(s)"

# Check Ollama process
ps aux | grep ollama
```

## Conclusion

These optimizations focus on practical, maintainable improvements that work with the existing hardware. By optimizing the knowledge base, tuning Ollama for CPU performance, and implementing comprehensive monitoring, we've created a more efficient and observable system.

The monitoring system will help track the effectiveness of these changes and identify any further optimization opportunities.

---

**Date**: October 6, 2025
**Version**: 1.0
**Status**: ✅ Implemented and Ready for Testing
