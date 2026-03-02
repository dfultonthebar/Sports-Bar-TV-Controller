
# Wolfpack Matrix AI Knowledge Base

## Overview
This knowledge base provides comprehensive information about Wolfpack modular matrix switchers for AI-powered analysis and optimization.

## Matrix Switcher Capabilities

### Supported Models
- **36x36 Matrix**: 36 inputs, 36 outputs, full crosspoint switching
- **Modular Design**: Expandable card cage architecture
- **Protocol Support**: HTTP web API (port 80) - primary and recommended
- **Scene Management**: Save and recall routing configurations
- **Real-time Control**: Immediate switching with status feedback

### Communication Protocols

#### HTTP Web API (Port 80) - Primary
- **Login**: `POST /login.php` with `username=admin&password=admin` (form-encoded)
- **Route**: `GET /get_json_cmd.php?cmd=o2ox&prm={input_0based},{output_0based},` with session cookie
- **Response**: JSON array where index = output (0-based), value = input (0-based)
- **Verification**: Check `responseArray[output] === input` to confirm route took effect
- **Value 65535**: Indicates disconnected/unused output slot
- **Recommended**: For all operations - the only reliable control method

#### CRITICAL WARNING: TCP Port 5000 is Non-Functional
- TCP port 5000 responds "OK" to ANY command (including garbage) but NEVER actually switches routes
- This has been confirmed on all Wolf Pack units tested
- Do NOT use TCP port 5000 for control - it will appear to work but routes won't change
- TCP/UDP code is preserved in the codebase as legacy fallback only

## Command Reference

### Basic Switching Commands

#### Input to All Outputs
- **Command**: `YAll.` (where Y = input number)
- **Example**: `1ALL.` switches input 1 to all outputs
- **Use Case**: Emergency broadcasts, global content distribution
- **Response**: `OK` on success, `ERR` on failure

#### One-to-One Mapping
- **Command**: `All1.`
- **Function**: Maps input 1→output 1, input 2→output 2, etc.
- **Use Case**: System reset, default configuration
- **Best Practice**: Use during maintenance or setup

#### Single Input to Output
- **Command**: `YXZ.` (Y=input, Z=output)
- **Example**: `1X2.` switches input 1 to output 2
- **Most Common**: Primary switching operation
- **Validation**: Always verify with status query after switching

#### Multi-Output Switching
- **Command**: `YXZ&Q&W.` (Y=input, Z,Q,W=outputs)
- **Example**: `1X2&3&4.` switches input 1 to outputs 2, 3, and 4
- **Efficiency**: Single command for multiple operations
- **Limitation**: Maximum outputs per command varies by model

### Scene Management Commands

#### Save Scene
- **Command**: `SaveY.` (Y = scene number)
- **Example**: `Save2.` saves current routing to scene 2
- **Capacity**: Typically 8-16 scenes depending on model
- **Best Practice**: Document scene contents for operators

#### Recall Scene
- **Command**: `RecallY.` (Y = scene number)
- **Example**: `Recall2.` restores saved scene 2
- **Speed**: Fastest way to implement complex routing changes
- **Use Case**: Event-based configurations, emergency scenarios

### System Control Commands

#### Buzzer Control
- **Commands**: `BeepON.` and `BeepOFF.`
- **Function**: Enable/disable audible feedback
- **Recommendation**: Turn off in noise-sensitive environments
- **Default**: Usually enabled on factory reset

#### Status Query
- **Command**: `Y?.` (Y = input number)
- **Example**: `1?.` returns routing status for input 1
- **Response**: Lists all outputs receiving this input
- **Usage**: Troubleshooting, verification, status monitoring

## Performance Characteristics

### Switching Speed
- **Typical**: <100ms for single operation
- **Optimal**: <50ms under ideal network conditions
- **Factors**: Network latency, protocol choice, system load

### Network Requirements
- **Bandwidth**: Minimal (<1KB per command)
- **Latency**: <10ms recommended for real-time control
- **Stability**: Wired connections preferred over WiFi
- **Redundancy**: Consider backup control paths for critical systems

## Common Issues and Solutions

### Connection Problems

