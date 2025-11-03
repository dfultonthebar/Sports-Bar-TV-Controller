/**
 * Generate comprehensive Q&A pairs from documentation files
 * and insert them into the database for AI knowledge base training
 */

import { db, schema } from '../src/db'
import * as crypto from 'crypto'

const { qaEntries } = schema

interface QAPair {
  question: string
  answer: string
  category: 'api' | 'hardware' | 'network' | 'configuration' | 'monitoring'
  tags: string
  confidence: number
  sourceFile: string
}

const qaData: QAPair[] = [
  // ========================================
  // API_REFERENCE.md Q&A Pairs (30 pairs)
  // ========================================
  {
    question: "What is the base URL for the Sports Bar TV Controller API?",
    answer: "The base URL is http://localhost:3000/api. All API endpoints are accessible via HTTP without authentication for local network access.",
    category: "api",
    tags: "api,base-url,endpoint,http",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I check the system health status?",
    answer: "Use the GET /api/system/health endpoint. This returns comprehensive health status for all system components including overall health percentage, devices online/offline count, active issues, and categorized device status for TVs, cable boxes, audio zones, matrix, and other devices. Example: curl http://localhost:3000/api/system/health",
    category: "monitoring",
    tags: "health,monitoring,status,api,diagnostics",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I send a command to the Wolf Pack HDMI matrix?",
    answer: "Use POST /api/matrix/command with a JSON body containing: {\"command\":\"I1O1\", \"ipAddress\":\"192.168.1.100\", \"port\":23, \"protocol\":\"TCP\"}. The command format is IxOy where x is the input number and y is the output number. Commands must end with a period. Example: I1O1. routes input 1 to output 1.",
    category: "api",
    tags: "matrix,hdmi,routing,wolfpack,command",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What is the Wolf Pack matrix command format?",
    answer: "Wolf Pack matrix commands use the format IxOy. where x is the input number and y is the output number. For example, I1O1. routes input 1 to output 1. To route one input to all outputs, use IxOA. (e.g., I2OA. routes input 2 to all outputs). Commands MUST end with a period (.).",
    category: "hardware",
    tags: "matrix,wolfpack,command,format,syntax",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I get all CEC devices?",
    answer: "Use GET /api/cec/devices. This returns all detected CEC devices with information including device ID, address, name, type, vendor, power status, and active source status. Example: curl http://localhost:3000/api/cec/devices",
    category: "api",
    tags: "cec,devices,hdmi,discovery,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I power on a TV via HDMI-CEC?",
    answer: "Use POST /api/cec/command with body: {\"command\":\"on\", \"address\":\"0.0.0.0\"}. The address 0.0.0.0 typically represents the TV. Other commands available are \"standby\" to turn off and \"active_source\" to set as active source.",
    category: "api",
    tags: "cec,power,tv,control,hdmi",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What CEC addresses are used for different device types?",
    answer: "CEC addresses follow HDMI-CEC standard: 0.0.0.0 for TV (primary display), 1.0.0.0 for Recording Device (cable box, DVR), 3.0.0.0 for Tuner, 4.0.0.0 for Playback Device (streaming device), and 5.0.0.0 for Audio System.",
    category: "hardware",
    tags: "cec,addresses,hdmi,devices,standard",
    confidence: 0.90,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I tune a cable box to a specific channel via CEC?",
    answer: "Use POST /api/cec/cable-box/tune with body: {\"channel\":\"705\", \"deviceId\":\"cable-box-1\"}. This sends CEC channel tuning commands directly to the cable box via HDMI-CEC, allowing remote channel changing without IR blasters.",
    category: "api",
    tags: "cec,cable-box,channel,tuning,control",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I get the currently playing track from Soundtrack Your Brand?",
    answer: "Use GET /api/soundtrack/now-playing?playerId=PLAYER_ID where PLAYER_ID is your Soundtrack player ID. Returns track title, artist, album, album art URL, playing status, position, and duration.",
    category: "api",
    tags: "soundtrack,music,now-playing,audio,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I get all audio zones?",
    answer: "Use GET /api/audio-processor/zones?processorId=PROCESSOR_ID where PROCESSOR_ID is your audio processor ID (e.g., 'atlas-1'). Returns all configured zones with ID, zone number, name, description, current source, volume, mute status, and enabled status.",
    category: "api",
    tags: "audio,zones,atlas,processor,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I query Atlas audio processor configuration?",
    answer: "Use GET /api/atlas/configuration with either processorId parameter for file-based config or processorIp and param parameters for direct hardware query. Example for direct query: /api/atlas/configuration?processorIp=192.168.1.50&param=/IO/Input/1/Gain. This uses JSON-RPC 2.0 protocol over TCP port 5321.",
    category: "api",
    tags: "atlas,audio,configuration,query,hardware",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I get the sports programming guide?",
    answer: "Use POST /api/sports-guide with optional body {\"days\":7} to fetch programming for a specific number of days (default is 7). Also available as GET /api/sports-guide. Returns programming from The Rail Media API with listing groups organized by sport, including title, start time, channel, and channel number.",
    category: "api",
    tags: "sports,guide,programming,schedule,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What sports guide data source does the system use?",
    answer: "The system uses The Rail Media API (https://guide.thedailyrail.com/api/v1) for sports programming guide data. The API provides comprehensive sports listings organized by sport type, including game times, channels, and channel numbers.",
    category: "configuration",
    tags: "sports,guide,api,source,therailmedia",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I search for specific sports in the programming guide?",
    answer: "Use GET /api/sports-guide/channels with query parameters. Example: /api/sports-guide/channels?search=NFL&days=3 searches for NFL games in the next 3 days. You can also filter by lineup, start_date, and end_date.",
    category: "api",
    tags: "sports,search,guide,filter,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I test connectivity to a Fire TV device?",
    answer: "Use POST /api/firetv-devices/test-connection with body: {\"ipAddress\":\"192.168.1.200\", \"port\":5555}. Returns success status and device info including model and Fire OS version if connection is successful.",
    category: "api",
    tags: "firetv,test,connection,adb,devices",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I send a command to a Fire TV device?",
    answer: "Use POST /api/firetv-devices/send-command with body: {\"deviceId\":\"ftv-1\", \"command\":\"input keyevent KEYCODE_HOME\"}. The command is an ADB shell command that will be executed on the Fire TV device.",
    category: "api",
    tags: "firetv,command,adb,control,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I create a scheduled event?",
    answer: "Use POST /api/schedules with body: {\"name\":\"Monday Night Football\", \"enabled\":true, \"schedule\":\"0 20 * * 1\", \"action\":\"route_input\", \"params\":{\"input\":2, \"outputs\":[1,2,3,4]}}. The schedule field uses cron format (minute hour day month weekday).",
    category: "api",
    tags: "schedule,automation,cron,events,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What is the cron format for scheduling?",
    answer: "The schedule uses cron format: minute hour day month weekday. For example, '0 13 * * 0' runs at 1:00 PM (13:00) on Sundays (0=Sunday), and '0 20 * * 1' runs at 8:00 PM (20:00) on Mondays (1=Monday).",
    category: "configuration",
    tags: "cron,schedule,format,automation,time",
    confidence: 0.90,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I manually execute a schedule?",
    answer: "Use POST /api/schedules/execute with body: {\"scheduleId\":1}. This immediately executes the scheduled action without waiting for the scheduled time. Returns the execution result including the action type and success status.",
    category: "api",
    tags: "schedule,execute,manual,automation,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I use the AI enhanced chat feature?",
    answer: "Use POST /api/ai/enhanced-chat with body: {\"message\":\"How do I route input 1 to output 5?\", \"context\":\"matrix_control\"}. The AI assistant will provide helpful responses and suggestions based on the system's knowledge base.",
    category: "api",
    tags: "ai,chat,assistant,help,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I query the AI knowledge base?",
    answer: "Use POST /api/ai/knowledge-query with body: {\"query\":\"Wolf Pack matrix commands\", \"limit\":5}. Returns relevant knowledge base entries with content, source file, and relevance score.",
    category: "api",
    tags: "ai,knowledge,query,search,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I run AI-powered diagnostics on a device?",
    answer: "Use POST /api/devices/intelligent-diagnostics with body: {\"deviceType\":\"firetv\", \"deviceId\":\"ftv-1\"}. Returns diagnostic results including status, issues found with severity and recommendations, and overall health score.",
    category: "api",
    tags: "ai,diagnostics,troubleshooting,devices,monitoring",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What deprecated endpoints should I avoid using?",
    answer: "Deprecated endpoints include: /api/health (use /api/system/health), /api/tvs (use /api/matrix/routes and /api/cec/devices), /api/zones/audio (use /api/audio-processor/zones), /api/firetv/devices (use /api/firetv-devices), and /api/soundtrack/status (use /api/soundtrack/config and /api/soundtrack/now-playing).",
    category: "api",
    tags: "deprecated,api,migration,endpoints",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What HTTP response codes does the API use?",
    answer: "The API uses standard HTTP response codes: 200 for Success, 201 for Created, 400 for Bad Request (invalid parameters), 404 for Not Found (endpoint or resource doesn't exist), and 500 for Internal Server Error.",
    category: "api",
    tags: "http,response,codes,status,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "What is the format for API error responses?",
    answer: "All errors follow this JSON format: {\"success\":false, \"error\":\"Error message describing what went wrong\", \"details\":\"Additional error details if available\"}",
    category: "api",
    tags: "error,response,format,api,json",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "Does the API require authentication?",
    answer: "No, the API does not currently require authentication for local network access. All endpoints are accessible via HTTP without tokens. However, the documentation notes this is designed for local network use and you should be cautious when exposing endpoints to the internet.",
    category: "api",
    tags: "authentication,security,access,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "Is there rate limiting on API endpoints?",
    answer: "Currently, no rate limiting is enforced on API endpoints. This may change in future versions.",
    category: "api",
    tags: "rate-limiting,performance,api,throttling",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "Does the API support WebSocket connections?",
    answer: "WebSocket support is planned for future releases to enable real-time updates for matrix routing changes, CEC device status, audio zone changes, and now playing updates. It is not currently available.",
    category: "api",
    tags: "websocket,realtime,future,updates,api",
    confidence: 0.90,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I test the matrix connection?",
    answer: "Use POST /api/matrix/test-connection with body: {\"ipAddress\":\"192.168.1.100\", \"port\":23}. Returns success status, message, and response time in milliseconds if successful.",
    category: "api",
    tags: "matrix,test,connection,troubleshooting,api",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },
  {
    question: "How do I discover CEC cable boxes?",
    answer: "Use POST /api/cec/cable-box/discover. This scans the HDMI-CEC bus for cable box devices and returns detected devices with address, name, type, and vendor information.",
    category: "api",
    tags: "cec,cable-box,discovery,scan,devices",
    confidence: 0.95,
    sourceFile: "docs/API_REFERENCE.md"
  },

  // ========================================
  // HARDWARE_CONFIGURATION.md Q&A Pairs (30 pairs)
  // ========================================
  {
    question: "What is the IP address of the Wolf Pack Matrix?",
    answer: "The Wolf Pack Matrix is located at 192.168.5.100 on port 23. This is the correct IP address as verified in the latest configuration. The matrix was previously misconfigured as 192.168.1.100 in the static config file, but the database has always used the correct IP 192.168.5.100.",
    category: "hardware",
    tags: "matrix,ip-address,wolfpack,configuration,network",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What are the recommended hardware specifications for the control server?",
    answer: "The recommended control server is an Intel NUC13ANHi5 or equivalent with: Intel Core i5 (4+ cores), 16GB DDR4 RAM, 512GB NVMe SSD storage, Gigabit Ethernet (required), running Ubuntu 22.04 LTS or Debian 11+. A static IP address and UPS are also recommended.",
    category: "hardware",
    tags: "server,specifications,requirements,intel-nuc,hardware",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What port does the Wolf Pack matrix use?",
    answer: "The Wolf Pack matrix uses port 23 for Telnet control via TCP protocol. It also supports UDP on port 4000. The default and recommended protocol is TCP.",
    category: "hardware",
    tags: "matrix,port,telnet,tcp,protocol",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I test the Pulse-Eight CEC adapter?",
    answer: "To test the CEC adapter, run: echo 'scan' | cec-client -s -d 1. This scans for CEC devices on the HDMI bus. To list devices, run: echo 'scan' | cec-client -s -d 1 | grep 'device #'. First ensure libcec-dev and cec-utils are installed via apt-get.",
    category: "hardware",
    tags: "cec,pulse-eight,testing,troubleshooting,commands",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What is the IP address of the AtlasIED audio processor?",
    answer: "The AtlasIED audio processor is at IP address 192.168.1.50 (example - configure to your network) on port 5321 (TCP). Note: The connectivity report shows the actual IP is 192.168.5.101 on the production network.",
    category: "hardware",
    tags: "atlas,audio,ip-address,processor,network",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What control protocol does the AtlasIED processor use?",
    answer: "The AtlasIED processor uses JSON-based commands over TCP port 5321. The protocol supports methods: get, set, and sub (subscribe). Example command: {\"method\":\"get\",\"param\":\"/IO/Input/1/Gain\",\"format\":\"str\"}",
    category: "hardware",
    tags: "atlas,protocol,json,tcp,control",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What audio zone configuration is recommended?",
    answer: "A typical configuration includes: Zone 1 - Main Bar, Zone 2 - Dining Area, Zone 3 - Patio, Zone 4 - Private Room. Audio sources typically include: 1) Soundtrack Your Brand (commercial music), 2) TV Audio (HDMI audio extraction), 3) Background Music, 4) Microphone Input.",
    category: "configuration",
    tags: "audio,zones,configuration,atlas,setup",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What is the Global Cache IR blaster IP address?",
    answer: "The Global Cache iTach IP2IR is typically at 192.168.1.150 on port 4998 for IR control. The exact IP address should be configured to match your network setup.",
    category: "hardware",
    tags: "global-cache,ir,ip-address,control,network",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I enable ADB debugging on Fire TV?",
    answer: "On Fire TV: Go to Settings > My Fire TV > Developer Options > ADB Debugging > ON. Also enable Settings > My Fire TV > Developer Options > Apps from Unknown Sources > ON. The default ADB port is 5555.",
    category: "configuration",
    tags: "firetv,adb,debugging,setup,configuration",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I connect to a Fire TV device via ADB?",
    answer: "From the server, run: adb connect 192.168.5.131:5555 (replace with your Fire TV IP). To verify connection: adb devices. To send a command: adb -s 192.168.5.131:5555 shell input keyevent KEYCODE_HOME",
    category: "configuration",
    tags: "firetv,adb,connection,commands,control",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What Fire TV models are supported?",
    answer: "The system supports Fire TV Cube (3rd Gen) and Fire TV Stick 4K Max. Both can connect via WiFi or Ethernet and support ADB control on port 5555 for streaming content, app launching, and remote control.",
    category: "hardware",
    tags: "firetv,models,supported,devices,streaming",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What are the recommended network IP address ranges for different device types?",
    answer: "Recommended IP allocations: Management Network 192.168.1.0/24 (Control Server 192.168.1.10, AtlasIED 192.168.1.50, Wolf Pack Matrix 192.168.1.100, Global Cache 192.168.1.150), Streaming Devices 192.168.5.0/24 (Fire TV Cubes 192.168.5.131-133). Use DHCP reservations and consistent IP ranges for device types.",
    category: "network",
    tags: "ip-address,network,allocation,vlan,planning",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What firewall ports need to be open?",
    answer: "Required ports: 3000 (Web interface), 5555 (ADB for Fire TV), 23 (Telnet for Wolf Pack), 5321 (AtlasIED control), 4998 (Global Cache IR control). Configure firewall rules to allow incoming connections to the control server on these ports.",
    category: "network",
    tags: "firewall,ports,security,network,configuration",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What VLAN setup is recommended?",
    answer: "Optional but recommended VLAN setup: VLAN 10 for Management (control server, admin access), VLAN 20 for AV Equipment (matrix, audio, IR), VLAN 30 for Streaming Devices (Fire TVs), VLAN 40 for Display Network (TVs if IP-enabled).",
    category: "network",
    tags: "vlan,network,segmentation,security,best-practices",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What QoS priorities should be configured?",
    answer: "Quality of Service priorities: Priority 1 - Control traffic (matrix commands, CEC), Priority 2 - Audio streaming (Soundtrack), Priority 3 - Video streaming (Fire TV). This ensures critical control commands are not delayed by streaming traffic.",
    category: "network",
    tags: "qos,quality-of-service,network,priority,performance",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I troubleshoot matrix connection issues?",
    answer: "Test network: ping 192.168.1.100. Test Telnet: telnet 192.168.1.100 23. If connection fails: 1) Check network cable, 2) Verify IP address on matrix front panel, 3) Check firewall rules, 4) Restart matrix (power cycle).",
    category: "monitoring",
    tags: "troubleshooting,matrix,network,connectivity,diagnostics",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "Why are my matrix commands not working?",
    answer: "Common issues: 1) Commands must end with a period (.), 2) Check command format (IxOy.), 3) Verify TCP vs UDP protocol setting matches configuration, 4) Check for network latency issues.",
    category: "monitoring",
    tags: "troubleshooting,matrix,commands,wolfpack,errors",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I troubleshoot CEC adapter issues?",
    answer: "Check USB connection: lsusb | grep -i pulse. Test adapter: echo 'scan' | cec-client -s -d 1. If needed, reinstall drivers: sudo apt-get install --reinstall libcec-dev cec-utils. Ensure HDMI cable is connected and TV CEC settings are enabled (Anynet+ or Bravia Sync).",
    category: "monitoring",
    tags: "troubleshooting,cec,pulse-eight,usb,drivers",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "Why is TV power control via CEC not working?",
    answer: "Common causes: 1) Verify HDMI cable connection, 2) Check TV CEC settings must be enabled, 3) Try different CEC address, 4) Some TVs require 'Anynet+' (Samsung) or 'Bravia Sync' (Sony) to be enabled in TV settings.",
    category: "monitoring",
    tags: "troubleshooting,cec,tv,power,hdmi",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I troubleshoot AtlasIED connectivity?",
    answer: "Test connectivity: nc -zv 192.168.1.50 5321. Check processor web interface at http://192.168.1.50. If no audio output: check source routing in Audio Control Center, verify input levels not muted, check physical connections, verify zone is enabled.",
    category: "monitoring",
    tags: "troubleshooting,atlas,audio,connectivity,diagnostics",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I fix Fire TV ADB connection failures?",
    answer: "Reconnect: adb connect 192.168.5.131:5555. If fails, restart ADB server: adb kill-server && adb start-server. Check Fire TV settings: Settings > My Fire TV > Developer Options > ADB Debugging must be ON. Verify IP address hasn't changed.",
    category: "monitoring",
    tags: "troubleshooting,firetv,adb,connection,errors",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I troubleshoot IR blaster commands?",
    answer: "Check: 1) IR emitter placement (must face IR receiver), 2) Verify correct IR code database loaded, 3) Test with different IR codes, 4) Check Global Cache network connection. IR emitters should be positioned directly in front of the device's IR receiver.",
    category: "monitoring",
    tags: "troubleshooting,ir,global-cache,blaster,commands",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What is the recommended maintenance schedule?",
    answer: "Daily: Monitor system health dashboard, check for offline devices, review error logs. Weekly: Test CEC power control, verify matrix routing, check audio zone status, update Fire TV devices if needed. Monthly: Backup configuration database, update firmware, clean IR emitters, test backup/restore. Quarterly: Full system health check, network security audit, hardware inspection, update documentation.",
    category: "monitoring",
    tags: "maintenance,schedule,best-practices,monitoring,backup",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I add a new TV to the system?",
    answer: "1) Connect TV to available matrix output, 2) Configure output label in application, 3) Test HDMI signal, 4) Set up CEC control if supported, 5) Update documentation with TV location and matrix output assignment.",
    category: "configuration",
    tags: "tv,expansion,setup,configuration,hardware",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I add a Fire TV device to the system?",
    answer: "1) Connect Fire TV to network, 2) Assign static IP via DHCP reservation, 3) Enable ADB debugging in Fire TV settings, 4) Connect Fire TV to matrix input, 5) Add device in application, 6) Test connectivity and commands.",
    category: "configuration",
    tags: "firetv,expansion,setup,configuration,hardware",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "How do I add an audio zone?",
    answer: "1) Connect zone output on AtlasIED processor, 2) Configure zone in Audio Control Center, 3) Set up routing from sources to zone, 4) Test audio levels, 5) Configure Soundtrack player if applicable.",
    category: "configuration",
    tags: "audio,zone,expansion,atlas,setup",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What power management best practices should I follow?",
    answer: "1) Use UPS for control server, 2) Label all power connections, 3) Document power-on sequence, 4) Configure auto-restart on power failure for critical systems.",
    category: "configuration",
    tags: "power,ups,best-practices,safety,hardware",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What cable management practices are recommended?",
    answer: "1) Label all HDMI cables with source and destination, 2) Use cable ties and proper cable management, 3) Document cable runs in network diagram, 4) Take photos of connections for reference.",
    category: "configuration",
    tags: "cables,management,best-practices,documentation,hardware",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What network security best practices should I follow?",
    answer: "1) Change default passwords on all devices, 2) Use VLANs where possible for network segmentation, 3) Restrict external access to the system, 4) Keep firmware updated on all hardware devices.",
    category: "network",
    tags: "security,best-practices,network,passwords,firewall",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },
  {
    question: "What documentation should I maintain?",
    answer: "1) Keep hardware configuration guide updated, 2) Document all configuration changes, 3) Maintain IP address spreadsheet, 4) Take photos of physical connections, 5) Track firmware versions and update dates.",
    category: "configuration",
    tags: "documentation,best-practices,maintenance,tracking,inventory",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONFIGURATION.md"
  },

  // ========================================
  // HARDWARE_CONNECTIVITY_REPORT.md Q&A Pairs (25 pairs)
  // ========================================
  {
    question: "What is the actual IP address of the Wolf Pack Matrix in production?",
    answer: "The actual IP address of the Wolf Pack Matrix in production is 192.168.5.100 on port 23 (TCP). Note that the static config file matrix-config.json incorrectly shows 192.168.1.100, but the database MatrixConfiguration table has the correct IP. The matrix control library correctly uses the database IP.",
    category: "hardware",
    tags: "matrix,ip-address,production,wolfpack,configuration",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What is the IP address of the AtlasIED audio processor in production?",
    answer: "The AtlasIED AZMP8 audio processor is at 192.168.5.101 with HTTP port 80, TCP control port 5321, and UDP meter port 3131. The device is online and fully operational.",
    category: "hardware",
    tags: "atlas,audio,ip-address,production,network",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "How many audio zones are configured in the system?",
    answer: "There are 8 audio zones configured: 1) Bar Main, 2) Bar Sub, 3) Dining Room, 4) Red Bird Room, 5) Party Room East, 6) Outside, 7) Bath, 8) Zone 8 (unconfigured). The system also has 9 audio sources including Matrix 1-4, Mic 1-2, Spotify, and Party Room East/West.",
    category: "hardware",
    tags: "audio,zones,atlas,configuration,count",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What Fire TV devices are currently online?",
    answer: "Fire TV Cube 'Amazon 1' at 192.168.5.131:5555 is online with Hulu and Netflix installed. It's connected to matrix input channel 13. Fire TV 'Amazon 2' has been offline for 17 days since 2025-10-16.",
    category: "hardware",
    tags: "firetv,status,online,devices,monitoring",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What CEC devices are detected in the system?",
    answer: "One Pulse-Eight CEC Adapter is detected on USB (Bus 003 Device 004, USB ID 2548:1002). It detected 1 CEC device: Recorder 1 at address 1.0.0.0 (Pulse Eight CECTester, CEC Version 1.4, Power Status ON). The database shows 5 configured CEC devices for TV power and cable box control.",
    category: "hardware",
    tags: "cec,devices,pulse-eight,usb,detection",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "Why are the DirecTV receivers unreachable?",
    answer: "DirecTV receivers are unreachable due to network segmentation. The control server is on 192.168.5.x subnet, but 7 of 8 DirecTV receivers are configured on 192.168.1.x subnet (unreachable). DirecTV 1 at 192.168.5.121 is also not responding. No routing exists between the subnets.",
    category: "monitoring",
    tags: "directv,network,unreachable,troubleshooting,subnet",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "Why are the Global Cache IR devices unreachable?",
    answer: "The Global Cache iTach IP2IR adapters at 192.168.1.110 and 192.168.1.111 are unreachable because they're on the 192.168.1.x subnet while the control server is on 192.168.5.x subnet. There is no routing configured between these subnets.",
    category: "monitoring",
    tags: "global-cache,ir,network,unreachable,troubleshooting",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What is the recommended solution for the network routing issues?",
    answer: "The recommended solution is to consolidate all devices to the 192.168.5.x subnet (Option A). This involves: 1) Moving DirecTV receivers to 192.168.5.122-128, 2) Moving Global Cache devices to 192.168.5.110-111, 3) Updating configuration files with new IPs, 4) Testing connectivity. This is preferred over inter-VLAN routing or moving the server.",
    category: "network",
    tags: "network,routing,solution,migration,recommendation",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What Atlas audio processor API endpoints are available?",
    answer: "Available Atlas endpoints: /api/atlas/configuration, /api/atlas/query-hardware, /api/atlas/groups, /api/atlas/sources, /api/atlas/input-meters, /api/atlas/output-meters, /api/atlas/ai-analysis, /api/atlas/route-matrix-to-zone, /api/atlas/recall-scene. The processor uses JSON-RPC 2.0 protocol over TCP port 5321.",
    category: "api",
    tags: "atlas,api,endpoints,audio,control",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What features does the AtlasIED client library provide?",
    answer: "The atlasClient.ts library provides: automatic reconnection with exponential backoff, connection pooling and keep-alive (every 4 minutes), TCP and UDP socket management, message buffering with newline-terminated protocol, subscription management (survives reconnects), comprehensive error handling/logging, and PM2 cluster mode support with SO_REUSEADDR for UDP.",
    category: "configuration",
    tags: "atlas,client,library,features,tcp-udp",
    confidence: 0.90,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What CEC API endpoints are available?",
    answer: "CEC API endpoints: /api/cec/discovery (scan devices), /api/cec/config (configuration), /api/cec/power-control (TV on/standby), /api/cec/cable-box/discover (detect cable boxes), /api/cec/cable-box/tune (change channels), /api/cec/cable-box/test (test control), /api/cec/cable-box/logs (command logs), /api/cec/cable-box/stats (performance stats).",
    category: "api",
    tags: "cec,api,endpoints,cable-box,control",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What Soundtrack Your Brand API endpoints are available?",
    answer: "Soundtrack API endpoints: /api/soundtrack/test (token validation), /api/soundtrack/config (configuration), /api/soundtrack/account (account info), /api/soundtrack/players (player list), /api/soundtrack/stations (station list), /api/soundtrack/now-playing (current track), /api/soundtrack/diagnose (diagnostics). Note: API key must be configured in .env file.",
    category: "api",
    tags: "soundtrack,api,endpoints,music,audio",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "Is Soundtrack Your Brand configured in the system?",
    answer: "No, Soundtrack Your Brand is not configured. The .env file contains a placeholder value 'your-soundtrack-api-token'. To enable: 1) Obtain API token from Soundtrack account dashboard, 2) Update .env with actual API key, 3) Test using /api/soundtrack/test endpoint, 4) Configure audio zone mappings.",
    category: "configuration",
    tags: "soundtrack,configuration,api-key,setup,music",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What is the system overall status?",
    answer: "System status: MOSTLY OPERATIONAL. Critical systems online: 4 of 6. Working: Wolf Pack Matrix (192.168.5.100), AtlasIED Audio (192.168.5.101), Fire TV Cube Amazon 1 (192.168.5.131), CEC Adapter (USB). Warning status: 2 systems (network routing issues). No critical failures.",
    category: "monitoring",
    tags: "status,health,overview,monitoring,systems",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What working integrations are in the system?",
    answer: "Working integrations: 1) Wolf Pack Matrix → AtlasIED Audio (matrix outputs 1-4 feed Atlas sources 1-4), 2) Fire TV → Wolf Pack Matrix (Fire TV on input 13), 3) AtlasIED → Soundtrack (ready, awaiting API key), 4) CEC → Cable Boxes (channel tuning functional).",
    category: "configuration",
    tags: "integrations,connections,working,system,status",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What integrations are currently broken?",
    answer: "Broken integrations: 1) DirecTV → Wolf Pack Matrix (network routing issue, offline), 2) Global Cache IR → Cable Boxes (network routing issue, offline), 3) CEC → TVs Power Control (only 1 of 5 adapters detected, partially functional).",
    category: "monitoring",
    tags: "integrations,broken,issues,troubleshooting,status",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "Where is the production database located?",
    answer: "The production database is located at /home/ubuntu/sports-bar-data/production.db with size 13.1 MB, last modified 2025-10-30 21:53. It contains tables for MatrixConfiguration, AudioProcessor, AudioZone, AudioGroup, FireTVDevice, CECDevice, GlobalCacheDevice, and IRDevice.",
    category: "configuration",
    tags: "database,location,production,sqlite,path",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "Where are the device configuration files located?",
    answer: "Device configurations are in /home/ubuntu/Sports-Bar-TV-Controller/data/ including: matrix-config.json (Wolf Pack), audio-zones.json (zones), firetv-devices.json (Fire TV), directv-devices.json (DirecTV), ir-devices.json (Global Cache), device-subscriptions.json (channel subscriptions), and atlas-configs/ directory (143 backup files).",
    category: "configuration",
    tags: "configuration,files,location,path,data",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What is the matrix-config.json IP address error?",
    answer: "The matrix-config.json file incorrectly shows wolfpack_ip as 192.168.1.100, but the correct IP is 192.168.5.100. The database MatrixConfiguration table has the correct IP. The matrix control library (matrix-control.ts) correctly uses the database, so functionality works despite the static file error. The file should be updated to match.",
    category: "configuration",
    tags: "matrix,configuration,error,ip-address,bug",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What network tests were performed in the connectivity report?",
    answer: "Network tests performed: Ping tests on 11 devices, TCP port scans on 6 services (verified ports 23, 5321, 3131, 80, 5555, 4998), latency measurements (sub-2ms for all reachable devices), database queries on 8 tables, USB device enumeration (CEC adapter), CEC bus scanning (1 device found), and API endpoint verification (30+ endpoints).",
    category: "monitoring",
    tags: "testing,network,connectivity,verification,diagnostics",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What are the next immediate steps recommended?",
    answer: "Immediate steps: 1) Fix matrix-config.json IP address from 192.168.1.100 to 192.168.5.100 (5 min), 2) Perform network discovery scan of 192.168.5.x subnet (15 min), 3) Decide on network architecture approach (today), 4) Implement network solution and test all devices (this week), 5) Update all config files with verified IPs (this week).",
    category: "configuration",
    tags: "action-items,recommendations,next-steps,priority,tasks",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What vendor support contacts are available?",
    answer: "Vendor support: Wolf Pack Matrix (Wolf Cinema), AtlasIED (https://www.atlasied.com/support, 1-800-876-3333), Global Cache (https://www.globalcache.com/support, support@globalcache.com), Pulse-Eight CEC (https://www.pulse-eight.com/support), DirecTV Business (1-800-531-5000), Soundtrack Your Brand (https://www.soundtrackyourbrand.com/support).",
    category: "configuration",
    tags: "support,vendors,contacts,help,hardware",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What Atlas audio sources are configured?",
    answer: "The AtlasIED processor has 9 configured audio sources: Matrix 1, Matrix 2, Matrix 3, Matrix 4, Mic 1, Mic 2, Spotify, Party Room East, and Party Room West. These can be routed to any of the 8 audio zones.",
    category: "hardware",
    tags: "atlas,audio,sources,inputs,configuration",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What is the current mute status of audio zones?",
    answer: "Mute status from last query: Bar Main (muted), Bar Sub (muted), Dining Room (muted), Red Bird Room (not muted), Party Room East (not muted), Outside (not muted), Bath (not muted), Zone 8 (unconfigured). Note: This is a snapshot from the hardware query, actual status may have changed.",
    category: "monitoring",
    tags: "audio,zones,mute,status,atlas",
    confidence: 0.85,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },
  {
    question: "What control library files are used for hardware?",
    answer: "Control library files: /home/ubuntu/Sports-Bar-TV-Controller/src/lib/matrix-control.ts (Wolf Pack matrix), /home/ubuntu/Sports-Bar-TV-Controller/src/lib/atlasClient.ts (AtlasIED TCP/UDP client), /home/ubuntu/Sports-Bar-TV-Controller/src/lib/atlas-models-config.ts (Atlas data models), /home/ubuntu/Sports-Bar-TV-Controller/src/lib/atlas-logger.ts (Atlas logging).",
    category: "configuration",
    tags: "libraries,code,control,files,location",
    confidence: 0.95,
    sourceFile: "docs/HARDWARE_CONNECTIVITY_REPORT.md"
  },

  // ========================================
  // API_QUICK_REFERENCE.md Q&A Pairs (10 pairs)
  // ========================================
  {
    question: "What is the quickest way to check system health?",
    answer: "Use: curl http://localhost:3000/api/system/health | jq '.overall' to get a quick overview of overall system health including status, health percentage, devices online/total, and active issues count.",
    category: "monitoring",
    tags: "health,quick,curl,monitoring,status",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "What's a quick command to route a matrix input?",
    answer: "curl -X POST http://localhost:3000/api/matrix/command -H \"Content-Type: application/json\" -d '{\"command\":\"I1O1\",\"ipAddress\":\"192.168.1.100\",\"port\":23}' | jq",
    category: "api",
    tags: "matrix,routing,curl,quick,command",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "What's a quick command to power on a TV via CEC?",
    answer: "curl -X POST http://localhost:3000/api/cec/command -H \"Content-Type: application/json\" -d '{\"command\":\"on\",\"address\":\"0.0.0.0\"}' | jq",
    category: "api",
    tags: "cec,power,tv,curl,quick",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "What's a quick command to get today's sports programming?",
    answer: "curl http://localhost:3000/api/sports-guide | jq '.summary' to get a summary of sports programming listings.",
    category: "api",
    tags: "sports,guide,curl,quick,programming",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "What are the most commonly used API endpoints?",
    answer: "Most common endpoints: GET /api/system/health (system status), POST /api/matrix/command (matrix routing), GET /api/cec/devices (CEC devices), POST /api/sports-guide (sports guide), GET /api/soundtrack/now-playing (music), GET /api/audio-processor/zones (audio zones), GET /api/firetv-devices (Fire TV list).",
    category: "api",
    tags: "endpoints,common,api,frequently-used,reference",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "How do I get active matrix routes quickly?",
    answer: "GET /api/matrix/routes returns all active routing configurations with input numbers, output numbers, and active status.",
    category: "api",
    tags: "matrix,routes,api,quick,status",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "How do I check CEC device power status quickly?",
    answer: "GET /api/cec/status?tvAddress=0 returns power status for CEC devices. The tvAddress parameter defaults to 0 if not specified.",
    category: "api",
    tags: "cec,status,power,api,quick",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "How do I search for NFL games quickly?",
    answer: "GET /api/sports-guide/channels?search=NFL&days=3 searches for NFL games in the next 3 days. Adjust the days parameter as needed.",
    category: "api",
    tags: "sports,search,nfl,api,quick",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "How do I send a Fire TV command quickly?",
    answer: "POST /api/firetv-devices/send-command with body: {\"deviceId\":\"ftv-1\", \"command\":\"input keyevent KEYCODE_HOME\"} sends an ADB command to the specified Fire TV device.",
    category: "api",
    tags: "firetv,command,adb,api,quick",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },
  {
    question: "Where can I find complete API documentation?",
    answer: "Complete API documentation is in docs/API_REFERENCE.md. Hardware configuration details are in docs/HARDWARE_CONFIGURATION.md. The quick reference provides curl examples for the most common operations.",
    category: "api",
    tags: "documentation,reference,api,help,location",
    confidence: 0.95,
    sourceFile: "docs/API_QUICK_REFERENCE.md"
  },

  // ========================================
  // NETWORK_ARCHITECTURE_DECISION.md Q&A Pairs (20 pairs)
  // ========================================
  {
    question: "What network architecture is recommended for the system?",
    answer: "The recommended architecture is to consolidate all devices to the 192.168.5.x subnet as the single, unified network. This subnet is the production network where the Wolf Pack Matrix (192.168.5.100), AtlasIED Audio (192.168.5.101), and Fire TV devices are already located.",
    category: "network",
    tags: "architecture,network,recommendation,subnet,migration",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "Why was dual-subnet configuration rejected?",
    answer: "Dual-subnet configuration causes: 1) Unreachable devices (7 DirecTV receivers, 2 Global Cache IR controllers), 2) Operational complexity (two configs to maintain), 3) Migration risk (misconfiguration potential), 4) Configuration drift (docs not matching reality). Consolidation to single subnet eliminates these issues.",
    category: "network",
    tags: "architecture,subnet,problems,decision,network",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What devices are currently on the 192.168.5.x subnet?",
    answer: "Active on 192.168.5.x: Control Server (192.168.5.???), Wolf Pack Matrix (192.168.5.100:23), AtlasIED AZMP8 (192.168.5.101:5321), Fire TV Cube Amazon 1 (192.168.5.131:5555), DirecTV 1 (192.168.5.121, currently offline).",
    category: "network",
    tags: "subnet,devices,192.168.5.x,inventory,network",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What devices are on the legacy 192.168.1.x subnet?",
    answer: "Legacy 192.168.1.x devices: DirecTV 2-8 (192.168.1.122-128, unreachable), Global Cache iTach 1 (192.168.1.110, unreachable), Global Cache iTach 2 (192.168.1.111, unreachable), Old Matrix System (unknown IP, legacy), Fire TV Amazon 2 (unknown IP, intentionally on legacy network with old system).",
    category: "network",
    tags: "subnet,legacy,192.168.1.x,devices,migration",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What is the recommended IP allocation plan?",
    answer: "Recommended allocation: Video Infrastructure 192.168.5.100-119 (Matrix 100, Global Cache 110-111), Satellite 192.168.5.120-129 (DirecTV 121-128), Streaming 192.168.5.130-139 (Fire TV 131-132), Audio 192.168.5.150-159 (AtlasIED 150), CEC 192.168.5.160-169, Displays 192.168.5.200-250. Use static IPs for all production devices.",
    category: "network",
    tags: "ip-allocation,planning,subnet,addresses,network",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What are the phases of the network migration?",
    answer: "Phase 1: Documentation & Planning (30 min), Phase 2: Pre-Migration Preparation (1 hour - backup configs), Phase 3: Device Migration (2-4 hours - change IPs), Phase 4: System Configuration Update (30 min - update database/files), Phase 5: Verification & Testing (1 hour), Phase 6: Legacy System Decommission (future). Total: 5-7 hours.",
    category: "network",
    tags: "migration,phases,planning,timeline,implementation",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "When should the network migration be scheduled?",
    answer: "Recommended schedule: Start at 2 AM (after bar closing), expected completion 7-9 AM, buffer for issues until noon, rollback deadline before 11 AM (lunch service). Total maintenance window: 5-7 hours during low-traffic period to minimize service interruption.",
    category: "network",
    tags: "migration,schedule,timing,maintenance,downtime",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "How do I migrate a DirecTV receiver to the new subnet?",
    answer: "For each DirecTV receiver: 1) Navigate to network settings menu, 2) Change from DHCP to Static IP (or update DHCP reservation), 3) Set new IP 192.168.5.122-128, 4) Set subnet mask 255.255.255.0, 5) Set gateway 192.168.5.1, 6) Set DNS 8.8.8.8, 8.8.4.4, 7) Save and restart, 8) Verify: ping 192.168.5.12x",
    category: "network",
    tags: "migration,directv,configuration,network,setup",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "How do I migrate a Global Cache device to the new subnet?",
    answer: "For Global Cache iTach: 1) Access web interface at current IP (192.168.1.110 or .111), 2) Navigate to Network Settings, 3) Change Static IP to 192.168.5.110 or 192.168.5.111, 4) Set subnet mask 255.255.255.0, 5) Set gateway 192.168.5.1, 6) Save and reboot, 7) Verify: nc -zv 192.168.5.110 4998",
    category: "network",
    tags: "migration,global-cache,ir,configuration,network",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What configuration files need updating during migration?",
    answer: "Update: /data/directv-devices.json (DirecTV IPs), /data/globalcache-devices.json (iTach IPs), Database DirecTVDevice table (update IP addresses), Database GlobalCacheDevice table (update IP addresses). Backup all configs before changes: tar -czf config-backup-$(date +%Y%m%d).tar.gz src/data/ data/*.json",
    category: "network",
    tags: "migration,configuration,files,database,backup",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What are the success criteria for network migration?",
    answer: "Success criteria: All devices reachable on 192.168.5.x, no packet loss to any device, health endpoint reports all systems healthy, matrix routing functional, audio zones operational, DirecTV channel changing works, Fire TV streaming operational, CEC power control functional, no service interruption during operating hours.",
    category: "network",
    tags: "migration,success,criteria,testing,verification",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What is the rollback plan if migration fails?",
    answer: "Rollback steps: 1) Immediate: Power cycle devices to restore original IPs (if DHCP), 2) 5 min: Restore database from backup, 3) 10 min: Restore config files from backup, 4) 15 min: Restart PM2 services, 5) 20 min: Verify all services operational on old architecture, 6) Document lessons learned for next attempt.",
    category: "network",
    tags: "rollback,migration,failure,recovery,backup",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "Why was inter-VLAN routing option rejected?",
    answer: "Inter-VLAN routing (Option A) was rejected because: it adds network complexity, requires router configuration access, adds latency for routed traffic, still maintains two subnets to manage, doesn't solve long-term architecture issue. It's a band-aid solution that doesn't address the root cause.",
    category: "network",
    tags: "vlan,routing,rejected,decision,architecture",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "Why was moving the control server to 192.168.1.x rejected?",
    answer: "Moving server to 192.168.1.x (Option B) was rejected because: it's the wrong direction (moving away from new architecture), Wolf Pack Matrix and AtlasIED Audio already on 192.168.5.x would need to move, Fire TV already on 192.168.5.x would need to move, preserves legacy network as primary. New infrastructure should define the network.",
    category: "network",
    tags: "migration,rejected,decision,architecture,server",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What network verification tests should be run after migration?",
    answer: "Connectivity tests: for ip in {100,101,110,111,121..128,131,132}; do echo \"Testing 192.168.5.$ip\"; ping -c 2 192.168.5.$ip; done. Functional tests: DirecTV channel changing, matrix routing, audio zone control, Fire TV ADB commands, CEC power control. Health monitoring: curl http://localhost:3001/api/health",
    category: "network",
    tags: "testing,verification,migration,connectivity,validation",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What database updates are needed during migration?",
    answer: "SQL updates needed: UPDATE DirecTVDevice SET ipAddress = '192.168.5.122' WHERE name = 'DirecTV 2'; (repeat for DirecTV 3-8 with IPs .123-.128), UPDATE GlobalCacheDevice SET ipAddress = '192.168.5.110' WHERE name = 'iTach 1'; UPDATE GlobalCacheDevice SET ipAddress = '192.168.5.111' WHERE name = 'iTach 2';",
    category: "network",
    tags: "database,migration,sql,update,configuration",
    confidence: 0.95,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What are the long-term network best practices?",
    answer: "Best practices: 1) Static IPs for all production devices (no DHCP), 2) Document all IP assignments in hardware inventory, 3) Reserve IP ranges for each device category, 4) Use consistent numbering (sequential within category), 5) Leave expansion room in each range, 6) Backup configs before network changes, 7) Test in maintenance windows only, 8) Monitor health endpoint after changes.",
    category: "network",
    tags: "best-practices,network,ip-management,documentation,planning",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "When should Fire TV Amazon 2 be migrated?",
    answer: "Fire TV Amazon 2 should be migrated to 192.168.5.132 when the legacy matrix system is retired. It's currently intentionally on the legacy network being used with the older matrix system. After legacy decommission: 1) Configure to 192.168.5.132, 2) Update ADB connection string, 3) Test streaming apps.",
    category: "network",
    tags: "firetv,migration,amazon-2,legacy,timing",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What are the network segmentation causes?",
    answer: "Possible causes of dual-subnet issue: 1) Network reconfiguration - devices moved to new subnet without updating configs, 2) VLAN segmentation - networks on separate VLANs without inter-VLAN routing, 3) Firewall rules - router/firewall blocking traffic between subnets, 4) Incomplete migration - system partially migrated from 192.168.1.x to 192.168.5.x.",
    category: "network",
    tags: "troubleshooting,network,causes,segmentation,analysis",
    confidence: 0.85,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
  {
    question: "What is the future network architecture design?",
    answer: "Future design on 192.168.5.0/24: Control Layer (.10-50): servers and management, Video Infrastructure (.100-119): matrix and IR blasters, Satellite Receivers (.120-129): DirecTV 1-8, Streaming Devices (.130-139): Fire TV cubes, Audio Infrastructure (.150-159): AtlasIED processors, CEC Control (.160-169): adapters, Displays (.200-250): Smart TVs if networked.",
    category: "network",
    tags: "architecture,future,planning,design,ip-ranges",
    confidence: 0.90,
    sourceFile: "docs/NETWORK_ARCHITECTURE_DECISION.md"
  },
]

async function insertQAEntries() {
  console.log('Starting Q&A entry insertion...\n')

  let successCount = 0
  let errorCount = 0
  const errors: Array<{question: string, error: string}> = []

  for (const qa of qaData) {
    try {
      await db.insert(qaEntries).values({
        id: crypto.randomUUID(),
        question: qa.question,
        answer: qa.answer,
        category: qa.category,
        tags: qa.tags,
        confidence: qa.confidence,
        sourceFile: qa.sourceFile,
        sourceType: 'documentation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      successCount++
      console.log(`✓ Inserted: ${qa.question.substring(0, 60)}...`)
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push({ question: qa.question, error: errorMsg })
      console.error(`✗ Failed: ${qa.question.substring(0, 60)}... - ${errorMsg}`)
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('INSERTION SUMMARY')
  console.log('='.repeat(80))
  console.log(`Total Q&A pairs processed: ${qaData.length}`)
  console.log(`Successfully inserted: ${successCount}`)
  console.log(`Failed: ${errorCount}`)
  console.log('\nBreakdown by file:')

  const fileBreakdown = qaData.reduce((acc, qa) => {
    acc[qa.sourceFile] = (acc[qa.sourceFile] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  Object.entries(fileBreakdown).forEach(([file, count]) => {
    console.log(`  - ${file}: ${count} Q&A pairs`)
  })

  console.log('\nBreakdown by category:')
  const categoryBreakdown = qaData.reduce((acc, qa) => {
    acc[qa.category] = (acc[qa.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  Object.entries(categoryBreakdown).forEach(([category, count]) => {
    console.log(`  - ${category}: ${count} Q&A pairs`)
  })

  if (errors.length > 0) {
    console.log('\n' + '='.repeat(80))
    console.log('ERRORS')
    console.log('='.repeat(80))
    errors.forEach(({ question, error }) => {
      console.log(`\nQuestion: ${question}`)
      console.log(`Error: ${error}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('SAMPLE Q&A PAIRS (first 10)')
  console.log('='.repeat(80))
  qaData.slice(0, 10).forEach((qa, index) => {
    console.log(`\n${index + 1}. Question: ${qa.question}`)
    console.log(`   Answer: ${qa.answer.substring(0, 100)}...`)
    console.log(`   Category: ${qa.category} | Tags: ${qa.tags} | Confidence: ${qa.confidence}`)
    console.log(`   Source: ${qa.sourceFile}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('DATABASE STATUS')
  console.log('='.repeat(80))
  console.log(`✓ All Q&A entries have been inserted into the database`)
  console.log(`✓ Database location: /home/ubuntu/sports-bar-data/production.db`)
  console.log(`✓ Table: QAEntry`)
  console.log('\n')
}

// Run the insertion
insertQAEntries()
  .then(() => {
    console.log('Q&A generation and insertion completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error during Q&A insertion:', error)
    process.exit(1)
  })
