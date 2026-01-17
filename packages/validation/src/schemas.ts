/**
 * Common Validation Schemas
 *
 * Reusable Zod schemas for input validation across API endpoints
 */

import { z } from 'zod'
import { isValidCronExpression } from './cron-validation'

// ============================================================================
// COMMON PRIMITIVES
// ============================================================================

/**
 * UUID validation (v4 format)
 */
export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' })

/**
 * Non-empty string validation
 */
export const nonEmptyStringSchema = z.string().min(1, 'String cannot be empty')

/**
 * Optional non-empty string (can be undefined, but if present must not be empty)
 */
export const optionalNonEmptyStringSchema = z.string().min(1).optional()

/**
 * Positive integer validation
 */
export const positiveIntSchema = z.number().int().positive()

/**
 * Non-negative integer validation
 */
export const nonNegativeIntSchema = z.number().int().min(0)

/**
 * Port number validation (1-65535)
 */
export const portSchema = z.number().int().min(1).max(65535)

/**
 * ISO 8601 date string validation
 */
export const isoDateSchema = z.string().datetime({ message: 'Invalid ISO 8601 date format' })

/**
 * Boolean with coercion from strings
 */
export const booleanSchema = z.boolean().or(z.enum(['true', 'false']).transform(val => val === 'true'))

// ============================================================================
// NETWORK & INFRASTRUCTURE
// ============================================================================

/**
 * IP Address validation (IPv4 and IPv6)
 */
export const ipAddressSchema = z.string().ip({ message: 'Invalid IP address' })

/**
 * IPv4 Address validation (strict)
 */
export const ipv4AddressSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  'Invalid IPv4 address'
)

/**
 * URL validation
 */
export const urlSchema = z.string().url({ message: 'Invalid URL format' })

/**
 * Protocol validation (TCP/UDP)
 */
export const protocolSchema = z.enum(['TCP', 'UDP'], {
  errorMap: () => ({ message: 'Protocol must be TCP or UDP' })
})

// ============================================================================
// HARDWARE CONTROL
// ============================================================================

/**
 * Device ID validation (alphanumeric with underscores)
 */
export const deviceIdSchema = z.string().regex(
  /^[a-zA-Z0-9_-]+$/,
  'Device ID must contain only alphanumeric characters, underscores, and hyphens'
)


/**
 * Volume level validation (0-100)
 */
export const volumeSchema = z.number().int().min(0).max(100)

/**
 * Input number validation (1-10 for most devices)
 */
export const inputNumberSchema = z.number().int().min(1).max(10)

/**
 * Matrix routing validation
 */
export const matrixRouteSchema = z.object({
  inputId: deviceIdSchema,
  outputId: deviceIdSchema,
  immediate: z.boolean().optional().default(true)
})

/**
 * Channel number validation (1-9999)
 */
export const channelNumberSchema = z.number().int().min(1).max(9999)

// ============================================================================
// DEVICE TYPES
// ============================================================================

/**
 * Device type validation
 */
export const deviceTypeSchema = z.enum([
  'directv',
  'firetv',
  'cec',
  'ir',
  'matrix',
  'audio',
  'wolfpack',
  'atlas'
], {
  errorMap: () => ({ message: 'Invalid device type' })
})

/**
 * DirecTV receiver type validation
 */
export const directvReceiverTypeSchema = z.enum([
  'Genie HD DVR',
  'Genie Mini',
  'HD Receiver',
  'SD Receiver'
], {
  errorMap: () => ({ message: 'Invalid DirecTV receiver type' })
})

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Pagination limit (1-100)
 */
export const paginationLimitSchema = z.coerce.number().int().min(1).max(100).default(20)

/**
 * Pagination offset
 */
export const paginationOffsetSchema = z.coerce.number().int().min(0).default(0)

/**
 * Sort order validation
 */
export const sortOrderSchema = z.enum(['asc', 'desc'], {
  errorMap: () => ({ message: 'Sort order must be "asc" or "desc"' })
})

// ============================================================================
// SCHEDULING & TIME
// ============================================================================

/**
 * Schedule type validation
 */
export const scheduleTypeSchema = z.enum([
  'once',
  'daily',
  'weekly',
  'monthly',
  'cron'
], {
  errorMap: () => ({ message: 'Invalid schedule type' })
})

/**
 * Time string validation (HH:MM format)
 */
export const timeStringSchema = z.string().regex(
  /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  'Time must be in HH:MM format'
)

