# Sports Guide Data Integration Plan

**Date:** November 2, 2025
**Status:** Infrastructure Ready, Data Population Needed
**Location:** De Pere, Wisconsin (ZIP: 54114)

---

## Executive Summary

The Sports Bar TV Controller has complete infrastructure for sports guide data across three output types (Cable/CEC, DirecTV/IR, Amazon Fire Cube), but **zero events are currently populated** in the database. This document provides a comprehensive assessment and step-by-step integration plan.

---

## Current System Status

### Database Schema Status ✅
**Tables:** All required tables exist and are properly configured

1. **SportsEvent** - Main event storage (0 events currently)
   - Fields: sport, league, eventName, homeTeam, awayTeam, eventDate, eventTime, venue, channel
   - Supports: importance levels, status tracking, favorite team flags
   - Indexed: eventDate, league, status, importance

2. **SportsEventSyncLog** - Sync tracking (0 logs currently)
   - Tracks: league, teamName, syncType, eventsFound, eventsAdded, eventsUpdated
   - Purpose: Audit trail for API synchronization

3. **FireCubeSportsContent** - Fire Cube specific content
   - Links sports content to Fire Cube apps
   - Tracks: contentTitle, league, teams, startTime, deepLinks

4. **SportsGuideConfiguration** - System configuration ✅
   - Current: ZIP 54114, De Pere, Wisconsin, America/Chicago timezone
   - Status: ACTIVE and properly configured

5. **HomeTeam** - Favorite teams (5 teams configured) ✅
   - Green Bay Packers (NFL)
   - Milwaukee Bucks (NBA)
   - Milwaukee Brewers (MLB)
   - University of Wisconsin Badgers (NCAA-FB)
   - University of Wisconsin Badgers (NCAA-BB)

### API Integrations

#### 1. The Rail Media API (PRIMARY) ✅ CONFIGURED
**Status:** API keys configured and working
**Purpose:** Sports TV guide data for cable/satellite/streaming
**Configuration:**
- API Key: `12548RK0000000d2bb701f55b82bfa192e680985919` ✅
- User ID: `258351` ✅
- Base URL: `https://guide.thedailyrail.com/api/v1`

**Data Structure:**
```json
{
  "listing_groups": [
    {
      "group_title": "NFL Football",
      "listings": [
        {
          "time": "2025-11-05 13:00",
          "stations": ["FOX", "ESPN"],
          "channel_numbers": {
            "SAT": { "FOX": [206] },
            "DRTV": { "FOX": [212] }
          },
          "data": {
            "matchup": "Bears @ Packers",
            "league": "NFL",
            "broadcast": "National"
          }
        }
      ]
    }
  ]
}
```

**Integration Points:**
- `/api/sports-guide` - Fetches guide data (7 days default)
- `/api/sports-guide/channels` - Channel-specific filtering
- `/api/sports-guide/status` - API health check
- UI Component: `/src/components/SportsGuide.tsx` ✅

**Current Behavior:**
- UI auto-loads ALL sports on mount
- Displays raw Rail Media API data
- Supports search/filtering
- Color-coded by sport type
- Live game indicators

#### 2. TheSportsDB API (SECONDARY) ⚠️ PARTIALLY CONFIGURED
**Status:** Using free test key (key: "3")
**Purpose:** Team schedule sync for favorite teams
**Base URL:** `https://www.thesportsdb.com/api/v1/json/3`

**Available Endpoints:**
- `eventsnext.php?t={teamName}` - Next 15 events for team
- `eventsday.php?d={date}&l={leagueId}` - Events by league/date
- `searchteams.php?t={teamName}` - Team search

**Integration Points:**
- `/api/sports/sync` - Manual sync trigger
- `/api/sports/upcoming` - Query upcoming events
- Service: `/src/lib/services/sports-schedule-sync.ts`

**Current Issues:**
- ⚠️ Using free API key (key: "3") with limited features
- ⚠️ Team name matching is inconsistent ("Green Bay Packers" vs exact DB name)
- ⚠️ No scheduled automatic sync configured
- ⚠️ 0 sync operations have ever run

---

## Data Flow Architecture

### Three Parallel Data Sources

