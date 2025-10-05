
# CEC TV Discovery System

## Overview

The CEC TV Discovery system automatically detects TV brands connected to WolfPack matrix outputs using the CEC (Consumer Electronics Control) protocol. This information is then used to optimize CEC commands with brand-specific timing configurations.

## Features

### Automatic Brand Detection
- **OSD Name Query**: Queries each TV via CEC for its On-Screen Display name
- **Brand Recognition**: Intelligently parses OSD names to identify major TV brands
- **Physical Address Detection**: Captures CEC physical address for each TV
- **Database Storage**: Stores detected brand, model, and CEC address in the database

### Supported TV Brands
- Sony
- Samsung
- LG
- TCL
- Vizio
- Panasonic
- Philips
- Sharp
- Hisense
- Toshiba

### Integration with Enhanced CEC Control
- Brand-specific timing configurations automatically applied
- Optimized delays for power commands, input switching, and volume control
- Seamless integration with existing CEC infrastructure

## How It Works

### Discovery Process

1. **CEC Configuration Check**
   - Verifies CEC is enabled
   - Confirms CEC input channel is configured
   - Validates CEC server connection

2. **Output Enumeration**
   - Retrieves all active WolfPack outputs from database
   - Filters by active status to avoid querying unused outputs

3. **Sequential Discovery**
   - Routes to each output via WolfPack matrix
   - Waits for brand-specific routing delay
   - Sends CEC "Give OSD Name" command
   - Sends CEC "Give Physical Address" command
   - Parses responses to extract brand and model information

4. **Database Update**
   - Updates MatrixOutput record with discovered information:
     - `tvBrand`: Detected TV brand (e.g., "Sony", "Samsung")
     - `tvModel`: Full OSD name from TV
     - `cecAddress`: CEC physical address
     - `lastDiscovery`: Timestamp of discovery

5. **Results Reporting**
   - Returns success/failure status for each output
   - Provides error details for failed discoveries
   - Displays comprehensive results in UI

## Database Schema

### MatrixOutput Model Updates

```prisma
model MatrixOutput {
  id            String   @id @default(cuid())
  configId      String
  channelNumber Int
  label         String
  resolution    String   @default("1080p")
  status        String   @default("active")
  audioOutput   String?
  tvBrand       String?  // Auto-detected TV brand
  tvModel       String?  // Auto-detected TV model
  cecAddress    String?  // CEC physical address
  lastDiscovery DateTime? // Last discovery timestamp
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  configuration MatrixConfiguration @relation(fields: [configId], references: [id], onDelete: Cascade)
  
  @@unique([configId, channelNumber])
}
```

## API Endpoints

### POST /api/cec/discovery

Run CEC discovery on all outputs or a specific output.

**Request Body:**
```json
{
  "outputNumber": 1  // Optional: Discover specific output only
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "outputNumber": 1,
      "label": "Main Bar TV",
      "brand": "Sony",
      "model": "Sony KD-55X80J",
      "cecAddress": "1.0.0.0",
      "success": true
    },
    {
      "outputNumber": 2,
      "label": "Back Bar TV",
      "brand": "Samsung",
      "model": "Samsung QN50Q60A",
      "cecAddress": "2.0.0.0",
      "success": true
    }
  ],
  "message": "Discovery complete: 2/2 TVs detected"
}
```

### GET /api/cec/discovery

Get last discovery results from database.

**Response:**
```json
{
  "success": true,
  "outputs": [
    {
      "outputNumber": 1,
      "label": "Main Bar TV",
      "brand": "Sony",
      "model": "Sony KD-55X80J",
      "cecAddress": "1.0.0.0",
      "lastDiscovery": "2025-10-01T12:00:00Z",
      "discovered": true
    }
  ]
}
```

## User Interface

### CEC Discovery Panel

Located at: **Device Configuration → CEC Discovery Tab**

**Features:**
- **Discover All Button**: Runs discovery on all active outputs
- **Per-Output Discovery**: Refresh button for individual output discovery
- **Status Indicators**: 
  - ✓ Detected (green badge) - TV successfully discovered
  - ✗ Not Detected (gray badge) - No TV detected or discovery failed
