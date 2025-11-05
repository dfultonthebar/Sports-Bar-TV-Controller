import { sqliteTable, AnySQLiteColumn, index, uniqueIndex, text, integer, foreignKey, real } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const globalCacheDevice = sqliteTable("GlobalCacheDevice", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	ipAddress: text().notNull(),
	port: integer().default(4998).notNull(),
	model: text(),
	status: text().default("offline").notNull(),
	lastSeen: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("GlobalCacheDevice_ipAddress_idx").on(table.ipAddress),
	index("GlobalCacheDevice_status_idx").on(table.status),
	uniqueIndex("GlobalCacheDevice_ipAddress_unique").on(table.ipAddress),
]);

export const globalCachePort = sqliteTable("GlobalCachePort", {
	id: text().primaryKey().notNull(),
	deviceId: text().notNull().references(() => globalCacheDevice.id, { onDelete: "cascade" } ),
	portNumber: integer().notNull(),
	portType: text().default("IR").notNull(),
	assignedTo: text(),
	assignedDeviceId: text(),
	irCodeSet: text(),
	enabled: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("GlobalCachePort_assignedDeviceId_idx").on(table.assignedDeviceId),
	index("GlobalCachePort_deviceId_idx").on(table.deviceId),
	uniqueIndex("GlobalCachePort_deviceId_portNumber_key").on(table.deviceId, table.portNumber),
]);

export const homeTeam = sqliteTable("HomeTeam", {
	id: text().primaryKey().notNull(),
	teamName: text().notNull(),
	sport: text().notNull(),
	league: text().notNull(),
	category: text().notNull(),
	location: text(),
	conference: text(),
	isPrimary: integer().default(0).notNull(),
	logoUrl: text(),
	primaryColor: text(),
	secondaryColor: text(),
	isActive: integer().default(1).notNull(),
	priority: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("HomeTeam_teamName_league_key").on(table.teamName, table.league),
]);

export const indexedFile = sqliteTable("IndexedFile", {
	id: text().primaryKey().notNull(),
	filePath: text().notNull(),
	fileName: text().notNull(),
	fileType: text().notNull(),
	content: text().notNull(),
	fileSize: integer().notNull(),
	lastModified: text().notNull(),
	lastIndexed: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	hash: text().notNull(),
	isActive: integer().default(1).notNull(),
	metadata: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("IndexedFile_lastIndexed_idx").on(table.lastIndexed),
	index("IndexedFile_fileType_idx").on(table.fileType),
	index("IndexedFile_isActive_idx").on(table.isActive),
	uniqueIndex("IndexedFile_filePath_unique").on(table.filePath),
]);

export const irCommand = sqliteTable("IRCommand", {
	id: text().primaryKey().notNull(),
	deviceId: text().notNull().references(() => irDevice.id, { onDelete: "cascade" } ),
	functionName: text().notNull(),
	irCode: text().notNull(),
	hexCode: text(),
	codeSetId: text(),
	category: text(),
	description: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("IRCommand_category_idx").on(table.category),
	index("IRCommand_functionName_idx").on(table.functionName),
	index("IRCommand_deviceId_idx").on(table.deviceId),
	uniqueIndex("IRCommand_deviceId_functionName_key").on(table.deviceId, table.functionName),
]);

export const irDatabaseCredentials = sqliteTable("IRDatabaseCredentials", {
	id: text().primaryKey().notNull(),
	email: text().notNull(),
	password: text().notNull(),
	apiKey: text(),
	isActive: integer().default(1).notNull(),
	lastLogin: text(),
	dailyLimit: integer().default(50).notNull(),
	usedToday: integer().default(0).notNull(),
	lastReset: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("IRDatabaseCredentials_isActive_idx").on(table.isActive),
	uniqueIndex("IRDatabaseCredentials_email_unique").on(table.email),
]);

export const irDevice = sqliteTable("IRDevice", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	deviceType: text().notNull(),
	brand: text().notNull(),
	model: text(),
	matrixInput: integer(),
	matrixInputLabel: text(),
	irCodeSetId: text(),
	globalCacheDeviceId: text(),
	globalCachePortNumber: integer(),
	description: text(),
	status: text().default("active").notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("IRDevice_globalCacheDeviceId_idx").on(table.globalCacheDeviceId),
	index("IRDevice_matrixInput_idx").on(table.matrixInput),
	index("IRDevice_brand_idx").on(table.brand),
	index("IRDevice_deviceType_idx").on(table.deviceType),
]);

