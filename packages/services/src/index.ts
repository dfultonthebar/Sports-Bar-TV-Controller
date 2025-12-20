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
