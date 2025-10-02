# AI-Powered Input Gain Control System

## Overview

This feature implements comprehensive input level monitoring and AI-powered automatic gain adjustment for AtlasIED AZMP8 audio processors. The system maintains optimal audio levels at a target of -3dB across all line-level inputs while providing real-time visual feedback through VU meters.

## Features

### 1. Real-Time Input Level Monitoring
- **Visual VU Meters**: Vertical bar meters for each input showing current audio levels
- **Color-Coded Display**: 
  - Green: Normal levels (-20 to -3 dB)
  - Yellow: Warning levels (-3 to 0 dB)
  - Red: Clipping (0 dB and above)
- **Live Updates**: Meter updates every 500ms for real-time monitoring
- **Peak Indicators**: White line showing peak levels
- **Numerical Display**: Current dB level shown below each meter

### 2. AI-Powered Gain Adjustment
- **Target Level**: Automatically adjusts all inputs to -3dB
- **Smart Adjustment Speed**:
  - **Fast Mode**: When audio is present and below -10dB, increases gain by 3dB per adjustment
  - **Slow Mode**: Once at -10dB, increases by 1dB per adjustment until reaching -3dB target
  - **Idle Mode**: Maintains target level with no adjustments needed
  - **Waiting Mode**: Pauses adjustments when no audio is detected
- **Audio Presence Detection**: 
  - Monitors for audio above -40dB threshold
  - Waits for actual audio source before adjusting (prevents adjusting noise floor)
  - Enters waiting mode after 60 seconds of silence

### 3. Input Type Management
- **Line-Level Inputs**: Full AI gain control enabled
- **Microphone Inputs**: AI control disabled to prevent feedback
- **Per-Input Configuration**: Each input can be individually set as mic or line

### 4. Manual Override
- **Manual Gain Control**: Slider to manually adjust gain from -20dB to +20dB
- **Override AI**: Manual adjustments temporarily override AI control
- **Real-Time Application**: Changes applied immediately to the processor

### 5. Alert System
- **Clipping Alerts**: Immediate notification when inputs exceed 0dB
- **Low Level Warnings**: Alerts for inputs below -50dB
- **Visual Indicators**: Color-coded alert cards at top of interface

### 6. Adjustment Logging
- **Complete History**: All gain adjustments logged with timestamps
- **Adjustment Context**: Records level, target, mode, and reason for each change
- **Success/Failure Tracking**: Logs both successful and failed adjustments
- **Query API**: Retrieve adjustment history for any input

## Database Schema

### AIGainConfiguration Table
Stores AI gain control settings for each input:
- Input type (mic/line)
- AI enabled status
- Target level and thresholds
- Current gain setting
- Adjustment mode and parameters
- Safety limits (min/max gain)
- Adjustment statistics

### AIGainAdjustmentLog Table
Logs all gain adjustments:
- Timestamp and input details
- Previous and new gain values
- Input level and target level
- Adjustment mode and reason
- Success status and error messages

## API Endpoints

### Input Gain Control
- `GET /api/audio-processor/[id]/input-gain` - Read current gain settings
- `POST /api/audio-processor/[id]/input-gain` - Set gain for specific input

### AI Gain Configuration
- `GET /api/audio-processor/[id]/ai-gain-control` - Get AI settings for all inputs
- `POST /api/audio-processor/[id]/ai-gain-control` - Configure AI settings per input
- `DELETE /api/audio-processor/[id]/ai-gain-control` - Remove AI configuration

### Monitoring Service
- `GET /api/audio-processor/[id]/ai-monitoring` - Get monitoring status
- `POST /api/audio-processor/[id]/ai-monitoring` - Start/stop monitoring service

### Adjustment History
- `GET /api/audio-processor/[id]/adjustment-history` - Get adjustment history for an input

## Components

### AIGainControlPanel
Main integration component that provides:
- Tabbed interface (VU Meters, AI Controls, Information)
- Monitoring service control (Start/Stop)
- Status overview (AI-enabled count, active adjustments)
- Real-time status updates

### EnhancedInputLevelMonitor
Visual VU meter display:
- Grid layout of vertical bar meters
- Real-time level updates (500ms refresh)
- Color-coded status indicators
- Peak level tracking
- Alert notifications

### AIGainControl
Per-input control card:
- AI enable/disable toggle
- Input type selection (mic/line)
- Current status display (level, target, gain)
- Manual gain override slider
- Advanced settings view
- Status indicators (Fast/Slow/Idle/Waiting)

## Service Layer

