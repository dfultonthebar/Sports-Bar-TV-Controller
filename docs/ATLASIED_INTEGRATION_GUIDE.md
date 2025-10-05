
# 🎵 AtlasIED Atmosphere Audio Processor Integration Guide

## Overview

This guide provides complete setup and operation instructions for integrating AtlasIED Atmosphere audio processors (AZM4, AZM8, AZMP4, AZMP8, AZM4-D, AZM8-D) with your Sports Bar AI Assistant.

## Supported Models

### **Zone Controllers**
- **AZM4**: 4-Zone Signal Processor
- **AZM8**: 8-Zone Signal Processor

### **Powered Models** 
- **AZMP4**: 4-Zone Signal Processor + Amplifier (600W)
- **AZMP8**: 8-Zone Signal Processor + Amplifier (1200W)

### **Dante Models**
- **AZM4-D**: 4-Zone + Dante Network Audio
- **AZM8-D**: 8-Zone + Dante Network Audio
- **AZMP8-DW**: 8-Zone + Amp + Dante (Wall Mount)

## Network Setup Requirements

### **IP Configuration**
- Each processor needs a static IP address on your network
- Default web interface port: **80** (HTTP)
- Ensure processors are accessible from the AI Assistant server
- Recommended network: Same subnet as the AI Assistant

### **Network Requirements**
- **Minimum Speed**: 100 Mbps Ethernet
- **Latency**: < 10ms for real-time control
- **Firewall**: Allow HTTP (port 80) traffic to processors
- **DHCP Reservations**: Recommended for consistent IP addresses

## Initial Setup Process

### **1. Physical Installation**
1. Mount processors in equipment rack
2. Connect power (ensure proper grounding)
3. Connect Ethernet cable to network switch
4. Connect audio inputs/outputs as per AtlasIED documentation

### **2. Network Configuration**
1. Access processor web interface: `http://[processor-ip]`
2. Configure network settings (static IP recommended)
3. Set device name/location for easy identification
4. Test web interface accessibility from AI Assistant server

### **3. Sports Bar AI Assistant Configuration**
1. Navigate to **Management Panel** → **Audio Processors**
2. Click **"Add Processor"**
3. Fill in processor details:
   - **Name**: Descriptive name (e.g., "Main Bar Audio")
   - **Model**: Select appropriate model (AZM4, AZM8, etc.)
   - **IP Address**: Processor's network IP
   - **Port**: 80 (default)
   - **Description**: Optional location/purpose description

### **4. Connection Testing**
1. Click **"Test Connection"** button
2. Verify "Connection Successful" message
3. Status should show as "Online" with green indicator
4. Click **"Web Interface"** to access processor directly

## Zone Configuration

### **Adding Audio Zones**
1. Select processor from tabs
2. Click **"Add Zone"** button
3. Configure zone settings:
   - **Zone Number**: Physical zone on processor (1-4 or 1-8)
   - **Name**: Descriptive area name (e.g., "Main Dining")
   - **Description**: Optional details about coverage area
   - **Default Source**: Initial audio input

### **Zone Control Features**
- **Volume Control**: Adjust zone volume (0-100%)
- **Mute/Unmute**: Instant audio muting per zone
- **Source Selection**: Switch audio inputs per zone
- **Zone Status**: Real-time monitoring of zone settings

## Advanced Features

### **Scene Recall** (API Ready)
- Save and recall complete system settings
- Multiple scenes per processor
- Instant switching between configurations
- Integration with automation systems

### **Message Playback** (API Ready)
- Play stored messages to specific zones
- All-call and selective zone paging
- Message scheduling capabilities
- Custom audio file support

### **Room Combining** (API Ready)
- Dynamically group zones together
- Synchronized audio across multiple areas
- Event-based room configurations
- Temporary and permanent groupings

## Integration with Matrix System

### **Audio Routing Strategy**
1. **Video Matrix Outputs** → **Audio Processor Inputs**
   - Matrix Audio 1-4 outputs connect to AZM inputs
   - Synchronized A/V switching capability
   - Centralized source management