export const matrixConfig = sqliteTable("MatrixConfig", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	config: text().notNull(),
	isActive: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const matrixConfiguration = sqliteTable("MatrixConfiguration", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	ipAddress: text().notNull(),
	tcpPort: integer().default(23).notNull(),
	udpPort: integer().default(4000).notNull(),
	protocol: text().default("TCP").notNull(),
	isActive: integer().default(1).notNull(),
	cecInputChannel: integer(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const matrixInput = sqliteTable("MatrixInput", {
	id: text().primaryKey().notNull(),
	configId: text().notNull().references(() => matrixConfiguration.id, { onDelete: "cascade" } ),
	channelNumber: integer().notNull(),
	label: text().notNull(),
	inputType: text().default("HDMI").notNull(),
	deviceType: text().default("Other").notNull(),
	isActive: integer().default(1).notNull(),
	status: text().default("active").notNull(),
	powerOn: integer().default(0).notNull(),
	isCecPort: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("MatrixInput_configId_channelNumber_key").on(table.configId, table.channelNumber),
]);

export const matrixOutput = sqliteTable("MatrixOutput", {
	id: text().primaryKey().notNull(),
	configId: text().notNull().references(() => matrixConfiguration.id, { onDelete: "cascade" } ),
	channelNumber: integer().notNull(),
	label: text().notNull(),
	resolution: text().default("1080p").notNull(),
	isActive: integer().default(1).notNull(),
	status: text().default("active").notNull(),
	audioOutput: text(),
	powerOn: integer().default(0).notNull(),
	selectedVideoInput: integer(),
	videoInputLabel: text(),
	dailyTurnOn: integer().default(0).notNull(),
	dailyTurnOff: integer().default(0).notNull(),
	tvBrand: text(),
	tvModel: text(),
	cecAddress: text(),
	lastDiscovery: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("MatrixOutput_configId_channelNumber_key").on(table.configId, table.channelNumber),
]);

export const matrixRoute = sqliteTable("MatrixRoute", {
	id: text().primaryKey().notNull(),
	inputNum: integer().notNull(),
	outputNum: integer().notNull(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("MatrixRoute_outputNum_idx").on(table.outputNum),
	uniqueIndex("MatrixRoute_outputNum_unique").on(table.outputNum),
]);

export const processedFile = sqliteTable("ProcessedFile", {
	id: text().primaryKey().notNull(),
	filePath: text().notNull(),
	fileHash: text().notNull(),
	lastProcessed: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	qaCount: integer().default(0).notNull(),
	sourceType: text().notNull(),
	status: text().default("processed").notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("ProcessedFile_lastProcessed_idx").on(table.lastProcessed),
	index("ProcessedFile_sourceType_idx").on(table.sourceType),
	index("ProcessedFile_status_idx").on(table.status),
	uniqueIndex("ProcessedFile_filePath_unique").on(table.filePath),
]);

export const providerInput = sqliteTable("ProviderInput", {
	id: text().primaryKey().notNull(),
	providerId: text().notNull().references(() => tvProvider.id, { onDelete: "cascade" } ),
	inputId: text().notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("ProviderInput_providerId_inputId_key").on(table.providerId, table.inputId),
]);

export const qaEntry = sqliteTable("QAEntry", {
	id: text().primaryKey().notNull(),
	question: text().notNull(),
	answer: text().notNull(),
	category: text().default("general").notNull(),
	tags: text(),
	sourceFile: text(),
	sourceType: text().default("manual").notNull(),
	confidence: real().default(1).notNull(),
	useCount: integer().default(0).notNull(),
	lastUsed: text(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("QAEntry_sourceFile_idx").on(table.sourceFile),
	index("QAEntry_sourceType_idx").on(table.sourceType),
	index("QAEntry_isActive_idx").on(table.isActive),
	index("QAEntry_category_idx").on(table.category),
]);

export const qaGenerationJob = sqliteTable("QAGenerationJob", {
	id: text().primaryKey().notNull(),
	status: text().default("pending").notNull(),
	sourceType: text().notNull(),
	sourcePath: text(),
	totalFiles: integer().default(0).notNull(),
	processedFiles: integer().default(0).notNull(),
	generatedQas: integer().default(0).notNull(),
	entriesGenerated: integer().default(0).notNull(),
	errorMessage: text(),
	startedAt: text(),
	completedAt: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("QAGenerationJob_createdAt_idx").on(table.createdAt),
	index("QAGenerationJob_status_idx").on(table.status),
]);

export const scheduleLog = sqliteTable("ScheduleLog", {
	id: text().primaryKey().notNull(),
	scheduleId: text().notNull().references(() => schedule.id, { onDelete: "cascade" } ),
	executedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	success: integer().notNull(),
	error: text(),
	channelName: text().notNull(),
	deviceName: text().notNull(),
});

export const schedule = sqliteTable("Schedule", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	deviceId: text().notNull().references(() => fireTvDevice.id, { onDelete: "cascade" } ),
	channelName: text().notNull(),
	channelNumber: text(),
	startTime: text().notNull(),
	endTime: text(),
	recurring: integer().default(0).notNull(),
	daysOfWeek: text(),
	enabled: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const selectedLeague = sqliteTable("SelectedLeague", {
	id: text().primaryKey().notNull(),
	league: text().notNull(),
	isActive: integer().default(1).notNull(),
	priority: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("SelectedLeague_priority_idx").on(table.priority),
	index("SelectedLeague_league_idx").on(table.league),
	uniqueIndex("SelectedLeague_league_unique").on(table.league),
]);

export const soundtrackConfig = sqliteTable("SoundtrackConfig", {
	id: text().primaryKey().notNull(),
	apiKey: text().notNull(),
	accountId: text(),
	accountName: text(),
	isActive: integer().default(1).notNull(),
	lastSync: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const soundtrackPlayer = sqliteTable("SoundtrackPlayer", {
	id: text().primaryKey().notNull(),
	configId: text().notNull().references(() => soundtrackConfig.id, { onDelete: "cascade" } ),
	playerId: text().notNull(),
	playerName: text().notNull(),
	locationName: text(),
	audioZoneId: text().references(() => audioZone.id),
	displayOrder: integer().default(0).notNull(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	bartenderVisible: integer().default(0).notNull(),
},
(table) => [
	uniqueIndex("SoundtrackPlayer_playerId_key").on(table.playerId),
	index("SoundtrackPlayer_configId_idx").on(table.configId),
]);

export const sportsGuideConfiguration = sqliteTable("SportsGuideConfiguration", {
	id: text().primaryKey().notNull(),
	zipCode: text(),
	city: text(),
	state: text(),
	timezone: text().default("America/New_York").notNull(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const systemSettings = sqliteTable("SystemSettings", {
	id: text().primaryKey().notNull(),
	key: text().notNull(),
	value: text().notNull(),
	description: text(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("SystemSettings_key_unique").on(table.key),
]);

export const testLog = sqliteTable("TestLog", {
	id: text().primaryKey().notNull(),
	testType: text().notNull(),
	testName: text().notNull(),
	status: text().notNull(),
	inputChannel: integer(),
	outputChannel: integer(),
	command: text(),
	response: text(),
	errorMessage: text(),
	duration: integer(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	metadata: text(),
},
(table) => [
	index("TestLog_timestamp_idx").on(table.timestamp),
	index("TestLog_status_idx").on(table.status),
	index("TestLog_testType_idx").on(table.testType),
]);

export const todoDocument = sqliteTable("TodoDocument", {
	id: text().primaryKey().notNull(),
	todoId: text().notNull().references(() => todo.id, { onDelete: "cascade" } ),
	filename: text().notNull(),
	filepath: text().notNull(),
	filesize: integer(),
	mimetype: text(),
	uploadedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("TodoDocument_todoId_idx").on(table.todoId),
]);

export const todo = sqliteTable("Todo", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	priority: text().default("MEDIUM").notNull(),
	status: text().default("PLANNED").notNull(),
	category: text(),
	tags: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	completedAt: text(),
});

export const trainingDocument = sqliteTable("TrainingDocument", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	content: text().notNull(),
	fileType: text().notNull(),
	fileName: text().notNull(),
	fileSize: integer().notNull(),
	category: text(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("TrainingDocument_isActive_idx").on(table.isActive),
	index("TrainingDocument_fileType_idx").on(table.fileType),
]);

export const tvLayout = sqliteTable("TVLayout", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	layoutData: text().notNull(),
	isActive: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const tvProvider = sqliteTable("TVProvider", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	channels: text().notNull(),
	packages: text().notNull(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const wolfpackMatrixRouting = sqliteTable("WolfpackMatrixRouting", {
	id: text().primaryKey().notNull(),
	matrixOutputNumber: integer().notNull(),
	wolfpackInputNumber: integer().notNull(),
	wolfpackInputLabel: text().notNull(),
	atlasInputLabel: text(),
	isActive: integer().default(1).notNull(),
	lastRouted: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("WolfpackMatrixRouting_matrixOutputNumber_unique").on(table.matrixOutputNumber),
]);

export const wolfpackMatrixState = sqliteTable("WolfpackMatrixState", {
	id: text().primaryKey().notNull(),
	matrixOutputNumber: integer().notNull(),
	wolfpackInputNumber: integer().notNull(),
	wolfpackInputLabel: text().notNull(),
	channelInfo: text(),
	routedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("WolfpackMatrixState_routedAt_idx").on(table.routedAt),
	index("WolfpackMatrixState_matrixOutputNumber_idx").on(table.matrixOutputNumber),
]);

export const n8NWebhookLog = sqliteTable("N8nWebhookLog", {
	id: text().primaryKey().notNull(),
	action: text().notNull(),
	workflowId: text(),
	executionId: text(),
	payload: text().notNull(),
	response: text(),
	status: text().default("success").notNull(),
	errorMessage: text(),
	duration: integer().notNull(),
	metadata: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("N8nWebhookLog_workflowId_idx").on(table.workflowId),
	index("N8nWebhookLog_createdAt_idx").on(table.createdAt),
	index("N8nWebhookLog_status_idx").on(table.status),
	index("N8nWebhookLog_action_idx").on(table.action),
]);

export const n8NWorkflowConfig = sqliteTable("N8nWorkflowConfig", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	workflowId: text(),
	description: text(),
	webhookUrl: text(),
	isActive: integer().default(1).notNull(),
	triggerType: text().default("manual").notNull(),
	schedule: text(),
	actions: text().notNull(),
	metadata: text(),
	lastExecuted: text(),
	executionCount: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("N8nWorkflowConfig_isActive_idx").on(table.isActive),
	index("N8nWorkflowConfig_workflowId_idx").on(table.workflowId),
	uniqueIndex("N8nWorkflowConfig_workflowId_unique").on(table.workflowId),
]);

export const aiGainAdjustmentLog = sqliteTable("AIGainAdjustmentLog", {
	id: text().primaryKey().notNull(),
	configId: text().notNull().references(() => aiGainConfiguration.id, { onDelete: "cascade" } ),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	inputNumber: integer().notNull(),
	previousLevel: real().notNull(),
	newLevel: real().notNull(),
	adjustment: real().notNull(),
	reason: text(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("AIGainAdjustmentLog_timestamp_idx").on(table.timestamp),
	index("AIGainAdjustmentLog_configId_idx").on(table.configId),
]);

export const aiGainConfiguration = sqliteTable("AIGainConfiguration", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	inputNumber: integer().notNull(),
	inputName: text().notNull(),
	targetLevel: real().default(-20).notNull(),
	enabled: integer().default(0).notNull(),
	lastAdjustment: text(),
	adjustmentCount: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("AIGainConfiguration_processorId_inputNumber_key").on(table.processorId, table.inputNumber),
]);

export const apiKey = sqliteTable("ApiKey", {
	id: text().primaryKey().notNull(),
	provider: text().notNull(),
	keyName: text().notNull(),
	apiKey: text().notNull(),
	endpoint: text(),
	model: text(),
	isActive: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("ApiKey_isActive_idx").on(table.isActive),
	index("ApiKey_provider_idx").on(table.provider),
	uniqueIndex("ApiKey_provider_keyName_key").on(table.provider, table.keyName),
]);

export const atlasConnectionState = sqliteTable("AtlasConnectionState", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	isConnected: integer().default(0).notNull(),
	lastConnected: text(),
	lastDisconnected: text(),
	lastKeepAlive: text(),
	connectionErrors: integer().default(0).notNull(),
	lastError: text(),
	reconnectAttempts: integer().default(0).notNull(),
	tcpPort: integer().default(5321).notNull(),
	udpPort: integer().default(3131).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("AtlasConnectionState_processorId_unique").on(table.processorId),
]);

export const atlasMeterReading = sqliteTable("AtlasMeterReading", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	meterType: text().notNull(),
	meterIndex: integer().notNull(),
	meterName: text(),
	level: real().notNull(),
	peak: real(),
	clipping: integer().default(0).notNull(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("AtlasMeterReading_timestamp_idx").on(table.timestamp),
	index("AtlasMeterReading_processorId_meterType_meterIndex_idx").on(table.processorId, table.meterType, table.meterIndex),
]);

export const atlasParameter = sqliteTable("AtlasParameter", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	paramName: text().notNull(),
	paramType: text().notNull(),
	paramIndex: integer().notNull(),
	displayName: text(),
	minValue: real(),
	maxValue: real(),
	currentValue: text(),
	format: text().default("val").notNull(),
	readOnly: integer().default(0).notNull(),
	isSubscribed: integer().default(0).notNull(),
	lastUpdated: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("AtlasParameter_processorId_paramType_idx").on(table.processorId, table.paramType),
	uniqueIndex("AtlasParameter_processorId_paramName_key").on(table.processorId, table.paramName),
]);

export const audioInputMeter = sqliteTable("AudioInputMeter", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	inputNumber: integer().notNull(),
	inputName: text().notNull(),
	level: real().notNull(),
	peak: real().notNull(),
	clipping: integer().default(0).notNull(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("AudioInputMeter_processorId_timestamp_idx").on(table.processorId, table.timestamp),
	uniqueIndex("AudioInputMeter_processorId_inputNumber_key").on(table.processorId, table.inputNumber),
]);

export const audioMessage = sqliteTable("AudioMessage", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	audioFile: text().notNull(),
	duration: integer(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const audioProcessor = sqliteTable("AudioProcessor", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	model: text().notNull(),
	ipAddress: text().notNull(),
	port: integer().default(80).notNull(),
	tcpPort: integer().default(5321).notNull(),
	username: text(),
	password: text(),
	zones: integer().default(4).notNull(),
	description: text(),
	status: text().default("offline").notNull(),
	lastSeen: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("AudioProcessor_ipAddress_port_key").on(table.ipAddress, table.port),
]);

export const audioScene = sqliteTable("AudioScene", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	name: text().notNull(),
	description: text(),
	sceneData: text().notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const audioZone = sqliteTable("AudioZone", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	zoneNumber: integer().notNull(),
	name: text().notNull(),
	description: text(),
	currentSource: text(),
	volume: integer().default(50).notNull(),
	muted: integer().default(0).notNull(),
	enabled: integer().default(1).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("AudioZone_processorId_zoneNumber_key").on(table.processorId, table.zoneNumber),
]);

export const audioGroup = sqliteTable("AudioGroup", {
	id: text().primaryKey().notNull(),
	processorId: text().notNull().references(() => audioProcessor.id, { onDelete: "cascade" } ),
	groupNumber: integer().notNull(),
	name: text().notNull(),
	isActive: integer().default(0).notNull(),
	currentSource: text(),
	gain: real().default(-10).notNull(),
	muted: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("AudioGroup_processorId_groupNumber_key").on(table.processorId, table.groupNumber),
]);

export const bartenderRemote = sqliteTable("BartenderRemote", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	ipAddress: text().notNull(),
	port: integer().default(80).notNull(),
	description: text(),
	status: text().default("offline").notNull(),
	lastSeen: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("BartenderRemote_ipAddress_unique").on(table.ipAddress),
]);

export const cecConfiguration = sqliteTable("CECConfiguration", {
	id: text().primaryKey().notNull(),
	isEnabled: integer().default(0).notNull(),
	cecInputChannel: integer(),
	usbDevicePath: text().default("/dev/ttyACM0").notNull(),
	powerOnDelay: integer().default(2000).notNull(),
	powerOffDelay: integer().default(1000).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const channelPreset = sqliteTable("ChannelPreset", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	channelNumber: text().notNull(),
	deviceType: text().notNull(),
	order: integer().default(0).notNull(),
	isActive: integer().default(1).notNull(),
	usageCount: integer().default(0).notNull(),
	lastUsed: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("ChannelPreset_usageCount_idx").on(table.usageCount),
	index("ChannelPreset_isActive_idx").on(table.isActive),
	index("ChannelPreset_deviceType_order_idx").on(table.deviceType, table.order),
]);

export const fireCubeApp = sqliteTable("FireCubeApp", {
	id: text().primaryKey().notNull(),
	deviceId: text().notNull().references(() => fireCubeDevice.id, { onDelete: "cascade" } ),
	packageName: text().notNull(),
	appName: text().notNull(),
	version: text(),
	versionCode: integer(),
	category: text(),
	iconUrl: text(),
	isSystemApp: integer().default(0).notNull(),
	isSportsApp: integer().default(0).notNull(),
	hasSubscription: integer().default(0).notNull(),
	subscriptionStatus: text(),
	lastChecked: text(),
	installedAt: text(),
	updatedAt: text().notNull(),
},
(table) => [
	index("FireCubeApp_deviceId_idx").on(table.deviceId),
	uniqueIndex("FireCubeApp_deviceId_packageName_key").on(table.deviceId, table.packageName),
]);

export const fireCubeDevice = sqliteTable("FireCubeDevice", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	ipAddress: text().notNull(),
	port: integer().default(5555).notNull(),
	macAddress: text(),
	serialNumber: text(),
	deviceModel: text(),
	softwareVersion: text(),
	location: text(),
	matrixInputChannel: integer(),
	adbEnabled: integer().default(0).notNull(),
	status: text().default("discovered").notNull(),
	lastSeen: text(),
	keepAwakeEnabled: integer().default(0).notNull(),
	keepAwakeStart: text().default("07:00"),
	keepAwakeEnd: text().default("01:00"),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().notNull(),
},
(table) => [
	uniqueIndex("FireCubeDevice_serialNumber_unique").on(table.serialNumber),
	uniqueIndex("FireCubeDevice_ipAddress_unique").on(table.ipAddress),
]);

export const fireCubeKeepAwakeLog = sqliteTable("FireCubeKeepAwakeLog", {
	id: text().primaryKey().notNull(),
	deviceId: text().notNull().references(() => fireCubeDevice.id, { onDelete: "cascade" } ),
	action: text().notNull(),
	success: integer().notNull(),
	errorMessage: text(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("FireCubeKeepAwakeLog_timestamp_idx").on(table.timestamp),
	index("FireCubeKeepAwakeLog_deviceId_idx").on(table.deviceId),
]);

export const fireCubeSideloadOperation = sqliteTable("FireCubeSideloadOperation", {
	id: text().primaryKey().notNull(),
	sourceDeviceId: text().notNull().references(() => fireCubeDevice.id, { onDelete: "cascade" } ),
	targetDeviceIds: text().notNull(),
	packageName: text().notNull(),
	appName: text().notNull(),
	status: text().default("pending").notNull(),
	progress: integer().default(0).notNull(),
	totalDevices: integer().notNull(),
	completedDevices: integer().default(0).notNull(),
	failedDevices: integer().default(0).notNull(),
	errorLog: text(),
	startedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	completedAt: text(),
},
(table) => [
	index("FireCubeSideloadOperation_startedAt_idx").on(table.startedAt),
	index("FireCubeSideloadOperation_status_idx").on(table.status),
]);

export const fireCubeSportsContent = sqliteTable("FireCubeSportsContent", {
	id: text().primaryKey().notNull(),
	appId: text().notNull().references(() => fireCubeApp.id, { onDelete: "cascade" } ),
	deviceId: text().notNull().references(() => fireCubeDevice.id, { onDelete: "cascade" } ),
	contentTitle: text().notNull(),
	contentType: text().notNull(),
	league: text(),
	teams: text(),
	startTime: text(),
	endTime: text(),
	channel: text(),
	isLive: integer().default(0).notNull(),
	deepLink: text(),
	thumbnailUrl: text(),
	description: text(),
	lastUpdated: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("FireCubeSportsContent_deviceId_idx").on(table.deviceId),
]);

export const sportsEventSyncLog = sqliteTable("SportsEventSyncLog", {
	id: text().primaryKey().notNull(),
	league: text().notNull(),
	teamName: text(),
	syncType: text().notNull(),
	eventsFound: integer().notNull(),
	eventsAdded: integer().notNull(),
	eventsUpdated: integer().notNull(),
	success: integer().notNull(),
	errorMessage: text(),
	syncedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("SportsEventSyncLog_league_idx").on(table.league),
	index("SportsEventSyncLog_syncedAt_idx").on(table.syncedAt),
]);

export const sportsEvent = sqliteTable("SportsEvent", {
	id: text().primaryKey().notNull(),
	externalId: text(),
	sport: text().notNull(),
	league: text().notNull(),
	eventName: text().notNull(),
	homeTeam: text().notNull(),
	awayTeam: text().notNull(),
	homeTeamId: text().references(() => homeTeam.id),
	eventDate: text().notNull(),
	eventTime: text(),
	venue: text(),
	city: text(),
	country: text(),
	channel: text(),
	importance: text().default("normal").notNull(),
	isHomeTeamFavorite: integer().default(0),
	preGameCheckCompleted: integer().default(0),
	preGameCheckTime: text(),
	status: text().default("scheduled").notNull(),
	thumbnail: text(),
	description: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("SportsEvent_importance_idx").on(table.importance),
	index("SportsEvent_status_idx").on(table.status),
	index("SportsEvent_league_idx").on(table.league),
	index("SportsEvent_eventDate_idx").on(table.eventDate),
]);

export const chatSession = sqliteTable("ChatSession", {
	id: text().primaryKey().notNull(),
	title: text(),
	messages: text().notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const deviceMapping = sqliteTable("DeviceMapping", {
	id: text().primaryKey().notNull(),
	tvNumber: integer().notNull(),
	fireTvDeviceId: text(),
	fireTvName: text(),
	audioZoneId: text(),
	audioZoneName: text(),
	description: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("DeviceMapping_tvNumber_unique").on(table.tvNumber),
]);

export const document = sqliteTable("Document", {
	id: text().primaryKey().notNull(),
	filename: text().notNull(),
	originalName: text().notNull(),
	filePath: text().notNull(),
	fileSize: integer().notNull(),
	mimeType: text().notNull(),
	content: text(),
	embeddings: text(),
	uploadedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
});

export const fireTvDevice = sqliteTable("FireTVDevice", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	ipAddress: text().notNull(),
	macAddress: text(),
	location: text(),
	status: text().default("offline").notNull(),
	lastSeen: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	uniqueIndex("FireTVDevice_ipAddress_unique").on(table.ipAddress),
]);

export const pendingAiTraining = sqliteTable("PendingAITraining", {
	id: text().primaryKey(),
	filePath: text().notNull(),
	fileName: text().notNull(),
	detectedAt: text().notNull(),
	status: text().default("pending"),
	processedAt: text(),
	errorMessage: text(),
	createdAt: text().notNull(),
	updatedAt: text().notNull(),
},
(table) => [
	index("idx_pending_detected").on(table.detectedAt),
	index("idx_pending_status").on(table.status),
]);

export const cecDevice = sqliteTable("CECDevice", {
	id: text().primaryKey().notNull(),
	devicePath: text().notNull(),
	deviceType: text().default("cable_box").notNull(),
	deviceName: text().notNull(),
	matrixInputId: text(),
	cecAddress: text(),
	vendorId: text(),
	productId: text(),
	serialNumber: text(),
	firmwareVersion: text(),
	isActive: integer().default(1).notNull(),
	lastSeen: text(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("CECDevice_isActive_idx").on(table.isActive),
	index("CECDevice_deviceType_idx").on(table.deviceType),
	index("CECDevice_devicePath_idx").on(table.devicePath),
]);

export const cableBox = sqliteTable("CableBox", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	cecDeviceId: text().notNull().references(() => cecDevice.id, { onDelete: "cascade" } ),
	matrixInputId: text(),
	provider: text().default("spectrum").notNull(),
	model: text().default("spectrum-100h").notNull(),
	lastChannel: text(),
	isOnline: integer().default(0).notNull(),
	createdAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
	updatedAt: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("CableBox_matrixInputId_idx").on(table.matrixInputId),
	uniqueIndex("CableBox_cecDeviceId_key").on(table.cecDeviceId),
]);

export const cecCommandLog = sqliteTable("CECCommandLog", {
	id: text().primaryKey().notNull(),
	cecDeviceId: text().notNull().references(() => cecDevice.id, { onDelete: "cascade" } ),
	command: text().notNull(),
	cecCode: text(),
	params: text(),
	success: integer().notNull(),
	responseTime: integer(),
	errorMessage: text(),
	timestamp: text().default("sql`(CURRENT_TIMESTAMP)`").notNull(),
},
(table) => [
	index("CECCommandLog_command_idx").on(table.command),
	index("CECCommandLog_timestamp_idx").on(table.timestamp),
	index("CECCommandLog_cecDeviceId_idx").on(table.cecDeviceId),
]);

