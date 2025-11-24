import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// Helper function for timestamp defaults (compatible with Prisma DATETIME format)
const timestamp = (name: string) => text(name)
const timestampNow = () => sql`CURRENT_TIMESTAMP`

// FireTV Device Model
export const fireTVDevices = sqliteTable('FireTVDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  macAddress: text('macAddress'),
  location: text('location'),
  status: text('status').notNull().default('offline'),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

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
export const tvLayouts = sqliteTable('TVLayout', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  layoutData: text('layoutData').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Matrix Config Model
export const matrixConfigs = sqliteTable('MatrixConfig', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  config: text('config').notNull(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Matrix Configuration Model
export const matrixConfigurations = sqliteTable('MatrixConfiguration', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull(),
  tcpPort: integer('tcpPort').notNull().default(23),
  udpPort: integer('udpPort').notNull().default(4000),
  protocol: text('protocol').notNull().default('TCP'),
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
  status: text('status').notNull().default('active'),
  audioOutput: text('audioOutput'),
  powerOn: integer('powerOn', { mode: 'boolean' }).notNull().default(false),
  selectedVideoInput: integer('selectedVideoInput'),
  videoInputLabel: text('videoInputLabel'),
  dailyTurnOn: integer('dailyTurnOn', { mode: 'boolean' }).notNull().default(false),
  dailyTurnOff: integer('dailyTurnOff', { mode: 'boolean' }).notNull().default(false),
  tvBrand: text('tvBrand'),
  tvModel: text('tvModel'),
  lastDiscovery: timestamp('lastDiscovery'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  configChannelIdx: uniqueIndex('MatrixOutput_configId_channelNumber_key').on(table.configId, table.channelNumber),
}))

// Bartender Remote Model
export const bartenderRemotes = sqliteTable('BartenderRemote', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  ipAddress: text('ipAddress').notNull().unique(),
  port: integer('port').notNull().default(80),
  description: text('description'),
  status: text('status').notNull().default('offline'),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Device Mapping Model
export const deviceMappings = sqliteTable('DeviceMapping', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tvNumber: integer('tvNumber').notNull().unique(),
  fireTvDeviceId: text('fireTvDeviceId'),
  fireTvName: text('fireTvName'),
  audioZoneId: text('audioZoneId'),
  audioZoneName: text('audioZoneName'),
  description: text('description'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// System Settings Model
export const systemSettings = sqliteTable('SystemSettings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Audio Processor Model
export const audioProcessors = sqliteTable('AudioProcessor', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  model: text('model').notNull(),
  ipAddress: text('ipAddress').notNull(),
  port: integer('port').notNull().default(80),
  tcpPort: integer('tcpPort').notNull().default(5321),
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
export const audioScenes = sqliteTable('AudioScene', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  sceneData: text('sceneData').notNull(),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// Audio Message Model
export const audioMessages = sqliteTable('AudioMessage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  processorId: text('processorId').notNull().references(() => audioProcessors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  audioFile: text('audioFile').notNull(),
  duration: integer('duration'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

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
  matrixOutputNumber: integer('matrixOutputNumber').notNull(),
  wolfpackInputNumber: integer('wolfpackInputNumber').notNull(),
  wolfpackInputLabel: text('wolfpackInputLabel').notNull(),
  channelInfo: text('channelInfo'),
  routedAt: timestamp('routedAt').notNull().default(timestampNow()),
}, (table) => ({
  matrixOutputIdx: index('WolfpackMatrixState_matrixOutputNumber_idx').on(table.matrixOutputNumber),
  routedAtIdx: index('WolfpackMatrixState_routedAt_idx').on(table.routedAt),
}))

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
export const trainingDocuments = sqliteTable('TrainingDocument', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  fileType: text('fileType').notNull(),
  fileName: text('fileName').notNull(),
  filePath: text('filePath').notNull(), // Full path to file
  fileSize: integer('fileSize').notNull(),
  category: text('category'),
  tags: text('tags'), // JSON array of tags
  description: text('description'), // User-provided description
  metadata: text('metadata'), // JSON metadata
  processedAt: timestamp('processedAt'), // When document was processed for AI
  viewCount: integer('viewCount').notNull().default(0),
  lastViewed: timestamp('lastViewed'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  fileTypeIdx: index('TrainingDocument_fileType_idx').on(table.fileType),
  isActiveIdx: index('TrainingDocument_isActive_idx').on(table.isActive),
  categoryIdx: index('TrainingDocument_category_idx').on(table.category),
}))

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
  inputNum: integer('inputNum').notNull(),
  outputNum: integer('outputNum').notNull().unique(),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
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

// n8n Webhook Logs Model (for tracking n8n webhook executions)
export const n8nWebhookLogs = sqliteTable('N8nWebhookLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  action: text('action').notNull(), // Action type (control_tv, control_audio, etc.)
  workflowId: text('workflowId'), // n8n workflow ID
  executionId: text('executionId'), // n8n execution ID
  payload: text('payload').notNull(), // JSON payload received from n8n
  response: text('response'), // JSON response sent back to n8n
  status: text('status').notNull().default('success'), // success, failed, error
  errorMessage: text('errorMessage'), // Error message if failed
  duration: integer('duration').notNull(), // Execution duration in ms
  metadata: text('metadata'), // Additional metadata as JSON
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
}, (table) => ({
  actionIdx: index('N8nWebhookLog_action_idx').on(table.action),
  statusIdx: index('N8nWebhookLog_status_idx').on(table.status),
  createdAtIdx: index('N8nWebhookLog_createdAt_idx').on(table.createdAt),
  workflowIdIdx: index('N8nWebhookLog_workflowId_idx').on(table.workflowId),
}))

// n8n Workflow Configurations Model (for storing n8n workflow settings)
export const n8nWorkflowConfigs = sqliteTable('N8nWorkflowConfig', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(), // Workflow name
  workflowId: text('workflowId').unique(), // n8n workflow ID
  description: text('description'), // Workflow description
  webhookUrl: text('webhookUrl'), // Webhook URL for this workflow
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  triggerType: text('triggerType').notNull().default('manual'), // manual, scheduled, webhook
  schedule: text('schedule'), // Cron expression for scheduled workflows
  actions: text('actions').notNull(), // JSON array of action configurations
  metadata: text('metadata'), // Additional configuration as JSON
  lastExecuted: timestamp('lastExecuted'),
  executionCount: integer('executionCount').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  workflowIdIdx: index('N8nWorkflowConfig_workflowId_idx').on(table.workflowId),
  isActiveIdx: index('N8nWorkflowConfig_isActive_idx').on(table.isActive),
}))


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

  // TV Outputs Allocated
  tvOutputIds: text('tv_output_ids').notNull(), // JSON array of matrix output IDs
  tvCount: integer('tv_count').notNull(),

  // Timing
  allocatedAt: integer('allocated_at').notNull().default(sql`(strftime('%s', 'now'))`), // Unix timestamp
  expectedFreeAt: integer('expected_free_at').notNull(), // Unix timestamp (estimated game end + buffer)
  actuallyFreedAt: integer('actually_freed_at'), // Unix timestamp

  // Status
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'completed', 'preempted', 'cancelled'

  // Preemption Tracking
  preemptedByAllocationId: text('preempted_by_allocation_id').references(() => inputSourceAllocations.id, { onDelete: 'set null' }),
  preemptedReason: text('preempted_reason'),

  // Quality of Service
  allocationQuality: text('allocation_quality'), // 'optimal', 'suboptimal', 'degraded'
  qualityNotes: text('quality_notes'), // explanation of quality rating

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