```
┌─────────────────────────────────────────────────────────────┐
│                    Sports Data Sources                       │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Rail Media    │  │  TheSportsDB   │  │  Fire Cube     │
│  API           │  │  API           │  │  Content       │
│                │  │                │  │  Detector      │
│  • TV Guide    │  │  • Schedules   │  │  • Streaming   │
│  • Channels    │  │  • Team Data   │  │  • Deep Links  │
│  • 7-day range │  │  • Next 15     │  │  • Live Status │
└────────────────┘  └────────────────┘  └────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  SportsEvent DB  │
                    │                  │
                    │  • Unified data  │
                    │  • 0 events      │
                    └──────────────────┘
                              ▼
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│  Cable Box     │  │  DirecTV       │  │  Fire Cube     │
│  CEC Control   │  │  IR Control    │  │  ADB Control   │
└────────────────┘  └────────────────┘  └────────────────┘
```

---

## Integration Plan

### Phase 1: Quick Start (Manual Testing) - 1-2 hours

**Goal:** Verify UI and database can handle sports data

**Steps:**
1. **Insert Test Data**
   ```bash
   # Execute the test SQL (see Quick Start section below)
   sqlite3 /home/ubuntu/sports-bar-data/production.db < test_sports_data.sql
   ```

2. **Test UI Display**
   - Navigate to `/sports-guide`
   - Verify events display correctly
   - Test filtering/search
   - Verify channel information

3. **Test API Endpoints**
   ```bash
   # Get upcoming events
   curl http://localhost:3000/api/sports/upcoming?days=7

   # Check specific league
   curl http://localhost:3000/api/sports/upcoming?league=NFL
   ```

**Success Criteria:**
- ✅ Test events visible in UI
- ✅ Filtering/search works
- ✅ API returns expected data
- ✅ No database errors

---

### Phase 2: TheSportsDB Integration - 3-4 hours

**Goal:** Populate real data from TheSportsDB for favorite teams

#### 2.1 API Key Setup (30 min)
Current: Free test key (limited features)

**Options:**
1. **Continue with free key** (key: "3")
   - Limitations: Basic data, rate limits
   - Good for: Testing, small deployments

2. **Upgrade to Patreon** ($3-5/month)
   - Full API access
   - Better rate limits
   - Team/league search

**Decision Required:** For production, recommend Patreon tier ($3/month)

#### 2.2 Fix Team Name Mapping (1 hour)

**Current Issue:** TheSportsDB uses exact team names
```typescript
// Current implementation in sports-schedule-sync.ts (line 276)
const url = `${BASE_URL}/${this.apiKey}/eventsnext.php?t=${encodeURIComponent(teamName)}`
```

**Fix:** Add team ID lookup or name normalization
```typescript
// Recommended: Use team ID instead of name
const TEAM_IDS = {
  'Green Bay Packers': '134920',
  'Milwaukee Bucks': '134879',
  // etc.
}
```

**Implementation:**
1. Create team ID mapping table
2. Update sync service to use IDs
3. Test with all 5 configured teams

#### 2.3 Implement Sync Service (1-2 hours)

**Create:** `/src/lib/services/sports-data-sync-orchestrator.ts`

```typescript
export class SportsDataSyncOrchestrator {
  async syncAllSources() {
    // 1. Sync TheSportsDB for favorite teams
    // 2. Fetch Rail Media guide data
    // 3. Merge and deduplicate
    // 4. Update FireCubeSportsContent
    // 5. Log sync status
  }
}
```

**Features:**
- Deduplication logic (same game from multiple sources)
- Priority handling (home team games = high importance)
- Error handling and retry logic
- Sync logging to SportsEventSyncLog

#### 2.4 Test Manual Sync (30 min)

```bash
# Trigger manual sync
curl -X POST http://localhost:3000/api/sports/sync

# Verify data
curl http://localhost:3000/api/sports/upcoming?days=7

# Check logs
sqlite3 production.db "SELECT * FROM SportsEventSyncLog ORDER BY syncedAt DESC LIMIT 10"
```

**Success Criteria:**
- ✅ Events populated for all 5 home teams
- ✅ Sync logs created
- ✅ No duplicate events
- ✅ Proper importance levels set

