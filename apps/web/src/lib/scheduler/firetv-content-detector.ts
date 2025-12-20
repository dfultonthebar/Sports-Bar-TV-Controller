/**
 * Fire TV Content Detector - Bridge File
 *
 * Re-exports from @sports-bar/scheduler package.
 * This maintains backwards compatibility with existing imports.
 */

export {
  FireTVContentDetector,
  getFireTVContentDetector,
  resetFireTVContentDetector,
  STREAMING_PLATFORMS,
  type StreamingPlatform,
  type StreamingGame
} from '@sports-bar/scheduler'