2. **Zone Mapping**
   - TV locations mapped to audio zones
   - Coordinated volume control
   - Unified source selection

### **Recommended Connections**
```
Wolf Pack Matrix → AtlasIED AZM8
- Matrix Audio 1 → AZM8 Input 1
- Matrix Audio 2 → AZM8 Input 2  
- Matrix Audio 3 → AZM8 Input 3
- Matrix Audio 4 → AZM8 Input 4
```

## API Control Examples

### **Volume Control**
```javascript
// Set zone 1 to 75% volume
POST /api/audio-processor/control
{
  "processorId": "processor-id",
  "command": {
    "action": "volume",
    "zone": 1,
    "value": 75
  }
}
```

### **Mute Control**
```javascript
// Mute zone 2
POST /api/audio-processor/control
{
  "processorId": "processor-id", 
  "command": {
    "action": "mute",
    "zone": 2,
    "value": true
  }
}
```

### **Source Selection**
```javascript
// Switch zone 3 to Input 2
POST /api/audio-processor/control
{
  "processorId": "processor-id",
  "command": {
    "action": "source",
    "zone": 3,
    "value": "Input 2"
  }
}
```

## Troubleshooting

### **Connection Issues**
- **Problem**: "Connection Failed" message
- **Solutions**:
  - Verify IP address is correct and reachable
  - Check network connectivity with ping test
  - Ensure processor web interface is enabled
  - Verify firewall settings allow HTTP traffic

### **Zone Control Problems** 
- **Problem**: Zone commands not responding
- **Solutions**:
  - Check processor web interface directly
  - Verify zone numbers match physical configuration
  - Restart processor if needed
  - Review processor logs for errors

### **Network Performance Issues**
- **Problem**: Slow response or timeouts
- **Solutions**:
  - Check network bandwidth utilization
  - Verify switch/router performance
  - Consider dedicated audio network segment
  - Update processor firmware if available

## Maintenance & Monitoring

### **Regular Health Checks**
- Monitor processor status indicators
- Review connection logs for patterns
- Test zone controls weekly
- Verify web interface accessibility

### **Preventive Maintenance**
- Keep processor firmware updated
- Monitor network switch performance
- Document zone assignments and changes
- Backup processor configurations

### **System Updates**
- Coordinate with AtlasIED for firmware updates
- Test connectivity after network changes
- Update AI Assistant to latest version
- Review and update zone configurations

## Best Practices

### **Naming Conventions**
- **Processors**: Location-based names (e.g., "Main Bar Audio", "Patio Audio")
- **Zones**: Area descriptions (e.g., "Main Dining", "VIP Section", "Outdoor Patio")
- **Sources**: Clear input identification (e.g., "Matrix Audio 1", "Bluetooth", "Microphone")

### **Documentation**
- Maintain zone-to-speaker mapping diagrams
- Document IP addresses and network settings
- Keep AtlasIED manuals accessible
- Record configuration changes with dates

### **Security Considerations**
- Use network segmentation for audio equipment
- Implement access controls for web interfaces
- Monitor for unauthorized configuration changes
- Regular security updates and patches

## Next Steps

1. **Configure Your First Processor**
   - Add your AtlasIED unit to the system
   - Test connectivity and basic controls
   - Configure initial zones

2. **Integrate with Matrix System** 
   - Connect audio outputs from video matrix
   - Map TV locations to audio zones
   - Test coordinated A/V switching

3. **Advanced Features**
   - Explore scene recall capabilities
   - Set up message playback system
   - Configure room combining for events

4. **Optimization**
   - Fine-tune volume levels per zone
   - Create automation rules
   - Monitor system performance

## Support Resources

- **AtlasIED Technical Support**: Available for processor-specific issues
- **Sports Bar AI Assistant Logs**: Check application logs for detailed error information
- **Network Diagnostics**: Built-in connection testing tools
- **GitHub Documentation**: Latest updates and feature additions

---

*For additional support or feature requests, refer to the main project documentation or contact your system administrator.*
