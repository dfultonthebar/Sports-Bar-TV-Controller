
# Input Level Monitoring for AtlasIED Atmosphere Processors

This guide explains how to use the new input level monitoring feature for AtlasIED Atmosphere audio processors to monitor live band inputs and other audio sources.

## Overview

The input level monitoring feature allows you to:
- Monitor real-time audio input levels from live bands, microphones, and other audio sources
- Set custom warning and danger thresholds for each input
- Track peak levels to identify clipping or distortion
- Receive visual alerts when levels are too high or too low
- View historical data and connection status

## How It Works

The system uses the AtlasIED Atmosphere's built-in API to monitor `SourceMeter_X` parameters:
- **TCP Port 5321**: Used for subscribing to meter updates
- **UDP Port 3131**: Receives real-time meter data
- **Updates**: Level data is updated every 2 seconds
- **Keep-Alive**: Automatic connection maintenance every 4 minutes

## Setting Up Input Level Monitoring

### Step 1: Configure the Processor Parameter Names

1. Access your AtlasIED processor's web interface
2. Go to **Settings > Third Party Control > Message Table**
3. Note the parameter names for your input sources (e.g., `SourceMeter_0`, `SourceMeter_1`)
4. These names will be needed when adding input meters

### Step 2: Add Input Meters

1. Go to the **Audio Processors** section in the Sports Bar AI Assistant
2. Select your processor tab
3. Click on the **Input Levels** tab
4. Click **Add Input** button
5. Fill in the form:
   - **Input Number**: 0-based index (e.g., 0 for first input)
   - **Parameter Name**: From Step 1 (e.g., `SourceMeter_0`)
   - **Input Name**: Friendly name like "Live Band Input"
   - **Warning Threshold**: Yellow alert level (default: -12dB)
   - **Danger Threshold**: Red alert level (default: -3dB)

### Step 3: Monitor Levels

Once configured, the system will:
- Automatically subscribe to meter updates from the processor
- Display real-time level meters with color coding:
  - **Green**: Normal levels (below warning threshold)
  - **Yellow**: Warning levels (between warning and danger)
  - **Red**: Danger levels (above danger threshold)
  - **Gray**: No signal or connection issues

## Using the Interface

### Level Meter Display

Each input meter shows:
- **Current Level**: Real-time dB level (-80dB to 0dB)
- **Peak Level**: Highest level recorded since last reset
- **Visual Meter**: Color-coded bar with threshold markers
- **Status Badge**: Connection and signal status
- **Last Update**: Timestamp of most recent data

### Key Features

- **Real-Time Updates**: Levels update every 2 seconds
- **Peak Hold**: Track maximum levels to identify clipping
- **Reset Peaks**: Clear peak levels for all inputs
- **Threshold Markers**: Visual indicators on meter bars
- **Connection Status**: Shows if data is actively being received

## Monitoring Live Bands

### Recommended Settings for Live Music

**For Live Band Inputs:**
- Warning Threshold: -15dB (prevents feedback)
- Danger Threshold: -6dB (prevents clipping)

**For Microphone Inputs:**
- Warning Threshold: -18dB (vocal clarity)
- Danger Threshold: -9dB (prevents distortion)

### Best Practices

1. **Sound Check**: Monitor levels during band sound check
2. **Peak Monitoring**: Watch for red peaks during performance
3. **Feedback Prevention**: Yellow warnings indicate potential feedback
4. **Communication**: Use visual status to communicate with band
5. **Documentation**: Note optimal levels for each band/venue

## Troubleshooting

### No Signal Status
- Check processor IP address and network connectivity
- Verify parameter names in processor's Message Table
- Ensure TCP port 5321 and UDP port 3131 are accessible
- Test connection using the "Test Connection" button

### Stale Data
- Data is considered stale if no updates for 30+ seconds
- Check network connectivity to processor
- Verify processor is online and responding
- Restart monitoring by toggling processor connection

### Level Reading Issues
- Ensure correct parameter names from processor's Message Table
- Check input is actually connected and receiving signal
- Verify processor firmware supports meter reporting
- Parameter names are case-sensitive

## Network Requirements

The monitoring feature requires network access to:
- **TCP Port 5321**: For subscription management
- **UDP Port 3131**: For real-time meter data
- **HTTP Port 80/443**: For processor web interface (optional)

Ensure firewall rules allow these connections between the Sports Bar AI Assistant and the AtlasIED processors.

## Technical Details

### API Commands Used

**Subscribe to Input Level:**
```json
{"jsonrpc":"2.0","method":"sub","params":{"param":"SourceMeter_0","fmt":"val"}}
```

**Keep-Alive Message:**
```json
{"jsonrpc":"2.0","method":"get","params":{"param":"KeepAlive","fmt":"str"}}
```

### Data Format

**Meter Update (UDP):**
```json
{"jsonrpc":"2.0","method":"set","params":{"param":"SourceMeter_0","val":-25.5}}
```

- **Level Range**: -80dB to 0dB
- **Update Frequency**: ~100ms (filtered to 2s in UI)
- **Connection**: Automatic reconnection on failure

## Support

For technical support or questions about input level monitoring:
1. Check processor documentation and firmware version
2. Verify network connectivity and port access
3. Review processor's Third Party Control Message Table
4. Contact AtlasIED support for processor-specific issues

---

*This feature requires AtlasIED Atmosphere processors with Third Party Control enabled and network connectivity.*