---

### Phase 3: Automated Scheduling - 2-3 hours

**Goal:** Auto-sync sports data daily

#### 3.1 Add Cron Job (1 hour)

**Update:** `/src/lib/initCronJobs.ts`

```typescript
import { schedule } from 'node-cron'
import { getSportsScheduleSyncService } from '@/lib/services/sports-schedule-sync'

export function initializeCronJobs() {
  // Existing preset reordering job...

  // Add sports sync job - daily at 3 AM
  schedule('0 3 * * *', async () => {
    console.log('[Cron] Running daily sports sync...')
    try {
      const syncService = getSportsScheduleSyncService()
      await syncService.syncAllTeamsSchedules()
      console.log('[Cron] Sports sync completed')
    } catch (error) {
      console.error('[Cron] Sports sync failed:', error)
    }
  })
}
```

#### 3.2 Add Manual Trigger UI (30 min)

**Location:** `/src/app/sports-guide/page.tsx`

Add button to trigger sync:
```tsx
<button onClick={handleSync} className="btn-primary">
  Sync Schedules Now
</button>
```

#### 3.3 Cleanup Old Events (30 min)

**Add:** Auto-cleanup of completed/past events

```typescript
// In sports-schedule-sync.ts
async cleanupOldEvents(daysOld: number = 7): Promise<number> {
  // Already implemented (line 324)
  // Schedule to run weekly
}
```

**Success Criteria:**
- ✅ Cron job runs daily
- ✅ Manual sync button works
- ✅ Old events cleaned up
- ✅ System logs sync status

---

### Phase 4: Fire Cube Integration - 2-3 hours

**Goal:** Populate Fire Cube sports content

#### 4.1 Content Detection Service

**File:** `/src/lib/firecube/sports-content-detector.ts` (already exists)

**Enhancements needed:**
1. Link detected content to SportsEvent table
2. Auto-populate deep links
3. Track live status

#### 4.2 Streaming App Mapping

Create mapping for Fire Cube apps:
- ESPN+ → NFL, NBA, MLB games
- Peacock → NBC sports, NFL
- Paramount+ → CBS sports
- YouTube TV → All channels
- Hulu Live → ESPN, FS1, etc.

#### 4.3 Implementation

```typescript
// Link Fire Cube content to sports events
export async function linkFireCubeContent(deviceId: string) {
  // 1. Scan installed sports apps
  // 2. Match available content to SportsEvent
  // 3. Generate deep links
  // 4. Update FireCubeSportsContent table
}
```

**Success Criteria:**
- ✅ Fire Cube sports apps detected
- ✅ Content linked to events
- ✅ Deep links functional
- ✅ Live status updates

---

### Phase 5: Rail Media Integration Enhancement - 1-2 hours

**Goal:** Better utilize Rail Media guide data

#### 5.1 Channel Number Extraction

The Rail Media API provides channel numbers for different providers:
```json
"channel_numbers": {
  "SAT": { "FOX": [206] },
  "DRTV": { "FOX": [212] }
}
```

**Enhancement:** Store channel numbers in SportsEvent
```sql
ALTER TABLE SportsEvent ADD COLUMN cableChannel TEXT;
ALTER TABLE SportsEvent ADD COLUMN directvChannel TEXT;
ALTER TABLE SportsEvent ADD COLUMN satelliteChannel TEXT;
```

#### 5.2 Provider-Specific Filtering

**Update:** `/src/lib/sportsGuideApi.ts`

Add methods to filter by provider type:
```typescript
getCableChannels(guide: SportsGuideResponse): ChannelListing[]
getDirectvChannels(guide: SportsGuideResponse): ChannelListing[]
getStreamingOptions(guide: SportsGuideResponse): StreamingListing[]
```

**Success Criteria:**
- ✅ Channel numbers stored per provider
- ✅ Provider-specific filtering works
- ✅ UI shows correct channels

---

## Data Transformation Requirements

### Input: TheSportsDB Event
```json
{
  "idEvent": "1234567",
  "strEvent": "Chicago Bears @ Green Bay Packers",
  "strHomeTeam": "Green Bay Packers",
  "strAwayTeam": "Chicago Bears",
  "dateEvent": "2025-11-09",
  "strTime": "13:00:00",
  "strVenue": "Lambeau Field",
  "strLeague": "American Football",
  "strTVStation": null
}
```

