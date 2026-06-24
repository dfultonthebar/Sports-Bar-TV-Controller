// v2.48.5 (2026-05-18): 11 unused table definitions removed:
//   tvLayouts, matrixConfigs, audioMessages, audioScenes, bartenderRemotes,
//   deviceMappings, trainingDocuments, aiTvAvailability, aiGamePlanExecutions,
//   schedulingPreferences, aiScheduleSuggestions
// All had 0 code references (verified across apps/web/src + packages + scripts +
// tests). Actual SQLite tables in production.db are left intact per Standing
// Rule 3 (never drop DB in same pass as code). If you want the columns gone,
// add an explicit migration that runs DROP TABLE for each.

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Helper function for timestamp defaults (compatible with Prisma DATETIME format)
const timestamp = (name: string) => text(name)
const timestampNow = () => sql`CURRENT_TIMESTAMP`

// FireTV Device Model (expanded to be single source of truth — replaces firetv-devices.json)
export const fireTVDevices = sqliteTable('FireTVDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  port: integer('port').notNull().default(5555),
  macAddress: text('macAddress'),
  deviceType: text('deviceType').notNull().default('Fire TV Cube'), // 'Fire TV Cube', 'Atmosphere TV', 'Epson Projector', etc.
  inputChannel: integer('inputChannel'), // Wolf Pack matrix input number
  location: text('location'),
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
  adbEnabled: integer('adbEnabled', { mode: 'boolean' }),
  serialNumber: text('serialNumber'),
  deviceModel: text('deviceModel'),
  softwareVersion: text('softwareVersion'),
  model: text('model'), // Hardware model (e.g. 'HA90' for Epson)
  keepAwakeEnabled: integer('keepAwakeEnabled', { mode: 'boolean' }),
  keepAwakeStart: text('keepAwakeStart'),
  keepAwakeEnd: text('keepAwakeEnd'),
  status: text('status').notNull().default('offline'),
  lastSeen: timestamp('lastSeen'),
  addedAt: timestamp('addedAt'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Training Documents — DB-backed knowledge the local AI is trained on. Re-wired v2.82.x
// (was stripped in v2.48.5 as an unused orphan; operator 2026-06-23 wants the local AI to
// have all system knowledge → these rows are ingested into the RAG vector store so the
// chatbot answers from them, alongside the filesystem docs). Binds to the existing prod
// TrainingDocument table (no migration needed). Ingestion: scripts/index-training-docs.ts
// + the /api/training-docs POST path; RAG pickup via scan-system-docs.
export const trainingDocuments = sqliteTable('TrainingDocument', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  fileType: text('fileType').notNull().default('md'),
  fileName: text('fileName'),
  filePath: text('filePath'),
  fileSize: integer('fileSize'),
  category: text('category'),
  tags: text('tags'),                 // JSON array of strings
  description: text('description'),
  metadata: text('metadata'),         // JSON object
  processedAt: text('processedAt'),   // last time this row was indexed into RAG
  viewCount: integer('viewCount').notNull().default(0),
  lastViewed: text('lastViewed'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// DirecTV Device Model (single source of truth — replaces directv-devices.json)
export const direcTVDevices = sqliteTable('DirecTVDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  port: integer('port').notNull().default(8080),
  deviceType: text('deviceType').notNull().default('DirecTV'),
  inputChannel: integer('inputChannel'), // Wolf Pack matrix input number
  receiverId: text('receiverId'), // Receiver ID (e.g. '0330 7601 5313')
  receiverType: text('receiverType').default('Genie HD DVR'),
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  addedAt: timestamp('addedAt'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Streaming Services Master List
export const streamingServices = sqliteTable('StreamingService', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),  // ESPN+, Peacock, NBA League Pass, etc.
  stationCodes: text('stationCodes').notNull(),  // JSON array: ["ESPND", "ESPN+"]
  packages: text('packages').notNull(),  // JSON array: ["com.espn.gtv", "com.espn.score_center"]
  logoUrl: text('logoUrl'),
  category: text('category').notNull().default('sports'),  // sports, live_tv, streaming
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
})

// Bar's Streaming Subscriptions (what services the bar pays for)
export const streamingSubscriptions = sqliteTable('StreamingSubscription', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text('serviceId').notNull().references(() => streamingServices.id, { onDelete: 'cascade' }),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),  // e.g., "Annual subscription", "Shared with other location"
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Fire TV Device Logins (which services are logged in on which device)
export const deviceStreamingLogins = sqliteTable('DeviceStreamingLogin', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('deviceId').notNull(),  // Fire TV device ID (e.g., "amazon-1")
  serviceId: text('serviceId').notNull().references(() => streamingServices.id, { onDelete: 'cascade' }),
  isLoggedIn: integer('isLoggedIn', { mode: 'boolean' }).notNull().default(true),
  lastVerified: timestamp('lastVerified'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceServiceIdx: uniqueIndex('device_service_idx').on(table.deviceId, table.serviceId),
}))

// NFHS Network Games (High School Sports)
export const nfhsGames = sqliteTable('NFHSGame', {
  id: text('id').primaryKey(),
  schoolSlug: text('schoolSlug').notNull(),
  sport: text('sport').notNull(),
  level: text('level'),
  homeTeam: text('homeTeam').notNull(),
  awayTeam: text('awayTeam'),
  opponent: text('opponent'),
  date: text('date').notNull(),
  time: text('time'),
  dateTime: text('dateTime'),
  location: text('location'),
  status: text('status').notNull().default('upcoming'),
  eventUrl: text('eventUrl'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  schoolIdx: index('idx_nfhs_school').on(table.schoolSlug),
  statusIdx: index('idx_nfhs_status').on(table.status),
}))

// NFHS Network Schools tracked by this venue — hourly sync reads from this
// table to know which school pages to scrape. Per-location config: each
// sports bar adds the schools their customers care about.
export const nfhsSchools = sqliteTable('NFHSSchool', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Page slug from nfhsnetwork.com/schools/<slug> — e.g. "de-pere-high-school-de-pere-wi"
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),          // Display name: "De Pere Redbirds"
  city: text('city'),                    // "De Pere"
  state: text('state'),                  // "WI"
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  lastSyncedAt: text('lastSyncedAt'),
  lastSyncedGames: integer('lastSyncedGames').default(0),
  lastSyncError: text('lastSyncError'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  activeIdx: index('idx_nfhs_school_active').on(table.isActive),
}))

// Schedule Model
export const schedules = sqliteTable('Schedule', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  deviceId: text('deviceId').references(() => fireTVDevices.id, { onDelete: 'cascade' }),
  channelName: text('channelName'),
  channelNumber: text('channelNumber'),
  startTime: timestamp('startTime'),
  endTime: timestamp('endTime'),
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
  daysOfWeek: text('daysOfWeek'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastExecuted: timestamp('lastExecuted'),
  executionCount: integer('executionCount').notNull().default(0),
  lastResult: text('lastResult'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),

  // Smart scheduling specific fields
  description: text('description'),
  scheduleType: text('scheduleType'),
  executionTime: text('executionTime'),
  powerOnTVs: integer('powerOnTVs', { mode: 'boolean' }).default(true),
  powerOffTVs: integer('powerOffTVs', { mode: 'boolean' }).default(false),
  selectedOutputs: text('selectedOutputs'),
  setDefaultChannels: integer('setDefaultChannels', { mode: 'boolean' }).default(false),
  defaultChannelMap: text('defaultChannelMap'),
  inputDefaultChannels: text('inputDefaultChannels'), // JSON: Simplified approach - map input IDs to default channels { "input-uuid": "channel" }
  autoFindGames: integer('autoFindGames', { mode: 'boolean' }).default(false),
  monitorHomeTeams: integer('monitorHomeTeams', { mode: 'boolean' }).default(false),
  homeTeamIds: text('homeTeamIds'),
  preferredProviders: text('preferredProviders'),
  executionOrder: text('executionOrder'),
  delayBetweenCommands: integer('delayBetweenCommands'),
  nextExecution: text('nextExecution'),

  // Audio control fields
  audioSettings: text('audioSettings'), // JSON field for audio zone settings

  // Fill-with-sports strategy
  fillWithSports: integer('fillWithSports', { mode: 'boolean' }).default(true), // Show any live sports when home teams aren't playing
})

// Schedule Log Model
export const scheduleLogs = sqliteTable('ScheduleLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduleId: text('scheduleId').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  executedAt: timestamp('executedAt').notNull().default(timestampNow()),
  success: integer('success', { mode: 'boolean' }).notNull(),
  error: text('error'),
  channelName: text('channelName').notNull(),
  deviceName: text('deviceName').notNull(),
})

// Home Team Model
export const homeTeams = sqliteTable('HomeTeam', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamName: text('teamName').notNull(),
  sport: text('sport').notNull(),
  league: text('league').notNull(),
  category: text('category').notNull(),
  location: text('location'),
  conference: text('conference'),
  isPrimary: integer('isPrimary', { mode: 'boolean' }).notNull().default(false),
  logoUrl: text('logoUrl'),
  primaryColor: text('primaryColor'),
  secondaryColor: text('secondaryColor'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),

  // Fuzzy Matching Fields
  aliases: text('aliases'), // JSON array of team name variations
  cityAbbreviations: text('cityAbbreviations'), // JSON array of city abbreviations (e.g., ["MIL", "Milw"])
  teamAbbreviations: text('teamAbbreviations'), // JSON array of team abbreviations (e.g., ["UW", "Wisc"])
  commonVariations: text('commonVariations'), // JSON array of common name variations
  matchingStrategy: text('matchingStrategy').default('fuzzy'), // 'exact', 'fuzzy', 'alias', 'learned'
  minMatchConfidence: real('minMatchConfidence').default(0.7), // Minimum confidence score (0.0-1.0)

  // Scheduler Integration Fields
  minTVsWhenActive: integer('minTVsWhenActive').default(1), // Minimum TVs when game is on
  autoPromotePlayoffs: integer('autoPromotePlayoffs', { mode: 'boolean' }).default(true), // Auto-boost playoff games
  preferredZones: text('preferredZones'), // JSON array of preferred zone names (e.g., ["main", "bar"])
  rivalTeams: text('rivalTeams'), // JSON array of rival team names for bonus priority
  schedulerNotes: text('schedulerNotes'), // Admin notes for scheduling decisions

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  teamLeagueIdx: uniqueIndex('HomeTeam_teamName_league_key').on(table.teamName, table.league),
}))

// Team Name Matches - Learning system for fuzzy matching
export const teamNameMatches = sqliteTable('TeamNameMatch', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  guideTeamName: text('guideTeamName').notNull(), // Team name as it appeared in guide
  matchedTeamId: text('matchedTeamId').references(() => homeTeams.id, { onDelete: 'cascade' }), // Matched home team (nullable for no-match)
  matchedTeamName: text('matchedTeamName'), // Name of matched team (denormalized for speed)
  confidence: real('confidence').notNull(), // Match confidence score (0.0-1.0)
  matchMethod: text('matchMethod').notNull(), // 'exact', 'alias', 'fuzzy', 'partial', 'abbreviation', 'learned'
  sport: text('sport'), // Sport context for the match
  league: text('league'), // League context for the match
  isValidated: integer('isValidated', { mode: 'boolean' }).default(false), // Admin validated match
  isCorrect: integer('isCorrect', { mode: 'boolean' }), // Admin marked as correct/incorrect
  validatedBy: text('validatedBy'), // Admin user who validated
  validatedAt: timestamp('validatedAt'), // When validation occurred
  matchCount: integer('matchCount').notNull().default(1), // How many times this match occurred
  lastMatchedAt: timestamp('lastMatchedAt').notNull().default(timestampNow()), // Last occurrence
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  guideNameIdx: index('TeamNameMatch_guideTeamName_idx').on(table.guideTeamName),
  matchedTeamIdx: index('TeamNameMatch_matchedTeamId_idx').on(table.matchedTeamId),
  confidenceIdx: index('TeamNameMatch_confidence_idx').on(table.confidence),
}))

// TV Layout Model
// Matrix Config Model
// Matrix Configuration Model
export const matrixConfigurations = sqliteTable('MatrixConfiguration', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chassisId: text('chassisId'), // Links to wolfpack-devices.json entry (nullable for backward compat)
  name: text('name').notNull(),
  model: text('model').notNull().default('WP-36X36'), // Wolf Pack model (WP-4X4, WP-8X8, WP-16X16, WP-18X18, WP-36X36, WP-64X64)
  ipAddress: text('ipAddress').notNull(),
  tcpPort: integer('tcpPort').notNull().default(23),
  udpPort: integer('udpPort').notNull().default(4000),
  protocol: text('protocol').notNull().default('HTTP'),
  inputCount: integer('inputCount').notNull().default(36),
  outputCount: integer('outputCount').notNull().default(36),
  outputOffset: integer('outputOffset').notNull().default(0),
  audioOutputCount: integer('audioOutputCount').notNull().default(4),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Matrix Input Model
export const matrixInputs = sqliteTable('MatrixInput', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  configId: text('configId').notNull().references(() => matrixConfigurations.id, { onDelete: 'cascade' }),
  channelNumber: integer('channelNumber').notNull(),
  label: text('label').notNull(),
  inputType: text('inputType').notNull().default('HDMI'),
  deviceType: text('deviceType').notNull().default('Other'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('active'),
  powerOn: integer('powerOn', { mode: 'boolean' }).notNull().default(false),
  isSchedulingEnabled: integer('isSchedulingEnabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  configChannelIdx: uniqueIndex('MatrixInput_configId_channelNumber_key').on(table.configId, table.channelNumber),
}))

// Matrix Output Model
export const matrixOutputs = sqliteTable('MatrixOutput', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  configId: text('configId').notNull().references(() => matrixConfigurations.id, { onDelete: 'cascade' }),
  channelNumber: integer('channelNumber').notNull(),
  label: text('label').notNull(),
  resolution: text('resolution').notNull().default('1080p'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  isSchedulingEnabled: integer('isSchedulingEnabled', { mode: 'boolean' }).notNull().default(true), // Exclude audio-only outputs from AI scheduling
  status: text('status').notNull().default('active'),
  audioOutput: text('audioOutput'),
  powerOn: integer('powerOn', { mode: 'boolean' }).notNull().default(false),
  selectedVideoInput: integer('selectedVideoInput'),
  videoInputLabel: text('videoInputLabel'),
  dailyTurnOn: integer('dailyTurnOn', { mode: 'boolean' }).notNull().default(false),
  dailyTurnOff: integer('dailyTurnOff', { mode: 'boolean' }).notNull().default(false),
  tvBrand: text('tvBrand'),
  tvModel: text('tvModel'),
  cecAddress: text('cecAddress'),
  lastDiscovery: timestamp('lastDiscovery'),
  tvGroupId: text('tvGroupId'),  // Group ID for TVs that are physically close together (e.g., "group-1", "front-wall")
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  configChannelIdx: uniqueIndex('MatrixOutput_configId_channelNumber_key').on(table.configId, table.channelNumber),
}))

// Bartender Remote Model
// Device Mapping Model
// System Settings Model
export const systemSettings = sqliteTable('SystemSettings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Audio Processor Model
// Supports both AtlasIED and dbx ZonePRO processors
export const audioProcessors = sqliteTable('AudioProcessor', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  model: text('model').notNull(),
  // Processor type: 'atlas' for AtlasIED, 'dbx-zonepro' for dbx ZonePRO
  processorType: text('processorType').notNull().default('atlas'),
  ipAddress: text('ipAddress').notNull(),
  port: integer('port').notNull().default(80),
  tcpPort: integer('tcpPort').notNull().default(5321),
  // Connection type for dbx: 'ethernet' or 'rs232'
  connectionType: text('connectionType').notNull().default('ethernet'),
  // RS-232 settings (for dbx ZonePRO non-m models)
  serialPort: text('serialPort'),
  baudRate: integer('baudRate').default(57600),
  username: text('username'),
  password: text('password'),
  zones: integer('zones').notNull().default(4),
  description: text('description'),
  status: text('status').notNull().default('offline'),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  ipPortIdx: uniqueIndex('AudioProcessor_ipAddress_port_key').on(table.ipAddress, table.port),
}))

// Audio Zone Model
// Supports mono and stereo configurations for dbx ZonePRO
export const audioZones = sqliteTable('AudioZone', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  zoneNumber: integer('zoneNumber').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  currentSource: text('currentSource'),
  volume: integer('volume').notNull().default(50),
  muted: integer('muted', { mode: 'boolean' }).notNull().default(false),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  // Stereo/Mono configuration (primarily for dbx ZonePRO)
  // 'mono' = single channel, 'stereo-left' = left of pair, 'stereo-right' = right of pair
  channelMode: text('channelMode').notNull().default('mono'),
  // Links stereo pairs together (ID of the paired zone)
  pairedZoneId: text('pairedZoneId'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  processorZoneIdx: uniqueIndex('AudioZone_processorId_zoneNumber_key').on(table.processorId, table.zoneNumber),
}))

// Audio Group Model
export const audioGroups = sqliteTable('AudioGroup', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  groupNumber: integer('groupNumber').notNull(),
  name: text('name').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(false),
  currentSource: text('currentSource'),
  gain: real('gain').notNull().default(-10),
  muted: integer('muted', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  processorGroupIdx: uniqueIndex('AudioGroup_processorId_groupNumber_key').on(table.processorId, table.groupNumber),
}))