/**
 * Day of week validation (0=Sunday, 6=Saturday)
 */
export const dayOfWeekSchema = z.number().int().min(0).max(6)

/**
 * Timezone validation
 */
export const timezoneSchema = z.string().min(1, 'Timezone is required')

/**
 * Cron expression validation (5-field format)
 */
export const cronExpressionSchema = z.string()
  .min(9, 'Cron expression too short')
  .refine(
    (val) => isValidCronExpression(val),
    { message: 'Invalid cron expression format' }
  )

// ============================================================================
// SPORTS & ENTERTAINMENT
// ============================================================================

/**
 * Sports league validation
 */
export const sportsLeagueSchema = z.enum([
  'NFL',
  'NBA',
  'MLB',
  'NHL',
  'MLS',
  'NCAA',
  'EPL',
  'UFC',
  'NASCAR'
], {
  errorMap: () => ({ message: 'Invalid sports league' })
})

/**
 * Date string validation (YYYY-MM-DD)
 */
export const dateStringSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
)

// ============================================================================
// API KEYS & AUTHENTICATION
// ============================================================================

/**
 * API Key provider validation
 */
export const apiKeyProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'aws',
  'azure',
  'sportsdata',
  'soundtrack',
  'other'
], {
  errorMap: () => ({ message: 'Invalid API key provider' })
})

/**
 * API Key name validation (3-100 characters)
 */
export const apiKeyNameSchema = z.string().min(3).max(100)

/**
 * API Key value validation (min 10 characters for security)
 */
export const apiKeyValueSchema = z.string().min(10, 'API key must be at least 10 characters')

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * File path validation (unix-style paths)
 */
export const filePathSchema = z.string().regex(
  /^\/[\w\-./]+$/,
  'Invalid file path format'
)

/**
 * Filename validation (no path separators)
 */
export const filenameSchema = z.string().regex(
  /^[^/\\]+$/,
  'Filename cannot contain path separators'
)

// ============================================================================
// STREAMING & APPS
// ============================================================================

/**
 * App ID validation (package name format)
 */
export const appIdSchema = z.string().regex(
  /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
  'Invalid app ID format (must be package name format)'
)

/**
 * Deep link validation
 */
export const deepLinkSchema = z.string().url().or(z.string().startsWith('intent://'))

// ============================================================================
// COMPOSITE SCHEMAS
// ============================================================================

/**
 * Device creation schema
 */
export const deviceCreateSchema = z.object({
  name: nonEmptyStringSchema,
  ipAddress: ipAddressSchema,
  port: portSchema.optional(),
  type: deviceTypeSchema
})

/**
 * Device update schema
 */
export const deviceUpdateSchema = z.object({
  id: deviceIdSchema,
  name: optionalNonEmptyStringSchema,
  ipAddress: ipAddressSchema.optional(),
  port: portSchema.optional(),
  isOnline: z.boolean().optional()
})

/**
 * Command execution schema
 */
export const commandExecutionSchema = z.object({
  deviceId: deviceIdSchema,
  command: nonEmptyStringSchema,
  params: z.record(z.unknown()).optional()
})

/**
 * Scheduled command schema
 */
export const scheduledCommandCreateSchema = z.object({
  name: nonEmptyStringSchema,
  description: optionalNonEmptyStringSchema,
  commandType: nonEmptyStringSchema,
  targetType: deviceTypeSchema,
  targets: z.array(deviceIdSchema).min(1, 'At least one target is required'),
  commandSequence: z.array(z.record(z.unknown())).min(1, 'At least one command is required'),
  scheduleType: scheduleTypeSchema,
  scheduleData: z.record(z.unknown()),
  cronExpression: cronExpressionSchema.optional(),
  timezone: timezoneSchema.optional(),
  enabled: z.boolean().optional(),
  createdBy: optionalNonEmptyStringSchema
})

// ============================================================================
// HARDWARE CONTROL SCHEMAS
// ============================================================================


/**
 * Channel tuning schema
 */
export const channelTuneSchema = z.object({
  deviceId: deviceIdSchema.optional(),
  channel: channelNumberSchema,
  immediate: z.boolean().optional().default(true)
})

/**
 * Matrix routing command schema
 */
export const matrixRoutingSchema = z.object({
  input: z.union([z.number().int().min(1).max(32), deviceIdSchema]),
  output: z.union([z.number().int().min(1).max(32), deviceIdSchema]),
  immediate: z.boolean().optional().default(true)
})

