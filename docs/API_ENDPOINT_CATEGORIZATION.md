# API Endpoint Categorization

**Complete catalog of all 250 API endpoints organized by feature area**

**Generated:** November 6, 2025
**Total Endpoints:** 250

---

## Category Summary

| Category | Endpoint Count | Rate Limit Config |
|----------|---------------|-------------------|
| Authentication | 11 | AUTH (10/min) |
| Fire TV Devices | 8 | HARDWARE (60/min) |
| DirecTV Devices | 12 | HARDWARE (60/min) |
| IR Devices & Global Cache | 41 | HARDWARE (60/min) |
| CEC Control | 13 | HARDWARE (60/min) |
| Matrix & Video Routing | 17 | HARDWARE (60/min) |
| Audio Control (Atlas/General) | 28 | HARDWARE (60/min) |
| Soundtrack Integration | 8 | EXTERNAL (20/min) |
| Sports Guide & Entertainment | 21 | SPORTS_DATA (30/min) |
| Channel Management | 10 | SPORTS_DATA (30/min) |
| Scheduling & Automation | 14 | SCHEDULER (30/min) |
| AI & Analytics | 17 | AI (5/min) |
| System Management | 13 | SYSTEM (100/min) |
| Logging & Monitoring | 17 | DATABASE_READ (60/min) |
| Memory Bank & RAG | 10 | DEFAULT (30/min) |
| File Operations | 16 | FILE_OPS (20/min) |
| Git & GitHub | 5 | GIT (10/min) |
| Streaming Platforms | 9 | EXTERNAL (20/min) |
| Testing | 4 | TESTING (50/min) |
| Todo Management | 7 | DEFAULT (30/min) |
| Other | 9 | Various |

---

## 1. Authentication (11 endpoints)

**Rate Limit:** AUTH (10 requests/minute)

1. `POST /api/auth/login` - Authenticate with PIN
2. `POST /api/auth/logout` - End session
3. `GET /api/auth/session` - Get current session info
4. `GET /api/auth/pins` - List all PINs
5. `POST /api/auth/pins` - Create new PIN
6. `GET /api/auth/audit-log` - View authentication logs
7. `GET /api/auth/api-keys` - List API keys
8. `POST /api/auth/api-keys` - Create API key
9. `GET /api/api-keys` - List API keys (legacy)
10. `POST /api/api-keys` - Create API key (legacy)
11. `DELETE /api/api-keys/[id]` - Delete API key

---

## 2. Fire TV Devices (8 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)

1. `GET /api/firetv-devices` - List all Fire TV devices
2. `POST /api/firetv-devices` - Add new Fire TV device
3. `PUT /api/firetv-devices` - Update Fire TV device
4. `DELETE /api/firetv-devices` - Delete Fire TV device
5. `POST /api/firetv-devices/test-connection` - Test device connection
6. `POST /api/firetv-devices/send-command` - Send ADB command
7. `GET /api/firetv-devices/connection-status` - Get connection status
8. `GET /api/firetv-devices/guide-data` - Get guide data for device

---

## 3. DirecTV Devices (12 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)

1. `GET /api/directv-devices` - List all DirecTV devices
2. `POST /api/directv-devices` - Add new DirecTV device
3. `PUT /api/directv-devices` - Update DirecTV device
4. `DELETE /api/directv-devices` - Delete DirecTV device
5. `POST /api/directv-devices/test-connection` - Test device connection
6. `POST /api/directv-devices/send-command` - Send command to receiver
7. `POST /api/directv-devices/smart-channel-change` - AI-powered channel change
8. `GET /api/directv-devices/guide-data` - Get guide data
9. `POST /api/directv-devices/diagnose` - Run diagnostics
10. `GET /api/directv-devices/ai-insights` - Get AI insights
11. `POST /api/directv-devices/resolve-alert` - Resolve device alert
12. `GET /api/directv-logs` - View DirecTV logs

---

## 4. IR Devices & Global Cache (41 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)

### IR Devices (Main API)
1. `GET /api/ir-devices` - List all IR devices
2. `POST /api/ir-devices` - Add new IR device
3. `PUT /api/ir-devices` - Update IR device
4. `DELETE /api/ir-devices` - Delete IR device
5. `POST /api/ir-devices/send-command` - Send IR command
6. `POST /api/ir-devices/send-ip-command` - Send IP-based IR command
7. `POST /api/ir-devices/test-connection` - Test iTach connection
8. `POST /api/ir-devices/learn` - Learn IR code from remote
9. `POST /api/ir-devices/start-learning` - Start learning session
10. `POST /api/ir-devices/stop-learning` - Stop learning session
11. `GET /api/ir-devices/search-codes` - Search IR code database
12. `GET /api/ir-devices/model-codes` - Get codes for device model