// Audio Scene Model
// Audio Message Model
// Audio Input Meter Model
export const audioInputMeters = sqliteTable('AudioInputMeter', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  inputNumber: integer('inputNumber').notNull(),
  inputName: text('inputName').notNull(),
  level: real('level').notNull().default(0),
  peak: real('peak').notNull().default(0),
  clipping: integer('clipping', { mode: 'boolean' }).notNull().default(false),
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  processorInputIdx: uniqueIndex('AudioInputMeter_processorId_inputNumber_key').on(table.processorId, table.inputNumber),
  processorTimeIdx: index('AudioInputMeter_processorId_timestamp_idx').on(table.processorId, table.timestamp),
}))

// Test Log Model
export const testLogs = sqliteTable('TestLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  testType: text('testType').notNull(),
  testName: text('testName').notNull(),
  status: text('status').notNull(),
  inputChannel: integer('inputChannel'),
  outputChannel: integer('outputChannel'),
  command: text('command'),
  response: text('response'),
  errorMessage: text('errorMessage'),
  duration: integer('duration'),
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
  metadata: text('metadata'),
}, (table) => ({
  testTypeIdx: index('TestLog_testType_idx').on(table.testType),
  statusIdx: index('TestLog_status_idx').on(table.status),
  timestampIdx: index('TestLog_timestamp_idx').on(table.timestamp),
}))

// Wolfpack Matrix Routing Model
export const wolfpackMatrixRoutings = sqliteTable('WolfpackMatrixRouting', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chassisId: text('chassisId'), // Links to wolfpack-devices.json chassis entry (nullable for backward compat)
  matrixOutputNumber: integer('matrixOutputNumber').notNull().unique(),
  wolfpackInputNumber: integer('wolfpackInputNumber').notNull(),
  wolfpackInputLabel: text('wolfpackInputLabel').notNull(),
  atlasInputLabel: text('atlasInputLabel'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  lastRouted: timestamp('lastRouted'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Wolfpack Matrix State Model
export const wolfpackMatrixStates = sqliteTable('WolfpackMatrixState', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chassisId: text('chassisId'), // Links to wolfpack-devices.json chassis entry (nullable for backward compat)
  matrixOutputNumber: integer('matrixOutputNumber').notNull(),
  wolfpackInputNumber: integer('wolfpackInputNumber').notNull(),
  wolfpackInputLabel: text('wolfpackInputLabel').notNull(),
  channelInfo: text('channelInfo'),
  routedAt: timestamp('routedAt').notNull().default(timestampNow()),
}, (table) => ({
  matrixOutputIdx: index('WolfpackMatrixState_matrixOutputNumber_idx').on(table.matrixOutputNumber),
  routedAtIdx: index('WolfpackMatrixState_routedAt_idx').on(table.routedAt),
}))

// Crestron Matrix Model
export const crestronMatrices = sqliteTable('CrestronMatrix', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  model: text('model').notNull(), // DM-MD8X8, DM-MD16X16, etc.
  ipAddress: text('ipAddress').notNull(),
  port: integer('port').notNull().default(23),
  username: text('username'),
  password: text('password'),
  description: text('description'),
  status: text('status').default('unknown'), // online, offline, unknown
  lastSeen: timestamp('lastSeen'),
  inputs: integer('inputs').notNull().default(8),
  outputs: integer('outputs').notNull().default(8),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Wolf Pack Multi-View Card Model
export const wolfpackMultiViewCards = sqliteTable('WolfpackMultiViewCard', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  startSlot: integer('startSlot').notNull(), // First of 4 consecutive slots (e.g., 21)
  endSlot: integer('endSlot').notNull(), // Last slot (startSlot + 3, e.g., 24)
  serialPort: text('serialPort').notNull(), // USB serial device, e.g., "/dev/ttyUSB0"
  baudRate: integer('baudRate').notNull().default(115200),
  currentMode: integer('currentMode').notNull().default(0), // 0-7 display modes
  inputAssignments: text('inputAssignments'), // JSON: { "window1": 5, "window2": 6, ... }
  status: text('status').default('unknown'), // online, offline, unknown
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Sports Guide Configuration Model
export const sportsGuideConfigurations = sqliteTable('SportsGuideConfiguration', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  zipCode: text('zipCode'),
  city: text('city'),
  state: text('state'),
  timezone: text('timezone').notNull().default('America/New_York'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// TV Provider Model
export const tvProviders = sqliteTable('TVProvider', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  type: text('type').notNull(),
  channels: text('channels').notNull(),
  packages: text('packages').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Provider Input Model
export const providerInputs = sqliteTable('ProviderInput', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  providerId: text('providerId').notNull().references(() => tvProviders.id, { onDelete: 'cascade' }),
  inputId: text('inputId').notNull(),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  providerInputIdx: uniqueIndex('ProviderInput_providerId_inputId_key').on(table.providerId, table.inputId),
}))

// Todo Model
export const todos = sqliteTable('Todo', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').notNull().default('MEDIUM'),
  status: text('status').notNull().default('PLANNED'),
  category: text('category'),
  tags: text('tags'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
  completedAt: timestamp('completedAt'),
})

// Todo Document Model
export const todoDocuments = sqliteTable('TodoDocument', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  todoId: text('todoId').notNull().references(() => todos.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  filepath: text('filepath').notNull(),
  filesize: integer('filesize'),
  mimetype: text('mimetype'),
  uploadedAt: timestamp('uploadedAt').notNull().default(timestampNow()),
}, (table) => ({
  todoIdIdx: index('TodoDocument_todoId_idx').on(table.todoId),
}))

// Indexed File Model
export const indexedFiles = sqliteTable('IndexedFile', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  filePath: text('filePath').notNull().unique(),
  fileName: text('fileName').notNull(),
  fileType: text('fileType').notNull(),
  content: text('content').notNull(),
  fileSize: integer('fileSize').notNull(),
  lastModified: timestamp('lastModified').notNull(),
  lastIndexed: timestamp('lastIndexed').notNull().default(timestampNow()),
  hash: text('hash').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  isActiveIdx: index('IndexedFile_isActive_idx').on(table.isActive),
  fileTypeIdx: index('IndexedFile_fileType_idx').on(table.fileType),
  lastIndexedIdx: index('IndexedFile_lastIndexed_idx').on(table.lastIndexed),
}))

// QA Entry Model
export const qaEntries = sqliteTable('QAEntry', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: text('category').notNull().default('general'),
  tags: text('tags'),
  sourceFile: text('sourceFile'),
  sourceType: text('sourceType').notNull().default('manual'),
  confidence: real('confidence').notNull().default(1.0),
  useCount: integer('useCount').notNull().default(0),
  lastUsed: timestamp('lastUsed'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  categoryIdx: index('QAEntry_category_idx').on(table.category),
  isActiveIdx: index('QAEntry_isActive_idx').on(table.isActive),
  sourceTypeIdx: index('QAEntry_sourceType_idx').on(table.sourceType),
  sourceFileIdx: index('QAEntry_sourceFile_idx').on(table.sourceFile),
}))

// Training Document Model (Enhanced)
// Scheduled Command Sequence Model
export const scheduledCommands = sqliteTable('ScheduledCommand', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  commandType: text('commandType').notNull(), // 'tv_power', 'cec', 'matrix', 'custom'
  targetType: text('targetType').notNull(), // 'all', 'specific', 'group'
  targets: text('targets').notNull(), // JSON array of target IDs
  commandSequence: text('commandSequence').notNull(), // JSON array of commands
  scheduleType: text('scheduleType').notNull(), // 'once', 'daily', 'weekly', 'monthly', 'cron'
  scheduleData: text('scheduleData').notNull(), // JSON schedule configuration
  cronExpression: text('cron_expression'), // Cron expression for 'cron' scheduleType (e.g., '0 19 * * 1')
  timezone: text('timezone').notNull().default('America/New_York'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastExecuted: timestamp('lastExecuted'),
  nextExecution: timestamp('nextExecution'),
  executionCount: integer('executionCount').notNull().default(0),
  failureCount: integer('failureCount').notNull().default(0),
  createdBy: text('createdBy'), // User who created it
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  commandTypeIdx: index('ScheduledCommand_commandType_idx').on(table.commandType),
  scheduleTypeIdx: index('ScheduledCommand_scheduleType_idx').on(table.scheduleType),
  enabledIdx: index('ScheduledCommand_enabled_idx').on(table.enabled),
  nextExecutionIdx: index('ScheduledCommand_nextExecution_idx').on(table.nextExecution),
}))

// Scheduled Command Execution Log Model
export const scheduledCommandLogs = sqliteTable('ScheduledCommandLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  scheduledCommandId: text('scheduledCommandId').notNull().references(() => scheduledCommands.id, { onDelete: 'cascade' }),
  executedAt: timestamp('executedAt').notNull().default(timestampNow()),
  success: integer('success', { mode: 'boolean' }).notNull(),
  commandsSent: integer('commandsSent').notNull().default(0),
  commandsFailed: integer('commandsFailed').notNull().default(0),
  executionTime: integer('executionTime'), // Milliseconds
  errorMessage: text('errorMessage'),
  details: text('details'), // JSON execution details
  targetResults: text('targetResults'), // JSON results per target
}, (table) => ({
  scheduledCommandIdIdx: index('ScheduledCommandLog_scheduledCommandId_idx').on(table.scheduledCommandId),
  executedAtIdx: index('ScheduledCommandLog_executedAt_idx').on(table.executedAt),
  successIdx: index('ScheduledCommandLog_success_idx').on(table.success),
}))

// API Key Model
export const apiKeys = sqliteTable('ApiKey', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text('provider').notNull(),
  keyName: text('keyName').notNull(),
  apiKey: text('apiKey').notNull(),
  endpoint: text('endpoint'),
  model: text('model'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  providerKeyNameIdx: uniqueIndex('ApiKey_provider_keyName_key').on(table.provider, table.keyName),
  providerIdx: index('ApiKey_provider_idx').on(table.provider),
  isActiveIdx: index('ApiKey_isActive_idx').on(table.isActive),
}))

// Cable Box Model
// DEPRECATED: This table is no longer used for CEC control
// Cable boxes should now be configured as IR devices in the irDevices table
// Keeping this table for historical data and potential migration
export const cableBoxes = sqliteTable('CableBox', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(), // e.g., "Cable Box 1"
  cecDeviceId: text('cecDeviceId'), // DEPRECATED: Foreign key removed, nullable for legacy data
  matrixInputId: text('matrixInputId'), // Link to matrix input
  provider: text('provider').notNull().default('spectrum'), // 'spectrum', 'xfinity', 'cox', etc.
  model: text('model').notNull().default('spectrum-100h'), // Cable box model
  lastChannel: text('lastChannel'), // Last tuned channel
  currentProgram: text('currentProgram'), // JSON: Current program/game info from sports guide
  currentProgramUpdatedAt: timestamp('currentProgramUpdatedAt'), // When currentProgram was last updated
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  matrixInputIdIdx: index('CableBox_matrixInputId_idx').on(table.matrixInputId),
}))

// QA Generation Job Model
export const qaGenerationJobs = sqliteTable('QAGenerationJob', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  status: text('status').notNull().default('pending'),
  sourceType: text('sourceType').notNull(),
  sourcePath: text('sourcePath'),
  totalFiles: integer('totalFiles').notNull().default(0),
  processedFiles: integer('processedFiles').notNull().default(0),
  generatedQAs: integer('generatedQAs').notNull().default(0),
  entriesGenerated: integer('entriesGenerated').notNull().default(0),
  errorMessage: text('errorMessage'),
  startedAt: timestamp('startedAt'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  statusIdx: index('QAGenerationJob_status_idx').on(table.status),
  createdAtIdx: index('QAGenerationJob_createdAt_idx').on(table.createdAt),
}))

// Processed File Model
export const processedFiles = sqliteTable('ProcessedFile', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  filePath: text('filePath').notNull().unique(),
  fileHash: text('fileHash').notNull(),
  lastProcessed: timestamp('lastProcessed').notNull().default(timestampNow()),
  qaCount: integer('qaCount').notNull().default(0),
  sourceType: text('sourceType').notNull(),
  status: text('status').notNull().default('processed'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  statusIdx: index('ProcessedFile_status_idx').on(table.status),
  sourceTypeIdx: index('ProcessedFile_sourceType_idx').on(table.sourceType),
  lastProcessedIdx: index('ProcessedFile_lastProcessed_idx').on(table.lastProcessed),
}))

// Global Cache Device Model
export const globalCacheDevices = sqliteTable('GlobalCacheDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  port: integer('port').notNull().default(4998),
  model: text('model'),
  status: text('status').notNull().default('offline'),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  statusIdx: index('GlobalCacheDevice_status_idx').on(table.status),
  ipAddressIdx: index('GlobalCacheDevice_ipAddress_idx').on(table.ipAddress),
}))

// Global Cache Port Model
export const globalCachePorts = sqliteTable('GlobalCachePort', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('deviceId').notNull().references(() => globalCacheDevices.id, { onDelete: 'cascade' }),
  portNumber: integer('portNumber').notNull(),
  portType: text('portType').notNull().default('IR'),
  assignedTo: text('assignedTo'),
  assignedDeviceId: text('assignedDeviceId'),
  irCodeSet: text('irCodeSet'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  devicePortIdx: uniqueIndex('GlobalCachePort_deviceId_portNumber_key').on(table.deviceId, table.portNumber),
  deviceIdIdx: index('GlobalCachePort_deviceId_idx').on(table.deviceId),
  assignedDeviceIdIdx: index('GlobalCachePort_assignedDeviceId_idx').on(table.assignedDeviceId),
}))

// IR Device Model
export const irDevices = sqliteTable('IRDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  deviceType: text('deviceType').notNull(),
  brand: text('brand').notNull(),
  model: text('model'),
  matrixInput: integer('matrixInput'),
  matrixInputLabel: text('matrixInputLabel'),
  irCodeSetId: text('irCodeSetId'),
  irCodes: text('irCodes'), // JSON object of learned IR codes {command: irCode}
  globalCacheDeviceId: text('globalCacheDeviceId'),
  globalCachePortNumber: integer('globalCachePortNumber'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceTypeIdx: index('IRDevice_deviceType_idx').on(table.deviceType),
  brandIdx: index('IRDevice_brand_idx').on(table.brand),
  matrixInputIdx: index('IRDevice_matrixInput_idx').on(table.matrixInput),
  globalCacheDeviceIdIdx: index('IRDevice_globalCacheDeviceId_idx').on(table.globalCacheDeviceId),
}))

// IR Command Model
export const irCommands = sqliteTable('IRCommand', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('deviceId').notNull().references(() => irDevices.id, { onDelete: 'cascade' }),
  functionName: text('functionName').notNull(),
  irCode: text('irCode').notNull(),
  hexCode: text('hexCode'),
  codeSetId: text('codeSetId'),
  category: text('category'),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceFunctionIdx: uniqueIndex('IRCommand_deviceId_functionName_key').on(table.deviceId, table.functionName),
  deviceIdIdx: index('IRCommand_deviceId_idx').on(table.deviceId),
  functionNameIdx: index('IRCommand_functionName_idx').on(table.functionName),
  categoryIdx: index('IRCommand_category_idx').on(table.category),
}))

// IR Database Credentials Model
export const irDatabaseCredentials = sqliteTable('IRDatabaseCredentials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  apiKey: text('apiKey'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  lastLogin: timestamp('lastLogin'),
  dailyLimit: integer('dailyLimit').notNull().default(50),
  usedToday: integer('usedToday').notNull().default(0),
  lastReset: timestamp('lastReset').notNull().default(timestampNow()),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  isActiveIdx: index('IRDatabaseCredentials_isActive_idx').on(table.isActive),
}))

// Chat Session Model (for AI chat functionality)
export const chatSessions = sqliteTable('ChatSession', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title'),
  messages: text('messages').notNull(), // JSON string of messages
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Document Model (for uploaded documents)
export const documents = sqliteTable('Document', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  filename: text('filename').notNull(),
  originalName: text('originalName').notNull(),
  filePath: text('filePath').notNull(),
  fileSize: integer('fileSize').notNull(),
  mimeType: text('mimeType').notNull(),
  content: text('content'), // Extracted text content for AI processing
  embeddings: text('embeddings'), // JSON string of embeddings for vector search
  uploadedAt: timestamp('uploadedAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Channel Preset Model
export const channelPresets = sqliteTable('ChannelPreset', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(), // User-friendly name like "ESPN", "Fox Sports", "NFL RedZone"
  channelNumber: text('channelNumber').notNull(), // Channel number to tune to (e.g., "206", "212")
  deviceType: text('deviceType').notNull(), // "cable" or "directv"
  order: integer('order').notNull().default(0), // Display order in the list
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  usageCount: integer('usageCount').notNull().default(0), // Track how many times this preset has been used
  lastUsed: timestamp('lastUsed'), // Track when this preset was last used
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceTypeOrderIdx: index('ChannelPreset_deviceType_order_idx').on(table.deviceType, table.order),
  isActiveIdx: index('ChannelPreset_isActive_idx').on(table.isActive),
  usageCountIdx: index('ChannelPreset_usageCount_idx').on(table.usageCount),
}))

// Matrix Route Model (for tracking matrix routing)
export const matrixRoutes = sqliteTable('MatrixRoute', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  chassisId: text('chassisId'), // Links to wolfpack-devices.json chassis entry (nullable for backward compat)
  inputNum: integer('inputNum').notNull(),
  outputNum: integer('outputNum').notNull().unique(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
  // Bartender manual override protection (protects TV routing from AI scheduler)
  manualOverrideUntil: timestamp('manualOverrideUntil'), // When override expires
  lastManualChangeBy: text('lastManualChangeBy'), // Who made the change (bartender ID)
  lastManualChangeAt: timestamp('lastManualChangeAt'), // When the manual change was made
}, (table) => ({
  outputNumIdx: index('MatrixRoute_outputNum_idx').on(table.outputNum),
}))

// Input Current Channel Model (for tracking current channel per matrix input)
export const inputCurrentChannels = sqliteTable('InputCurrentChannel', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inputNum: integer('inputNum').notNull().unique(), // Matrix input number
  inputLabel: text('inputLabel').notNull(), // Matrix input label (e.g., "Cable Box 1")
  deviceType: text('deviceType').notNull(), // "cable" or "directv"
  deviceId: text('deviceId'), // Reference to the actual device (IR device ID, DirecTV IP, etc.)
  channelNumber: text('channelNumber').notNull(), // Current channel number
  channelName: text('channelName'), // Channel preset name if available
  showName: text('showName'), // Current show/program name from guide data
  presetId: text('presetId'), // Reference to channel preset if used
  lastTuned: timestamp('lastTuned').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),

  // Manual Override Protection Fields
  manualOverrideUntil: timestamp('manualOverrideUntil'), // Timestamp until which this input is protected from auto-scheduling
  lastManualChangeBy: text('lastManualChangeBy'), // Session ID or user identifier who made the manual change
  lastManualChangeAt: timestamp('lastManualChangeAt'), // When the manual change was made
}, (table) => ({
  inputNumIdx: index('InputCurrentChannel_inputNum_idx').on(table.inputNum),
  deviceTypeIdx: index('InputCurrentChannel_deviceType_idx').on(table.deviceType),
  manualOverrideIdx: index('InputCurrentChannel_manualOverrideUntil_idx').on(table.manualOverrideUntil),
}))

