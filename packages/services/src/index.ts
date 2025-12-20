/**
 * @sports-bar/services
 *
 * Shared service utilities for the Sports Bar TV Controller.
 * Contains services that don't require database access.
 *
 * Note: Services with database dependencies remain in apps/web/src/lib/services/
 * and will be migrated once the database layer is extracted.
 */

// Job Tracker - In-memory job tracking for background tasks
export {
  jobTracker,
  JobTrackerService,
  type Job,
  type JobProgress,
  type JobType,
  type JobStatus,
} from './job-tracker'

// IR Database - Global Cache IR Database API client
export {
  IRDatabaseService,
  irDatabaseService,
  type IRDBBrand,
  type IRDBType,
  type IRDBBrandType,
  type IRDBModel,
  type IRDBFunction,
  type IRDBCode,
  type IRDBCodeResponse,
  type IRDBAccountResponse,
} from './ir-database'

// AI Sports Context - Provides game context for AI
export {
  AISportsContextProvider,
  getAISportsContextProvider,
  type SportsContext,
} from './ai-sports-context'

// Command Scheduler - Scheduled command execution service
export {
  commandScheduler,
  CommandScheduler,
} from './command-scheduler'

// Sports Schedule Sync - Fetches game schedules from TheSportsDB
export {
  SportsScheduleSyncService,
  getSportsScheduleSyncService,
} from './sports-schedule-sync'

// Automated Health Check - Comprehensive system health checks
export {
  AutomatedHealthCheckService,
  getAutomatedHealthCheckService,
  type HealthCheckResult,
} from './automated-health-check'

// Health Check Scheduler - Automatic daily and pre-game checks
export {
  HealthCheckScheduler,
  getHealthCheckScheduler,
  startHealthCheckScheduler,
} from './health-check-scheduler'

// Q&A Uploader - Parse and upload Q&A documents
export {
  parseQAContent,
  saveUploadedQAs,
  processUploadedFile,
  type UploadedQA,
  type ParseResult,
} from './qa-uploader'

// Q&A Generator - Auto-generate Q&A pairs using Ollama
export {
  generateQAsFromRepository,
  getQAGenerationStatus,
  getGenerationJobStatus,
  getAllQAEntries,
  searchQAEntries,
  updateQAEntry,
  deleteQAEntry,
  getQAStatistics,
  type QAGenerationOptions,
  type GeneratedQA,
} from './qa-generator'

// Q&A Generator Processor - Claude API-based Q&A generation
export {
  processQAGenerationJob,
  type QAGenerationOptions as ProcessorQAGenerationOptions,
  type GeneratedQA as ProcessorGeneratedQA,
} from './qa-generator-processor'

// Enhanced Document Search - Fuzzy search with keyword extraction
export {
  EnhancedDocumentSearch,
  documentSearch,
  type DocumentSearchResult,
} from './enhanced-document-search'

// Enhanced AI Client - Ollama integration with health checks
export {
  EnhancedAIClient,
  type ScriptGenerationRequest,
  type FeatureDesignRequest,
  type AIResponse,
} from './enhanced-ai-client'