### IR Database
13. `GET /api/ir/database/brands` - List device brands
14. `GET /api/ir/database/types` - List device types
15. `GET /api/ir/database/models` - List device models
16. `GET /api/ir/database/functions` - List IR functions
17. `GET /api/ir/database/download` - Download code database
18. `GET /api/ir/credentials` - Get IR database credentials

### IR Devices (Alternate API)
19. `GET /api/ir/devices` - List IR devices
20. `POST /api/ir/devices` - Create IR device
21. `GET /api/ir/devices/[id]` - Get IR device details
22. `PUT /api/ir/devices/[id]` - Update IR device
23. `DELETE /api/ir/devices/[id]` - Delete IR device
24. `GET /api/ir/devices/[id]/commands` - List device commands
25. `POST /api/ir/devices/[id]/load-template` - Load code template
26. `GET /api/ir/templates` - List code templates
27. `POST /api/ir/learn` - Learn IR code

### IR Commands
28. `GET /api/ir/commands` - List all IR commands
29. `POST /api/ir/commands` - Create IR command
30. `GET /api/ir/commands/[id]` - Get command details
31. `PUT /api/ir/commands/[id]` - Update IR command
32. `DELETE /api/ir/commands/[id]` - Delete IR command
33. `POST /api/ir/commands/send` - Send IR command

### Global Cache (iTach IP2IR)
34. `GET /api/globalcache/devices` - List iTach devices
35. `POST /api/globalcache/devices` - Add iTach device
36. `GET /api/globalcache/devices/[id]` - Get device details
37. `PUT /api/globalcache/devices/[id]` - Update device
38. `DELETE /api/globalcache/devices/[id]` - Delete device
39. `POST /api/globalcache/devices/[id]/test` - Test device connection
40. `GET /api/globalcache/ports/[id]` - Get port configuration
41. `POST /api/globalcache/learn` - Learn IR code via iTach

---

## 5. CEC Control (13 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)
**Note:** Deprecated for Spectrum cable boxes (use IR instead)

1. `GET /api/cec/devices` - List CEC devices
2. `POST /api/cec/devices` - Add CEC device
3. `GET /api/cec/status` - Get CEC device status
4. `POST /api/cec/command` - Send CEC command
5. `POST /api/cec/power-control` - Control TV power
6. `POST /api/cec/enhanced-control` - Enhanced CEC control
7. `GET /api/cec/config` - Get CEC configuration
8. `POST /api/cec/config` - Update CEC config
9. `POST /api/cec/initialize` - Initialize CEC adapter
10. `POST /api/cec/scan` - Scan for CEC devices
11. `GET /api/cec/monitor` - Monitor CEC bus
12. `POST /api/cec/discovery` - Discover cable boxes
13. `GET /api/cec/discovery/status` - Discovery status
14. `GET /api/cec/tv-documentation` - Get TV manual docs
15. `POST /api/cec/fetch-tv-manual` - Fetch TV manual

---

## 6. Matrix & Video Routing (17 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)

### Wolf Pack Matrix
1. `POST /api/matrix/command` - Send matrix command
2. `GET /api/matrix/routes` - Get active routes
3. `POST /api/matrix/route` - Route input to output
4. `GET /api/matrix/config` - Get matrix config
5. `POST /api/matrix/config` - Update matrix config
6. `POST /api/matrix/test-connection` - Test matrix connection
7. `POST /api/matrix/initialize-connection` - Initialize connection
8. `POST /api/matrix/switch-input-enhanced` - Enhanced input switching
9. `GET /api/matrix/video-input-selection` - Get input selection
10. `GET /api/matrix/outputs-schedule` - Get output schedules
11. `GET /api/matrix-config` - Get matrix config (alt)
12. `GET /api/matrix-display` - Get display configuration
13. `POST /api/matrix/config/cec-input` - Configure CEC input
14. `GET /api/matrix/connection-manager` - Get connection status

### Wolf Pack Specific
15. `GET /api/wolfpack/inputs` - List available inputs
16. `GET /api/wolfpack/current-routings` - Get current routings
17. `POST /api/wolfpack/route-to-matrix` - Route to matrix
18. `POST /api/wolfpack/ai-analysis` - AI routing analysis