- **Information Display**:
  - TV brand and model
  - CEC physical address
  - Last discovery timestamp
- **Real-time Updates**: UI updates automatically after discovery completes

### Discovery Panel Layout

```
┌──────────────────────────────────────────────────────┐
│ 🖥️  CEC TV Discovery              [Discover All]     │
│ Automatically detect TV brands connected to outputs   │
├──────────────────────────────────────────────────────┤
│ ✅ Discovery complete: 2/2 TVs detected              │
├──────────────────────────────────────────────────────┤
│ Output 1: Main Bar TV                    ✓ Detected │
│   Brand: Sony                                   [↻] │
│   Model: Sony KD-55X80J                             │
│   CEC Address: 1.0.0.0                              │
│   Last Discovery: 10/1/2025, 12:00 PM               │
├──────────────────────────────────────────────────────┤
│ Output 2: Back Bar TV                    ✓ Detected │
│   Brand: Samsung                                [↻] │
│   Model: Samsung QN50Q60A                           │
│   CEC Address: 2.0.0.0                              │
│   Last Discovery: 10/1/2025, 12:00 PM               │
└──────────────────────────────────────────────────────┘
```

## Service Layer

### CEC Discovery Service

**File:** `src/lib/services/cec-discovery-service.ts`

**Key Functions:**

#### `discoverAllTVBrands()`
Discovers TV brands for all active matrix outputs.

```typescript
const results = await discoverAllTVBrands()
// Returns array of CECDiscoveryResult
```

#### `discoverSingleTV(outputNumber: number)`
Discovers TV brand for a specific output.

```typescript
const result = await discoverSingleTV(1)
// Returns single CECDiscoveryResult
```

#### `parseBrandFromOSD(osdName: string)`
Parses OSD name to extract brand information.

```typescript
const { brand, model } = parseBrandFromOSD("Sony KD-55X80J")
// Returns: { brand: "Sony", model: "Sony KD-55X80J" }
```

## Integration with Enhanced CEC Control

### Automatic Brand Detection

When sending CEC commands to a specific output, the system now:

1. Queries the database for the output's detected TV brand
2. Loads brand-specific timing configuration
3. Applies optimized delays based on the TV manufacturer
4. Logs the brand being used for debugging

**Code Example:**
```typescript
// In /api/cec/enhanced-control route
const output = await prisma.matrixOutput.findFirst({
  where: { channelNumber: outputNumber }
})

if (output?.tvBrand) {
  brandConfig = getBrandConfig(output.tvBrand)
  console.log(`Using brand-specific config for ${output.tvBrand}`)
}
```

### Brand-Specific Timing

Each brand has optimized timing for:
- Power on delays (2-6 seconds)
- Power off delays (1-3 seconds)
- Volume control delays (100-300ms)
- Input switching delays (1-4 seconds)

See `src/lib/tv-brands-config.ts` for full configuration details.

## Setup and Configuration

### Prerequisites

1. **CEC Hardware**
   - Pulse-Eight USB CEC Adapter connected to server
   - CEC bridge software running (see `cec-bridge-setup.md`)

2. **WolfPack Matrix**
   - Configured with at least one CEC input channel
   - TVs connected to output channels via HDMI

3. **CEC Configuration**
   - Navigate to: **Device Configuration → Settings**
   - Set CEC Input Channel (e.g., Input 32)
   - Set CEC Server IP and Port
   - Enable CEC

### Running Your First Discovery

1. Navigate to **Device Configuration → CEC Discovery**
2. Ensure all TVs are powered on
3. Click **Discover All** button
4. Wait for discovery to complete (may take several minutes)
5. Review results and verify detected brands

### Best Practices

- **TV Power State**: TVs must be powered on for discovery to work
- **Discovery Timing**: Allow 2-3 seconds per TV for complete discovery
- **Interference**: Ensure no other CEC commands are being sent during discovery
- **Verification**: After discovery, test CEC commands to verify correct operation
- **Re-Discovery**: Run discovery again if you replace or add TVs

