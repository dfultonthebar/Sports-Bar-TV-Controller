# Atlas Configuration Restoration Guide

## Critical Issue: Configuration Wipe Bug

### What Happened
The upload/download configuration feature had a critical bug that **generated random configuration data** instead of reading from the actual Atlas processor. When users clicked "Download Config", it would:
1. Generate random input/output settings
2. Overwrite the saved configuration file
3. Wipe out all carefully configured settings

### Root Cause
The `src/app/api/atlas/download-config/route.ts` file was generating random data for testing purposes, but this code was left in production. When users downloaded configuration, it replaced their real settings with random values.

### The Fix
**Fixed Files:**
1. `src/app/api/atlas/download-config/route.ts` - Now reads from saved configuration file instead of generating random data
2. `src/app/api/atlas/upload-config/route.ts` - Now saves configuration to file system BEFORE attempting processor upload

### Atlas Configuration Backup Location
- **Primary Config**: `/home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai0000260a7xuiepjl.json`
- **Backups**: `/home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai0000260a7xuiepjl_backup_*.json`

### Restored Configuration Summary
From backup file `cmgjxa5ai0000260a7xuiepjl.json`:

**Inputs (7 configured):**
1. Matrix 1 - Line input, -17dB gain, routes to outputs 3,5
2. Matrix 2 - Line input, -18dB gain, routes to output 4
3. Matrix 3 - Line input, -3dB gain, routes to outputs 1,6
4. Matrix 4 - Line input, +2dB gain, routes to output 7
5. Mic 1 - Microphone, -18dB gain, compressor enabled, routes to outputs 2,7
6. Mic 2 - Microphone, -4dB gain, compressor enabled, routes to outputs 1,4,5,3
7. Spotify - Line input, -17dB gain, routes to outputs 3,5,2

**Outputs (7 configured):**
1. Bar - Speaker, -20dB, 48ms delay, limiter enabled
2. Bar Sub - Speaker, -17dB, 94ms delay, limiter enabled
3. Dining Room - Speaker, -27dB, 46ms delay, limiter enabled
4. Party Room West - Speaker, -11dB, 77ms delay, compressor + limiter
5. Party Room East - Speaker, -13dB, 22ms delay, limiter enabled
6. Patio - Speaker, -19dB, 44ms delay, MUTED, compressor + limiter
7. Bathroom - Speaker, -19dB, 88ms delay, limiter enabled

**Scenes (3 configured):**
- Scene 1, 2, and 3 with various input/output level presets

## Atlas Processor Information

### Connection Details
- **IP Address**: 192.168.5.101
- **Port**: 80 (HTTP)
- **Model**: AZMP8 (8 inputs, 8 outputs, 8 zones)
- **Authentication**: HTTP Basic Auth
  - Username: admin
  - Password: admin (base64 encoded in database)
- **Status**: Online and reachable

### Database Configuration
- **Processor ID**: cmgjxa5ai0000260a7xuiepjl
- **Name**: Graystone Alehouse Main Audio
- **Database**: `/home/ubuntu/Sports-Bar-TV-Controller/prisma/data/sports_bar.db`
- **Table**: AudioProcessor

## How to Prevent Future Data Loss

### 1. Always Backup Before Changes
```bash
# Manual backup command
cd /home/ubuntu/Sports-Bar-TV-Controller
cp data/atlas-configs/cmgjxa5ai0000260a7xuiepjl.json \
   data/atlas-configs/cmgjxa5ai0000260a7xuiepjl_manual_backup_$(date +%Y%m%d_%H%M%S).json
```

### 2. Verify Configuration After Download
After clicking "Download Config", always verify that the displayed settings match your expectations. If they look wrong, DO NOT save them.

### 3. Use the Atlas Web Interface Directly
For critical configuration changes, access the Atlas processor directly:
- URL: http://192.168.5.101
- Username: admin
- Password: admin

### 4. Regular Automated Backups
The system has automated daily backups at 3:00 AM:
- Location: `/home/ubuntu/Sports-Bar-TV-Controller/backups/`
- Retention: 14 days

## Restoration Process

### If Configuration Gets Wiped Again

1. **Stop the application**:
   ```bash
   pm2 stop sports-bar-tv-controller
   ```

2. **Restore from backup**:
   ```bash
   cd /home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs
   # Find the most recent backup
   ls -lt cmgjxa5ai0000260a7xuiepjl_backup_*.json | head -n 1
   # Copy it to the main config file
   cp cmgjxa5ai0000260a7xuiepjl_backup_TIMESTAMP.json cmgjxa5ai0000260a7xuiepjl.json
   ```

3. **Restart the application**:
   ```bash
   pm2 restart sports-bar-tv-controller
   ```

4. **Verify in UI**:
   - Navigate to Audio Control Center
   - Check that inputs and outputs show correct names and settings

## Atlas AI Monitor

### Issue
The Atlas AI Monitor was showing errors because it requires real-time meter data from the Atlas processor.

### Status
The AI Monitor component is functional but requires:
1. Active AudioInputMeter data in the database
2. The Atlas processor to be online and sending meter data
3. Proper configuration of the meter monitoring service

### To Enable Full AI Monitoring
The meter monitoring service needs to be configured to poll the Atlas processor regularly and store meter readings in the database.

## Wolf Pack Tests

### Status
Wolf Pack tests are working correctly. The previous database schema fixes resolved the test logging issues.

### Test Endpoints
- Connection Test: `/api/tests/wolfpack/connection`
- Switching Test: `/api/tests/wolfpack/switching`

Both tests properly log results to the TestLog table with correct data types.

## Important Notes

1. **Atlas Configuration is Independent**: The Atlas processor maintains its own configuration internally. The application's configuration files are for reference and UI display only.

2. **No Direct Atlas API**: The current implementation does not directly communicate with the Atlas processor's API for configuration changes. All configuration is stored locally in JSON files.

3. **Future Enhancement**: To enable true bidirectional sync with the Atlas processor, the Atlas HTTP API endpoints need to be properly documented and implemented.

## Troubleshooting

### Atlas Shows Offline
1. Check network connectivity: `ping 192.168.5.101`
2. Check port accessibility: `nc -zv 192.168.5.101 80`
3. Verify Atlas processor is powered on
4. Check firewall rules

### Configuration Not Loading
1. Check file exists: `ls -l /home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs/cmgjxa5ai0000260a7xuiepjl.json`
2. Verify JSON is valid: `cat file.json | python3 -m json.tool`
3. Check file permissions: `chmod 644 file.json`

### AI Monitor Shows Errors
1. Verify AudioProcessor exists in database
2. Check that processor status is 'online'
3. Ensure meter monitoring service is running
4. Check API endpoint: `curl -X POST http://localhost:3001/api/atlas/ai-analysis -H "Content-Type: application/json" -d '{"processorId":"cmgjxa5ai0000260a7xuiepjl","processorModel":"AZMP8"}'`

## Contact Information

For Atlas processor technical support:
- Manufacturer: AtlasIED
- Product: Atmosphere AZMP8
- Documentation: https://www.atlasied.com/atmosphere

---
Last Updated: October 10, 2025
