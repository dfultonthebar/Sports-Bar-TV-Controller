
# Professional TV Guide Integration Implementation

## Overview

This implementation integrates both **Gracenote (Nielsen)** and **Spectrum Business API** services to provide comprehensive, professional-grade TV guide data for your sports bar. The system includes fallback data and a unified interface that combines the best of both services.

## 🚀 What's Been Implemented

### 1. Core Services

#### Gracenote Service (`src/lib/gracenote-service.ts`)
- **Professional TV guide data** with comprehensive metadata
- **Sports-focused features** including league, team, and venue information
- **Real-time updates** and comprehensive program search
- **Channel lineup management** with provider-specific data
- **Caching system** to optimize API usage and performance

#### Spectrum Business API Service (`src/lib/spectrum-business-api.ts`)
- **Direct Spectrum Business integration** for account-specific data
- **Channel lineup** based on your actual subscription
- **Sports programming** with enhanced metadata
- **Account information** including package details
- **Regional sports networks** and local channel data

#### Unified TV Guide Service (`src/lib/unified-tv-guide-service.ts`)
- **Intelligent data merging** from both sources
- **Deduplication** and conflict resolution
- **Enhanced program matching** with confidence scoring
- **Comprehensive search** across all data sources
- **Fallback handling** when services are unavailable

### 2. API Endpoints

#### Individual Service Endpoints
- `/api/tv-guide/gracenote` - Gracenote-specific data access
- `/api/tv-guide/spectrum-business` - Spectrum Business API access
- `/api/tv-guide/unified` - Combined data from all sources