### AIGainService
Background service that handles:
- Continuous monitoring (500ms intervals)
- AI gain adjustment logic
- Audio presence detection
- TCP communication with AZMP8
- Adjustment logging
- Error handling

## Usage Instructions

### Initial Setup

1. **Navigate to Audio Control Center**
   - Go to Audio Processor Manager
   - Select your AZMP8 processor

2. **Configure Input Meters**
   - Switch to "Input Levels" tab
   - Add input meters for inputs you want to monitor
   - Set appropriate warning/danger thresholds

3. **Enable AI Gain Control**
   - Switch to "AI Gain Control" tab
   - For each input:
     - Set input type (Line or Microphone)
     - Enable AI control toggle
     - Verify target level (-3dB default)

4. **Start Monitoring**
   - Click "Start Monitoring" button
   - Service begins continuous monitoring and adjustment
   - Monitor status shows "Active" with green indicator

### Daily Operation

1. **Monitor VU Meters**
   - Check "VU Meters" tab for real-time levels
   - Watch for clipping alerts (red)
   - Verify all inputs showing appropriate levels

2. **Review AI Status**
   - Check "AI Controls" tab
   - Verify adjustment modes:
     - Fast: Rapidly increasing gain
     - Slow: Fine-tuning to target
     - Idle: Target reached
     - Waiting: No audio detected

3. **Manual Adjustments**
   - Use manual gain slider when needed
   - Manual changes override AI temporarily
   - AI resumes automatic adjustment after manual change

### Troubleshooting

**Input Not Adjusting:**
- Verify AI is enabled for that input
- Check input type is set to "Line" (not Mic)
- Ensure monitoring service is running
- Check if input is in "Waiting" mode (no audio detected)

**Clipping Alerts:**
- Check if gain is too high
- Manually reduce gain if needed
- Verify source equipment output levels

**Low Level Warnings:**
- Check source equipment is powered on
- Verify cable connections
- Check if input is receiving audio signal

## Technical Details

### AZMP8 Input Configuration
- **Inputs 1-6**: Balanced mic/line (configurable)
- **Inputs 7-10**: RCA line-level only
- **Gain Range**: -20dB to +20dB
- **Communication**: TCP port 5321 (JSON-RPC)

### Adjustment Algorithm
```
1. Read current input level
2. Check if audio is present (> -40dB)
3. If silent for >60s, enter waiting mode
4. Calculate difference from target (-3dB)
5. Determine adjustment mode:
   - If level < -10dB: Fast mode (3dB steps)
   - If level >= -10dB: Slow mode (1dB steps)
6. Apply gain adjustment
7. Log adjustment
8. Wait 500ms before next check
```

### Safety Features
- Microphone inputs excluded from AI control
- Gain limits enforced (-20dB to +20dB)
- Audio presence detection prevents noise adjustment
- All adjustments logged for audit trail
- Manual override capability
- Per-input enable/disable control

## Performance Considerations

- **Monitoring Interval**: 500ms (2 updates per second)
- **Database Writes**: Only on actual adjustments (not every check)
- **TCP Connections**: Reused for efficiency
- **UI Updates**: Throttled to prevent excessive re-renders

## Future Enhancements

Potential improvements for future versions:
- Configurable target levels per input
- Time-based adjustment profiles
- Integration with scheduling system
- Advanced analytics and reporting
- Multi-processor coordination
- Preset configurations for different scenarios

## Files Created/Modified

### Database
- `prisma/schema.prisma` - Added AIGainConfiguration and AIGainAdjustmentLog models
- `prisma/migrations/20251002231714_ai_input_gain_control/` - Migration files

### API Routes
- `src/app/api/audio-processor/[id]/input-gain/route.ts` - Gain control endpoints
- `src/app/api/audio-processor/[id]/ai-gain-control/route.ts` - AI configuration endpoints
- `src/app/api/audio-processor/[id]/ai-monitoring/route.ts` - Monitoring service control
- `src/app/api/audio-processor/[id]/adjustment-history/route.ts` - History query endpoint

### Services
- `src/lib/ai-gain-service.ts` - Core AI gain adjustment service

### Components
- `src/components/AIGainControlPanel.tsx` - Main integration panel
- `src/components/AIGainControl.tsx` - Per-input control card
- `src/components/EnhancedInputLevelMonitor.tsx` - VU meter display
- `src/components/ui/slider.tsx` - Slider UI component
- `src/components/AudioProcessorManager.tsx` - Updated with AI Gain tab

## Support

For issues or questions:
1. Check adjustment logs for error messages
2. Verify processor connectivity
3. Review configuration settings
4. Check system logs for service errors

## License

Part of the Sports Bar TV Controller system.