// Per-input channel lists — each matrix input (especially DirecTV) can have
// its own curated channel list. Falls back to global ChannelPreset if absent.
export const inputChannelLists = sqliteTable('InputChannelList', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  matrixInputId: integer('matrixInputId').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

export const inputChannelListEntries = sqliteTable('InputChannelListEntry', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  listId: text('listId').notNull().references(() => inputChannelLists.id, { onDelete: 'cascade' }),
  channelNumber: text('channelNumber').notNull(),
  channelName: text('channelName').notNull(),
  callsign: text('callsign'),
  network: text('network'),
  category: text('category').notNull().default('sports'),
  isHD: integer('isHD', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('displayOrder').notNull().default(0),
  source: text('source').notNull().default('manual'),
  lastVerified: text('lastVerified'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  listIdIdx: index('InputChannelListEntry_listId_idx').on(table.listId),
  listChannelIdx: uniqueIndex('InputChannelListEntry_listId_channelNumber_key').on(table.listId, table.channelNumber),
  isActiveIdx: index('InputChannelListEntry_isActive_idx').on(table.isActive),
}))

// Append-only history of every tune attempt (success or failure).
// InputCurrentChannel holds only the latest channel per input, so older
// tunes are lost. This table preserves the full rolling sequence so we can
// answer "what changed on input N after 4pm?" after the fact.
export const channelTuneLogs = sqliteTable('ChannelTuneLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inputNum: integer('inputNum'),
  inputLabel: text('inputLabel'),
  deviceType: text('deviceType').notNull(),
  deviceId: text('deviceId'),
  cableBoxId: text('cableBoxId'),
  channelNumber: text('channelNumber').notNull(),
  channelName: text('channelName'),
  presetId: text('presetId'),
  triggeredBy: text('triggeredBy').notNull().default('bartender'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),
  durationMs: integer('durationMs'),
  correlationId: text('correlationId'),
  tunedAt: timestamp('tunedAt').notNull().default(timestampNow()),
}, (table) => ({
  tunedAtIdx: index('ChannelTuneLog_tunedAt_idx').on(table.tunedAt),
  inputNumIdx: index('ChannelTuneLog_inputNum_idx').on(table.inputNum),
  deviceTypeIdx: index('ChannelTuneLog_deviceType_idx').on(table.deviceType),
}))

// AI Gain Configuration Model
export const aiGainConfigurations = sqliteTable('AIGainConfiguration', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  inputNumber: integer('inputNumber').notNull(),
  inputName: text('inputName').notNull(),
  targetLevel: real('targetLevel').notNull().default(-20),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  lastAdjustment: timestamp('lastAdjustment'),
  adjustmentCount: integer('adjustmentCount').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  processorInputIdx: uniqueIndex('AIGainConfiguration_processorId_inputNumber_key').on(table.processorId, table.inputNumber),
}))

// AI Gain Adjustment Log Model
export const aiGainAdjustmentLogs = sqliteTable('AIGainAdjustmentLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  configId: text('configId').notNull().references(() => aiGainConfigurations.id, { onDelete: 'cascade' }),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  inputNumber: integer('inputNumber').notNull(),
  previousLevel: real('previousLevel').notNull(),
  newLevel: real('newLevel').notNull(),
  adjustment: real('adjustment').notNull(),
  reason: text('reason'),
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  configIdIdx: index('AIGainAdjustmentLog_configId_idx').on(table.configId),
  timestampIdx: index('AIGainAdjustmentLog_timestamp_idx').on(table.timestamp),
}))

// Soundtrack Configuration Model
export const soundtrackConfigs = sqliteTable('SoundtrackConfig', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  apiKey: text('apiKey').notNull(),
  accountId: text('accountId'),
  accountName: text('accountName'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  lastSync: timestamp('lastSync'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Soundtrack Player Model
export const soundtrackPlayers = sqliteTable('SoundtrackPlayer', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  configId: text('configId').notNull().references(() => soundtrackConfigs.id, { onDelete: 'cascade' }),
  playerId: text('playerId').notNull(),
  playerName: text('playerName').notNull(),
  locationName: text('locationName'),
  audioZoneId: text('audioZoneId').references(() => audioZones.id),
  bartenderVisible: integer('bartenderVisible', { mode: 'boolean' }).notNull().default(false),
  displayOrder: integer('displayOrder').notNull().default(0),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  configIdIdx: index('SoundtrackPlayer_configId_idx').on(table.configId),
  playerIdIdx: uniqueIndex('SoundtrackPlayer_playerId_key').on(table.playerId),
}))

// Selected League Model (for sports guide)
export const selectedLeagues = sqliteTable('SelectedLeague', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  league: text('league').notNull().unique(), // e.g., "NFL", "NBA", "MLB", "NHL"
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  leagueIdx: index('SelectedLeague_league_idx').on(table.league),
  priorityIdx: index('SelectedLeague_priority_idx').on(table.priority),
}))

// Atlas Parameters Model (for dynamic parameter mappings and state persistence)
export const atlasParameters = sqliteTable('AtlasParameter', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  paramName: text('paramName').notNull(), // e.g., 'ZoneGain_0', 'SourceMute_1'
  paramType: text('paramType').notNull(), // e.g., 'ZoneGain', 'ZoneMute', 'ZoneSource', 'SourceMute', etc.
  paramIndex: integer('paramIndex').notNull(), // Index number (0-based)
  displayName: text('displayName'), // User-friendly name for the parameter
  minValue: real('minValue'), // Minimum value (for gain/volume parameters)
  maxValue: real('maxValue'), // Maximum value (for gain/volume parameters)
  currentValue: text('currentValue'), // Current value (stored as string, can be number or text)
  format: text('format').notNull().default('val'), // 'val', 'pct', or 'str'
  readOnly: integer('readOnly', { mode: 'boolean' }).notNull().default(false), // Whether parameter is read-only
  isSubscribed: integer('isSubscribed', { mode: 'boolean' }).notNull().default(false), // Whether we're subscribed to updates
  lastUpdated: timestamp('lastUpdated'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  processorParamIdx: uniqueIndex('AtlasParameter_processorId_paramName_key').on(table.processorId, table.paramName),
  processorTypeIdx: index('AtlasParameter_processorId_paramType_idx').on(table.processorId, table.paramType),
}))

// Atlas Meter Readings Model (for real-time audio metering via UDP)
export const atlasMeterReadings = sqliteTable('AtlasMeterReading', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  meterType: text('meterType').notNull(), // 'ZoneMeter', 'SourceMeter', 'InputMeter', 'OutputMeter'
  meterIndex: integer('meterIndex').notNull(), // Index number (0-based)
  meterName: text('meterName'), // Display name
  level: real('level').notNull(), // Current level in dB
  peak: real('peak'), // Peak level
  clipping: integer('clipping', { mode: 'boolean' }).notNull().default(false), // Clipping indicator
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  processorMeterIdx: index('AtlasMeterReading_processorId_meterType_meterIndex_idx').on(table.processorId, table.meterType, table.meterIndex),
  timestampIdx: index('AtlasMeterReading_timestamp_idx').on(table.timestamp),
}))

// Atlas Connection State Model (for tracking connection status and keep-alive)
export const atlasConnectionStates = sqliteTable('AtlasConnectionState', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().unique().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  isConnected: integer('isConnected', { mode: 'boolean' }).notNull().default(false),
  lastConnected: timestamp('lastConnected'),
  lastDisconnected: timestamp('lastDisconnected'),
  lastKeepAlive: timestamp('lastKeepAlive'),
  connectionErrors: integer('connectionErrors').notNull().default(0),
  lastError: text('lastError'),
  reconnectAttempts: integer('reconnectAttempts').notNull().default(0),
  tcpPort: integer('tcpPort').notNull().default(5321), // TCP control port
  udpPort: integer('udpPort').notNull().default(3131), // UDP metering port
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})


// ============================================================================
// FIRECUBE MODELS
// ============================================================================

export const fireCubeDevices = sqliteTable('FireCubeDevice', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  port: integer('port').notNull().default(5555),
  macAddress: text('macAddress'),
  serialNumber: text('serialNumber').unique(),
  deviceModel: text('deviceModel'),
  softwareVersion: text('softwareVersion'),
  location: text('location'),
  matrixInputChannel: integer('matrixInputChannel'),
  adbEnabled: integer('adbEnabled', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('discovered'),
  lastSeen: text('lastSeen'),
  keepAwakeEnabled: integer('keepAwakeEnabled', { mode: 'boolean' }).notNull().default(false),
  keepAwakeStart: text('keepAwakeStart').default('07:00'),
  keepAwakeEnd: text('keepAwakeEnd').default('01:00'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull(),
})

export const fireCubeApps = sqliteTable('FireCubeApp', {
  id: text('id').primaryKey(),
  deviceId: text('deviceId').notNull().references(() => fireCubeDevices.id, { onDelete: 'cascade' }),
  packageName: text('packageName').notNull(),
  appName: text('appName').notNull(),
  version: text('version'),
  versionCode: integer('versionCode'),
  category: text('category'),
  iconUrl: text('iconUrl'),
  isSystemApp: integer('isSystemApp', { mode: 'boolean' }).notNull().default(false),
  isSportsApp: integer('isSportsApp', { mode: 'boolean' }).notNull().default(false),
  hasSubscription: integer('hasSubscription', { mode: 'boolean' }).notNull().default(false),
  subscriptionStatus: text('subscriptionStatus'),
  lastChecked: text('lastChecked'),
  installedAt: text('installedAt'),
  updatedAt: text('updatedAt').notNull(),
}, (table) => ({
  deviceIdPackageNameIdx: uniqueIndex('FireCubeApp_deviceId_packageName_key').on(table.deviceId, table.packageName),
  deviceIdIdx: index('FireCubeApp_deviceId_idx').on(table.deviceId),
}))

export const fireCubeSportsContents = sqliteTable('FireCubeSportsContent', {
  id: text('id').primaryKey(),
  appId: text('appId').notNull().references(() => fireCubeApps.id, { onDelete: 'cascade' }),
  deviceId: text('deviceId').notNull().references(() => fireCubeDevices.id, { onDelete: 'cascade' }),
  contentTitle: text('contentTitle').notNull(),
  contentType: text('contentType').notNull(),
  league: text('league'),
  teams: text('teams'),
  startTime: text('startTime'),
  endTime: text('endTime'),
  channel: text('channel'),
  isLive: integer('isLive', { mode: 'boolean' }).notNull().default(false),
  deepLink: text('deepLink'),
  thumbnailUrl: text('thumbnailUrl'),
  description: text('description'),
  lastUpdated: text('lastUpdated').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  deviceIdIdx: index('FireCubeSportsContent_deviceId_idx').on(table.deviceId),
}))

export const fireCubeSideloadOperations = sqliteTable('FireCubeSideloadOperation', {
  id: text('id').primaryKey(),
  sourceDeviceId: text('sourceDeviceId').notNull().references(() => fireCubeDevices.id, { onDelete: 'cascade' }),
  targetDeviceIds: text('targetDeviceIds').notNull(),
  packageName: text('packageName').notNull(),
  appName: text('appName').notNull(),
  status: text('status').notNull().default('pending'),
  progress: integer('progress').notNull().default(0),
  totalDevices: integer('totalDevices').notNull(),
  completedDevices: integer('completedDevices').notNull().default(0),
  failedDevices: integer('failedDevices').notNull().default(0),
  errorLog: text('errorLog'),
  startedAt: text('startedAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completedAt'),
}, (table) => ({
  statusIdx: index('FireCubeSideloadOperation_status_idx').on(table.status),
  startedAtIdx: index('FireCubeSideloadOperation_startedAt_idx').on(table.startedAt),
}))

export const fireCubeKeepAwakeLogs = sqliteTable('FireCubeKeepAwakeLog', {
  id: text('id').primaryKey(),
  deviceId: text('deviceId').notNull().references(() => fireCubeDevices.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),
  timestamp: text('timestamp').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  deviceIdIdx: index('FireCubeKeepAwakeLog_deviceId_idx').on(table.deviceId),
  timestampIdx: index('FireCubeKeepAwakeLog_timestamp_idx').on(table.timestamp),
}))

// Sports Events Model - Track upcoming games for AI awareness
export const sportsEvents = sqliteTable('SportsEvent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  externalId: text('externalId'), // TheSportsDB event ID
  sport: text('sport').notNull(),
  league: text('league').notNull(),
  eventName: text('eventName').notNull(),
  homeTeam: text('homeTeam').notNull(),
  awayTeam: text('awayTeam').notNull(),
  homeTeamId: text('homeTeamId').references(() => homeTeams.id),
  eventDate: timestamp('eventDate').notNull(),
  eventTime: text('eventTime'),
  venue: text('venue'),
  city: text('city'),
  country: text('country'),
  channel: text('channel'),
  importance: text('importance').notNull().default('normal'), // 'low', 'normal', 'high', 'critical'
  isHomeTeamFavorite: integer('isHomeTeamFavorite', { mode: 'boolean' }).default(false),
  preGameCheckCompleted: integer('preGameCheckCompleted', { mode: 'boolean' }).default(false),
  preGameCheckTime: timestamp('preGameCheckTime'),
  status: text('status').notNull().default('scheduled'), // 'scheduled', 'in_progress', 'completed', 'cancelled'
  thumbnail: text('thumbnail'),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  eventDateIdx: index('SportsEvent_eventDate_idx').on(table.eventDate),
  leagueIdx: index('SportsEvent_league_idx').on(table.league),
  statusIdx: index('SportsEvent_status_idx').on(table.status),
  importanceIdx: index('SportsEvent_importance_idx').on(table.importance),
}))

// Sports Event Sync Log - Track when we last synced schedules
export const sportsEventSyncLogs = sqliteTable('SportsEventSyncLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  league: text('league').notNull(),
  teamName: text('teamName'),
  syncType: text('syncType').notNull(), // 'manual', 'auto', 'startup'
  eventsFound: integer('eventsFound').notNull(),
  eventsAdded: integer('eventsAdded').notNull(),
  eventsUpdated: integer('eventsUpdated').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),
  syncedAt: timestamp('syncedAt').notNull().default(timestampNow()),
}, (table) => ({
  syncedAtIdx: index('SportsEventSyncLog_syncedAt_idx').on(table.syncedAt),
  leagueIdx: index('SportsEventSyncLog_league_idx').on(table.league),
}))

// Security Validation Log Model - Track security validation events
export const securityValidationLogs = sqliteTable('SecurityValidationLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  validationType: text('validationType').notNull(), // 'file_system', 'code_execution', 'bash_command', 'resource_limit'
  operationType: text('operationType'), // e.g., 'read', 'write', 'execute', 'delete'
  allowed: integer('allowed', { mode: 'boolean' }).notNull(),
  blockedReason: text('blockedReason'), // Reason if blocked
  blockedPatterns: text('blockedPatterns'), // JSON array of matched patterns
  requestPath: text('requestPath'), // File path or command that was validated
  requestContent: text('requestContent'), // Sanitized content of the request
  sanitizedInput: text('sanitizedInput'), // JSON of sanitized input if allowed
  severity: text('severity').notNull().default('info'), // 'info', 'warning', 'critical'
  ipAddress: text('ipAddress'), // IP address of requester if available
  userId: text('userId'), // User ID if available
  sessionId: text('sessionId'), // Session ID if available
  metadata: text('metadata'), // Additional JSON metadata
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  validationTypeIdx: index('SecurityValidationLog_validationType_idx').on(table.validationType),
  allowedIdx: index('SecurityValidationLog_allowed_idx').on(table.allowed),
  severityIdx: index('SecurityValidationLog_severity_idx').on(table.severity),
  timestampIdx: index('SecurityValidationLog_timestamp_idx').on(table.timestamp),
  userIdIdx: index('SecurityValidationLog_userId_idx').on(table.userId),
}))

// ============================================================================
// NETWORK TV CONTROL MODELS
// ============================================================================