---

## 7. Audio Control (28 endpoints)

**Rate Limit:** HARDWARE (60 requests/minute)

### Audio Processor (Generic)
1. `GET /api/audio-processor` - List audio processors
2. `POST /api/audio-processor` - Add audio processor
3. `POST /api/audio-processor/control` - Send control command
4. `GET /api/audio-processor/zones` - Get audio zones
5. `GET /api/audio-processor/inputs` - Get audio inputs
6. `GET /api/audio-processor/outputs` - Get audio outputs
7. `GET /api/audio-processor/input-levels` - Get input levels
8. `POST /api/audio-processor/matrix-routing` - Audio matrix routing
9. `GET /api/audio-processor/meter-status` - Get meter status
10. `POST /api/audio-processor/test-connection` - Test processor connection

### Per-Device Audio Control
11. `GET /api/audio-processor/[id]/zones-status` - Get zone status
12. `POST /api/audio-processor/[id]/input-gain` - Set input gain
13. `GET /api/audio-processor/[id]/adjustment-history` - Get adjustment history
14. `POST /api/audio-processor/[id]/ai-gain-control` - AI gain optimization
15. `POST /api/audio-processor/[id]/ai-monitoring` - AI monitoring

### AtlasIED Processor
16. `GET /api/atlas/configuration` - Get Atlas config
17. `POST /api/atlas/configuration` - Update Atlas config
18. `POST /api/atlas/upload-config` - Upload configuration
19. `GET /api/atlas/download-config` - Download configuration
20. `GET /api/atlas/sources` - Get audio sources
21. `GET /api/atlas/groups` - Get zone groups
22. `POST /api/atlas/recall-scene` - Recall audio scene
23. `POST /api/atlas/route-matrix-to-zone` - Route matrix to zone
24. `POST /api/atlas/query-hardware` - Query hardware directly
25. `GET /api/atlas/input-meters` - Get input meters
26. `GET /api/atlas/output-meters` - Get output meters
27. `POST /api/atlas/meter-monitoring` - Start meter monitoring
28. `POST /api/atlas/ai-analysis` - AI audio analysis

---

## 8. Soundtrack Integration (8 endpoints)

**Rate Limit:** EXTERNAL (20 requests/minute)

1. `GET /api/soundtrack/config` - Get Soundtrack config
2. `POST /api/soundtrack/config` - Update Soundtrack config
3. `GET /api/soundtrack/now-playing` - Get now playing
4. `GET /api/soundtrack/players` - List players
5. `GET /api/soundtrack/stations` - List stations
6. `GET /api/soundtrack/account` - Get account info
7. `POST /api/soundtrack/test` - Test API connection
8. `POST /api/soundtrack/diagnose` - Run diagnostics
9. `GET /api/soundtrack/cache` - Get cached data

---

## 9. Sports Guide & Entertainment (21 endpoints)

**Rate Limit:** SPORTS_DATA (30 requests/minute)

1. `GET /api/sports-guide` - Get sports programming guide
2. `POST /api/sports-guide` - Fetch guide (with params)
3. `GET /api/sports-guide/channels` - Get channel guide
4. `GET /api/sports-guide/status` - Get guide status
5. `GET /api/sports-guide/current-time` - Get current time
6. `GET /api/sports-guide/scheduled` - Get scheduled games
7. `POST /api/sports-guide/test-providers` - Test guide providers
8. `POST /api/sports-guide/update-key` - Update API key
9. `POST /api/sports-guide/verify-key` - Verify API key
10. `POST /api/sports-guide/ollama/query` - Query with Ollama
11. `GET /api/sports-guide-config` - Get guide config
12. `POST /api/sports-guide-config` - Update guide config
13. `GET /api/sports/upcoming` - Get upcoming games
14. `POST /api/sports/sync` - Sync sports data
15. `GET /api/leagues` - List sports leagues
16. `GET /api/selected-leagues` - Get selected leagues
17. `POST /api/selected-leagues` - Update selected leagues
18. `GET /api/home-teams` - Get home teams
19. `POST /api/home-teams` - Update home teams
20. `GET /api/tv-guide/unified` - Unified TV guide
21. `GET /api/tv-guide/gracenote` - Gracenote guide
22. `GET /api/tv-guide/spectrum-business` - Spectrum guide
23. `GET /api/unified-guide` - Unified guide (alt)
24. `GET /api/channel-guide` - Channel guide
25. `GET /api/tv-programming` - TV programming
26. `POST /api/tv-programming/scheduler` - Schedule TV program