### Transform to: SportsEvent
```sql
INSERT INTO SportsEvent (
  id, externalId, sport, league, eventName,
  homeTeam, awayTeam, eventDate, eventTime,
  venue, city, country, channel, importance,
  isHomeTeamFavorite, status, description
) VALUES (
  'uuid', '1234567', 'Football', 'NFL',
  'Chicago Bears @ Green Bay Packers',
  'Green Bay Packers', 'Chicago Bears',
  '2025-11-09T13:00:00Z', '13:00',
  'Lambeau Field', 'Green Bay', 'USA',
  'FOX', 'high', 1, 'scheduled',
  'NFC North Division rivalry game'
)
```

### Channel Data Enhancement (from Rail Media)
```sql
UPDATE SportsEvent
SET cableChannel = '206',
    directvChannel = '212'
WHERE eventName = 'Chicago Bears @ Green Bay Packers'
  AND eventDate = '2025-11-09T13:00:00Z'
```

---

## Error Handling Strategy

### 1. API Failures
```typescript
class SportsDataError extends Error {
  constructor(
    message: string,
    public source: 'thesportsdb' | 'railmedia' | 'firecube',
    public retryable: boolean
  ) {
    super(message)
  }
}
```

**Handling:**
- Log to `SportsEventSyncLog` with error message
- Retry 3 times with exponential backoff
- Alert on repeated failures
- Fall back to cached data

### 2. Data Validation
```typescript
function validateSportsEvent(event: any): boolean {
  return !!(
    event.eventDate &&
    event.homeTeam &&
    event.awayTeam &&
    event.league &&
    new Date(event.eventDate) > new Date()
  )
}
```

### 3. Duplicate Detection
```typescript
async function findDuplicate(event: SportsEvent): Promise<SportsEvent | null> {
  // Check by: same teams, same date (within 2 hours), same league
  return await findFirst('sportsEvents', {
    where: and(
      eq(schema.sportsEvents.homeTeam, event.homeTeam),
      eq(schema.sportsEvents.awayTeam, event.awayTeam),
      eq(schema.sportsEvents.league, event.league),
      // Date within 2 hours
    )
  })
}
```

---

## Testing Approach

### Unit Tests
```typescript
// tests/sports-sync.test.ts
describe('SportsScheduleSyncService', () => {
  test('syncs team schedules', async () => {
    const service = new SportsScheduleSyncService()
    const result = await service.syncTeamSchedule('Green Bay Packers', 'NFL', 'team-id-1')
    expect(result.success).toBe(true)
    expect(result.eventsFound).toBeGreaterThan(0)
  })

  test('handles API errors gracefully', async () => {
    // Mock API failure
    // Verify error logging
    // Verify retry logic
  })
})
```

### Integration Tests
```bash
# Test full sync flow
npm run test:integration

# Test specific endpoints
curl -X POST http://localhost:3000/api/sports/sync
curl http://localhost:3000/api/sports/upcoming?days=7
```

### Manual QA Checklist
- [ ] Events display in UI correctly
- [ ] Channels show for different providers
- [ ] Favorite team games marked as high importance
- [ ] Past events auto-cleaned up
- [ ] Sync logs created correctly
- [ ] Fire Cube deep links work
- [ ] Manual sync button triggers sync
- [ ] Error messages display properly

---

## Monitoring & Observability

### Metrics to Track
1. **Sync Success Rate**
   ```sql
   SELECT
     COUNT(*) FILTER (WHERE success = 1) * 100.0 / COUNT(*) as success_rate
   FROM SportsEventSyncLog
   WHERE syncedAt > datetime('now', '-7 days')
   ```

2. **Events by League**
   ```sql
   SELECT league, COUNT(*) as event_count
   FROM SportsEvent
   WHERE status = 'scheduled'
   GROUP BY league
   ```

3. **API Response Times**
   - Log in SportsEventSyncLog
   - Track via application monitoring

### Alerts
- Sync failures > 3 consecutive times
- No events found for home team
- API rate limit warnings
- Old events not cleaning up