// Network TV Device Model - For IP-controlled TVs (Samsung, LG, Sony, Roku, etc.)
export const networkTVDevices = sqliteTable('NetworkTVDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'), // User-assigned display name (e.g., "Bar TV 1", "Pool Table")
  ipAddress: text('ipAddress').notNull().unique(),
  macAddress: text('macAddress'),
  brand: text('brand').notNull(), // 'samsung', 'lg', 'sony', 'roku', 'vizio', 'sharp', 'hisense'
  model: text('model'),
  port: integer('port').notNull(),

  // Brand-specific authentication credentials (encrypted in production)
  authToken: text('authToken'), // For Samsung/Vizio
  clientKey: text('clientKey'), // For LG
  psk: text('psk'), // Pre-shared key for Sony

  // Status
  status: text('status').notNull().default('offline'), // 'online', 'offline', 'pairing'
  lastSeen: timestamp('lastSeen'),

  // Matrix Integration
  matrixOutputId: text('matrixOutputId').references(() => matrixOutputs.id, { onDelete: 'set null' }),

  // Current state
  currentInput: text('currentInput'), // Last known HDMI input: 'hdmi1', 'hdmi2', 'hdmi3', 'hdmi4'

  // Capabilities
  supportsPower: integer('supportsPower', { mode: 'boolean' }).notNull().default(true),
  supportsVolume: integer('supportsVolume', { mode: 'boolean' }).notNull().default(true),
  supportsInput: integer('supportsInput', { mode: 'boolean' }).notNull().default(true),

  // Timestamps
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  brandIdx: index('NetworkTVDevice_brand_idx').on(table.brand),
  statusIdx: index('NetworkTVDevice_status_idx').on(table.status),
  matrixOutputIdIdx: index('NetworkTVDevice_matrixOutputId_idx').on(table.matrixOutputId),
  ipAddressIdx: index('NetworkTVDevice_ipAddress_idx').on(table.ipAddress),
}))

// ============================================================================
// AUTHENTICATION & AUTHORIZATION MODELS
// ============================================================================

// Location Model - For multi-location future support
export const locations = sqliteTable('Location', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(), // e.g., "Main Street Bar"
  description: text('description'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zipCode'),
  timezone: text('timezone').notNull().default('America/New_York'),
  // v2.51.2 — geocoded coordinates for this bar. Populated by
  // packages/utils/src/geocoder.ts via OSM Nominatim API when the
  // operator saves an address via the System Admin UI, OR by running
  // `npx tsx scripts/geocode-location.ts` once. Used by the neighborhood
  // RF prediction pipeline (NeighborhoodVenue distance computation +
  // weekly Overpass venue auto-discovery). Null until geocoded.
  latitude: real('latitude'),
  longitude: real('longitude'),
  // ISO timestamp of last successful geocode. Used to avoid re-geocoding
  // every save if the address hasn't changed.
  lastGeocodedAt: text('lastGeocodedAt'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata'), // JSON for future extensibility
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  isActiveIdx: index('Location_isActive_idx').on(table.isActive),
}))

// Auth PIN Model - Simple PIN-based authentication
export const authPins = sqliteTable('AuthPin', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('locationId').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'STAFF' or 'ADMIN'
  pinHash: text('pinHash').notNull(), // bcrypt hashed PIN
  description: text('description'), // e.g., "Bartender PIN", "Manager PIN"
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  expiresAt: timestamp('expiresAt'), // Optional expiration
  createdBy: text('createdBy'), // Session ID of who created it
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  locationIdIdx: index('AuthPin_locationId_idx').on(table.locationId),
  roleIdx: index('AuthPin_role_idx').on(table.role),
  isActiveIdx: index('AuthPin_isActive_idx').on(table.isActive),
}))

// Session Model - Track active sessions
export const sessions = sqliteTable('Session', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('locationId').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'STAFF' or 'ADMIN'
  ipAddress: text('ipAddress').notNull(),
  userAgent: text('userAgent'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  expiresAt: timestamp('expiresAt').notNull(),
  lastActivity: timestamp('lastActivity').notNull().default(timestampNow()),
}, (table) => ({
  locationIdIdx: index('Session_locationId_idx').on(table.locationId),
  isActiveIdx: index('Session_isActive_idx').on(table.isActive),
  expiresAtIdx: index('Session_expiresAt_idx').on(table.expiresAt),
  lastActivityIdx: index('Session_lastActivity_idx').on(table.lastActivity),
}))

// API Key Model - For webhooks and automation
export const authApiKeys = sqliteTable('AuthApiKey', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('locationId').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // e.g., "N8N Webhook", "Scheduler"
  keyHash: text('keyHash').notNull(), // bcrypt hashed API key
  permissions: text('permissions').notNull(), // JSON array of allowed endpoint patterns
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  expiresAt: timestamp('expiresAt'), // Optional expiration
  lastUsed: timestamp('lastUsed'),
  usageCount: integer('usageCount').notNull().default(0),
  createdBy: text('createdBy'), // Session ID of who created it
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  locationIdIdx: index('AuthApiKey_locationId_idx').on(table.locationId),
  isActiveIdx: index('AuthApiKey_isActive_idx').on(table.isActive),
  lastUsedIdx: index('AuthApiKey_lastUsed_idx').on(table.lastUsed),
}))

// Audit Log Model - Track administrative actions
export const auditLogs = sqliteTable('AuditLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('locationId').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  sessionId: text('sessionId').references(() => sessions.id, { onDelete: 'set null' }),
  apiKeyId: text('apiKeyId').references(() => authApiKeys.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g., 'SYSTEM_REBOOT', 'DELETE_PRESET', 'PIN_CREATED'
  resource: text('resource').notNull(), // e.g., 'system', 'preset', 'auth_pin'
  resourceId: text('resourceId'), // ID of the affected resource
  endpoint: text('endpoint').notNull(), // API endpoint called
  method: text('method').notNull(), // HTTP method (GET, POST, DELETE, etc.)
  ipAddress: text('ipAddress').notNull(),
  userAgent: text('userAgent'),
  requestData: text('requestData'), // JSON of sanitized request data
  responseStatus: integer('responseStatus'), // HTTP response code
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),
  metadata: text('metadata'), // Additional JSON metadata
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  locationIdIdx: index('AuditLog_locationId_idx').on(table.locationId),
  sessionIdIdx: index('AuditLog_sessionId_idx').on(table.sessionId),
  apiKeyIdIdx: index('AuditLog_apiKeyId_idx').on(table.apiKeyId),
  actionIdx: index('AuditLog_action_idx').on(table.action),
  resourceIdx: index('AuditLog_resource_idx').on(table.resource),
  timestampIdx: index('AuditLog_timestamp_idx').on(table.timestamp),
  successIdx: index('AuditLog_success_idx').on(table.success),
}))

// ============================================================================
// SMART SCHEDULING & TOURNAMENT TRACKING MODELS
// ============================================================================

// Game Schedules Model - Track game schedules from ESPN API
export const gameSchedules = sqliteTable('game_schedules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // ESPN Data
  espnEventId: text('espn_event_id').unique().notNull(),
  espnCompetitionId: text('espn_competition_id').notNull(),
  sport: text('sport').notNull(),
  league: text('league').notNull(),

  // Teams
  homeTeamId: text('home_team_id'),
  awayTeamId: text('away_team_id'),
  homeTeamEspnId: text('home_team_espn_id').notNull(),
  awayTeamEspnId: text('away_team_espn_id').notNull(),
  homeTeamName: text('home_team_name').notNull(),
  awayTeamName: text('away_team_name').notNull(),
  homeTeamAbbr: text('home_team_abbr'),
  awayTeamAbbr: text('away_team_abbr'),

  // Timing
  scheduledStart: integer('scheduled_start').notNull(), // Unix timestamp
  estimatedEnd: integer('estimated_end').notNull(), // Unix timestamp
  actualStart: integer('actual_start'), // Unix timestamp
  actualEnd: integer('actual_end'), // Unix timestamp
  durationMinutes: integer('duration_minutes'), // actual duration once game ends

  // Game Status
  status: text('status').notNull().default('scheduled'), // 'scheduled', 'delayed', 'in_progress', 'halftime', 'final', 'postponed', 'cancelled'
  statusDetail: text('status_detail'), // "8:32 - 3rd Quarter", "Halftime", "Final"
  currentPeriod: integer('current_period'), // 1, 2, 3, 4 (or innings, etc.)
  clockTime: text('clock_time'), // "8:32"

  // Scoring
  homeScore: integer('home_score').default(0),
  awayScore: integer('away_score').default(0),

  // Playoff/Tournament
  seasonType: integer('season_type').notNull(), // 1=Pre, 2=Regular, 3=Playoff, 4=Off
  seasonYear: integer('season_year').notNull(),
  weekNumber: integer('week_number'),
  weekText: text('week_text'), // "Week 11", "Wild Card", "Super Bowl"
  playoffRound: text('playoff_round'), // "Wild Card", "Divisional Round", "Conference Championship", "Super Bowl"
  tournamentName: text('tournament_name'), // "NCAA Tournament", "March Madness"

  // Broadcasting
  primaryNetwork: text('primary_network'), // "ESPN", "FOX", "NBC"
  broadcastNetworks: text('broadcast_networks'), // JSON array of all networks
  streamingServices: text('streaming_services'), // JSON array ["ESPN+", "Paramount+"]

  // Venue
  venueName: text('venue_name'),
  venueCity: text('venue_city'),
  venueState: text('venue_state'),
  isNeutralSite: integer('is_neutral_site', { mode: 'boolean' }).default(false),

  // Priority Calculation
  calculatedPriority: integer('calculated_priority').default(0),
  priorityFactors: text('priority_factors'), // JSON explaining priority calculation
  isPriorityGame: integer('is_priority_game', { mode: 'boolean' }).default(false),

  // Metadata
  lastSynced: integer('last_synced').default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  syncSource: text('sync_source').default('espn'),
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
}, (table) => ({
  scheduledStartIdx: index('GameSchedule_scheduledStart_idx').on(table.scheduledStart),
  statusIdx: index('GameSchedule_status_idx').on(table.status),
  homeTeamIdIdx: index('GameSchedule_homeTeamId_idx').on(table.homeTeamId),
  awayTeamIdIdx: index('GameSchedule_awayTeamId_idx').on(table.awayTeamId),
  isPriorityGameIdx: index('GameSchedule_isPriorityGame_scheduledStart_idx').on(table.isPriorityGame, table.scheduledStart),
  seasonTypeIdx: index('GameSchedule_seasonType_scheduledStart_idx').on(table.seasonType, table.scheduledStart),
  espnEventIdIdx: index('GameSchedule_espnEventId_idx').on(table.espnEventId),
  leagueIdx: index('GameSchedule_league_idx').on(table.league),
}))

// Input Sources Model - Registry of all input sources (cable boxes, Fire TVs, etc.)
export const inputSources = sqliteTable('input_sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Basic Info
  name: text('name').notNull(), // "Main Cable Box", "Fire TV #1"
  type: text('type').notNull(), // 'cable', 'directv', 'firetv', 'stream'

  // Connection Info
  deviceId: text('device_id'), // Reference to cableBoxes, fireTVDevices, etc.
  connectionType: text('connection_type'), // 'hdmi', 'component', 'network'
  matrixInputId: text('matrix_input_id'), // Which HDMI input on matrix this connects to

  // Capabilities
  availableNetworks: text('available_networks').notNull(), // JSON array ["ESPN", "FOX", "NBC", "Bally Sports"]
  installedApps: text('installed_apps'), // JSON array (for streaming devices)
  maxQuality: text('max_quality'), // '4k', '1080p', '720p'

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  currentlyAllocated: integer('currently_allocated', { mode: 'boolean' }).default(false),
  currentChannel: text('current_channel'), // for cable/directv
  currentApp: text('current_app'), // for streaming

  // Priority
  priorityRank: integer('priority_rank').default(50), // higher = preferred (cable > directv > streaming)

  // Metadata
  notes: text('notes'),
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
}, (table) => ({
  typeIdx: index('InputSource_type_idx').on(table.type),
  isActiveIdx: index('InputSource_isActive_currentlyAllocated_idx').on(table.isActive, table.currentlyAllocated),
  deviceIdIdx: index('InputSource_deviceId_idx').on(table.deviceId),
}))

// Input Source Allocations Model - Track which input is allocated to which game
export const inputSourceAllocations = sqliteTable('input_source_allocations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Input Source
  inputSourceId: text('input_source_id').notNull().references(() => inputSources.id, { onDelete: 'cascade' }),
  inputSourceType: text('input_source_type').notNull(), // 'cable', 'directv', 'firetv', 'stream'

  // Game
  gameScheduleId: text('game_schedule_id').notNull().references(() => gameSchedules.id, { onDelete: 'cascade' }),

  // Channel/App Info
  channelNumber: text('channel_number'), // for cable/directv
  appName: text('app_name'), // for streaming devices
  streamUrl: text('stream_url'), // for web streams
  // v2.32.85 — per-event deep link captured by the firetv-catalog walker.
  // When set, the scheduler-service passes this through to the tune
  // executor so the Fire TV opens directly to the specific game (autoplay
  // path in adb-client.launchPrimeVideoToContent / launchEspnToLiveContent)
  // instead of just the app's home screen. Mirrors the Watch button's
  // game.channel.deepLink — bartender Schedule button captures it from the
  // same field on the channel-guide program. Pre-fix, scheduled tunes for
  // streaming games landed on the app's home screen at game-time.
  deepLink: text('deep_link'),

  // TV Outputs Allocated
  tvOutputIds: text('tv_output_ids').notNull(), // JSON array of matrix output IDs
  tvCount: integer('tv_count').notNull(),

  // Timing
  allocatedAt: integer('allocated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  expectedFreeAt: integer('expected_free_at').notNull(), // Unix timestamp (estimated game end + buffer)
  actuallyFreedAt: integer('actually_freed_at'), // Unix timestamp

  // Revert bookkeeping (v2.26.1)
  // Set when the auto-reallocator's revert-sweep has processed this
  // allocation — regardless of whether it actually tuned TVs (a revert
  // can be skipped if another game starts on the same input within 30
  // min, but we still mark it attempted so the sweep doesn't re-scan).
  // NULL = allocation has not yet been through the revert sweep.
  // Existing rows are backfilled to `actually_freed_at` on first deploy
  // so pre-v2.26.1 completed allocations don't get retroactively reverted.
  revertAttemptedAt: integer('revert_attempted_at'),

  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'completed', 'preempted', 'cancelled'

  // Source tracking
  scheduledBy: text('scheduled_by').default('ai'), // 'bartender', 'ai' - who created this schedule

  // Preemption Tracking
  preemptedByAllocationId: text('preempted_by_allocation_id').references(() => inputSourceAllocations.id, { onDelete: 'set null' }),
  preemptedReason: text('preempted_reason'),

  // Audio routing
  audioSourceIndex: integer('audio_source_index'),
  audioSourceName: text('audio_source_name'),
  audioZoneIds: text('audio_zone_ids'), // JSON array of zone numbers

  // Quality of Service
  allocationQuality: text('allocation_quality'), // 'optimal', 'suboptimal', 'degraded'
  qualityNotes: text('quality_notes'), // explanation of quality rating

  // Closed-loop verification (v2.55.81+ — Wave 3 routeAndVerify)
  // After a tune/route command is acked, the scheduler reads the device
  // state back (matrix route via queryWolfpackRouteState, DirecTV via
  // getTuned, Fire TV via getCurrentApp) and records whether the TV is
  // ACTUALLY showing the intended input. ADVISORY ONLY — a failed verify
  // logs loud + escalates but never blocks/rolls back the tune (Standing
  // Rule 3). Verify lives in its OWN column, NOT a `status` value, so a
  // stuck verify can never strand the allocation lifecycle (still
  // pending/active/completed). verifyState: 'unverified' (default, never
  // checked) | 'verified' (read-back matched) | 'failed' (read-back
  // mismatched after retries) | 'unsupported' (device type has no
  // read-back path). verifyAttempts counts route/tune retries the verifier
  // triggered. verifyError holds the last mismatch detail for the
  // escalation surface.
  verifiedAt: integer('verified_at'), // Unix timestamp of last verify pass (NULL = never verified)
  verifyState: text('verify_state').notNull().default('unverified'),
  verifyAttempts: integer('verify_attempts').notNull().default(0),
  verifyError: text('verify_error'),
  // v2.82.x — tune-outcome telemetry. At game time the scheduler tunes a cable box / launches
  // a Fire TV app; if that FAILS (box offline, unknown channel) the allocation used to hang
  // 'pending' forever with nothing recorded. Now: tuneSuccess null=not-attempted else outcome;
  // tuneError = last failure reason; tuneAttempts = number of tune tries; the failure-sweep
  // flips status to 'failed' once attempts hit the cap OR the game window has passed, so a bad
  // tune stops hanging and is visible to the operator.
  tuneSuccess: integer('tune_success', { mode: 'boolean' }),
  tuneError: text('tune_error'),
  tuneAttempts: integer('tune_attempts').notNull().default(0),
  tuneLastAttemptAt: integer('tune_last_attempt_at'),
  // v2.82.x — audio-zone switch outcome (audio-follows-video). null=not-attempted; else whether
  // every zone switched to the intended source. audioZoneError lists the zones that failed, so a
  // silent "video moved but audio didn't follow" is visible instead of only PM2-logged.
  audioZoneSuccess: integer('audio_zone_success', { mode: 'boolean' }),
  audioZoneError: text('audio_zone_error'),

  // Metadata
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
}, (table) => ({
  inputSourceIdIdx: index('InputSourceAllocation_inputSourceId_status_idx').on(table.inputSourceId, table.status),
  gameScheduleIdIdx: index('InputSourceAllocation_gameScheduleId_idx').on(table.gameScheduleId),
  statusIdx: index('InputSourceAllocation_status_expectedFreeAt_idx').on(table.status, table.expectedFreeAt),
  preemptedByAllocationIdIdx: index('InputSourceAllocation_preemptedByAllocationId_idx').on(table.preemptedByAllocationId),
}))