---

## 10. Channel Management (10 endpoints)

**Rate Limit:** SPORTS_DATA (30 requests/minute)

1. `GET /api/channel-presets` - List all channel presets
2. `POST /api/channel-presets` - Create channel preset
3. `GET /api/channel-presets/[id]` - Get preset details
4. `PUT /api/channel-presets/[id]` - Update preset
5. `DELETE /api/channel-presets/[id]` - Delete preset
6. `POST /api/channel-presets/tune` - Tune to channel
7. `GET /api/channel-presets/by-device` - Get presets by device
8. `GET /api/channel-presets/statistics` - Get usage statistics
9. `POST /api/channel-presets/update-usage` - Update usage stats
10. `POST /api/channel-presets/reorder` - Reorder presets

---

## 11. Scheduling & Automation (14 endpoints)

**Rate Limit:** SCHEDULER (30 requests/minute)

1. `GET /api/schedules` - List all schedules
2. `POST /api/schedules` - Create schedule
3. `GET /api/schedules/[id]` - Get schedule details
4. `PUT /api/schedules/[id]` - Update schedule
5. `DELETE /api/schedules/[id]` - Delete schedule
6. `POST /api/schedules/execute` - Execute schedule manually
7. `GET /api/schedules/logs` - Get schedule logs
8. `GET /api/scheduled-commands` - List scheduled commands
9. `POST /api/scheduled-commands` - Create scheduled command
10. `GET /api/scheduler/status` - Get scheduler status
11. `POST /api/scheduler/manage` - Manage scheduler
12. `POST /api/cron/init` - Initialize cron jobs

---

## 12. AI & Analytics (17 endpoints)

**Rate Limit:** AI (5 requests/minute)

### AI Assistant
1. `POST /api/ai-assistant/search-code` - Search codebase
2. `POST /api/ai-assistant/index-codebase` - Index codebase
3. `GET /api/ai-assistant/logs` - Get AI logs
4. `POST /api/ai-assistant/analyze-logs` - Analyze logs with AI

### AI System
5. `GET /api/ai-system/status` - Get AI system status
6. `GET /api/ai-providers/status` - Get AI provider status
7. `POST /api/ai-providers/test` - Test AI providers
8. `GET /api/ai-hub/qa-training/stats` - Get QA stats

### AI-Powered Features
9. `POST /api/enhanced-chat` - Enhanced AI chat
10. `POST /api/chat` - Basic AI chat
11. `POST /api/devices/intelligent-diagnostics` - AI diagnostics
12. `POST /api/devices/ai-analysis` - AI device analysis
13. `POST /api/devices/execute-fix` - Execute AI fix
14. `GET /api/devices/smart-optimizer` - Smart optimization
15. `POST /api/devices/smart-optimizer/implement` - Implement optimization
16. `POST /api/devices/smart-optimizer/toggle` - Toggle optimizer
17. `POST /api/logs/ai-analysis` - AI log analysis
18. `POST /api/web-search` - AI web search

---

## 13. System Management (13 endpoints)

**Rate Limit:** SYSTEM (100 requests/minute)

1. `GET /api/system/health` - Comprehensive health check
2. `GET /api/system/health-check` - Basic health check
3. `GET /api/system/status` - System status
4. `POST /api/system/restart` - Restart application
5. `POST /api/system/reboot` - Reboot server
6. `GET /api/health` - Health endpoint (legacy)
7. `POST /api/startup` - Run startup tasks
8. `GET /api/test-env` - Test environment variables
9. `GET /api/device-subscriptions` - List subscriptions
10. `POST /api/device-subscriptions` - Create subscription
11. `GET /api/device-subscriptions/poll` - Poll for updates
12. `GET /api/circuit-breaker/status` - Get circuit breaker status
13. `GET /api/cache/stats` - Get cache statistics

---

## 14. Logging & Monitoring (17 endpoints)

**Rate Limit:** DATABASE_READ (60 requests/minute)