---

## Immediate Actions (Next Steps)

### Priority 1: Quick Win (Today)
1. **Insert test data** (5 min)
   - Use SQL script provided below
   - Verify UI displays correctly

2. **Test Rail Media API** (10 min)
   - Call `/api/sports-guide`
   - Verify data returns
   - Check channel numbers

### Priority 2: Enable Auto-Sync (This Week)
1. **Fix team ID mapping** (1 hour)
   - Research TheSportsDB team IDs
   - Update sync service
   - Test with all 5 teams

2. **Add cron job** (30 min)
   - Update `initCronJobs.ts`
   - Set to run at 3 AM daily
   - Test manual trigger

3. **Test full sync** (30 min)
   - Trigger sync
   - Verify events populate
   - Check for duplicates

### Priority 3: Production Ready (Next Week)
1. **Upgrade TheSportsDB** (5 min)
   - Sign up for Patreon ($3/month)
   - Update API key in .env
   - Test enhanced features

2. **Add Fire Cube integration** (2-3 hours)
   - Link content to events
   - Generate deep links
   - Test on actual devices

3. **Documentation** (1 hour)
   - Update README
   - Create operator guide
   - Document troubleshooting

---

## Effort Estimates

| Phase | Task | Estimated Time |
|-------|------|----------------|
| **Phase 1** | Quick Start Testing | 1-2 hours |
| **Phase 2** | TheSportsDB Integration | 3-4 hours |
| **Phase 3** | Automated Scheduling | 2-3 hours |
| **Phase 4** | Fire Cube Integration | 2-3 hours |
| **Phase 5** | Rail Media Enhancement | 1-2 hours |
| **Testing** | Full QA & Validation | 2-3 hours |
| **Documentation** | Guides & Troubleshooting | 1-2 hours |
| **TOTAL** | **Complete Implementation** | **12-19 hours** |

**Recommended Timeline:**
- **Week 1:** Phases 1-2 (Quick Start + TheSportsDB)
- **Week 2:** Phase 3 (Automated Scheduling)
- **Week 3:** Phases 4-5 (Fire Cube + Rail Media)
- **Week 4:** Testing + Documentation

---

## Quick Start: Test Data Population

### SQL Script for Test Data
```sql
-- Test Sports Events for Wisconsin Teams
-- Execute: sqlite3 /home/ubuntu/sports-bar-data/production.db < test_sports_data.sql

-- Green Bay Packers vs Chicago Bears (NFL)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nfl-1',
  'Football', 'NFL', 'Chicago Bears @ Green Bay Packers',
  'Green Bay Packers', 'Chicago Bears',
  '2025-11-09T13:00:00.000Z', '13:00',
  'Lambeau Field', 'Green Bay', 'USA', 'FOX',
  'high', 1, 'scheduled',
  'NFC North Division rivalry game',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Bucks vs Cleveland Cavaliers (NBA)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-nba-1',
  'Basketball', 'NBA', 'Milwaukee Bucks vs Cleveland Cavaliers',
  'Milwaukee Bucks', 'Cleveland Cavaliers',
  '2025-11-05T19:00:00.000Z', '19:00',
  'Fiserv Forum', 'Milwaukee', 'USA', 'ESPN',
  'normal', 1, 'scheduled',
  'Eastern Conference matchup',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Iowa Hawkeyes (NCAA Football)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-fb-1',
  'Football', 'NCAA-FB', 'Wisconsin Badgers vs Iowa Hawkeyes',
  'University Of Wisconsin Badgers', 'Iowa Hawkeyes',
  '2025-11-08T19:30:00.000Z', '19:30',
  'Camp Randall Stadium', 'Madison', 'USA', 'BTN',
  'high', 1, 'scheduled',
  'Big Ten Conference game',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Milwaukee Brewers vs Chicago Cubs (MLB)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-mlb-1',
  'Baseball', 'MLB', 'Milwaukee Brewers vs Chicago Cubs',
  'Milwaukee Brewers', 'Chicago Cubs',
  '2025-11-15T13:10:00.000Z', '13:10',
  'American Family Field', 'Milwaukee', 'USA', 'FS1',
  'normal', 1, 'scheduled',
  'NL Central Division game',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Wisconsin Badgers vs Michigan State (NCAA Basketball)
INSERT INTO SportsEvent (
  id, sport, league, eventName, homeTeam, awayTeam,
  eventDate, eventTime, venue, city, country, channel,
  importance, isHomeTeamFavorite, status, description,
  createdAt, updatedAt
) VALUES (
  'test-ncaa-bb-1',
  'Basketball', 'NCAA-BB', 'Wisconsin Badgers vs Michigan State Spartans',
  'University Of Wisconsin Badgers', 'Michigan State Spartans',
  '2025-11-12T20:00:00.000Z', '20:00',
  'Kohl Center', 'Madison', 'USA', 'ESPN2',
  'normal', 1, 'scheduled',
  'Big Ten Conference basketball',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Verify insertion
SELECT COUNT(*) as total_events FROM SportsEvent;
SELECT sport, league, COUNT(*) as count FROM SportsEvent GROUP BY sport, league;
```

