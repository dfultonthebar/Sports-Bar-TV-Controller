/**
 * @sports-bar/wolfpack - Wolfpack Matrix AI Analysis
 *
 * AI-powered monitoring and optimization for Wolfpack matrix switchers:
 * - Pattern matching for connection, routing, configuration issues
 * - Performance analysis and recommendations
 * - Layout and audio routing optimization
 */

// AI Analyzer
export {
  WolfpackMatrixAIAnalyzer,
  type WolfpackMatrixData,
  type WolfpackAIInsight
} from './wolfpack-ai-analyzer'

// Training Data & Pattern Matching
export {
  wolfpackTrainingData,
  WolfpackPatternMatcher,
  type WolfpackTrainingPattern
} from './wolfpack-ai-training-data'

// Matrix Control
export { routeMatrix } from './matrix-control'

// Wolfpack Matrix Service - Atlas Audio Integration
export {
  routeWolfpackToMatrix,
  sendHTTPCommand,
  getMatrixRoutingState,
  type MatrixConfiguration,
  type RoutingResult,
} from './wolfpack-matrix-service'

// Chassis Configuration Types
export type {
  WolfpackChassisConfig,
  WolfpackChassisInput,
  WolfpackChassisOutput,
  WolfpackChassisCredentials,
  WolfpackDevicesFile,
} from './chassis-config'

// Model Profiles
export {
  WOLFPACK_MODELS,
  getWolfpackModel,
  type WolfpackModelProfile,
} from './models'

// Learning System
export { runLearningCycle } from './wolfpack-pattern-learner'
export { WolfpackLearningCollector } from './wolfpack-learning-collector'