/**
 * IR command send schema
 */
export const irCommandSendSchema = z.object({
  deviceId: deviceIdSchema,
  command: nonEmptyStringSchema.max(100),
  repeat: z.number().int().min(1).max(10).optional().default(1),
  delay: z.number().int().min(0).max(5000).optional().default(0)
})

/**
 * Audio control schema
 */
export const audioControlSchema = z.object({
  processorId: z.string().uuid(),
  command: z.object({
    action: z.enum(['volume', 'mute', 'unmute', 'source', 'scene', 'message', 'combine', 'output-volume']),
    zone: z.number().int().min(1).max(16).optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    zones: z.array(z.number().int().min(1).max(16)).optional(),
    sceneId: z.number().int().optional(),
    messageId: z.number().int().optional(),
    outputIndex: z.number().int().min(0).optional(),
    parameterName: z.string().optional()
  })
})

// ============================================================================
// FILE UPLOAD & DATA IMPORT SCHEMAS
// ============================================================================

/**
 * Document upload schema
 */
export const documentUploadSchema = z.object({
  title: nonEmptyStringSchema.max(200),
  content: nonEmptyStringSchema.max(1000000),
  type: z.enum(['manual', 'guide', 'reference', 'other']).optional().default('other'),
  tags: z.array(z.string().min(1).max(50)).max(20).optional()
})

/**
 * Layout upload schema
 */
export const layoutUploadSchema = z.object({
  name: nonEmptyStringSchema.max(100),
  data: z.record(z.unknown()),
  description: z.string().min(1).max(500).optional()
})

/**
 * Configuration upload schema
 */
export const configUploadSchema = z.object({
  config: z.record(z.unknown()).optional(),
  processorId: z.string().optional(),
  ipAddress: ipAddressSchema.optional(),
  inputs: z.array(z.unknown()).optional(),
  outputs: z.array(z.unknown()).optional(),
  scenes: z.array(z.unknown()).optional(),
  overwrite: z.boolean().optional().default(false),
  backup: z.boolean().optional().default(true)
})

/**
 * QA entry upload schema
 */
export const qaEntrySchema = z.object({
  question: nonEmptyStringSchema.max(500),
  answer: nonEmptyStringSchema.max(5000),
  category: z.string().min(1).max(100).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional()
})

// ============================================================================
// SYSTEM OPERATION SCHEMAS
// ============================================================================

/**
 * Git operation schema
 */
export const gitCommitPushSchema = z.object({
  message: nonEmptyStringSchema.max(500),
  files: z.array(nonEmptyStringSchema).optional(),
  push: z.boolean().optional().default(true),
  branch: z.string().min(1).max(100).optional()
})

/**
 * Script execution schema
 * Supports either a raw command OR a script path (not both)
 */
export const scriptExecutionSchema = z.object({
  command: z.string().max(10000).optional(),
  scriptPath: z.string().max(1000).optional(),
  args: z.array(z.string()).max(50).optional(),
  timeout: z.number().int().min(1000).max(300000).optional().default(30000),
  workingDirectory: z.string().min(1).max(500).optional()
}).refine(
  (data) => data.command || data.scriptPath,
  { message: 'Either command or scriptPath is required' }
)

/**
 * System restart schema
 */
export const systemRestartSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: 'Must confirm system restart' }) }),
  delay: z.number().int().min(0).max(300).optional().default(0),
  reason: z.string().min(1).max(200).optional()
})

// ============================================================================
// STREAMING & MEDIA SCHEMAS
// ============================================================================

/**
 * Streaming app launch schema
 */
export const streamingAppLaunchSchema = z.object({
  deviceId: deviceIdSchema,
  appId: appIdSchema.or(nonEmptyStringSchema.max(100)),
  deepLink: deepLinkSchema.optional(),
  wait: z.boolean().optional().default(false)
})

/**
 * Streaming credentials schema
 */
export const streamingCredentialsSchema = z.object({
  provider: z.enum(['netflix', 'hulu', 'prime', 'espn', 'youtube', 'other']).optional(),
  username: nonEmptyStringSchema.max(200).optional(),
  password: nonEmptyStringSchema.min(8).max(200).optional(),
  platformId: z.string().optional(),
  rememberMe: z.boolean().optional(),
  additionalData: z.record(z.unknown()).optional()
})