1. `GET /api/logs/recent` - Get recent logs
2. `GET /api/logs/error` - Get error logs
3. `GET /api/logs/operations` - Get operation logs
4. `GET /api/logs/user-action` - Get user action logs
5. `GET /api/logs/device-interaction` - Get device interaction logs
6. `GET /api/logs/performance` - Get performance logs
7. `GET /api/logs/analytics` - Get analytics
8. `GET /api/logs/stats` - Get log statistics
9. `POST /api/logs/export` - Export logs
10. `GET /api/logs/preview` - Preview logs
11. `GET /api/logs/config-change` - Get config change logs
12. `GET /api/logs/config-tracking` - Get config tracking
13. `GET /api/logs/channel-guide-tracking` - Get channel guide tracking
14. `POST /api/config/track-change` - Track config change
15. `GET /api/security/logs` - Get security logs
16. `GET /api/diagnostics/bartender-remote` - Bartender diagnostics
17. `GET /api/diagnostics/device-mapping` - Device mapping diagnostics

---

## 15. Memory Bank & RAG (10 endpoints)

**Rate Limit:** DEFAULT (30 requests/minute)

### Memory Bank
1. `GET /api/memory-bank/current` - Get latest snapshot
2. `GET /api/memory-bank/history` - List all snapshots
3. `POST /api/memory-bank/snapshot` - Create new snapshot
4. `GET /api/memory-bank/restore/[id]` - Restore specific snapshot
5. `POST /api/memory-bank/start-watching` - Start file watching
6. `POST /api/memory-bank/stop-watching` - Stop file watching

### RAG System
7. `GET /api/rag/stats` - Get vector store statistics
8. `POST /api/rag/query` - Query documentation
9. `POST /api/rag/rebuild` - Rebuild vector store
10. `GET /api/rag/docs` - List indexed documents

---

## 16. File Operations (16 endpoints)

**Rate Limit:** FILE_OPS (20 requests/minute)

### Document Management
1. `GET /api/documents/[id]` - Get document
2. `POST /api/documents/[id]` - Update document
3. `POST /api/documents/reprocess` - Reprocess documents

### File System
4. `POST /api/file-system/execute` - Execute file operation
5. `POST /api/file-system/manage` - Manage files
6. `POST /api/file-system/write-script` - Write script file
7. `POST /api/generate-script` - Generate script

### Backup & Upload
8. `POST /api/backup` - Create backup
9. `POST /api/upload` - Upload file
10. `GET /api/uploads/layouts/[filename]` - Get uploaded layout

### Bartender Layout
11. `GET /api/bartender/layout` - Get bartender layout
12. `POST /api/bartender/layout` - Update layout
13. `POST /api/bartender/layout/upload` - Upload layout
14. `POST /api/bartender/layout/backup` - Backup layout
15. `POST /api/bartender/layout/detect` - Detect layout
16. `POST /api/bartender/upload-layout` - Upload layout (legacy)

---

## 17. Git & GitHub (5 endpoints)

**Rate Limit:** GIT (10 requests/minute)

1. `GET /api/git/status` - Get git status
2. `POST /api/git/pull` - Pull latest changes
3. `POST /api/git/commit-push` - Commit and push
4. `POST /api/github/push-config` - Push config to GitHub
5. `POST /api/github/auto-config-sync` - Auto-sync config

---

## 18. Streaming Platforms (9 endpoints)

**Rate Limit:** EXTERNAL (20 requests/minute)

1. `GET /api/streaming-platforms/status` - Get streaming status
2. `POST /api/streaming-platforms/auth` - Authenticate platform
3. `GET /api/streaming-platforms/credentials` - Get credentials
4. `POST /api/streaming-platforms/credentials` - Update credentials
5. `GET /api/streaming/status` - Get streaming status
6. `GET /api/streaming/events` - Get streaming events
7. `POST /api/streaming/launch` - Launch streaming app
8. `GET /api/streaming/subscribed-apps` - Get subscribed apps
9. `POST /api/streaming/apps/detect` - Detect streaming apps

---

## 19. Testing (4 endpoints)

**Rate Limit:** TESTING (50 requests/minute)

1. `GET /api/tests/logs` - Get test logs
2. `POST /api/tests/run` - Run tests
3. `POST /api/tests/wolfpack/connection` - Test Wolf Pack connection
4. `POST /api/tests/wolfpack/switching` - Test Wolf Pack switching

---

## 20. Todo Management (7 endpoints)

**Rate Limit:** DEFAULT (30 requests/minute)

1. `GET /api/todos` - List all todos
2. `POST /api/todos` - Create todo
3. `GET /api/todos/[id]` - Get todo details
4. `PUT /api/todos/[id]` - Update todo
5. `DELETE /api/todos/[id]` - Delete todo
6. `POST /api/todos/[id]/complete` - Mark todo complete
7. `GET /api/todos/[id]/documents` - Get todo documents
8. `POST /api/todos/[id]/documents` - Add todo document