// Tournament Brackets Model - Track tournament/playoff brackets
export const tournamentBrackets = sqliteTable('tournament_brackets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Tournament Info
  espnTournamentId: text('espnTournamentId').unique(),
  tournamentName: text('tournamentName').notNull(), // "NCAA Men's Basketball Tournament"
  shortName: text('shortName'), // "March Madness"
  seasonYear: integer('seasonYear').notNull(),
  sport: text('sport').notNull(),
  league: text('league').notNull(),

  // Structure
  totalTeams: integer('totalTeams'),
  totalRounds: integer('totalRounds'), // 6 for NCAA (64 teams → 32 → 16 → 8 → 4 → 2 → 1)
  currentRound: integer('currentRound'),
  roundName: text('roundName'), // "First Round", "Elite Eight", "Final Four", "Championship"

  // Bracket Data
  bracketStructure: text('bracketStructure'), // JSON with full bracket layout
  regions: text('regions'), // JSON array ["East", "West", "Midwest", "South"]

  // Progress Tracking
  totalGames: integer('totalGames'),
  gamesScheduled: integer('gamesScheduled'),
  gamesInProgress: integer('gamesInProgress'),
  gamesCompleted: integer('gamesCompleted'),

  // Timing
  tournamentStart: integer('tournamentStart'), // Unix timestamp
  tournamentEnd: integer('tournamentEnd'), // Unix timestamp
  currentRoundStart: integer('currentRoundStart'), // Unix timestamp
  currentRoundEnd: integer('currentRoundEnd'), // Unix timestamp

  // Status
  status: text('status'), // 'upcoming', 'in_progress', 'completed'

  // Metadata
  lastSynced: integer('lastSynced').default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
}, (table) => ({
  seasonYearSportIdx: index('TournamentBracket_seasonYear_sport_idx').on(table.seasonYear, table.sport),
  statusCurrentRoundIdx: index('TournamentBracket_status_currentRound_idx').on(table.status, table.currentRound),
  leagueIdx: index('TournamentBracket_league_idx').on(table.league),
}))

// ============================================
// AI GAME PLAN TABLES
// ============================================

// AI Venue Profile - Store bar/venue settings for AI scheduling
export const aiVenueProfiles = sqliteTable('ai_venue_profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Bar Hours
  openTime: text('openTime').notNull().default('11:00'), // 24hr format
  closeTime: text('closeTime').notNull().default('02:00'), // 24hr format (next day if < openTime)
  timezone: text('timezone').notNull().default('America/New_York'),

  // Filler Content Settings
  fillerChannels: text('fillerChannels'), // JSON array of channel numbers for when no good games
  fillerApps: text('fillerApps'), // JSON array of streaming apps for filler content
  defaultFillerMode: text('defaultFillerMode').notNull().default('sports_network'), // 'sports_network', 'highlights', 'atmosphere', 'off'

  // Auto-run Settings
  autoRunEnabled: integer('autoRunEnabled', { mode: 'boolean' }).default(false),
  autoRunTime: text('autoRunTime').default('09:00'), // Time to auto-generate daily plan

  // Priority Settings
  alwaysShowLocalTeams: integer('alwaysShowLocalTeams', { mode: 'boolean' }).default(true),
  nationalGameBoost: integer('nationalGameBoost').default(20), // Priority boost for prime time national games
  playoffBoost: integer('playoffBoost').default(30), // Priority boost for playoff games

  // Conflict Resolution
  conflictStrategy: text('conflictStrategy').default('priority'), // 'priority', 'round_robin', 'manual'

  // Metadata
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// AI TV Availability - Track which TVs/inputs are available for AI scheduling
// AI Game Plan Executions - Track plan executions for history/debugging
// Bartender Overrides - Track manual TV changes to prevent AI from overriding
// CRITICAL: This protects bartender decisions - never let AI flip a game the bartender chose
export const bartenderOverrides = sqliteTable('bartender_overrides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // TV Identification
  tvId: text('tvId').notNull(), // Matrix output ID or device ID
  tvName: text('tvName').notNull(), // Human-readable TV name for UI

  // Lock Status
  lockedUntil: timestamp('lockedUntil').notNull(), // When the 4-hour lock expires
  lockType: text('lockType').notNull().default('manual'), // 'manual' (4hr), 'permanent' (security cam), 'game_end_buffer' (10min)

  // Current Content Info
  currentGameId: text('currentGameId'), // ESPN game ID if showing a game
  currentChannel: text('currentChannel'), // Channel number or app name
  currentInput: text('currentInput'), // Matrix input or device

  // Game End Buffer
  gameEndTime: timestamp('gameEndTime'), // When the game is expected to end
  gameEndBufferUntil: timestamp('gameEndBufferUntil'), // 10 minutes after game ends

  // Override Info
  overriddenBy: text('overriddenBy').default('bartender'), // Who created the lock
  overrideReason: text('overrideReason'), // Optional note about why

  // Auto-unlock conditions
  unlockOnDeviceCrash: integer('unlockOnDeviceCrash', { mode: 'boolean' }).default(true), // Release lock if device goes offline

  // Metadata
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  tvIdIdx: index('BartenderOverrides_tvId_idx').on(table.tvId),
  lockedUntilIdx: index('BartenderOverrides_lockedUntil_idx').on(table.lockedUntil),
  lockTypeIdx: index('BartenderOverrides_lockType_idx').on(table.lockType),
}))

// FireStick Live Status - Real-time status from FireStick Scout agents
// Reports what app is open, what game is showing, scores, etc.
export const firestickLiveStatus = sqliteTable('firestick_live_status', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Device Identification
  deviceId: text('deviceId').notNull().unique(), // Fire TV device ID from our system
  deviceName: text('deviceName').notNull(), // Human-readable name (e.g., "Fire Stick TV-12")
  ipAddress: text('ipAddress'), // Device IP for direct communication

  // Current App Status
  currentApp: text('currentApp'), // Package name (e.g., "com.peacocktv.peacock")
  currentAppName: text('currentAppName'), // Friendly name (e.g., "Peacock")
  appCategory: text('appCategory'), // 'streaming', 'sports', 'news', 'other'

  // Current Game/Content (from OCR when sports app is open)
  currentGame: text('currentGame'), // e.g., "Penguins vs Capitals"
  homeTeam: text('homeTeam'),
  awayTeam: text('awayTeam'),
  homeScore: text('homeScore'),
  awayScore: text('awayScore'),
  gameStatus: text('gameStatus'), // "3rd 4:21", "Final", "Halftime"
  league: text('league'), // "NHL", "NFL", "NBA", etc.

  // Capabilities (what apps are installed and logged in)
  installedApps: text('installedApps'), // JSON array of installed streaming app package names
  loggedInApps: text('loggedInApps'), // JSON array of apps where user is logged in

  // Connection Status
  isOnline: integer('isOnline', { mode: 'boolean' }).default(false),
  lastHeartbeat: timestamp('lastHeartbeat'), // Last time we heard from the scout
  scoutVersion: text('scoutVersion'), // Version of the scout APK

  // Metadata
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceIdIdx: index('FirestickLiveStatus_deviceId_idx').on(table.deviceId),
  currentAppIdx: index('FirestickLiveStatus_currentApp_idx').on(table.currentApp),
  isOnlineIdx: index('FirestickLiveStatus_isOnline_idx').on(table.isOnline),
}))

// FireStick App Registry - Known streaming apps and their deep-link patterns
export const firestickAppRegistry = sqliteTable('firestick_app_registry', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // App Identification
  packageName: text('packageName').notNull().unique(), // e.g., "com.peacocktv.peacock"
  appName: text('appName').notNull(), // e.g., "Peacock"
  appCategory: text('appCategory').notNull().default('streaming'), // 'streaming', 'sports', 'live_tv'

  // Deep Link Patterns
  deepLinkPattern: text('deepLinkPattern'), // e.g., "peacock://live/sports/{sport}/{gameId}"
  searchDeepLink: text('searchDeepLink'), // e.g., "peacock://search?q={query}"
  homeDeepLink: text('homeDeepLink'), // e.g., "peacock://home"

  // Sports Capabilities
  hasSportsContent: integer('hasSportsContent', { mode: 'boolean' }).default(false),
  supportedLeagues: text('supportedLeagues'), // JSON array: ["NFL", "NHL", "EPL"]
  requiresSubscription: integer('requiresSubscription', { mode: 'boolean' }).default(true),

  // ADB Commands
  launchCommand: text('launchCommand'), // ADB command to launch app
  forceStopCommand: text('forceStopCommand'), // ADB command to force stop

  // UI Detection (for OCR)
  scoreRegexPattern: text('scoreRegexPattern'), // Regex to extract scores from OCR text
  gameStatusRegexPattern: text('gameStatusRegexPattern'), // Regex to extract game status

  // Metadata
  logoUrl: text('logoUrl'),
  isActive: integer('isActive', { mode: 'boolean' }).default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Per-box per-app sports content catalog populated by Sports Bar Scout's
// CatalogWalker (scout v1.9+). Each row is one playable item discovered on
// one Fire TV box's specific app. The catalog is overwritten daily (or
// whenever scout completes a fresh walk) — rows expire 36h after capture
// so a single bad walk doesn't strand stale content.
//
// Channel guide and AI Suggest read this table to surface streaming-only
// sports content that ESPN's broadcast_networks doesn't tag (regional
// broadcasts, Drive-to-Survive-style docuseries, replays). Each row says:
// "Fire TV X has app Y and you can play content Z".
//
// Indexed on (deviceId, app) for the common channel-guide query and on
// expiresAt for the cleanup sweep.
export const firetvStreamingCatalog = sqliteTable('firetv_streaming_catalog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Which Fire TV reported this — FireTVDevice.id (the canonical id, not
  // scout's compile-time deviceId). The firestick-scout ingest endpoint
  // resolves canonical id by IP before insert (see v2.28.10).
  deviceId: text('deviceId').notNull(),

  // Which app this content is in (e.g. "Prime Video", "Peacock", "Hulu").
  // Matches input_sources.available_networks display names so consumers
  // can join by app.
  app: text('app').notNull(),

  // Display title scout pulled off the tile (e.g. "Thursday Night Football",
  // "MLB.TV: Brewers vs. Cubs", "Drive to Survive S6E1"). Best-effort —
  // accessibility text capture varies by app.
  contentTitle: text('contentTitle').notNull(),

  // Optional explicit deep-link URI scout could extract (e.g.
  // "primevideo://detail?gti=..."). When present, the bartender-remote /
  // scheduler can launch directly to the content instead of just opening
  // the app's home screen. Most apps don't expose this externally — null
  // is normal.
  deepLink: text('deepLink'),

  // True when scout determined the content is currently airing live
  // (badge, "LIVE NOW" text, etc.). False for on-demand. Drives the
  // channel-guide sort order (live first).
  isLive: integer('isLive', { mode: 'boolean' }).default(false),

  // Best-guess sport label (NFL, NBA, MLB, soccer, mma, motorsport, etc.)
  // derived from tile text or app section heading. May be null if scout
  // couldn't classify.
  sportTag: text('sportTag'),

  // Game start time when the walker successfully extracted it from the
  // tile's accessibility text (ESPN: bullet-separated "Title • Sport •
  // 7:30 PM ET" tail; Prime Video: "Title, UPCOMING, Today 7:30 PM"
  // suffix before strip). Unix seconds. Null when not extractable —
  // most non-sports tiles, on-demand content, and apps where the time
  // doesn't appear in the dump (Peacock, Apple TV+, fuboTV are WebView
  // and walked as []). Channel-guide injection prefers this over
  // capturedAt for `gameTime` display.
  startTime: integer('startTime'),

  // When this row was captured by scout, and when it expires (default
  // captured + 36h). Cleanup sweep deletes rows past expiresAt.
  capturedAt: integer('capturedAt').notNull(),
  expiresAt: integer('expiresAt').notNull(),

  // v2.33.9 — Hybrid source tracking. Two writers populate this table:
  //   'walker'         — server-side TypeScript walker via adb input
  //                      keyevent (kernel input pipeline; drives Compose)
  //   'scout-snapshot' — Scout APK v2.2.0+ AccessibilityService active
  //                      extraction (faster ~16s, but limited to apps
  //                      whose tabs are AS-clickable)
  // Each writer replaces only rows matching its own source for a given
  // (deviceId, app) pair, so the two paths coexist instead of clobbering
  // each other. Channel-guide / bartender-remote readers consume rows
  // from any source.
  source: text('source').notNull().default('walker'),

  createdAt: integer('createdAt').notNull().default(sql`(strftime('%s','now'))`),
}, (table) => ({
  byDeviceApp: index('firetv_catalog_device_app_idx').on(table.deviceId, table.app),
  byExpiresAt: index('firetv_catalog_expires_idx').on(table.expiresAt),
  byDeviceAppSource: index('firetv_catalog_device_app_source_idx').on(table.deviceId, table.app, table.source),
}))

// ============================================================================
// DMX LIGHTING CONTROL
// ============================================================================

// DMX Controller (USB or Art-Net adapter)
export const dmxControllers = sqliteTable('DMXController', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  controllerType: text('controllerType').notNull(), // 'usb', 'artnet', 'maestro'

  // USB-specific fields
  serialPort: text('serialPort'),                   // e.g., '/dev/ttyUSB0', 'COM3'
  baudRate: integer('baudRate').default(250000),
  adapterModel: text('adapterModel'),               // 'enttec-pro', 'enttec-open', 'pknight-cr011r'

  // Art-Net/Maestro specific fields
  ipAddress: text('ipAddress'),
  artnetPort: integer('artnetPort').default(6454),
  artnetSubnet: integer('artnetSubnet').default(0),
  artnetNet: integer('artnetNet').default(0),

  // Universe assignment (which universes this adapter handles)
  universeStart: integer('universeStart').notNull().default(0),
  universeCount: integer('universeCount').notNull().default(1),

  // Maestro-specific
  maestroPresetCount: integer('maestroPresetCount'),
  maestroFunctionCount: integer('maestroFunctionCount'),

  // Status
  description: text('description'),
  status: text('status').notNull().default('offline'), // 'online', 'offline', 'error'
  lastSeen: timestamp('lastSeen'),
  lastError: text('lastError'),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  typeIdx: index('DMXController_controllerType_idx').on(table.controllerType),
  statusIdx: index('DMXController_status_idx').on(table.status),
}))

// DMX Zone (area grouping for fixtures)
export const dmxZones = sqliteTable('DMXZone', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  displayOrder: integer('displayOrder').notNull().default(0),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  isActiveIdx: index('DMXZone_isActive_idx').on(table.isActive),
}))

// DMX Fixture (individual light or device)
export const dmxFixtures = sqliteTable('DMXFixture', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  controllerId: text('controllerId').notNull().references(() => dmxControllers.id, { onDelete: 'cascade' }),
  zoneId: text('zoneId').references(() => dmxZones.id, { onDelete: 'set null' }),
  name: text('name').notNull(),

  // Fixture type and info
  fixtureType: text('fixtureType').notNull(),       // 'led-par', 'moving-head', 'strobe', 'fog-machine', etc.
  manufacturer: text('manufacturer'),
  model: text('model'),

  // DMX addressing
  universe: integer('universe').notNull().default(0),
  startAddress: integer('startAddress').notNull(),   // 1-512
  channelCount: integer('channelCount').notNull(),   // Number of channels

  // Channel mapping (JSON object)
  // e.g., {"red":1, "green":2, "blue":3, "white":4, "dimmer":5, "strobe":6}
  channelMap: text('channelMap').notNull(),

  // Fixture capabilities (JSON array)
  // e.g., ["rgb", "white", "dimmer", "strobe", "pan", "tilt"]
  capabilities: text('capabilities'),

  // Current state (JSON object)
  currentState: text('currentState'),

  // Status
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('displayOrder').notNull().default(0),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  controllerIdx: index('DMXFixture_controllerId_idx').on(table.controllerId),
  zoneIdx: index('DMXFixture_zoneId_idx').on(table.zoneId),
  addressIdx: index('DMXFixture_universe_startAddress_idx').on(table.universe, table.startAddress),
  typeIdx: index('DMXFixture_fixtureType_idx').on(table.fixtureType),
}))

// DMX Scene (lighting preset/scene)
export const dmxScenes = sqliteTable('DMXScene', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull().default('general'), // 'general', 'game-day', 'celebration', 'ambient'

  // Scene configuration (JSON array of fixture states)
  // [{ fixtureId: "xxx", state: { red: 255, green: 0, blue: 0, dimmer: 255 } }]
  sceneData: text('sceneData').notNull(),

  // Transition settings
  fadeTimeMs: integer('fadeTimeMs').notNull().default(500),

  // Maestro integration (optional - use Maestro's built-in preset instead)
  maestroControllerId: text('maestroControllerId').references(() => dmxControllers.id, { onDelete: 'set null' }),
  maestroPresetNumber: integer('maestroPresetNumber'),

  // Display settings
  displayOrder: integer('displayOrder').notNull().default(0),
  isFavorite: integer('isFavorite', { mode: 'boolean' }).notNull().default(false),
  bartenderVisible: integer('bartenderVisible', { mode: 'boolean' }).notNull().default(true),
  iconName: text('iconName'),                       // Lucide icon name
  iconColor: text('iconColor'),                     // Hex color for icon

  // Usage tracking
  usageCount: integer('usageCount').notNull().default(0),
  lastUsed: timestamp('lastUsed'),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  categoryIdx: index('DMXScene_category_idx').on(table.category),
  favoriteIdx: index('DMXScene_isFavorite_idx').on(table.isFavorite),
  bartenderIdx: index('DMXScene_bartenderVisible_idx').on(table.bartenderVisible),
}))