// ============================================================================
// QUERY & SEARCH SCHEMAS
// ============================================================================

/**
 * Generic pagination query schema
 */
export const paginationQuerySchema = z.object({
  limit: paginationLimitSchema,
  offset: paginationOffsetSchema,
  sortBy: z.string().min(1).max(50).optional(),
  sortOrder: sortOrderSchema.optional().default('asc')
})

/**
 * Date range query schema
 */
export const dateRangeQuerySchema = z.object({
  startDate: dateStringSchema.or(isoDateSchema),
  endDate: dateStringSchema.or(isoDateSchema),
  timezone: timezoneSchema.optional()
})

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
  query: nonEmptyStringSchema.max(500),
  filters: z.record(z.unknown()).optional(),
  limit: paginationLimitSchema.optional()
})

/**
 * Log query schema
 */
export const logQuerySchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  startDate: dateStringSchema.or(isoDateSchema).optional(),
  endDate: dateStringSchema.or(isoDateSchema).optional(),
  limit: paginationLimitSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  component: z.string().min(1).max(100).optional(),
  action: z.string().optional(),
  hours: z.number().optional(),
  category: z.string().optional()
})

// ============================================================================
// CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Device configuration schema
 */
export const deviceConfigSchema = z.object({
  enabled: z.boolean().optional(),
  autoConnect: z.boolean().optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  retryAttempts: z.number().int().min(0).max(10).optional(),
  settings: z.record(z.unknown()).optional()
})

/**
 * Schedule configuration schema
 */
export const scheduleConfigSchema = z.object({
  enabled: z.boolean(),
  scheduleType: scheduleTypeSchema,
  time: timeStringSchema.optional(),
  days: z.array(dayOfWeekSchema).optional(),
  timezone: timezoneSchema.optional(),
  action: nonEmptyStringSchema.max(100)
})

/**
 * Audio processor configuration schema
 */
export const audioProcessorConfigSchema = z.object({
  ipAddress: ipAddressSchema,
  port: portSchema.optional().default(23),
  zones: z.array(z.object({
    id: nonEmptyStringSchema.max(50),
    name: nonEmptyStringSchema.max(100),
    defaultVolume: volumeSchema.optional()
  })).optional()
})

// ============================================================================
// AI & ANALYSIS SCHEMAS
// ============================================================================

/**
 * AI chat/query schema
 */
export const aiQuerySchema = z.object({
  query: nonEmptyStringSchema.max(2000).optional(),
  message: nonEmptyStringSchema.max(2000).optional(),
  sessionId: z.string().optional(),
  enableTools: z.boolean().optional(),
  stream: z.boolean().optional(),
  chatType: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude', 'ollama']).optional(),
  maxTokens: z.number().int().min(100).max(4000).optional()
}).refine((data) => data.query || data.message, {
  message: "Either 'query' or 'message' must be provided",
  path: ['query']
})

/**
 * AI analysis request schema
 */
export const aiAnalysisSchema = z.object({
  type: z.enum(['device', 'logs', 'performance', 'layout', 'optimization']),
  data: z.record(z.unknown()).optional(),
  options: z.object({
    detailed: z.boolean().optional(),
    suggestions: z.boolean().optional()
  }).optional()
})

// ============================================================================
// DIAGNOSTICS & TESTING SCHEMAS
// ============================================================================

/**
 * Connection test schema
 */
export const connectionTestSchema = z.object({
  deviceId: deviceIdSchema.optional(),
  deviceName: nonEmptyStringSchema.optional(),
  ipAddress: ipAddressSchema.optional(),
  port: portSchema.optional(),
  protocol: protocolSchema.optional().default('TCP'),
  timeout: z.number().int().min(1000).max(30000).optional().default(5000),
  processorId: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  autoDetectCredentials: z.boolean().optional()
})

/**
 * Diagnostic run schema
 */
export const diagnosticRunSchema = z.object({
  components: z.array(z.enum(['network', 'devices', 'database', 'filesystem', 'all'])).optional(),
  verbose: z.boolean().optional().default(false)
})

// ============================================================================
// TV DISCOVERY & CONTROL SCHEMAS
// ============================================================================

/**
 * TV network scan schema
 */
export const tvNetworkScanSchema = z.object({
  ipRange: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}-(\d{1,3}\.){3}\d{1,3}$/,
    'IP range must be in format: 192.168.1.1-192.168.1.254'
  ).optional(),
  ports: z.array(z.number().int().min(1).max(65535)).optional().default([8060]),
  timeout: z.number().int().min(1000).max(30000).optional().default(5000)
})

