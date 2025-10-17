# Atlas AZMP8 TCP Implementation Documentation

## Overview

This document details the implementation of the Atlas AZMP8 audio processor TCP communication protocol for the Sports Bar TV Controller application. The implementation provides real-time communication with Atlas devices using the JSON-RPC 2.0 protocol over TCP port 5321.

## Implementation Date
**October 17, 2025** - Complete rewrite of Atlas configuration management to use actual TCP communication instead of local file operations only.

---

## Architecture

### Components

1. **Atlas TCP Client Library** (`src/lib/atlas-tcp-client.ts`)
   - Core TCP communication handler
   - JSON-RPC 2.0 protocol implementation
   - Message queuing and response handling
   - Connection management with automatic cleanup

2. **Download Configuration API** (`src/app/api/atlas/download-config/route.ts`)
   - Fetches live configuration from Atlas device
   - Saves configuration to local filesystem (backup)
   - Fallback to saved configuration if device unavailable

3. **Upload Configuration API** (`src/app/api/atlas/upload-config/route.ts`)
   - Uploads configuration to Atlas device
   - Saves configuration to local filesystem first (safety)
   - Continues operation even if device upload fails

---

## Protocol Details

### Connection Information
- **Protocol**: TCP/IP
- **Port**: 5321 (default for Atlas AZMP8)
- **IP Address**: 192.168.5.101 (configured in database)
- **Message Format**: JSON-RPC 2.0
- **Message Delimiter**: `\r\n` (carriage return + line feed)

### JSON-RPC 2.0 Message Structure

#### Request Format
```json
{
  "jsonrpc": "2.0",
  "method": "get|set|bmp|sub|unsub",
  "params": {
    "param": "ParameterName_Index",
    "val": 0,
    "fmt": "val|pct|str"
  },
  "id": 1
}
```

#### Response Format
```json
{
  "jsonrpc": "2.0",
  "result": [
    {
      "param": "ParameterName_Index",
      "val": 0,
      "str": "value"
    }
  ],
  "id": 1
}
```

#### Error Format
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  },
  "id": 1
}
```

---

## Supported Parameters

### Source (Input) Parameters
| Parameter | Description | Range | Format | Read/Write |
|-----------|-------------|-------|--------|------------|
| `SourceName_X` | Input name | N/A | str | Read Only |
| `SourceGain_X` | Input gain level | -80 to 0 dB | val | Read/Write |
| `SourceMute_X` | Input mute state | 0 (unmuted) or 1 (muted) | val | Read/Write |
| `SourceMeter_X` | Input audio level meter | -80 to 0 dB | val | Read Only |

### Zone (Output) Parameters
| Parameter | Description | Range | Format | Read/Write |
|-----------|-------------|-------|--------|------------|
| `ZoneName_X` | Zone/output name | N/A | str | Read Only |
| `ZoneGain_X` | Zone gain level | -80 to 0 dB | val | Read/Write |
| `ZoneMute_X` | Zone mute state | 0 (unmuted) or 1 (muted) | val | Read/Write |
| `ZoneSource_X` | Zone source routing | -1 to N (source index) | val | Read/Write |
| `ZoneMeter_X` | Zone audio level meter | -80 to 0 dB | val | Read Only |

### Scene Parameters
| Parameter | Description | Range | Format | Read/Write |
|-----------|-------------|-------|--------|------------|
| `SceneName_X` | Scene name | N/A | str | Read Only |
| `RecallScene` | Recall/activate scene | Scene index | val | Write Only |

**Note**: `X` represents the zero-based index (0-7 for AZMP8 model)

---

## API Usage

### Download Configuration

**Endpoint**: `POST /api/atlas/download-config`

**Request Body**:
```json
{
  "processorId": "atlas-001",
  "ipAddress": "192.168.5.101",
  "inputCount": 7,
  "outputCount": 7,
  "sceneCount": 3
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Configuration downloaded successfully from Atlas device",
  "inputs": [
    {
      "name": "Matrix 1",
      "gain": 0,
      "mute": false
    }
  ],
  "outputs": [
    {
      "name": "Main Bar",
      "gain": -40,
      "mute": false,
      "source": -1
    }
  ],
  "scenes": [
    {
      "name": "Test"
    }
  ],
  "source": "atlas_device",
  "savedToFile": true,
  "savedAt": "2025-10-17T19:49:40.079Z"
}
```

**Fallback Response** (device unavailable):
```json
{
  "success": true,
  "message": "Configuration loaded from saved file (device connection failed)",
  "inputs": [...],
  "outputs": [...],
  "scenes": [...],
  "source": "saved_configuration",
  "warning": "Could not connect to Atlas device: Connection timeout",
  "lastUpdated": "2025-10-17T18:30:00.000Z"
}
```

### Upload Configuration

**Endpoint**: `POST /api/atlas/upload-config`

**Request Body**:
```json
{
  "processorId": "atlas-001",
  "ipAddress": "192.168.5.101",
  "inputs": [
    {
      "name": "Matrix 1",
      "gain": -10,
      "mute": false
    }
  ],
  "outputs": [
    {
      "name": "Main Bar",
      "gain": -20,
      "mute": false,
      "source": 0
    }
  ],
  "scenes": [
    {
      "name": "Test"
    }
  ]
}
```

**Success Response**:
```json
{
  "success": true,
  "message": "Configuration uploaded successfully to Atlas device and saved locally",
  "savedAt": "2025-10-17T19:50:00.000Z",
  "savedToFile": true,
  "uploadedToDevice": true
}
```

**Partial Success Response** (device upload failed):
```json
{
  "success": true,
  "message": "Configuration saved locally but device upload failed",
  "savedAt": "2025-10-17T19:50:00.000Z",
  "savedToFile": true,
  "uploadedToDevice": false,
  "warning": "Device upload failed: Connection timeout",
  "details": "Configuration has been saved to local filesystem. Device upload can be retried later."
}
```

---

## File Storage

### Configuration Files Location
```
/home/ubuntu/Sports-Bar-TV-Controller/data/atlas-configs/
```

### File Naming Convention
- **Primary Configuration**: `{processorId}.json`
- **Backup Configuration**: `{processorId}_backup_{timestamp}.json`

### Example Configuration File
```json
{
  "processorId": "atlas-001",
  "inputs": [
    {
      "name": "Matrix 1",
      "gain": 0,
      "mute": false
    },
    {
      "name": "Mic 1",
      "gain": -10,
      "mute": false
    }
  ],
  "outputs": [
    {
      "name": "Main Bar",
      "gain": -40,
      "mute": false,
      "source": 0
    }
  ],
  "scenes": [
    {
      "name": "Normal Operation"
    }
  ],
  "messages": [],
  "lastUpdated": "2025-10-17T19:49:40.079Z",
  "source": "atlas_device"
}
```

---

## Logging & Debugging

### Log Prefix
All Atlas TCP operations use the prefix `[Atlas TCP]` or `[Atlas Download]`/`[Atlas Upload]` for easy filtering.

### Verbose Logging
The implementation includes comprehensive logging:

```bash
# View Atlas-related logs
pm2 logs sports-bar-tv | grep -i atlas