// DMX Game Event Trigger (automatic lighting for game events)
export const dmxGameEventTriggers = sqliteTable('DMXGameEventTrigger', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),

  // Event matching
  eventType: text('eventType').notNull(),           // 'goal', 'touchdown', 'home-run', 'score-change', etc.
  sportFilter: text('sportFilter'),                 // 'nfl', 'nba', 'nhl', 'mlb' (null = all)
  teamFilter: text('teamFilter'),                   // JSON array of team IDs (null = all)
  homeTeamOnly: integer('homeTeamOnly', { mode: 'boolean' }).notNull().default(true),

  // Effect to trigger
  effectType: text('effectType').notNull(),         // 'scene', 'strobe', 'color-burst', 'chase', 'maestro-preset'
  sceneId: text('sceneId').references(() => dmxScenes.id, { onDelete: 'set null' }),
  maestroControllerId: text('maestroControllerId').references(() => dmxControllers.id, { onDelete: 'set null' }),
  maestroPresetNumber: integer('maestroPresetNumber'),
  effectConfig: text('effectConfig'),               // JSON for effect parameters

  // Timing
  durationMs: integer('durationMs').notNull().default(5000),
  cooldownMs: integer('cooldownMs').notNull().default(30000), // Prevent rapid re-triggering
  lastTriggered: timestamp('lastTriggered'),

  // State
  isEnabled: integer('isEnabled', { mode: 'boolean' }).notNull().default(true),
  priority: integer('priority').notNull().default(0), // Higher = takes precedence

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  eventTypeIdx: index('DMXGameEventTrigger_eventType_idx').on(table.eventType),
  enabledIdx: index('DMXGameEventTrigger_isEnabled_idx').on(table.isEnabled),
}))

// DMX Execution Log (audit trail for lighting changes)
export const dmxExecutionLogs = sqliteTable('DMXExecutionLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  controllerId: text('controllerId').references(() => dmxControllers.id, { onDelete: 'cascade' }),

  // Execution details
  actionType: text('actionType').notNull(),         // 'scene_recall', 'fixture_control', 'effect', 'game_event', 'maestro_preset'
  actionId: text('actionId'),                       // Scene ID, trigger ID, etc.
  actionName: text('actionName'),

  // Result
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),

  // Metadata
  triggeredBy: text('triggeredBy'),                 // 'bartender', 'manager', 'scheduler', 'game_event'
  metadata: text('metadata'),                       // JSON additional context

  executedAt: timestamp('executedAt').notNull().default(timestampNow()),
}, (table) => ({
  controllerIdx: index('DMXExecutionLog_controllerId_idx').on(table.controllerId),
  actionTypeIdx: index('DMXExecutionLog_actionType_idx').on(table.actionType),
  executedAtIdx: index('DMXExecutionLog_executedAt_idx').on(table.executedAt),
}))

// ============================================================================
// COMMERCIAL LIGHTING TABLES (Lutron, Philips Hue, etc.)
// ============================================================================

// Commercial Lighting System (Lutron, Hue bridges, etc.)
export const commercialLightingSystems = sqliteTable('CommercialLightingSystem', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  systemType: text('systemType').notNull(),         // 'lutron-radiora2', 'lutron-radiora3', 'lutron-caseta', 'lutron-homeworks', 'philips-hue'

  // Connection configuration
  ipAddress: text('ipAddress').notNull(),
  port: integer('port'),
  username: text('username'),                       // For Lutron Telnet
  password: text('password'),                       // For Lutron Telnet (should be encrypted)
  applicationKey: text('applicationKey'),           // For Hue
  certificate: text('certificate'),                 // For LEAP API

  // Status
  status: text('status').notNull().default('offline'), // 'online', 'offline', 'error'
  lastSeen: timestamp('lastSeen'),
  firmwareVersion: text('firmwareVersion'),
  lastError: text('lastError'),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  systemTypeIdx: index('CommercialLightingSystem_systemType_idx').on(table.systemType),
  statusIdx: index('CommercialLightingSystem_status_idx').on(table.status),
}))

// Commercial Lighting Zone (room/area grouping)
export const commercialLightingZones = sqliteTable('CommercialLightingZone', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  systemId: text('systemId').notNull().references(() => commercialLightingSystems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  externalId: text('externalId'),                   // Lutron integration ID or Hue room ID
  zoneType: text('zoneType'),                       // 'room', 'area', 'zone'

  // Current state
  currentLevel: integer('currentLevel').notNull().default(0),
  isOn: integer('isOn', { mode: 'boolean' }).notNull().default(false),

  // Display
  displayOrder: integer('displayOrder').notNull().default(0),
  bartenderVisible: integer('bartenderVisible', { mode: 'boolean' }).notNull().default(true),
  iconName: text('iconName'),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  systemIdIdx: index('CommercialLightingZone_systemId_idx').on(table.systemId),
  bartenderVisibleIdx: index('CommercialLightingZone_bartenderVisible_idx').on(table.bartenderVisible),
}))

// Commercial Lighting Device (individual dimmer, switch, light)
export const commercialLightingDevices = sqliteTable('CommercialLightingDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  systemId: text('systemId').notNull().references(() => commercialLightingSystems.id, { onDelete: 'cascade' }),
  zoneId: text('zoneId').references(() => commercialLightingZones.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  externalId: text('externalId').notNull(),         // Lutron integration ID or Hue light ID
  deviceType: text('deviceType').notNull(),         // 'dimmer', 'switch', 'color-light', 'white-light', 'plug', 'keypad', 'sensor'

  // Capabilities
  capabilities: text('capabilities'),               // JSON: ["dimming", "color", "temperature"]
  minLevel: integer('minLevel').notNull().default(0),
  maxLevel: integer('maxLevel').notNull().default(100),

  // Current state
  currentLevel: integer('currentLevel').notNull().default(0),
  isOn: integer('isOn', { mode: 'boolean' }).notNull().default(false),
  colorHex: text('colorHex'),                       // For Hue color lights
  colorTemp: integer('colorTemp'),                  // For tunable white (mirek)

  // Display
  displayOrder: integer('displayOrder').notNull().default(0),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  systemIdIdx: index('CommercialLightingDevice_systemId_idx').on(table.systemId),
  zoneIdIdx: index('CommercialLightingDevice_zoneId_idx').on(table.zoneId),
  deviceTypeIdx: index('CommercialLightingDevice_deviceType_idx').on(table.deviceType),
}))

// Commercial Lighting Scene
export const commercialLightingScenes = sqliteTable('CommercialLightingScene', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  systemId: text('systemId').references(() => commercialLightingSystems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  externalId: text('externalId'),                   // Lutron scene button or Hue scene ID

  // For Lutron: which keypad button triggers the scene
  triggerDeviceId: text('triggerDeviceId'),         // Keypad integration ID
  triggerButtonId: integer('triggerButtonId'),      // Button number

  // For custom scenes (not system-native)
  sceneData: text('sceneData'),                     // JSON: device states

  // Display
  category: text('category').notNull().default('general'), // 'general', 'game-day', 'celebration', 'ambient', 'cleaning', 'closed'
  bartenderVisible: integer('bartenderVisible', { mode: 'boolean' }).notNull().default(true),
  isFavorite: integer('isFavorite', { mode: 'boolean' }).notNull().default(false),
  iconName: text('iconName'),
  iconColor: text('iconColor'),

  // Usage tracking
  usageCount: integer('usageCount').notNull().default(0),
  lastUsed: timestamp('lastUsed'),

  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  systemIdIdx: index('CommercialLightingScene_systemId_idx').on(table.systemId),
  categoryIdx: index('CommercialLightingScene_category_idx').on(table.category),
  bartenderVisibleIdx: index('CommercialLightingScene_bartenderVisible_idx').on(table.bartenderVisible),
}))

// Commercial Lighting Execution Log
export const commercialLightingLogs = sqliteTable('CommercialLightingLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  systemId: text('systemId').references(() => commercialLightingSystems.id, { onDelete: 'cascade' }),

  // Execution details
  actionType: text('actionType').notNull(),         // 'scene_recall', 'level_change', 'power_toggle', 'color_change'
  targetId: text('targetId'),                       // Device or zone ID
  targetName: text('targetName'),
  value: text('value'),                             // JSON or simple value

  // Result
  success: integer('success', { mode: 'boolean' }).notNull(),
  errorMessage: text('errorMessage'),

  // Metadata
  triggeredBy: text('triggeredBy'),                 // 'bartender', 'manager', 'scheduler', 'automation'
  metadata: text('metadata'),                       // JSON additional context

  executedAt: timestamp('executedAt').notNull().default(timestampNow()),
}, (table) => ({
  systemIdIdx: index('CommercialLightingLog_systemId_idx').on(table.systemId),
  actionTypeIdx: index('CommercialLightingLog_actionType_idx').on(table.actionType),
  executedAtIdx: index('CommercialLightingLog_executedAt_idx').on(table.executedAt),
}))

// ============================================================================
// BARTENDER LAYOUT TABLES (Multi-layout support for different bar areas)
// ============================================================================

// Bartender Layout (floor plans with TV zone configurations)
export const bartenderLayouts = sqliteTable('BartenderLayout', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  
  // Floor plan image
  imageUrl: text('imageUrl'),
  originalFileUrl: text('originalFileUrl'),
  professionalImageUrl: text('professionalImageUrl'),
  
  // TV zone configuration (JSON array of Zone objects)
  // Each zone: { id, outputNumber, x, y, width, height, label, room, confidence }
  zones: text('zones').notNull().default('[]'),

  // Room definitions (JSON array of Room objects)
  // Each room: { id, name, color, imageUrl? }
  rooms: text('rooms').notNull().default('[]'),

  // Layout settings
  isDefault: integer('isDefault', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('displayOrder').notNull().default(0),
  
  // Metadata
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  isDefaultIdx: index('BartenderLayout_isDefault_idx').on(table.isDefault),
  isActiveIdx: index('BartenderLayout_isActive_idx').on(table.isActive),
  displayOrderIdx: index('BartenderLayout_displayOrder_idx').on(table.displayOrder),
}))

// ============================================================================
// SCHEDULER LOGGING TABLES (Comprehensive scheduler operation tracking)
// ============================================================================

// Scheduler Log - Track all scheduler operations with correlation IDs
export const schedulerLogs = sqliteTable('SchedulerLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  correlationId: text('correlationId').notNull(), // Groups related operations

  // Operation classification
  component: text('component').notNull(), // 'scheduler-service', 'auto-reallocator', 'distribution-engine', etc.
  operation: text('operation').notNull(), // 'tune', 'allocate', 'reallocate', 'recover', 'distribute'
  level: text('level').notNull(), // 'debug', 'info', 'warn', 'error'
  message: text('message').notNull(),

  // Context references
  gameId: text('gameId'),
  inputSourceId: text('inputSourceId'),
  allocationId: text('allocationId'),
  channelNumber: text('channelNumber'),
  deviceType: text('deviceType'), // 'cable', 'directv', 'firetv'
  deviceId: text('deviceId'),

  // Outcome tracking
  success: integer('success', { mode: 'boolean' }).notNull(),
  durationMs: integer('durationMs'), // Operation duration in milliseconds
  errorMessage: text('errorMessage'),
  errorStack: text('errorStack'),

  // Additional metadata as JSON
  metadata: text('metadata'),

  createdAt: integer('createdAt').notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  correlationIdIdx: index('SchedulerLog_correlationId_idx').on(table.correlationId),
  componentIdx: index('SchedulerLog_component_idx').on(table.component),
  operationIdx: index('SchedulerLog_operation_idx').on(table.operation),
  levelIdx: index('SchedulerLog_level_idx').on(table.level),
  createdAtIdx: index('SchedulerLog_createdAt_idx').on(table.createdAt),
  successIdx: index('SchedulerLog_success_idx').on(table.success),
  gameIdIdx: index('SchedulerLog_gameId_idx').on(table.gameId),
}))

// Scheduler Metrics - Aggregated statistics for reporting
export const schedulerMetrics = sqliteTable('SchedulerMetrics', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

  // Metric classification
  metricType: text('metricType').notNull(), // 'tune', 'allocation', 'reallocation', 'distribution'
  period: text('period').notNull(), // 'hourly', 'daily'
  periodStart: integer('periodStart').notNull(), // Unix timestamp of period start

  // Counters
  successCount: integer('successCount').notNull().default(0),
  failureCount: integer('failureCount').notNull().default(0),
  totalCount: integer('totalCount').notNull().default(0),

  // Timing stats (in milliseconds)
  totalDurationMs: integer('totalDurationMs').notNull().default(0),
  minDurationMs: integer('minDurationMs'),
  maxDurationMs: integer('maxDurationMs'),
  avgDurationMs: integer('avgDurationMs'),

  // Component breakdown (JSON)
  componentBreakdown: text('componentBreakdown'), // {"scheduler-service": 10, "auto-reallocator": 5}

  createdAt: integer('createdAt').notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updatedAt').notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  metricTypeIdx: index('SchedulerMetrics_metricType_idx').on(table.metricType),
  periodStartIdx: index('SchedulerMetrics_periodStart_idx').on(table.periodStart),
  metricTypePeriodStartIdx: uniqueIndex('SchedulerMetrics_type_period_start_idx').on(table.metricType, table.period, table.periodStart),
}))

// ============================================================================
// WOLFPACK AI LEARNING TABLES
// ============================================================================

// Wolfpack Learning Events - Records routing outcomes for pattern learning
export const wolfpackLearningEvents = sqliteTable('WolfpackLearningEvent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text('eventType').notNull(), // 'route_success', 'route_failure', 'connection_error', 'connection_timeout', 'latency_spike', 'recovery'
  chassisId: text('chassisId'),
  inputNum: integer('inputNum'),
  outputNum: integer('outputNum'),
  inputLabel: text('inputLabel'),
  outputLabel: text('outputLabel'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  durationMs: integer('durationMs'),
  errorMessage: text('errorMessage'),
  dayOfWeek: integer('dayOfWeek').notNull(), // 0-6 (Sunday-Saturday)
  hourOfDay: integer('hourOfDay').notNull(), // 0-23
  protocol: text('protocol'),
  retryCount: integer('retryCount').notNull().default(0),
  wasRetrySuccessful: integer('wasRetrySuccessful', { mode: 'boolean' }),
  metadata: text('metadata'), // JSON
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  eventTypeIdx: index('WolfpackLearningEvent_eventType_idx').on(table.eventType),
  chassisIdIdx: index('WolfpackLearningEvent_chassisId_idx').on(table.chassisId),
  createdAtIdx: index('WolfpackLearningEvent_createdAt_idx').on(table.createdAt),
  timePatternIdx: index('WolfpackLearningEvent_time_pattern_idx').on(table.dayOfWeek, table.hourOfDay),
  successIdx: index('WolfpackLearningEvent_success_idx').on(table.success),
}))

// ============================================================================
// ATLAS AI LEARNING TABLES
// ============================================================================

// Atlas Learning Events - Records audio gain, clipping, zone, and connection outcomes for pattern learning
export const atlasLearningEvents = sqliteTable('AtlasLearningEvent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text('eventType').notNull(), // 'gain_adjustment', 'gain_adjustment_failed', 'clipping_detected', 'zone_volume_change', 'zone_mute_toggle', 'zone_source_change', 'connection_online', 'connection_offline', 'signal_snapshot'
  processorId: text('processorId').notNull(),
  inputNumber: integer('inputNumber'),
  zoneNumber: integer('zoneNumber'),
  success: integer('success', { mode: 'boolean' }).notNull(),
  previousGain: real('previousGain'),
  newGain: real('newGain'),
  currentLevel: real('currentLevel'),
  targetLevel: real('targetLevel'),
  adjustmentMode: text('adjustmentMode'), // 'fast' | 'slow'
  movedTowardTarget: integer('movedTowardTarget', { mode: 'boolean' }),
  previousVolume: integer('previousVolume'),
  newVolume: integer('newVolume'),
  muted: integer('muted', { mode: 'boolean' }),
  signalLevels: text('signalLevels'), // JSON
  clippingInputs: text('clippingInputs'), // JSON
  errorMessage: text('errorMessage'),
  dayOfWeek: integer('dayOfWeek').notNull(), // 0-6 (Sunday-Saturday)
  hourOfDay: integer('hourOfDay').notNull(), // 0-23
  durationMs: integer('durationMs'),
  metadata: text('metadata'), // JSON
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  eventTypeIdx: index('AtlasLearningEvent_eventType_idx').on(table.eventType),
  processorIdIdx: index('AtlasLearningEvent_processorId_idx').on(table.processorId),
  createdAtIdx: index('AtlasLearningEvent_createdAt_idx').on(table.createdAt),
  timePatternIdx: index('AtlasLearningEvent_time_pattern_idx').on(table.dayOfWeek, table.hourOfDay),
  successIdx: index('AtlasLearningEvent_success_idx').on(table.success),
  inputNumberIdx: index('AtlasLearningEvent_inputNumber_idx').on(table.inputNumber),
}))

// ============================================================================
// AI Scheduling Intelligence Tables
// ============================================================================

