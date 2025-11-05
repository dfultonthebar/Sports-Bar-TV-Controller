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
  deviceId: text('deviceId').notNull().references(() => fireTVDevices.id, { onDelete: 'cascade' }),
  channelName: text('channelName').notNull(),
  channelNumber: text('channelNumber'),
  startTime: timestamp('startTime').notNull(),
  endTime: timestamp('endTime'),
  recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
  daysOfWeek: text('daysOfWeek'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
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
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  teamLeagueIdx: uniqueIndex('HomeTeam_teamName_league_key').on(table.teamName, table.league),
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
  cecInputChannel: integer('cecInputChannel'),
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
  isCecPort: integer('isCecPort', { mode: 'boolean' }).notNull().default(false),
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
  cecAddress: text('cecAddress'),
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

// CEC Configuration Model
// NOTE: Only used for TV power control via CEC
// Cable box CEC control has been deprecated - use IR control instead
export const cecConfigurations = sqliteTable('CECConfiguration', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  isEnabled: integer('isEnabled', { mode: 'boolean' }).notNull().default(false),
  cecInputChannel: integer('cecInputChannel'),
  usbDevicePath: text('usbDevicePath').notNull().default('/dev/ttyACM0'),
  powerOnDelay: integer('powerOnDelay').notNull().default(2000),
  powerOffDelay: integer('powerOffDelay').notNull().default(1000),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
})

// CEC Device Model
// NOTE: Only used for TV power control via CEC adapters
// DEPRECATED: Cable box CEC control (deviceType='cable_box') - use IR control instead
// Valid deviceType values: 'tv_power' (others deprecated)
export const cecDevices = sqliteTable('CECDevice', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  devicePath: text('devicePath').notNull().unique(), // e.g., /dev/ttyACM0
  deviceType: text('deviceType').notNull().default('tv_power'), // 'tv_power' (cable_box deprecated)
  deviceName: text('deviceName').notNull(), // User-friendly name
  matrixInputId: text('matrixInputId'), // Link to matrix input if applicable
  cecAddress: text('cecAddress'), // CEC logical address (0-15)
  vendorId: text('vendorId'), // USB vendor ID
  productId: text('productId'), // USB product ID
  serialNumber: text('serialNumber'), // Adapter serial number
  firmwareVersion: text('firmwareVersion'), // Adapter firmware version
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  lastSeen: timestamp('lastSeen'),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  devicePathIdx: index('CECDevice_devicePath_idx').on(table.devicePath),
  deviceTypeIdx: index('CECDevice_deviceType_idx').on(table.deviceType),
  isActiveIdx: index('CECDevice_isActive_idx').on(table.isActive),
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
  isOnline: integer('isOnline', { mode: 'boolean' }).notNull().default(false),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  matrixInputIdIdx: index('CableBox_matrixInputId_idx').on(table.matrixInputId),
}))

// CEC Command Log Model
// NOTE: Only logs TV power control commands now
// Historical cable box command logs are preserved for reference
export const cecCommandLogs = sqliteTable('CECCommandLog', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cecDeviceId: text('cecDeviceId').notNull().references(() => cecDevices.id, { onDelete: 'cascade' }),
  command: text('command').notNull(), // TV power commands: 'power_on', 'power_off', 'power_toggle'
  cecCode: text('cecCode'), // Raw CEC code (e.g., "tx 40:44:40" for power)
  params: text('params'), // JSON params
  success: integer('success', { mode: 'boolean' }).notNull(),
  responseTime: integer('responseTime'), // Execution time in ms
  errorMessage: text('errorMessage'),
  timestamp: timestamp('timestamp').notNull().default(timestampNow()),
}, (table) => ({
  cecDeviceIdIdx: index('CECCommandLog_cecDeviceId_idx').on(table.cecDeviceId),
  timestampIdx: index('CECCommandLog_timestamp_idx').on(table.timestamp),
  commandIdx: index('CECCommandLog_command_idx').on(table.command),
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
