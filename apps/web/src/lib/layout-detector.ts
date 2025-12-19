/**
 * TV Layout Auto-Detection System
 *
 * Bridge file that re-exports from @sports-bar/layout-detection package
 */

export type {
  DetectedZone,
  LayoutDetectionResult
} from '@sports-bar/layout-detection'

export {
  detectTVZonesFromImage,
  autoMatchZonesToOutputs
} from '@sports-bar/layout-detection'
