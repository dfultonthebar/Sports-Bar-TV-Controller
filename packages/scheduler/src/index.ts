/**
 * @sports-bar/scheduler
 *
 * AI-powered game scheduling and TV distribution engine for sports bars.
 *
 * Core Components:
 * - DistributionEngine: Assigns games to TVs based on priority and zones
 * - StateReader: Captures current system state for scheduling decisions
 * - PriorityCalculator: Calculates game priority scores with bonuses
 * - TeamNameMatcher: Fuzzy matching for team names from guide data
 * - FireTVContentDetector: Detects streaming-exclusive games
 * - SmartOverride: Calculates intelligent override durations
 */

// Distribution Engine - Main scheduling logic
export {
  DistributionEngine,
  getDistributionEngine,
  resetDistributionEngine,
  type DistributionPlan,
  type GameAssignment,
  type TVAssignment,
  type DefaultAssignment,
  type DistributionOptions
} from './distribution-engine'

// State Reader - System state capture
export {
  StateReader,
  getStateReader,
  resetStateReader,
  type SystemState,
  type InputChannelState,
  type OutputState,
  type AvailableInput
} from './state-reader'

// Priority Calculator - Game scoring
export {
  PriorityCalculator,
  getPriorityCalculator,
  resetPriorityCalculator,
  type GameInfo,
  type PriorityScore
} from './priority-calculator'

// Team Name Matcher - Fuzzy matching
export {
  TeamNameMatcher,
  getTeamMatcher,
  resetTeamMatcher,
  type TeamMatch,
  type HomeTeamData
} from './team-name-matcher'

// Fire TV Content Detector - Streaming games
export {
  FireTVContentDetector,
  getFireTVContentDetector,
  resetFireTVContentDetector,
  STREAMING_PLATFORMS,
  type StreamingPlatform,
  type StreamingGame
} from './firetv-content-detector'

// Smart Override - Duration calculator
export {
  calculateSmartOverrideDuration,
  type SmartOverrideResult
} from './smart-override'

// Smart Input Allocator - Game to input source allocation
export {
  smartInputAllocator,
  type InputSource,
  type GameSchedule,
  type AllocationRequest,
  type AllocationResult
} from './smart-input-allocator'

// Conflict Detector - Scheduling conflict detection
export {
  conflictDetector,
  type SchedulingConflict,
  type ConflictDetectionResult
} from './conflict-detector'

// Tournament Detector - Playoff/tournament detection
export {
  tournamentDetector,
  type DetectedTournament
} from './tournament-detector'

// ESPN Sync Service - Game schedule synchronization
export {
  espnSyncService,
  type SyncConfig,
  type SyncResult
} from './espn-sync-service'

// Auto-Reallocator - Automatic input source reallocation
export { autoReallocator } from './auto-reallocator'

// Auto-Reallocator Worker - Background reallocation worker
export { autoReallocatorWorker } from './auto-reallocator-worker'

// Scheduler Service - Background schedule executor
export { schedulerService } from './scheduler-service'