/**
 * TV power control schema
 */
export const tvPowerControlSchema = z.object({
  action: z.enum(['on', 'off', 'toggle'], {
    errorMap: () => ({ message: 'Action must be on, off, or toggle' })
  })
})

/**
 * TV volume control schema
 */
export const tvVolumeControlSchema = z.object({
  action: z.enum(['up', 'down', 'mute', 'set'], {
    errorMap: () => ({ message: 'Action must be up, down, mute, or set' })
  }),
  value: z.number().int().min(0).max(100).optional()
}).refine((data) => {
  if (data.action === 'set' && data.value === undefined) {
    return false
  }
  return true
}, {
  message: "Value is required when action is 'set'",
  path: ['value']
})

// ============================================================================
// EXPORTS
// ============================================================================

export const ValidationSchemas = {
  // Primitives
  uuid: uuidSchema,
  nonEmptyString: nonEmptyStringSchema,
  optionalNonEmptyString: optionalNonEmptyStringSchema,
  positiveInt: positiveIntSchema,
  nonNegativeInt: nonNegativeIntSchema,
  port: portSchema,
  isoDate: isoDateSchema,
  boolean: booleanSchema,

  // Network
  ipAddress: ipAddressSchema,
  ipv4Address: ipv4AddressSchema,
  url: urlSchema,
  protocol: protocolSchema,

  // Hardware
  deviceId: deviceIdSchema,
  volume: volumeSchema,
  inputNumber: inputNumberSchema,
  matrixRoute: matrixRouteSchema,
  channelNumber: channelNumberSchema,

  // Devices
  deviceType: deviceTypeSchema,
  directvReceiverType: directvReceiverTypeSchema,

  // Query
  paginationLimit: paginationLimitSchema,
  paginationOffset: paginationOffsetSchema,
  sortOrder: sortOrderSchema,

  // Scheduling
  scheduleType: scheduleTypeSchema,
  timeString: timeStringSchema,
  dayOfWeek: dayOfWeekSchema,
  timezone: timezoneSchema,
  cronExpression: cronExpressionSchema,

  // Sports
  sportsLeague: sportsLeagueSchema,
  dateString: dateStringSchema,

  // Auth
  apiKeyProvider: apiKeyProviderSchema,
  apiKeyName: apiKeyNameSchema,
  apiKeyValue: apiKeyValueSchema,

  // Files
  filePath: filePathSchema,
  filename: filenameSchema,

  // Streaming
  appId: appIdSchema,
  deepLink: deepLinkSchema,

  // Composite
  deviceCreate: deviceCreateSchema,
  deviceUpdate: deviceUpdateSchema,
  commandExecution: commandExecutionSchema,
  scheduledCommandCreate: scheduledCommandCreateSchema,

  // Hardware Control
  channelTune: channelTuneSchema,
  matrixRouting: matrixRoutingSchema,
  irCommandSend: irCommandSendSchema,
  audioControl: audioControlSchema,

  // File Upload & Data Import
  documentUpload: documentUploadSchema,
  layoutUpload: layoutUploadSchema,
  configUpload: configUploadSchema,
  qaEntry: qaEntrySchema,

  // System Operations
  gitCommitPush: gitCommitPushSchema,
  scriptExecution: scriptExecutionSchema,
  systemRestart: systemRestartSchema,

  // Streaming & Media
  streamingAppLaunch: streamingAppLaunchSchema,
  streamingCredentials: streamingCredentialsSchema,

  // Query & Search
  paginationQuery: paginationQuerySchema,
  dateRangeQuery: dateRangeQuerySchema,
  searchQuery: searchQuerySchema,
  logQuery: logQuerySchema,

  // Configuration
  deviceConfig: deviceConfigSchema,
  scheduleConfig: scheduleConfigSchema,
  audioProcessorConfig: audioProcessorConfigSchema,

  // AI & Analysis
  aiQuery: aiQuerySchema,
  aiAnalysis: aiAnalysisSchema,

  // Diagnostics & Testing
  connectionTest: connectionTestSchema,
  diagnosticRun: diagnosticRunSchema,

  // TV Discovery & Control
  tvNetworkScan: tvNetworkScanSchema,
  tvPowerControl: tvPowerControlSchema,
  tvVolumeControl: tvVolumeControlSchema
}