### Execute Test Data
```bash
# Save SQL to file
cat > /tmp/test_sports_data.sql << 'EOF'
[SQL from above]
EOF

# Execute
sqlite3 /home/ubuntu/sports-bar-data/production.db < /tmp/test_sports_data.sql

# Verify
sqlite3 /home/ubuntu/sports-bar-data/production.db "SELECT eventName, eventDate, channel FROM SportsEvent"
```

### Test UI
```bash
# Navigate to sports guide
# URL: http://localhost:3000/sports-guide

# Or use API
curl http://localhost:3000/api/sports/upcoming?days=14 | jq
```

---

## Recommendations

### Immediate (Do First)
1. ✅ **Insert test data** - Verify UI and database work correctly
2. ✅ **Test Rail Media API** - Confirm API keys are functional
3. ⚠️ **Upgrade TheSportsDB** - Get Patreon subscription for production

### Short-term (This Month)
1. Implement TheSportsDB sync service
2. Add cron job for daily updates
3. Link Fire Cube sports content
4. Test with real devices

### Long-term (Future)
1. Add more data sources (ESPN API, etc.)
2. Implement live score updates
3. Add betting odds integration
4. Create analytics dashboard
5. Add SMS/email notifications for favorite team games

---

## API Key Management

### Current Keys
```env
# .env file
SPORTS_GUIDE_API_KEY=12548RK0000000d2bb701f55b82bfa192e680985919
SPORTS_GUIDE_USER_ID=258351
SPORTS_GUIDE_API_URL=https://guide.thedailyrail.com/api/v1
```

### Needed Keys
```env
# TheSportsDB (upgrade recommended)
THESPORTSDB_API_KEY=3  # Currently free tier
# Upgrade to: Patreon key ($3/month)

# Future integrations
ESPN_API_KEY=  # Optional
SPORTRADAR_API_KEY=  # Optional (live scores)
```

---

## Conclusion

The Sports Bar TV Controller has excellent infrastructure for sports guide data, but requires data population and sync automation. The system supports three output types (Cable/CEC, DirecTV/IR, Fire Cube) and has proper database schema with favorite team tracking.

**Key Blockers:**
1. Zero events currently in database
2. No automated sync configured
3. TheSportsDB using limited free tier
4. Fire Cube content not linked to events

**Path Forward:**
1. Start with test data (Phase 1)
2. Implement TheSportsDB sync (Phase 2)
3. Automate with cron jobs (Phase 3)
4. Enhance Fire Cube integration (Phase 4)

**Total Effort:** 12-19 hours for complete implementation
**Timeline:** 3-4 weeks for production-ready system

---

## Contact & Support

**System Location:** De Pere, Wisconsin (ZIP: 54114)
**Timezone:** America/Chicago
**Database:** `/home/ubuntu/sports-bar-data/production.db`
**Environment:** `/home/ubuntu/Sports-Bar-TV-Controller/.env`

**API Documentation:**
- Rail Media: https://guide.thedailyrail.com/api/v1
- TheSportsDB: https://www.thesportsdb.com/api.php

---

**Document Version:** 1.0
**Last Updated:** November 2, 2025
**Author:** System Analysis & Integration Planning
