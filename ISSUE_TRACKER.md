# Sports Bar TV Controller - Issue Tracker

## Overview
This document tracks all issues, fixes, and planned features for the Sports Bar TV Controller system. All entries include timestamps and detailed descriptions.

---

## Active Issues

### 🔄 In Progress

#### Atlas AI Monitor UI Context Issue
- **Status**: In Progress
- **Priority**: High
- **Started**: October 10, 2025, ~5:00 AM
- **Description**: Atlas AI Monitor component not receiving processor context properly, causing UI display errors
- **Impact**: AI Monitor page shows error instead of audio analysis data
- **Root Cause**: Component not properly receiving activeProcessor prop from parent
- **Solution**: Update component to properly receive and use processor prop, ensure parent passes activeProcessor

#### Sports Guide API Integration
- **Status**: In Progress
- **Priority**: High
- **Started**: October 10, 2025, ~5:00 AM
- **Description**: Integrate Sports Guide API for cable box channel guide functionality
- **Requirements**:
  - Read API documentation and key from uploaded files
  - Create API service client with authentication
  - Add UI section for API key management (verify, update, status)
  - Store API key securely in .env
  - NO MOCK DATA - only real API calls
  - Support cable box channel guide (Direct TV and streaming to be added later)
- **API Details**:
  - Endpoint: https://guide.thedailyrail.com/api/v1/guide/258351
  - Authentication: API key in header
  - User ID: 258351

---

## Fixed Issues

### ✅ Completed Fixes - October 10, 2025

#### [FIXED - Oct 10, 2025, ~2:00 AM] Atlas Configuration Wiped
- **Issue**: Atlas processor configuration was completely wiped from database
- **Impact**: All audio zones, labels, and routing lost
- **Root Cause**: Unknown - possible database reset or migration issue
- **Solution**: Restored configuration from backup file
- **Files Modified**: Database restoration via restore_atlas_config.js
- **Verification**: All 7 audio zones restored and functional

#### [FIXED - Oct 10, 2025, ~2:30 AM] Upload/Download Config Bug
- **Issue**: Upload/download configuration endpoints generating random/incorrect data
- **Impact**: Configuration backups were unreliable and contained wrong data
- **Root Cause**: API routes not properly reading from database, generating mock data instead
- **Solution**: Fixed API routes to properly query database and return actual configuration
- **Files Modified**: 
  - src/app/api/atlas/download-config/route.ts
  - src/app/api/atlas/upload-config/route.ts
- **Verification**: Download now returns correct Atlas configuration, upload properly saves

#### [FIXED - Oct 10, 2025, ~2:45 AM] Atlas Connection at 192.168.5.101:80
- **Issue**: Atlas processor not connecting at IP address 192.168.5.101:80
- **Impact**: Audio control features unavailable
- **Root Cause**: Connection initialization not properly configured
- **Solution**: Updated connection manager to properly initialize Atlas connection
- **Files Modified**: src/app/api/matrix/connection-manager/route.ts
- **Verification**: Atlas processor now connects successfully at 192.168.5.101:80

#### [FIXED - Oct 10, 2025, ~3:00 AM] Wolf Pack Tests Database Errors
- **Issue**: Wolf Pack connection and switching tests failing with database errors
- **Impact**: Unable to verify matrix switcher connectivity
- **Root Cause**: PrismaClient instantiation issues and improper testLog.create() calls
- **Solution**: 
  - Fixed PrismaClient singleton usage
  - Updated testLog.create() calls with proper data types
  - Added explicit null values for optional fields
- **Files Modified**:
  - src/app/api/tests/wolfpack/connection/route.ts
  - src/app/api/tests/wolfpack/switching/route.ts
- **Verification**: Tests now run without database errors, logs properly saved

#### [FIXED - Oct 10, 2025, ~3:15 AM] Audio Zone Labels Not Matching Atlas Config
- **Issue**: Audio zone labels showing hardcoded "Matrix 1-4" instead of actual video input names
- **Impact**: Confusing UI, labels didn't reflect actual routing
- **Root Cause**: AudioZoneControl component using hardcoded labels
- **Solution**: 
  - Added fetchMatrixLabels() function to retrieve current video input selections
  - Labels now dynamically reflect selected video input names
  - Falls back to "Matrix 1-4" only if no selection
- **Files Modified**: src/components/AudioZoneControl.tsx
- **Verification**: Labels now show actual video input names (e.g., "Cable Box 1")

#### [FIXED - Oct 10, 2025, ~3:30 AM] Matrix Labels Not Updating Dynamically
- **Issue**: When selecting video input for Matrix 1-4, labels didn't update in real-time
- **Impact**: Required page refresh to see label changes
- **Root Cause**: No cross-component communication mechanism
- **Solution**: 
  - Added window.refreshAudioZoneControl() function
  - MatrixControl triggers refresh after video input selection
  - Labels update immediately across all components
- **Files Modified**:
  - src/components/AudioZoneControl.tsx
  - src/components/MatrixControl.tsx
- **Verification**: Labels update instantly when video input selected

#### [FIXED - Oct 10, 2025, ~3:45 AM] Matrix Test Database Error
- **Issue**: Matrix test failing with PrismaClientUnknownRequestError
- **Impact**: Unable to verify matrix switcher functionality
- **Root Cause**: Invalid testLog.create() invocation with improper data structure
- **Solution**: 
  - Updated data object structure to match Prisma schema
  - Added explicit null values for optional fields
  - Ensured duration is always valid integer
- **Files Modified**: 
  - src/app/api/tests/wolfpack/connection/route.ts
  - src/app/api/tests/wolfpack/switching/route.ts
- **Verification**: Tests now pass and logs saved correctly