export const schedulingPatterns = sqliteTable('scheduling_patterns', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  patternType: text('pattern_type').notNull(),
  patternKey: text('pattern_key').notNull(),
  patternData: text('pattern_data').notNull(),
  observationCount: integer('observation_count').notNull().default(1),
  sampleSize: integer('sample_size').notNull().default(0),
  firstObserved: integer('first_observed').notNull().default(sql`(strftime('%s', 'now'))`),
  lastObserved: integer('last_observed').notNull().default(sql`(strftime('%s', 'now'))`),
  confidence: real('confidence').notNull().default(0.0),
  isStale: integer('is_stale', { mode: 'boolean' }).notNull().default(false),
  lastAnalyzedAt: integer('last_analyzed_at').default(sql`(strftime('%s', 'now'))`),
  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer('updated_at').notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  patternTypeIdx: index('SchedulingPattern_patternType_idx').on(table.patternType),
  typeKeyIdx: uniqueIndex('SchedulingPattern_type_key_idx').on(table.patternType, table.patternKey),
  confidenceIdx: index('SchedulingPattern_confidence_idx').on(table.confidence),
  lastObservedIdx: index('SchedulingPattern_lastObserved_idx').on(table.lastObserved),
}))

// Audio Volume Log - Tracks every volume change with context for AI learning
// Local Channel Overrides - team-specific channel mappings (e.g., Brewers → ch 308)
export const localChannelOverrides = sqliteTable('local_channel_overrides', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  teamName: text('team_name').notNull(),
  channelNumber: integer('channel_number').notNull(),
  channelName: text('channel_name').notNull(),
  deviceType: text('device_type').default('cable'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const audioVolumeLogs = sqliteTable('audio_volume_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processor_id').notNull(),
  zoneNumber: integer('zone_number').notNull(),
  zoneName: text('zone_name'),
  previousVolume: integer('previous_volume'),
  newVolume: integer('new_volume').notNull(),
  changedBy: text('changed_by').notNull().default('bartender'), // 'bartender', 'scheduler', 'ai', 'system'

  // Game context (what was playing when volume changed)
  activeGameId: text('active_game_id'),
  activeLeague: text('active_league'),
  activeHomeTeam: text('active_home_team'),
  activeAwayTeam: text('active_away_team'),
  isHomeGame: integer('is_home_game', { mode: 'boolean' }),

  // Time context
  dayOfWeek: text('day_of_week'), // 'monday', 'tuesday', etc.
  hourOfDay: integer('hour_of_day'), // 0-23
  timeSlot: text('time_slot'), // 'morning', 'lunch', 'afternoon', 'prime_time', 'late_night'

  // Audio context
  currentSource: text('current_source'), // 'dj', 'game_audio', 'jukebox', 'spotify', etc.
  isDJMode: integer('is_dj_mode', { mode: 'boolean' }).default(false),

  createdAt: integer('created_at').notNull().default(sql`(strftime('%s', 'now'))`),
}, (table) => ({
  zoneIdx: index('AudioVolumeLog_zone_idx').on(table.zoneNumber),
  changedByIdx: index('AudioVolumeLog_changedBy_idx').on(table.changedBy),
  leagueIdx: index('AudioVolumeLog_league_idx').on(table.activeLeague),
  timeSlotIdx: index('AudioVolumeLog_timeSlot_idx').on(table.timeSlot),
  createdAtIdx: index('AudioVolumeLog_createdAt_idx').on(table.createdAt),
}))

// Station Aliases Model (for channel guide station name matching)
export const stationAliases = sqliteTable('station_aliases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  standardName: text('standard_name').notNull().unique(),
  aliases: text('aliases').notNull(), // JSON array of alias strings
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

// Auto-Update singleton state (always id=1). Written by scripts/auto-update.sh
// via sqlite3 CLI and read by the Sync tab UI via Drizzle. See
// docs/AUTO_UPDATE_SETUP.md §2 for the state-location decision record.
export const autoUpdateState = sqliteTable('auto_update_state', {
  id: integer('id').primaryKey().default(1),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  scheduleCron: text('schedule_cron').notNull().default('30 2 * * *'),
  lastRunAt: text('last_run_at'),
  lastResult: text('last_result'), // 'pass' | 'fail' | 'rolled_back' | 'in_progress'
  lastCommitShaBefore: text('last_commit_sha_before'),
  lastCommitShaAfter: text('last_commit_sha_after'),
  lastError: text('last_error'),
  lastDurationSecs: integer('last_duration_secs'),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

// Auto-Update append-only history. Each run inserts one row on start, updates
// it on each phase boundary, and finalizes it at success/fail/rollback. The
// Sync tab UI pages through the last N rows for the history table.
export const autoUpdateHistory = sqliteTable('auto_update_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  result: text('result').notNull(), // 'pass' | 'fail' | 'rolled_back' | 'in_progress'
  commitShaBefore: text('commit_sha_before').notNull(),
  commitShaAfter: text('commit_sha_after'),
  branch: text('branch').notNull(),
  durationSecs: integer('duration_secs'),
  verifyResultJson: text('verify_result_json'),
  errorMessage: text('error_message'),
  triggeredBy: text('triggered_by').notNull(), // 'cron' | 'manual_api' | 'manual_cli'
})

// ============================================================================
// EVERPASS DEVICE TABLE (replaces everpass-devices.json)
// ============================================================================

export const everpassDevices = sqliteTable('EverPassDevice', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  cecDevicePath: text('cecDevicePath').notNull(), // e.g. "/dev/ttyACM0"
  inputChannel: integer('inputChannel').notNull(), // Matrix input number
  deviceModel: text('deviceModel'),
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// ============================================================================
// DEVICE SUBSCRIPTION POLLING TABLE (replaces device-subscriptions.json)
// ============================================================================

export const deviceSubscriptions = sqliteTable('DeviceSubscription', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  deviceId: text('deviceId').notNull(),
  deviceType: text('deviceType').notNull(), // 'firetv' | 'directv'
  deviceName: text('deviceName').notNull(),
  subscriptions: text('subscriptions').notNull().default('[]'), // JSON array
  lastPolled: timestamp('lastPolled'),
  pollStatus: text('pollStatus').notNull().default('pending'), // 'success' | 'error' | 'pending'
  error: text('error'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  deviceIdIdx: uniqueIndex('DeviceSubscription_deviceId_idx').on(table.deviceId),
  deviceTypeIdx: index('DeviceSubscription_deviceType_idx').on(table.deviceType),
}))

// ============================================================================
// STREAMING CREDENTIALS TABLE (replaces streaming-credentials.json)
// ============================================================================

export const streamingCredentials = sqliteTable('StreamingCredential', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  platformId: text('platformId').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('passwordHash').notNull(), // AES-256-GCM encrypted
  encrypted: integer('encrypted', { mode: 'boolean' }).notNull().default(true),
  encryptionVersion: text('encryptionVersion').notNull().default('aes-256-gcm'),
  status: text('status').notNull().default('active'), // 'active' | 'expired' | 'error'
  lastSync: timestamp('lastSync'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// ============================================================================
// SUBSCRIBED STREAMING APPS TABLE (replaces subscribed-streaming-apps.json)
// ============================================================================

export const subscribedStreamingApps = sqliteTable('SubscribedStreamingApp', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  appId: text('appId').notNull().unique(), // Android package name
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  activityName: text('activityName'), // Android activity for launch
  displayOrder: integer('displayOrder').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// ============================================================================
// SCHEDULED OVERRIDE DEFAULTS (v2.24.3)
// ============================================================================
//
// When an operator clicks "Apply" on an override-learn recommendation, we
// store the decision here as a durable rule: "for team X, action Y on TV
// output Z". The scheduler-service consults this table when building the
// initial tv_output_ids list for new allocations, so the bartender
// doesn't have to re-correct the same routing every night.
//
// Action semantics:
//   - 'exclude': never auto-route this team to this output (removes it
//     from the default tv_output_ids). Derived from recurring 'remove'
//     override events.
//   - 'include': always auto-route this team to this output (adds it to
//     the default tv_output_ids). Derived from recurring 'add' override
//     events.
//
// UNIQUE (team, outputNum, action) prevents duplicates. A team can have
// BOTH exclude and include entries on different outputs.
//
// This table is read-only from the scheduler's perspective; mutations
// only happen through /api/override-learn/apply (and a DELETE endpoint
// for revert). Every apply also writes a SchedulerLog audit row.
// ============================================================================
// AUTO-UPDATE ROLLBACK LEARN (v2.25.1)
// ============================================================================
//
// Every time auto-update.sh fails a checkpoint or a step and rolls back,
// we capture the failure signature here so future Checkpoint A prompts
// can consult "we've hit this pattern before" before approving new
// merges. Parallel to override-learn: passively collect signal → surface
// pattern → reduce recurrence.
//
// Signature = which STEP failed + the first ~200 chars of the error
// message/rollback reason, normalized to strip timestamps and UUIDs.
// Same step+signature combo increments `occurrences` instead of
// creating a new row, so a recurring bug shows up as one high-count
// entry instead of dozens of near-dupes.
export const autoUpdateFailureSignatures = sqliteTable('AutoUpdateFailureSignatures', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  failedStep: text('failedStep').notNull(), // e.g. 'build', 'schema_push', 'checkpoint_c'
  signature: text('signature').notNull(), // normalized first-200-chars of error text
  fullReason: text('fullReason'), // last raw reason observed (not the historical sum)
  occurrences: integer('occurrences').notNull().default(1),
  firstSeen: integer('firstSeen').notNull().default(sql`(strftime('%s', 'now'))`),
  lastSeen: integer('lastSeen').notNull().default(sql`(strftime('%s', 'now'))`),
  affectedVersions: text('affectedVersions'), // JSON array of version strings where this hit
  lastRunId: text('lastRunId'), // last auto-update-YYYY-MM-DD-HH-MM filename where this fired
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  stepIdx: index('AutoUpdateFailureSignatures_step_idx').on(table.failedStep),
  uniqueSig: uniqueIndex('AutoUpdateFailureSignatures_step_sig_unique').on(table.failedStep, table.signature),
}))

export const scheduledOverrideDefaults = sqliteTable('ScheduledOverrideDefaults', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  team: text('team').notNull(),
  league: text('league'),
  outputNum: integer('outputNum').notNull(),
  action: text('action').notNull(), // 'exclude' | 'include'
  isHomeTeam: integer('isHomeTeam', { mode: 'boolean' }).notNull().default(false),
  occurrences: integer('occurrences').notNull().default(1), // # of source events this was derived from
  sourceCorrelationId: text('sourceCorrelationId'), // optional link to a specific override-digest batch
  appliedAt: timestamp('appliedAt').notNull().default(timestampNow()),
  appliedBy: text('appliedBy').notNull().default('operator'),
  notes: text('notes'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  teamIdx: index('ScheduledOverrideDefaults_team_idx').on(table.team),
  uniqueAction: uniqueIndex('ScheduledOverrideDefaults_team_output_action_unique').on(
    table.team,
    table.outputNum,
    table.action,
  ),
}))

// ============================================================================
// PPV / EVENT CHANNEL DISCOVERY (v2.28.0)
// ============================================================================

// Track DirecTV PPV channel observations from /tv/getTuned probe runs.
// ESPN doesn't reliably surface PPV broadcast info for UFC/boxing events,
// so we discover channels reactively: every 10 minutes the scheduler asks
// each DirecTV box what it's tuned to and upserts any "PPV"-callsigned or
// 100-199 channel-range result here. This gives operators a list of recently
// active PPV channels they can pin to scheduled events when ESPN is silent.
export const discoveredPpvChannels = sqliteTable('discovered_ppv_channels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  directvDeviceId: text('directv_device_id').notNull(),
  channelMajor: integer('channel_major').notNull(),
  channelMinor: integer('channel_minor'),
  callsign: text('callsign'),
  title: text('title'),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  seenCount: integer('seen_count').notNull().default(1),
}, (table) => ({
  uniquePerDeviceChannel: uniqueIndex('discovered_ppv_channels_device_major_unique')
    .on(table.directvDeviceId, table.channelMajor),
  lastSeenIdx: index('discovered_ppv_channels_lastSeen_idx').on(table.lastSeenAt),
}))

// ============================================================================
// WATCHER AUDIT TABLES (v2.33-v2.45) — declared here so drizzle-kit push
// stops asking to delete them. These are created by raw `CREATE TABLE IF
// NOT EXISTS` in the watcher startup paths (atlas-drop-watcher.ts,
// atlas-priority-watcher.ts, shure-rf-watcher.ts) because they predate the
// Drizzle schema. Runtime code uses raw `sql\`INSERT INTO ...\`` against
// them; the only reason to declare them here is so drizzle-kit's diff
// against the live DB doesn't flag "table not in schema, want to drop"
// and roll back every auto-update at locations that have populated rows.
//
// Greenville hit this on 2026-05-19 v2.50.11 push — drizzle-kit refused to
// drop 6 atlas_priority_events / 2 shure_rf_events rows in non-interactive
// mode and the entire upgrade rolled back. See CLAUDE.md §7 (Atlas) and
// §7a (Shure SLX-D) for the operational role of these tables. Schema
// definitions below mirror the live DB exactly — DO NOT edit columns or
// add new ones here unless you also update the watcher's CREATE TABLE SQL.
// ============================================================================

export const atlasDropEvents = sqliteTable('atlas_drop_events', {
  id: text('id').primaryKey(),
  processorId: text('processor_id').notNull(),
  zoneNumber: integer('zone_number').notNull(),
  zoneName: text('zone_name'),
  previousVolume: integer('previous_volume').notNull(),
  newVolume: integer('new_volume').notNull(),
  delta: integer('delta').notNull(),
  sourceAtDrop: integer('source_at_drop'),
  mutedAtDrop: integer('muted_at_drop', { mode: 'boolean' }).notNull().default(false),
  eventType: text('event_type').notNull().default('drop'),
  detectedAt: integer('detected_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
})

export const atlasPriorityEvents = sqliteTable('atlas_priority_events', {
  id: text('id').primaryKey(),
  processorId: text('processor_id').notNull(),
  eventType: text('event_type').notNull(),
  zoneNumber: integer('zone_number'),
  zoneName: text('zone_name'),
  previousSource: integer('previous_source'),
  newSource: integer('new_source'),
  inputIndex: integer('input_index'),
  inputName: text('input_name'),
  inputLevelDb: real('input_level_db'),
  detectedAt: integer('detected_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  detectedAtIdx: index('atlas_priority_events_detected_at_idx').on(table.detectedAt),
  processorTypeIdx: index('atlas_priority_events_processor_type_idx').on(table.processorId, table.eventType, table.detectedAt),
}))

export const shureRfEvents = sqliteTable('shure_rf_events', {
  id: text('id').primaryKey(),
  receiverId: text('receiver_id').notNull(),
  receiverName: text('receiver_name'),
  ipAddress: text('ip_address'),
  channel: integer('channel').notNull().default(0),
  eventType: text('event_type').notNull(),
  rssiDbm: real('rssi_dbm'),
  frequencyMhz: real('frequency_mhz'),
  txType: text('tx_type'),
  note: text('note'),
  detectedAt: integer('detected_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  detectedAtIdx: index('shure_rf_events_detected_at_idx').on(table.detectedAt),
  receiverIdx: index('shure_rf_events_receiver_idx').on(table.receiverId, table.channel, table.detectedAt),
}))

// v2.52.14: daily RF Pattern Digest. Tier 3 of the SDR AI integration.
// A scheduler job runs once per day, pulls 24h of sdr_carriers,
// shure_rf_events, and matched NeighborhoodEvent rows, formats a
// structured prompt for Ollama qwen2.5:14b, and stores the LLM
// summary here. The bartender Audio tab reads the latest row.
//
// Bartender-grade output — plain language, no jargon. Example:
//   "The band at Anduzzi's tonight (DJ Casey) tends to use freqs near
//    your Mic 2. The SDR has been seeing strong activity at 484-485 MHz
//    on the past 3 Fridays around 9pm. Consider moving Mic 2 to
//    491 MHz before showtime."
//
// structured_findings is a JSON blob with the LLM's parsed
// recommendations + raw counts (for the UI to render badges/charts
// instead of just the prose).
export const rfPatternDigest = sqliteTable('rf_pattern_digest', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  locationId: text('location_id').notNull(),
  periodStart: integer('period_start').notNull(),
  periodEnd: integer('period_end').notNull(),
  summaryText: text('summary_text').notNull(),
  structuredFindings: text('structured_findings'),
  modelUsed: text('model_used').notNull(),
  promptTokenCount: integer('prompt_token_count'),
  completionTokenCount: integer('completion_token_count'),
  generationMs: integer('generation_ms'),
  generatedAt: integer('generated_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  locationIdx: index('rf_pattern_digest_location_idx').on(table.locationId, table.generatedAt),
}))

export const schedulingPreferences = sqliteTable('scheduling_preferences', {
  id: text('id').primaryKey(),
  preferenceType: text('preference_type').notNull(),
  teamId: text('team_id'),
  teamName: text('team_name'),
  league: text('league'),
  preferenceData: text('preference_data').notNull(),
  weight: integer('weight').notNull().default(50),
  confidence: real('confidence').notNull().default(0.5),
  source: text('source').notNull().default('learned'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  preferenceTypeIdx: index('SchedulingPreference_preferenceType_idx').on(table.preferenceType),
  teamIdIdx: index('SchedulingPreference_teamId_idx').on(table.teamId),
  leagueIdx: index('SchedulingPreference_league_idx').on(table.league),
  isActiveIdx: index('SchedulingPreference_isActive_idx').on(table.isActive),
}))

// ============================================================================
// NEIGHBORHOOD RF INTERFERENCE PREDICTION (v2.51.0+)
// ============================================================================
// AI-powered system that polls nearby venue event calendars (Bandsintown,
// Bananas Entertainment scrape, manual operator entry, per-venue scrapers
// for Anduzi's / Stadium View / etc.) and correlates with our own Shure
// SLX-D RF interference detections. Builds an artist-level confidence
// profile so when a known-interferer band/DJ is booked at a nearby venue
// tomorrow, the scheduler can pre-emptively retune our wireless mics to
// clean frequencies BEFORE they set up.
//
// Distance + time-window correlation: an artist gig within 0.5 mi of our
// venue + within ±30 min of an rf_interference event is a candidate
// attribution. After 3+ attributions across multiple gigs, the artist
// gets a profile row with predicted_freqs_affected and a textual
// recommendation. The scheduler tick reads this daily at 6 AM.
//
// Lambeau Field + Resch Center are the dominant interference sources at
// Holmgren Way (~0.3 mi away). Broadcast wireless rigs for Packers home
// games + concerts span the entire UHF band. Game/concert dates are
// public + predictable — operators want pre-emptive scans 4+ hours
// before kickoff.
//
// See docs/NEIGHBORHOOD_RF_PREDICTION.md for the full architecture +
// operational runbook (correlation tuning, blacklist threshold, manual
// override workflow).
// ============================================================================

export const neighborhoodVenues = sqliteTable('NeighborhoodVenue', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  category: text('category').notNull(),                          // 'bar' | 'concert_hall' | 'stadium' | 'restaurant' | 'agency' | 'other'
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  // Distance from our LOCATION's bar — denormalized so we don't recompute
  // the haversine on every correlation lookup. Updated whenever a fleet
  // location moves or a new venue is added.
  distanceMi: real('distance_mi'),
  // Canonical URL to scrape/fetch events from. May be a venue website,
  // a Facebook page, a Bandsintown venue page, or — in the case of
  // Bananas Entertainment — the agency's calendar page that lists where
  // their DJs/bands play.
  sourceUrl: text('source_url'),
  bandsintownVenueId: text('bandsintown_venue_id'),
  facebookEventUrl: text('facebook_event_url'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  // v2.51.1: review_status tracks the auto-discovery → operator-approval
  // lifecycle. 'manual' = hand-seeded by operator (Holmgren's initial 16);
  // 'pending_review' = auto-discovered by Overpass+Ollama, awaiting
  // operator approval; 'approved' = operator approved an auto-discovered
  // row; 'declined' = operator rejected (won't re-appear on re-discovery).
  // Correlation engine + scraper only USE rows where review_status IN
  // ('manual', 'approved') AND is_active=true.
  reviewStatus: text('review_status').notNull().default('manual'),
  // v2.51.1: source of this venue row. 'manual' | 'overpass_osm' |
  // 'bandsintown' | 'google_places'. Tracks where we found it so
  // re-discovery doesn't duplicate or so we can re-query the same
  // source for updates (e.g. an OSM tag changed).
  discoverySource: text('discovery_source').notNull().default('manual'),
  // v2.51.1: OSM tags as JSON for auto-discovered rows. Useful for the
  // Ollama "books live music?" filter to re-evaluate. Null for manually
  // seeded rows.
  osmTags: text('osm_tags'),
  // v2.51.1: Ollama-assigned confidence that this venue books live
  // entertainment. 0.0–1.0. Used to filter the operator-review list
  // (e.g. only show ≥ 0.4 to reduce noise).
  bookingConfidence: real('booking_confidence'),
  // v2.51.3: TRUE if this venue row represents OUR OWN bar (the fleet
  // location's own physical building). Bookings AT our bar still
  // matter for interference prediction — bands bring their OWN
  // wireless rigs even at our venue, and that rig is now physically
  // INSIDE the same room as our Shure receiver. Highest possible
  // interference risk. So:
  //   - correlator DOES attribute rf_interference events to is_self
  //     bookings (distance=0.0 mi → confidence multiplier = 1.0)
  //   - preemptive-strike workflow uses a LOWER confidence threshold
  //     (≥ 0.3 instead of ≥ 0.6) for is_self bookings, since the
  //     band is literally in our building — even an unknown artist
  //     warrants a pre-scan
  //   - UI surfaces is_self events prominently ("tonight AT YOUR
  //     bar:" header) so the operator sees them first
  isSelf: integer('is_self', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  categoryIdx: index('NeighborhoodVenue_category_idx').on(table.category),
  distanceIdx: index('NeighborhoodVenue_distance_idx').on(table.distanceMi),
  isActiveIdx: index('NeighborhoodVenue_isActive_idx').on(table.isActive),
  reviewStatusIdx: index('NeighborhoodVenue_reviewStatus_idx').on(table.reviewStatus),
  isSelfIdx: index('NeighborhoodVenue_isSelf_idx').on(table.isSelf),
  // Allow same venue name across categories (e.g. "The Bar" could be a
  // restaurant and a sports bar in different cities, unlikely but possible)
  // but not duplicate same-name same-category rows.
  uniqueNameCat: uniqueIndex('NeighborhoodVenue_name_category_unique').on(table.name, table.category),
}))

// v2.51.3 — Alias table for venue-name normalization across ingestion sources.
//
// Bananas Entertainment writes venue names in ALL CAPS and strips
// punctuation: "ANDUZZIS - HOLMGREN WAY" for our seeded "Anduzzi's
// Sports Club - Holmgren Way". The bananas-ingestion fuzzy matcher's
// Levenshtein-≤3 threshold rejected the 14-char delta, dropping 80+
// events per scrape on the floor.
//
// Now: ingestion checks NeighborhoodVenueAlias first (exact match on
// alias_normalized) → falls back to exact match on venue.name →
// falls back to existing fuzzy match. Aliases can be seeded
// (apps/web/scripts/seed-neighborhood-venue-aliases.ts) or created on
// the fly when an operator approves a fuzzy match in the admin UI.
//
// alias_normalized is the input string after: lowercase, trim, collapse
// whitespace, strip everything except [a-z0-9 -]. Bananas's
// "ANDUZZIS - HOLMGREN WAY" normalizes to "anduzzis - holmgren way".
export const neighborhoodVenueAliases = sqliteTable('NeighborhoodVenueAlias', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  venueId: text('venue_id').notNull().references(() => neighborhoodVenues.id, { onDelete: 'cascade' }),
  aliasText: text('alias_text').notNull(),
  aliasNormalized: text('alias_normalized').notNull(),
  // 'manual' = operator added via UI/seed. 'auto' = bananas-ingestion
  // saw a fuzzy match + auto-recorded the alias so future runs are
  // O(1) lookups. 'bananas' / 'bandsintown' / etc. = source-specific
  // alias from upstream data.
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  venueIdx: index('NeighborhoodVenueAlias_venue_idx').on(table.venueId),
  uniqueAlias: uniqueIndex('NeighborhoodVenueAlias_normalized_unique').on(table.aliasNormalized),
}))