#### "Cannot Connect" Errors
- **Causes**: Incorrect IP address, network issues, matrix power state
- **Solutions**: 
  1. Verify IP address configuration
  2. Test network connectivity with ping
  3. Check matrix power status and network cables
  4. Verify firewall settings on control device

#### Intermittent Disconnections
- **Causes**: Network instability, IP conflicts, power issues
- **Solutions**:
  1. Switch to wired connection if using WiFi
  2. Check for IP address conflicts
  3. Implement connection retry logic
  4. Monitor power supply stability

### Command Execution Issues

#### "ERR" Responses
- **Causes**: Invalid commands, out-of-range values, syntax errors
- **Solutions**:
  1. Verify command syntax (always end with period)
  2. Check input/output range (1-36 for 36x36 matrix)
  3. Ensure proper case formatting
  4. Test with simple commands first

#### Slow Response Times
- **Causes**: Network congestion, protocol choice, system overload
- **Solutions**:
  1. Ensure protocol is set to HTTP (not TCP/UDP)
  2. Reduce network traffic during operations
  3. Implement command queuing to avoid overload
  4. Check matrix CPU usage and memory

### Configuration Issues

#### Duplicate Labels
- **Problem**: Multiple inputs/outputs with same name
- **Impact**: Operator confusion, routing errors
- **Solution**: Use unique, descriptive labels for all channels

#### Missing Layout Mapping
- **Problem**: Outputs not mapped to physical TV locations
- **Impact**: Inefficient operations, wrong content on TVs
- **Solution**: Implement location-based labeling system

## Optimization Strategies

### Routing Efficiency

#### Group Similar Operations
- Use multi-output commands when possible
- Batch scene recalls for complex changes
- Minimize single-operation commands during busy periods

#### Strategic Scene Usage
- Create scenes for common configurations
- Use descriptive scene names
- Update scenes when layout changes

### Network Optimization

#### Protocol Selection
- **HTTP for everything**: The only functional control protocol
- **TCP/UDP are non-functional**: Port 5000 responds OK but never switches
- **Verification built-in**: HTTP response includes routing map for confirmation

#### Connection Management
- Implement connection pooling
- Use persistent connections when possible
- Monitor connection health continuously

## Integration Best Practices

### Audio Routing Integration
- Map matrix audio outputs to Atlas audio inputs
- Use consistent naming between systems
- Monitor for audio routing conflicts
- Implement audio-follow-video logic where appropriate

### Layout System Integration
- Synchronize output labels with TV positions
- Import layout data for automatic mapping
- Validate physical connections match configuration
- Update both systems when layout changes

### Monitoring and Logging
- Log all switching operations with timestamps
- Monitor command success rates
- Track performance metrics (latency, errors)
- Implement alerting for system issues

## AI Analysis Patterns

### Normal Operation Indicators
- Command success rate >95%
- Response times <200ms
- Stable network connections
- Proper label configuration

### Warning Signs
- Increasing error rates
- Growing response times
- Frequent disconnections
- Configuration inconsistencies

### Critical Issues
- Connection failures
- Command rejection
- System unresponsiveness
- Hardware fault indicators

## Future Enhancements

### Advanced Features
- **Automatic failover**: Switch to backup inputs on signal loss
- **Load balancing**: Distribute content across multiple outputs
- **Intelligent routing**: AI-driven content distribution
- **Predictive maintenance**: Early warning for hardware issues

### Integration Opportunities
- **Voice control**: Natural language matrix control
- **Mobile apps**: Remote switching capabilities
- **Analytics**: Usage patterns and optimization recommendations
- **Session caching**: Reuse HTTP sessions to reduce login overhead

## dbx ZonePRO Audio Processor Integration

### Overview
The dbx ZonePRO series integrates with the Wolf Pack matrix for audio zone routing. Wolf Pack audio outputs feed into dbx ZonePRO inputs, allowing coordinated control of both video routing and audio zone management from a single interface.

### Supported Models
- **640 / 640m**: 6x4 zone processor
- **641 / 641m**: 6x4 zone processor with CobraNet
- **1260 / 1260m**: 12x6 zone processor
- **1261 / 1261m**: 12x6 zone processor with CobraNet

