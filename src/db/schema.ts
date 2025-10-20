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

// Training Document Model
export const trainingDocuments = sqliteTable('TrainingDocument', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text('title').notNull(),
  content: text('content').notNull(),
  fileType: text('fileType').notNull(),
  fileName: text('fileName').notNull(),
  fileSize: integer('fileSize').notNull(),
  category: text('category'),
  isActive: integer('isActive', { mode: 'boolean' }).notNull().default(true),
  createdAt: timestamp('createdAt').notNull().default(timestampNow()),
  updatedAt: timestamp('updatedAt').notNull().default(timestampNow()),
}, (table) => ({
  fileTypeIdx: index('TrainingDocument_fileType_idx').on(table.fileType),
  isActiveIdx: index('TrainingDocument_isActive_idx').on(table.isActive),
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