export const neighborhoodEvents = sqliteTable('NeighborhoodEvent', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  venueId: text('venue_id').notNull().references(() => neighborhoodVenues.id, { onDelete: 'cascade' }),
  artistName: text('artist_name').notNull(),                     // 'DJ Marco' | 'Cover Band X' | 'Green Bay Packers vs Lions'
  // Lowercased + trimmed + collapsed-whitespace for joins to
  // ArtistInterferenceProfile and dedup across sources.
  artistNormalized: text('artist_normalized').notNull(),
  startTime: integer('start_time').notNull(),                    // unix epoch seconds
  endTime: integer('end_time'),                                  // nullable when source omits it (defaults to start+4h for bars, +3h for shows)
  eventType: text('event_type'),                                 // 'band' | 'dj' | 'karaoke' | 'trivia' | 'sports' | 'concert' | 'other'
  // Source provenance — multiple sources may report the same event;
  // dedup via (source, source_event_id) uniqueness so re-ingestion is
  // idempotent. Examples: source='bandsintown' source_event_id='12345678',
  // source='bananas' source_event_id='2026-05-30-andre-anduzis',
  // source='manual' source_event_id=null (UI-entered).
  source: text('source').notNull(),
  sourceUrl: text('source_url'),
  sourceEventId: text('source_event_id'),
  // Original JSON payload from the source — useful for debugging parse
  // errors and rebuilding when Ollama HTML-parsing logic changes.
  rawPayload: text('raw_payload'),
  ingestedAt: integer('ingested_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  venueIdx: index('NeighborhoodEvent_venue_idx').on(table.venueId),
  startTimeIdx: index('NeighborhoodEvent_startTime_idx').on(table.startTime),
  artistNormalizedIdx: index('NeighborhoodEvent_artistNormalized_idx').on(table.artistNormalized),
  // Idempotent re-ingestion: same source + same source-side ID = same row.
  // Null source_event_id (manual entries) bypasses this constraint, which
  // is correct — manual entries should always insert as new rows.
  uniqueSourceEvent: uniqueIndex('NeighborhoodEvent_source_sourceEventId_unique').on(table.source, table.sourceEventId),
}))

export const interferenceAttributions = sqliteTable('InterferenceAttribution', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // v2.55.16: NO FK to shure_rf_events. This column holds an id from EITHER
  // shure_rf_events (source='shure') OR sdr_carriers (source='sdr') — a
  // polymorphic reference distinguished by the `source` column. The old
  // `.references(shureRfEvents.id)` FK assumed enforcement was off in prod,
  // but it's actually ON, so every SDR-sourced insert (carrier id, not a
  // shure_rf_events id) failed "FOREIGN KEY constraint failed" — breaking
  // the entire SDR interference-correlation pass (60+ errors/10h on Holmgren).
  rfEventId: text('rf_event_id').notNull(),
  neighborhoodEventId: text('neighborhood_event_id').notNull().references(() => neighborhoodEvents.id, { onDelete: 'cascade' }),
  timeDeltaSeconds: integer('time_delta_seconds').notNull(),     // abs(rf_event.detected_at - neighborhood_event.start_time)
  distanceMi: real('distance_mi').notNull(),                     // distance from our bar to event venue (copied from venue.distance_mi at attribution time)
  // Confidence 0.0–1.0. Tighter time + closer distance + matched freq
  // signature = higher confidence. Computed by correlation engine.
  confidence: real('confidence').notNull(),
  // 'correlation_v1' = the algorithmic time+distance match. 'manual' =
  // operator marked it. Future: 'ml_v2' if we add a learned model.
  attributionMethod: text('attribution_method').notNull().default('correlation_v1'),
  // v2.52.12: 'shure' for events from shure_rf_events table, 'sdr' for
  // events from sdr_carriers table. Allows the correlator to feed
  // BOTH detection sources into ArtistInterferenceProfile — when both
  // independently see RF activity at a venue's event time, confidence
  // is materially higher than either source alone. The FK in
  // rf_event_id is informal (FK enforcement off in prod sqlite); the
  // referenced ID lives in whichever table source points to.
  source: text('source').notNull().default('shure'),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  rfEventIdx: index('InterferenceAttribution_rfEvent_idx').on(table.rfEventId),
  neighborhoodEventIdx: index('InterferenceAttribution_neighborhoodEvent_idx').on(table.neighborhoodEventId),
  sourceIdx: index('InterferenceAttribution_source_idx').on(table.source),
  // One attribution per (rf_event, neighborhood_event) pair — re-running
  // the correlation engine is idempotent. rf_event IDs are UUIDs from
  // either shure_rf_events or sdr_carriers (no collision risk).
  uniqueAttribution: uniqueIndex('InterferenceAttribution_rfEvent_neighborhoodEvent_unique').on(table.rfEventId, table.neighborhoodEventId),
}))

export const artistInterferenceProfiles = sqliteTable('ArtistInterferenceProfile', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  artistNormalized: text('artist_normalized').notNull(),
  // Our LOCATION_ID — profiles are per-bar because the same DJ at the
  // same nearby venue might affect Holmgren (closest) differently than
  // Anduzi's-adjacent operators 1 mile further out.
  locationId: text('location_id').notNull(),
  totalGigs: integer('total_gigs').notNull().default(0),
  gigsWithInterference: integer('gigs_with_interference').notNull().default(0),
  avgSeverityDbm: real('avg_severity_dbm'),
  // JSON array of MHz values where this artist has caused interference.
  // E.g. '[510.9, 487.0, 502.3]' — read by the preemptive-strike
  // workflow to choose which of our channels to retune.
  predictedFreqsAffected: text('predicted_freqs_affected'),
  firstObserved: integer('first_observed'),
  lastObserved: integer('last_observed'),
  // Human-readable recommendation generated by Ollama llama3.1:8b from
  // the underlying attributions. Updated when totalGigs or
  // gigsWithInterference materially change.
  recommendation: text('recommendation'),
  // 0.0–1.0. gigsWithInterference / totalGigs scaled by sample size.
  // < 3 gigs = 0.0 (insufficient data, never act on it).
  confidence: real('confidence').notNull().default(0),
  updatedAt: integer('updated_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  artistIdx: index('ArtistInterferenceProfile_artist_idx').on(table.artistNormalized),
  locationIdx: index('ArtistInterferenceProfile_location_idx').on(table.locationId),
  confidenceIdx: index('ArtistInterferenceProfile_confidence_idx').on(table.confidence),
  // One profile per (artist, location) — running the profile builder
  // multiple times is idempotent.
  uniqueArtistLocation: uniqueIndex('ArtistInterferenceProfile_artist_location_unique').on(table.artistNormalized, table.locationId),
}))

// v2.55.23+ — Phase 2 of the self-monitoring architecture (HOOK_COVERAGE.md).
// Autonomous error-watch service tails the PM2 error log + grep-matches against
// a signature library, writing one row per detection. Also writes a 'heartbeat'
// row every N min so silence means "watcher died" not "all clear" — exactly the
// caveat baked into pattern #1: a watcher with no heartbeat is invisible
// when it dies. Plus 'startup' rows so the watcher proves it actually
// initialized on a fresh boot.
//
// kind: 'error' | 'heartbeat' | 'startup'
// signature: human-readable label of which signature matched, or
//   'watcher_alive' for heartbeat, or 'service_start' for startup
export const errorWatchEvents = sqliteTable('error_watch_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  kind: text('kind').notNull(),
  signature: text('signature').notNull(),
  sample: text('sample').notNull().default(''), // first ~200 chars of matched line, sanitized
  sourceFile: text('source_file'),               // basename of PM2 log file
  detectedAt: integer('detected_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  detectedAtIdx: index('error_watch_events_detected_at_idx').on(table.detectedAt),
  signatureIdx: index('error_watch_events_signature_idx').on(table.signature, table.detectedAt),
  kindIdx: index('error_watch_events_kind_idx').on(table.kind, table.detectedAt),
}))

// shure_pending_resync — operator-queued receiver-side frequency changes
// that need a manual IR-sync of the transmitter to take effect on the
// mic. Lifecycle: row INSERTed when operator calls /api/shure-rf/queue-
// freq-change → bartender Audio tab shows a "Mic N needs re-sync" banner
// while verified_at IS NULL → shure-rf-watcher.ts UPDATE-sets verified_at
// when the receiver's sample frames show a real TX_MODEL (i.e. not
// UNKNOWN) with active signal at the new frequency. Operator can
// canceled_at-set the row via /api/shure-rf/cancel-resync to abandon a
// pending change (banner clears without verification).
//
// freq stored as 6-digit kHz to match the wire protocol (485325 =
// 485.325 MHz; SLX-D's `< SET 1 FREQUENCY 503000 >` format).
export const shurePendingResync = sqliteTable('shure_pending_resync', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  receiverId: text('receiver_id').notNull(),
  channel: integer('channel').notNull(),
  oldFreqKhz: integer('old_freq_khz').notNull(),
  newFreqKhz: integer('new_freq_khz').notNull(),
  setAt: integer('set_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
  verifiedAt: integer('verified_at'),     // NULL = pending; non-NULL = TX active on new freq
  canceledAt: integer('canceled_at'),     // NULL = active; non-NULL = abandoned
  notes: text('notes'),
}, (table) => ({
  activeIdx: index('shure_pending_resync_active_idx').on(table.receiverId, table.channel, table.verifiedAt, table.canceledAt),
  setAtIdx: index('shure_pending_resync_set_at_idx').on(table.setAt),
}))

// agent_tool_invocations (v2.57.0, Hermes Phase 2) — audit trail of every tool
// the agent brain (via the @sports-bar/mcp gateway) invokes. The MCP server
// fire-and-forget POSTs one row per tool call to /api/agent/tool-log. This is
// the accountability layer: proposals + todo-writes especially must leave a
// record (who/what/when), and read tools are logged too so an operator can see
// exactly what the agent looked at. Nothing here authorizes a hardware write —
// it only records intent + result.
export const agentToolInvocations = sqliteTable('agent_tool_invocations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tool: text('tool').notNull(),                 // tool name, e.g. 'get_system_health', 'propose_action'
  args: text('args'),                           // JSON string of the tool arguments (may be null/empty)
  resultSummary: text('result_summary'),        // first ~500 chars of the tool's text result
  surface: text('surface').notNull().default('unknown'), // 'operator' | 'bartender' | 'unknown'
  isError: integer('is_error', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().$defaultFn(() => Math.floor(Date.now() / 1000)),
}, (table) => ({
  toolIdx: index('agent_tool_invocations_tool_created_at_idx').on(table.tool, table.createdAt),
  createdAtIdx: index('agent_tool_invocations_created_at_idx').on(table.createdAt),
}))