The "m" variants are M-series models compatible with third-party TCP control.

### Communication Protocol

#### TCP Control (Port 3804) - Primary
- **Port**: 3804
- **Protocol**: Raw HiQnet frames over TCP (no prefix, no checksum)
- **Framing**: Version(01) + Length(4) + SrcVD(2) + SrcObj(4) + DstVD(2) + DstObj(4) + MsgID(2) + Flags(2) + Payload
- **Source VD**: 0x0033 (third-party controller identifier)
- **Message ID**: 0x0100 (MultiSVSet) for control commands
- **Flags**: 0x0500 (hop count 5)
- **Fire-and-forget**: No response is expected from the device (open-loop protocol)

#### RS-232 vs TCP Framing Differences
- **RS-232**: Uses `F0/64/00` prefix bytes and a trailing checksum
- **TCP**: Raw HiQnet frames with NO prefix and NO checksum
- **CRITICAL**: Do not mix framing formats — TCP connections using RS-232 framing will fail silently

### State Variable (SV) IDs

| SV ID  | Function | Data Type | Range           | Notes                          |
|--------|----------|-----------|-----------------|--------------------------------|
| 0x0000 | Source   | UBYTE     | 0-N (site-specific) | Input source selection     |
| 0x0001 | Volume   | UWORD     | 0-415           | Fader level                    |
| 0x0002 | Mute     | UBYTE     | 0 or 1          | 0=unmuted, 1=muted             |

### Volume Safety
- **Safe testing range**: Do not exceed 125 during testing
- **Normal listening level**: Approximately 95
- **Maximum value**: 415 (full scale — dangerously loud in most environments)

### CRITICAL: Failsafe Mode on TCP Connection

**Problem**: Every new TCP connection to the dbx ZonePRO triggers the device's failsafe mode, which shifts source routing indices. This causes audio sources to change unexpectedly (e.g., Spotify input shifts to S/PDIF).

**Solution**: Auto-recall Scene 1 on every new TCP connection. The `sceneOnConnect` feature in the `DbxTcpClient` handles this automatically.

**Why this matters**: Without the scene recall, the first command after connecting will appear to work but the source indices will be wrong, routing audio to incorrect inputs.

### Source Mapping
- Source indices are **site-specific** and configured in the ZonePRO Designer software
- Index 0 typically means "None" (no source selected)
- Each site must have its source mapping documented separately
- Source indices are 0-based unsigned bytes

### Integration with Wolf Pack Matrix

#### Audio Routing Chain
```
Wolf Pack Audio Output → Physical Cable → dbx ZonePRO Input → Zone Speaker
```

#### Coordinated Switching
- Changing a Wolf Pack audio route requires **also** updating the dbx source selection to match
- The bartender remote audio tab handles both operations:
  1. Routes the Wolf Pack matrix audio output to the correct input
  2. Sends the corresponding dbx source selection command
- Failure to update both systems results in audio mismatch (wrong source playing in a zone)

#### Object ID Format
- Object IDs follow the pattern: `0x0105XXXX` where `XXXX` is derived from the device node address and zone number
- Each zone (channel) has a unique object ID configured in ZonePRO Designer
- Object IDs must be confirmed per-site — they are not automatically discoverable

### Troubleshooting

#### No Audio After Switching
1. Verify Wolf Pack audio route is correct (check HTTP API response)
2. Verify dbx source selection matches the Wolf Pack routing
3. Check if failsafe mode triggered (scene recall should handle this automatically)
4. Confirm the dbx zone is not muted

#### Source Index Mismatch
- **Symptom**: Audio plays from wrong source after switching
- **Cause**: Failsafe mode shifted indices, or scene recall failed
- **Fix**: Ensure `sceneOnConnect` is enabled; manually recall Scene 1 if needed

#### Connection Refused on Port 3804
- **Cause**: Another controller (e.g., ZonePRO Designer PC) may hold an exclusive connection
- **Fix**: Disconnect other controllers or implement connection sharing
- **Note**: The dbx only supports a limited number of concurrent TCP connections