#### [FIXED - Oct 10, 2025, ~4:00 AM] PR #185 Merged to Main
- **Issue**: Multiple fixes needed to be merged to main branch
- **Impact**: Latest fixes not available in production
- **Solution**: Merged PR #185 with all Atlas and matrix fixes
- **Branch**: fix/restore-atlas-config-and-connections
- **Commits**: 21 commits merged
- **Verification**: Main branch updated with all fixes

#### [FIXED - Oct 10, 2025, ~4:15 AM] Audio Zone Detection in Audio Control Center
- **Issue**: Audio Control Center not properly detecting all 7 audio zones
- **Impact**: Some zones not accessible in UI
- **Root Cause**: Zone detection logic not reading from Atlas configuration
- **Solution**: Updated zone detection to properly read from Atlas processor config
- **Files Modified**: src/components/AudioZoneControl.tsx
- **Verification**: All 7 zones now detected and accessible

#### [FIXED - Oct 10, 2025, ~4:30 AM] Bartender Remote Audio Section Not Working
- **Issue**: Bartender Remote page audio section showing errors or not loading
- **Impact**: Remote control functionality broken for audio
- **Root Cause**: Component not properly integrated with AudioZoneControl
- **Solution**: 
  - Fixed component integration
  - Updated props passing
  - Ensured proper data flow from Atlas API
- **Files Modified**: 
  - src/app/remote/page.tsx
  - src/components/AudioZoneControl.tsx
- **Verification**: Bartender Remote audio section now fully functional

---

## Planned Features

### 🎯 High Priority

#### Sports Guide API for Cable Box Channel Guide
- **Description**: Integrate Sports Guide API to display cable box channel guide
- **Requirements**:
  - API authentication and key management
  - Channel guide data fetching
  - UI for displaying channel listings
  - Real-time updates
- **API Provider**: The Rail Media (guide.thedailyrail.com)
- **Status**: In Progress

#### Direct TV Channel Guide Integration
- **Description**: Add Direct TV channel guide from Amazon/Direct TV API
- **Requirements**:
  - Research Amazon/Direct TV API options
  - Implement API client
  - Integrate with existing channel guide UI
- **Status**: Planned
- **Dependencies**: Sports Guide API completion

#### Streaming Channel Guide Integration
- **Description**: Add streaming service channel guide from Amazon/Direct TV API
- **Requirements**:
  - Research streaming API options
  - Implement API client
  - Support multiple streaming services
- **Status**: Planned
- **Dependencies**: Sports Guide API completion

### 🔧 Medium Priority

#### Enhanced Configuration Backup System
- **Description**: Improve automated backup system with more options
- **Features**:
  - Manual backup trigger from UI
  - Backup restoration from UI
  - Multiple backup retention policies
  - Cloud backup integration
- **Status**: Planned

#### Mobile App Development
- **Description**: Create native mobile app for iOS and Android
- **Features**:
  - Remote control functionality
  - Push notifications for events
  - Offline mode support
- **Status**: Planned

#### Advanced Scheduling Features
- **Description**: Enhanced scheduling capabilities
- **Features**:
  - Recurring schedules
  - Holiday schedules
  - Event-based scheduling
  - Schedule templates
- **Status**: Planned

### 💡 Low Priority

#### Custom EPG Service Integration
- **Description**: Implement custom Electronic Program Guide service
- **Requirements**:
  - Research free/open EPG APIs
  - Design custom data aggregation
  - Implement caching layer
- **Status**: Planned

#### SSH Key Authentication
- **Description**: Replace password authentication with SSH keys
- **Benefits**:
  - Enhanced security
  - Automated deployment support
  - Better audit logging
- **Status**: Planned

---

## Known Limitations

### Hardware Dependencies
- **Wolf Pack Matrix Switcher**: System requires physical connection to Wolf Pack matrix for full functionality
- **Atlas Audio Processor**: Audio features require Atlas processor at 192.168.5.101:80
- **Network Connectivity**: All features require stable network connection to hardware devices

### API Limitations
- **Sports Guide API**: Currently limited to cable box channel guide (Direct TV and streaming to be added)
- **Rate Limiting**: API calls may be rate-limited by external services
- **Data Freshness**: Channel guide data depends on external API update frequency

### Database Constraints
- **SQLite**: Current database is SQLite, may need migration to PostgreSQL for production scale
- **Backup Frequency**: Automated backups run daily at 3:00 AM only
- **No Real-time Replication**: Database changes not replicated in real-time

### UI/UX Limitations
- **Mobile Responsiveness**: Some admin pages not fully optimized for mobile devices
- **Browser Compatibility**: Tested primarily on Chrome/Firefox, other browsers may have issues
- **Real-time Updates**: Some UI elements require manual refresh to show latest data

---

## Issue Reporting Guidelines

### How to Report a New Issue
1. Add entry to "Active Issues" section
2. Include timestamp, priority, and detailed description
3. Document impact and affected components
4. Add any relevant error messages or logs
5. Commit changes to repository

### How to Mark Issue as Fixed
1. Move entry from "Active Issues" to "Fixed Issues"
2. Add [FIXED - Date, Time] prefix
3. Document solution and files modified
4. Include verification steps
5. Commit changes to repository

### Priority Levels
- **Critical**: System down or major functionality broken
- **High**: Important feature not working, significant user impact
- **Medium**: Minor feature issue, workaround available
- **Low**: Cosmetic issue, enhancement request

---

## Maintenance Schedule

### Daily
- Automated database backup at 3:00 AM
- Log rotation and cleanup
- Health check monitoring

### Weekly
- Review active issues
- Update issue tracker
- Check for security updates

### Monthly
- Full system backup
- Performance review
- Dependency updates

---

*Last Updated: October 10, 2025, 5:30 AM*
*Maintained by: Development Team*