---

## 21. Other Endpoints (9 endpoints)

1. `GET /api/tv-brands` - List TV brands
2. `POST /api/tv-brands` - Add TV brand
3. `POST /api/tv-brands/detect` - Detect TV brand
4. `POST /api/unified-tv-control` - Unified TV control
5. `GET /api/design-feature` - Get design feature
6. `POST /api/n8n/webhook` - n8n webhook receiver (WEBHOOK rate limit)
7. `GET /api/keys` - List API keys (legacy)
8. `POST /api/keys` - Create API key (legacy)

---

## Endpoint Naming Conventions

### HTTP Methods
- `GET` - Retrieve data (no side effects)
- `POST` - Create new resource or execute action
- `PUT` - Update entire resource
- `PATCH` - Update partial resource (rarely used)
- `DELETE` - Delete resource

### Path Patterns
- Plural nouns for collections: `/api/devices`
- Singular for operations: `/api/device/test`
- Dynamic segments use brackets: `/api/devices/[id]`
- Actions as verbs: `/api/schedules/execute`
- Hierarchical relationships: `/api/audio-processor/[id]/zones`

### Query Parameters
- Filtering: `?type=cable&status=online`
- Pagination: `?limit=20&offset=0`
- Sorting: `?sortBy=name&sortOrder=asc`
- Search: `?query=espn`
- Date ranges: `?startDate=2025-11-01&endDate=2025-11-06`

---

## Rate Limit Implementation

All endpoints use the `withRateLimit` middleware with one of the predefined configs:

```typescript
const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
if (!rateLimit.allowed) {
  return rateLimit.response
}
```

Rate limit headers are automatically added to all responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Validation Implementation

All endpoints use Zod validation via the validation middleware:

```typescript
// POST/PUT/PATCH - Body validation
const bodyValidation = await validateRequestBody(request, schema)
if (!bodyValidation.success) return bodyValidation.error
const body = bodyValidation.data

// GET - Query parameter validation
const queryValidation = validateQueryParams(request, schema)
if (!queryValidation.success) return queryValidation.error
const params = queryValidation.data

// Dynamic routes - Path parameter validation
const pathValidation = validatePathParams({ id: params.id }, schema)
if (!pathValidation.success) return pathValidation.error
```

Common validation schemas are centralized in `/src/lib/validation/schemas.ts`.

---

## Common Patterns

### Device CRUD Pattern
Most device types follow this pattern:
- `GET /api/{device-type}` - List all
- `POST /api/{device-type}` - Create
- `PUT /api/{device-type}` - Update
- `DELETE /api/{device-type}` - Delete
- `POST /api/{device-type}/test-connection` - Test
- `POST /api/{device-type}/send-command` - Control

### Configuration Pattern
- `GET /api/{feature}/config` - Get configuration
- `POST /api/{feature}/config` - Update configuration

### Diagnostics Pattern
- `POST /api/{feature}/diagnose` - Run diagnostics
- `POST /api/{feature}/test` - Test functionality

### AI-Enhanced Pattern
- `POST /api/{feature}/ai-analysis` - Get AI analysis
- `POST /api/{feature}/ai-insights` - Get AI insights

---

## Authentication Requirements

Most endpoints do NOT require authentication for local network access.

**Requires Authentication:**
- Creating/updating/deleting resources (POST/PUT/DELETE)
- System management operations
- Configuration changes
- Security-sensitive operations

**No Authentication:**
- Reading data (GET)
- Sending device commands
- Querying information
- Health checks

---

## Deprecation Notes

### CEC Cable Box Control
**Deprecated for Spectrum/Charter cable boxes** - CEC is disabled in firmware.

**Migration Path:** Use IR learning system via `/api/ir-devices/learn`

See: `/docs/CEC_DEPRECATION_NOTICE.md` and `/docs/CEC_TO_IR_MIGRATION_GUIDE.md`

### Legacy Endpoints
Some endpoints have legacy versions for backward compatibility:
- `/api/api-keys` → Use `/api/auth/api-keys`
- `/api/health` → Use `/api/system/health`
- Various alternate paths maintained for compatibility

---

**Document Generated:** November 6, 2025
**Total Endpoints Cataloged:** 250
**Coverage:** 100%
