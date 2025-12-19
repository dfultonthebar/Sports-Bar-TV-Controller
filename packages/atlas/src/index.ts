/**
 * @sports-bar/atlas - AtlasIED Audio Processor Control Package
 *
 * Comprehensive library for AtlasIED AZM4/AZM8 audio processors:
 * - TCP client for JSON-RPC control commands
 * - HTTP client for web interface and configuration
 * - Meter monitoring and subscription
 * - AI-powered gain analysis
 * - Hardware configuration discovery
 */

// Configuration
export * from './config'

// Core TCP Client
export {
  AtlasTCPClient,
  createAtlasClient,
  executeAtlasCommand,
  type AtlasConnectionConfig,
  type AtlasCommand,
  type AtlasResponse
} from './atlasClient'

// HTTP Client
export {
  AtlasHttpClient,
  discoverAtlasConfiguration,
  type AtlasHttpConfig,
  type AtlasDiscoveredConfig,
  type AtlasConfigSource,
  type AtlasConfigZone,
  type AtlasConfigScene,
  type AtlasConfigMessage
} from './atlas-http-client'

// Client Manager (connection pooling)
export {
  atlasClientManager,
  getAtlasClient,
  releaseAtlasClient,
  disconnectAtlasClient,
  type MeterUpdateCallback
} from './atlas-client-manager'

// Hardware Query
export {
  queryAtlasHardwareConfiguration,
  testAtlasConnection,
  type AtlasHardwareSource,
  type AtlasZoneOutput,
  type AtlasHardwareZone,
  type AtlasHardwareGroup,
  type AtlasHardwareConfig
} from './atlas-hardware-query'

// Authentication
export {
  createBasicAuthHeader,
  createAuthHeaders,
  encryptPassword,
  decryptPassword,
  testCredentials,
  ATLAS_DEFAULT_CREDENTIALS
} from './atlas-auth'

// Logging
export { atlasLogger } from './atlas-logger'

// Meter Manager
export {
  AtlasMeterManager,
  createMeterManager
} from './atlas-meter-manager'

// Realtime Meter Service
export {
  AtlasRealtimeMeterService,
  createRealtimeMeterService
} from './atlas-realtime-meter-service'

// AI Analyzer
export {
  AtlasAIAnalyzer,
  atlasAIAnalyzer,
  type AtlasAIAnalysisResult,
  type AtlasMonitoringData
} from './atlas-ai-analyzer'

// Training Data & Pattern Matching
export {
  AtlasPatternMatcher,
  atlasPatternMatcher,
  atlasTrainingPatterns,
  type AtlasTrainingPattern,
  type AtlasLearningData
} from './atlas-ai-training-data'

// Models Config
export * from './atlas-models-config'