## Troubleshooting

### Common Issues

**Issue: "CEC is not enabled"**
- Solution: Enable CEC in Device Configuration → Settings
- Set CEC input channel before running discovery

**Issue: "No OSD name returned"**
- Cause: TV not responding to CEC commands
- Solutions:
  - Verify TV is powered on
  - Check HDMI cable connections
  - Enable CEC on TV (may be called "HDMI-CEC", "Anynet+", "Bravia Sync", etc.)
  - Verify CEC server is running

**Issue: Brand detected as "Unknown"**
- Cause: OSD name doesn't match known brand patterns
- Solutions:
  - Review OSD name in model field
  - Add brand pattern to `parseBrandFromOSD()` function
  - Manually set TV brand in database if needed

**Issue: Discovery hangs or times out**
- Cause: CEC command timeout or routing failure
- Solutions:
  - Check WolfPack matrix connectivity
  - Verify CEC server accessibility
  - Increase timeout values in service
  - Check for HDMI signal issues

**Issue: Inconsistent results between runs**
- Cause: CEC bus contention or timing issues
- Solutions:
  - Ensure no other devices are sending CEC commands
  - Increase delays between queries
  - Power cycle problematic TVs
  - Check for HDMI signal amplifiers that may block CEC

### Debug Logging

Discovery process logs to console:
```
[CEC Discovery] Starting discovery for 8 outputs...
[CEC Discovery] Processing output 1: Main Bar TV
[CEC Discovery] Routing to output 1...
[CEC Discovery] Querying CEC device on output 1...
[CEC Discovery] Output 1: Detected Sony - Sony KD-55X80J
[CEC Discovery] Discovery complete. 8/8 devices detected.
```

### Manual Database Updates

If needed, you can manually update TV brand information:

```sql
UPDATE MatrixOutput 
SET tvBrand = 'Sony', 
    tvModel = 'Sony KD-55X80J',
    lastDiscovery = datetime('now')
WHERE channelNumber = 1;
```

## Future Enhancements

### Planned Features

1. **Automatic Periodic Discovery**
   - Schedule discovery to run automatically (e.g., weekly)
   - Detect TV replacements and notify administrators

2. **Brand-Specific Command Profiles**
   - Store discovered TV's supported CEC features
   - Customize available commands per TV brand

3. **Discovery History**
   - Track discovery history for each output
   - Alert on brand changes or detection failures

4. **Bulk Configuration**
   - Apply settings to all TVs of same brand
   - Batch update firmware settings via CEC

5. **AI-Enhanced Discovery**
   - Machine learning for better brand recognition
   - Predictive maintenance based on CEC response patterns
   - Automatic optimization of timing parameters

## Technical Details

### CEC Protocol

**OSD Name Command (0x46):**
- Request device to report its name
- Response format: "Set OSD Name" (0x47) with device name

**Physical Address Command (0x83):**
- Request device to report its HDMI physical address
- Response format: "Report Physical Address" (0x84) with address

### Timing Considerations

- **Routing Delay**: 2 seconds to ensure stable HDMI signal
- **Command Timeout**: 5 seconds to wait for response
- **Inter-Query Delay**: 1 second between consecutive queries
- **Total Time**: Approximately 3-4 seconds per output

### Error Handling

- Graceful failure: Individual output failures don't stop discovery
- Detailed error messages for debugging
- Status tracking per output
- Retry capability via per-output discovery

## Conclusion

The CEC TV Discovery system provides automatic detection and configuration of TV brands throughout your venue. This enables optimized CEC command timing, improves reliability, and simplifies system management. Combined with the enhanced CEC control and brand-specific configurations, it creates a robust and intelligent TV control solution.

For questions or issues, refer to the troubleshooting section or consult the main documentation.

---

**Version:** 1.0
**Last Updated:** October 1, 2025
**Related Documentation:**
- `CEC_POWER_CONTROL_IMPLEMENTATION.md`
- `cec-bridge-setup.md`
- `ATLAS_CONFIGURATION_SUMMARY.md`