# Example output:
[Atlas TCP] Connected to 192.168.5.101:5321
[Atlas TCP] Fetching 7 sources...
[Atlas TCP] Sending message: {"jsonrpc":"2.0","method":"get","params":{"param":"SourceName_0","fmt":"str"},"id":1}
[Atlas TCP] Received response: {"jsonrpc":"2.0","result":[{"param":"SourceName_0","str":"Matrix 1"}],"id":1}
[Atlas TCP] Source 0: Matrix 1, gain=0, mute=false
[Atlas Download] Configuration successfully downloaded from device!
[Atlas Download] Downloaded: 7 inputs, 7 outputs, 3 scenes
```

### Log Levels
- **Connection**: TCP connection establishment and teardown
- **Messages**: All sent and received JSON-RPC messages
- **Parameters**: Individual parameter fetches and updates
- **Summaries**: Operation completion with statistics
- **Errors**: Connection failures, timeouts, and protocol errors

---

## Error Handling

### Connection Errors
- **Timeout**: Default 5 seconds for connection, 5 seconds per message
- **Network Unreachable**: Falls back to saved configuration
- **Connection Refused**: Device may be offline or port incorrect

### Protocol Errors
- **Invalid JSON**: Malformed messages from device
- **Missing ID**: Response without matching request ID
- **Error Responses**: Device-returned error messages

### Fallback Strategy
1. **Download**: Attempt device connection → Fall back to saved file → Return error
2. **Upload**: Save to filesystem first → Attempt device upload → Return partial success if device fails

---

## Testing

### Manual Testing via API

**Test Download**:
```bash
curl -X POST http://localhost:3000/api/atlas/download-config \
  -H "Content-Type: application/json" \
  -d '{
    "processorId": "atlas-001",
    "ipAddress": "192.168.5.101",
    "inputCount": 7,
    "outputCount": 7,
    "sceneCount": 3
  }'
```

**Test Upload**:
```bash
curl -X POST http://localhost:3000/api/atlas/upload-config \
  -H "Content-Type: application/json" \
  -d '{
    "processorId": "atlas-001",
    "ipAddress": "192.168.5.101",
    "inputs": [{"name": "Matrix 1", "gain": -10, "mute": false}],
    "outputs": [{"name": "Main Bar", "gain": -20, "mute": false, "source": 0}],
    "scenes": [{"name": "Test"}]
  }'
