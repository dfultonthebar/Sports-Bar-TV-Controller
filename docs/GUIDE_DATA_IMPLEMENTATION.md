

# TV Guide Data Implementation

## Overview
This implementation adds comprehensive TV guide data pulling from both DirecTV and Fire TV devices, creating a unified program guide system for the Sports Bar AI Assistant.

## New API Endpoints

### DirecTV Guide Data API
**Endpoint:** `/api/directv-devices/guide-data`
- **Method:** POST - Fetch guide data from DirecTV receiver
- **Method:** GET - API information

**Features:**
- Channel lineup retrieval from DirecTV receivers
- Program guide polling for multiple channels
- Current program information extraction
- HD/recording capability detection
- Fallback sample data when device unavailable

**Data Retrieved:**
- Channel numbers and callsigns
- Program titles and descriptions
- Start/end times and duration
- Categories and ratings
- HD status and recording capabilities
- Episode/season information

### Fire TV Guide Data API  
**Endpoint:** `/api/firetv-devices/guide-data`
- **Method:** POST - Fetch guide data from Fire TV device
- **Method:** GET - API information

**Features:**
- Installed streaming app detection
- App-specific schedule extraction
- Live TV guide (where available)
- Content recommendation parsing
- ADB connection management

**Supported Apps:**
- Prime Video (schedules and originals)
- YouTube TV (live channel guide)
- Hulu (live TV listings)
- Netflix (trending content)
- Paramount+ (scheduled content)
- Apple TV+ (original programming)

### Unified Guide API
**Endpoint:** `/api/unified-guide`
- **Method:** POST - Aggregate guide data from multiple devices
- **Method:** GET - Cached data and API information

**Features:**
- Multi-device guide aggregation
- Real-time program status calculation
- Smart priority scoring
- Category and source analytics  
- Cached data management
- Live program filtering

## New Components

### UnifiedGuideViewer Component
**Location:** `/src/components/UnifiedGuideViewer.tsx`

**Features:**
- Grid and list view modes
- Real-time search and filtering
- Category and device filtering
- Live-only program toggle
- Auto-refresh capability
- Priority-based highlighting
- Device status indicators

**Display Elements:**
- Program titles and descriptions
- Start/end times with duration
- Channel/app information
- Live status indicators
- Priority scoring badges
- Device association
- Matrix input mapping

### TV Guide Dashboard Page
**Location:** `/src/app/tv-guide/page.tsx`

**Features:**
- Device overview and status
- Auto-refresh toggle
- Direct device configuration access
- Real-time device counting
- Unified guide display integration

## Data Flow

### DirecTV Guide Polling
1. **Connection:** HTTP API to DirecTV receiver (port 8080)
2. **Channel Lineup:** GET `/tv/getChannels` 
3. **Program Data:** GET `/tv/getPrograms?major={channel}&startTime={start}&endTime={end}`
4. **Current Program:** GET `/tv/getTuned` (fallback)
5. **Data Enrichment:** Priority scoring, live status, recording capabilities

### Fire TV Guide Polling  
1. **ADB Connection:** Connect via ADB (port 5555)
2. **App Detection:** Query installed streaming applications
3. **Schedule Extraction:** Per-app guide data retrieval
4. **Live TV Check:** Fire TV Recast or similar integration
5. **Content Parsing:** Recommendations and trending content

### Unified Processing
1. **Multi-Device Fetch:** Parallel guide data collection
2. **Data Normalization:** Standardized program format
3. **Priority Calculation:** Sports/live content prioritization
4. **Time Analysis:** Current/upcoming program status
5. **Caching:** Local storage for offline access
6. **Analytics:** Device success rates and content categorization

## Installation Instructions

### 1. Add to Existing Project
All files are designed to integrate with the existing Sports Bar TV Controller project structure.

### 2. Update Navigation
Add TV Guide link to main navigation:
```typescript
// Add to your navigation component
<Link href="/tv-guide" className="nav-link">
  <Calendar className="w-4 h-4" />
  TV Guide
</Link>
```

### 3. Device Configuration
Ensure devices are properly configured in `/device-config` with:
- Correct IP addresses
- Appropriate ports (DirecTV: 8080, Fire TV: 5555)  
- Matrix input channel assignments
- Network connectivity

### 4. Enable APIs
The system automatically creates the required API routes. Ensure:
- Data directory permissions for caching
- Network access to device IPs
- Firewall rules allowing HTTP/ADB connections

## Usage Examples

### Fetch All Guide Data
```typescript
const response = await fetch('/api/unified-guide', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceList: [
      { id: 'directv1', type: 'directv', ipAddress: '192.168.1.150', port: 8080 },
      { id: 'firetv1', type: 'firetv', ipAddress: '192.168.1.151', port: 5555 }
    ],
    timeRange: {
      start: new Date().toISOString(),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  })
})
```

### Get Live Programs Only
```typescript
const livePrograms = await fetch('/api/unified-guide?action=live-programs')
```

### Cache Management
```typescript
const cachedGuide = await fetch('/api/unified-guide?action=cache')
const guideSummary = await fetch('/api/unified-guide?action=cache&format=summary')
```

## Integration Points

### Existing Systems
- **Device Management:** Uses existing DirecTV/Fire TV device configurations
- **Matrix Integration:** Maps programs to matrix input channels
- **Subscription System:** Can be enhanced with guide data correlation
- **AI Features:** Guide data feeds into smart recommendation systems

### Bartender Remote Enhancement
Guide data can enhance the bartender remote by:
- Showing current/upcoming programs when switching inputs
- Providing context-aware channel recommendations
- Displaying sports-specific programming alerts
- Offering smart recording suggestions

### Sports Guide Integration
The unified guide complements the existing sports guide by:
- Adding device-specific sports content
- Providing real broadcast channel mapping
- Enabling cross-device sports discovery
- Supporting multi-source sports scheduling

## Technical Benefits

### Performance
- **Parallel Processing:** Simultaneous device polling
- **Intelligent Caching:** Reduced API calls and faster loading
- **Selective Updates:** Refresh only changed data
- **Priority Queue:** Focus on high-value content first

### Reliability  
- **Fallback Data:** Sample data when devices offline
- **Error Handling:** Graceful degradation per device
- **Connection Retry:** Automatic reconnection attempts
- **Data Validation:** Ensure program data integrity

### Scalability
- **Multi-Device Support:** Unlimited device connections
- **Modular Architecture:** Easy addition of new device types
- **API Extensibility:** Simple integration of new guide sources
- **Data Export:** Standardized format for external systems

## Future Enhancements

### Advanced Features
- **DVR Integration:** Recording scheduling from guide
- **Conflict Detection:** Multi-device recording conflicts
- **Recommendation Engine:** AI-powered content suggestions  
- **Social Features:** Patron program requests and voting
- **Analytics Dashboard:** Viewing pattern analysis

### Additional Device Support
- **Cable Boxes:** Generic cable box guide integration
- **Roku Devices:** Roku channel guide extraction  
- **Apple TV:** Apple TV app schedule data
- **Gaming Consoles:** Xbox/PlayStation streaming guides

### Smart Automation
- **Auto-Switching:** Automatic input changes for preferred content
- **Schedule Alerts:** Notifications for upcoming shows
- **Batch Recording:** Smart recording scheduling
- **Content Discovery:** Cross-platform content matching

This implementation provides a comprehensive foundation for unified TV guide data management, enabling enhanced customer experiences and operational efficiency in the sports bar environment.