#### Supported Operations
- **Channel lineup** retrieval
- **Program guide** data for specified time ranges
- **Sports programming** filtering and enhancement
- **Search functionality** across all programs
- **Current sports** programs (what's airing now)
- **Service status** checking

### 3. User Interface Components

#### TV Guide Configuration Panel (`src/components/tv-guide/TVGuideConfigurationPanel.tsx`)
- **Service status** monitoring
- **API configuration** instructions
- **Connection testing** for all services
- **Real-time status** updates

#### Unified TV Guide Viewer (`src/components/tv-guide/UnifiedTVGuideViewer.tsx`)
- **Sports-focused view** optimized for sports bars
- **Live sports** highlighting
- **Program search** functionality
- **Multi-source data** display
- **Current programming** awareness

### 4. Web Pages
- `/tv-guide-config` - Configuration and setup page
- `/tv-guide` - Main TV guide viewing interface

## 🔧 Configuration Required

### Environment Variables

Add these to your `.env` file:

#### Gracenote Configuration
```env
GRACENOTE_API_KEY=your_gracenote_api_key
GRACENOTE_PARTNER_ID=your_gracenote_partner_id
GRACENOTE_USER_ID=your_gracenote_user_id  # Optional
GRACENOTE_BASE_URL=https://c.web.cddbp.net/webapi/xml/1.0/  # Optional
```

#### Spectrum Business Configuration
```env
SPECTRUM_BUSINESS_API_KEY=your_spectrum_business_api_key
SPECTRUM_BUSINESS_ACCOUNT_ID=your_spectrum_account_id
SPECTRUM_BUSINESS_REGION=midwest  # Optional, defaults to midwest
SPECTRUM_BUSINESS_BASE_URL=https://api.spectrum.com/business/v1  # Optional
```

## 🎯 Key Features for Sports Bars

### 1. Sports-First Approach
- **Live sports detection** and highlighting
- **League and team filtering** (NFL, NBA, MLB, NHL, College, etc.)
- **Venue information** for better customer service
- **Game status tracking** (Live, Upcoming, Final)

### 2. Enhanced Metadata
- **Team matchup information** (Home vs Away)
- **League classification** and sport type
- **Event timing** and duration
- **Regional sports network** identification

### 3. Real-Time Updates
- **Current programming** awareness
- **Schedule changes** detection
- **Live event status** updates
- **Cache management** for performance

### 4. Fallback System
- **Gracenote fallback** when Spectrum is unavailable
- **Spectrum fallback** when Gracenote is unavailable
- **Local channel data** when no APIs are configured
- **Smart data merging** to fill gaps

## 📊 API Usage Examples

### Get Current Sports Programming
```javascript
// Get what's airing right now
const response = await fetch('/api/tv-guide/unified?action=current-sports')
const data = await response.json()

// Returns live sports with team, league, and venue info
data.programs.forEach(program => {
  console.log(`${program.title}: ${program.sportsInfo?.teams?.join(' vs ')}`)
})
```

### Search for Specific Teams/Leagues
```javascript
// Search for Packers games
const response = await fetch('/api/tv-guide/unified?action=search&query=packers')
const data = await response.json()

// Get NFL programming specifically
const nflResponse = await fetch('/api/tv-guide/unified?action=sports&leagues=NFL')
const nflData = await nflResponse.json()
```

### Get Channel Lineup with Sources
```javascript
const response = await fetch('/api/tv-guide/unified?action=channels')
const data = await response.json()

// Shows channels from both Gracenote and Spectrum
data.channels.forEach(channel => {
  console.log(`${channel.number} - ${channel.name} (${channel.source})`)
})
```

## 🔄 Data Flow

1. **Service Configuration Check** - System checks which APIs are configured
2. **Parallel Data Retrieval** - Fetches data from available sources simultaneously
3. **Data Normalization** - Converts different API formats to unified structure
4. **Intelligent Merging** - Combines data with conflict resolution
5. **Cache Management** - Stores results for performance optimization
6. **Fallback Handling** - Uses alternative sources when primary fails

## 🎛️ Sports Bar Specific Benefits

### For Bartenders/Staff
- **Quick sports lookup** - Find what games are on which channels
- **Current programming** - See what's airing right now
- **Team-specific search** - Help customers find their team's games
- **Multi-source reliability** - Always have guide data available

### For Management
- **Professional data quality** - Industry-standard guide information
- **Account-specific accuracy** - Shows only subscribed channels
- **Cost optimization** - Efficient API usage with intelligent caching
- **Service monitoring** - Real-time status of all data sources

### For Customers
- **Accurate scheduling** - Reliable game times and channels
- **Comprehensive coverage** - All sports leagues and events
- **Local sports emphasis** - Regional networks and local teams highlighted

## 🛠️ Getting Started

1. **Visit Configuration Page** - Go to `/tv-guide-config`
2. **Check Service Status** - See which APIs need configuration
3. **Add API Keys** - Follow the setup instructions for each service
4. **Test Services** - Use the test buttons to verify connectivity
5. **View TV Guide** - Navigate to `/tv-guide` to see the unified guide

## 🔍 Testing & Monitoring

### Service Status Monitoring
- **Real-time status checks** for all configured services
- **Connection testing** with sample data retrieval
- **Error reporting** and troubleshooting information
- **Performance metrics** and cache effectiveness

### Data Quality Assurance
- **Source verification** - Shows which APIs provided each piece of data
- **Confidence scoring** - Indicates reliability of merged information
- **Duplicate detection** - Prevents redundant program entries
- **Coverage reporting** - Shows total channels and sports coverage

## 🚀 Future Enhancements

The system is designed to be easily extensible for additional features:

- **DVR Integration** - Connect with recording systems
- **Customer Notifications** - Alert systems for popular games
- **Analytics Dashboard** - Track popular programming and channels
- **Mobile Integration** - Extend to mobile apps and displays
- **Voice Control** - Integration with voice assistants
- **Custom Sports Feeds** - Add specialty sports data sources

## 🔧 Maintenance

### Regular Tasks
- **API key rotation** as required by providers
- **Cache cleanup** to manage storage usage
- **Service monitoring** to ensure uptime
- **Data quality checks** for accuracy verification

### Troubleshooting
- Use the configuration page to test individual services
- Check environment variables are properly set
- Monitor API rate limits and usage
- Review error logs for service connectivity issues

---

**Status**: ✅ **Ready for API Key Configuration**

The system is fully implemented and ready for use. Simply add your Gracenote and/or Spectrum Business API keys to start receiving professional TV guide data tailored specifically for sports bar operations.