```

### Connection Testing

**Test TCP Connection**:
```bash
# From the server
nc -zv 192.168.5.101 5321

# Expected output:
# Connection to 192.168.5.101 5321 port [tcp/*] succeeded!
```

**Test HTTP Connection** (port 80 is also available):
```bash
curl http://192.168.5.101/
```

---

## Troubleshooting

### Common Issues

#### Issue: "Connection timeout"
**Cause**: Device not responding on TCP port 5321
**Solution**:
1. Verify device is powered on
2. Check network connectivity: `ping 192.168.5.101`
3. Verify TCP port is open: `nc -zv 192.168.5.101 5321`
4. Check firewall rules on device

#### Issue: "Configuration loaded from saved file (device connection failed)"
**Cause**: Device unreachable but saved configuration exists
**Solution**:
1. This is expected behavior - application continues with saved config
2. Fix device connectivity for future updates
3. Configuration will sync on next successful connection

#### Issue: "No saved configuration found"
**Cause**: Fresh installation with no prior configuration
**Solution**:
1. Ensure device connectivity is working
2. Configuration will be downloaded on first successful connection
3. Manual configuration via UI will create the file

#### Issue: "Request timeout after 5000ms"
**Cause**: Device is connected but not responding to messages
**Solution**:
1. Check device firmware version
2. Verify third-party control is enabled in device settings
3. Restart device if needed
4. Check Atlas message table in device web UI

---

## Performance Optimization

### Connection Pooling
The implementation uses single-connection operations with automatic cleanup:
- Connection opened at start of operation
- All parameters fetched in parallel where possible
- Connection closed after operation completes
- No persistent connections to avoid resource leaks

### Parallel Parameter Fetching
```typescript
// Fetches name, gain, and mute in parallel
const [name, gain, mute] = await Promise.all([
  this.getParameter(`SourceName_${i}`, 'str'),
  this.getParameter(`SourceGain_${i}`, 'val'),
  this.getParameter(`SourceMute_${i}`, 'val')
])
```

### Timeout Management
- **Connection Timeout**: 5 seconds
- **Message Timeout**: 5 seconds
- **Total Operation Timeout**: ~30-60 seconds for full configuration

---

## Security Considerations

### Network Security
- Atlas devices should be on isolated VLAN
- Firewall rules should restrict access to port 5321
- No authentication on TCP protocol (device-level security only)

### Data Validation
- All parameter values validated against Atlas specification ranges
- JSON-RPC message structure validated
- Response IDs matched to request IDs to prevent injection

### File System Security
- Configuration files stored with appropriate permissions
- Backup files timestamped to prevent overwriting
- No sensitive credentials stored in configuration files

---

## Future Enhancements

### Potential Improvements
1. **WebSocket Support**: Real-time meter monitoring
2. **Subscribe/Unsubscribe**: Live parameter updates
3. **Connection Pooling**: Persistent connection for faster operations
4. **Configuration Comparison**: Diff tool to show changes
5. **Auto-Sync**: Periodic background synchronization
6. **Change Notifications**: Alert on configuration mismatches

---

## References

### Documentation
- **Atlas Third-Party Control Manual**: `ATS006993-B-AZM4-AZM8-3rd-Party-Control.pdf`
- **Atlas Data Sheet**: `ATS007275-Atmosphere-Data-Sheet_RevE.pdf`
- **User Manual**: `ATS006332_Atmosphere_User_Manual_RevE.pdf`

### API Endpoints
- Download Configuration: `POST /api/atlas/download-config`
- Upload Configuration: `POST /api/atlas/upload-config`
- Route Matrix to Zone: `POST /api/atlas/route-matrix-to-zone`
- Recall Scene: `POST /api/atlas/recall-scene`

### Code Files
- TCP Client Library: `src/lib/atlas-tcp-client.ts`
- Download API: `src/app/api/atlas/download-config/route.ts`
- Upload API: `src/app/api/atlas/upload-config/route.ts`

---

## Support

### Getting Help
1. Check PM2 logs: `pm2 logs sports-bar-tv | grep -i atlas`
2. Review this documentation
3. Test device connectivity: `nc -zv 192.168.5.101 5321`
4. Check device web interface at http://192.168.5.101
5. Consult Atlas user manual for device-specific issues

### Reporting Issues
When reporting Atlas TCP issues, include:
- PM2 log output with Atlas messages
- Network connectivity test results
- Device firmware version
- Configuration file content (if applicable)
- Exact error messages received

---

**Last Updated**: October 17, 2025
**Author**: AI Assistant
**Version**: 1.0.0
