/**
 * Real Device Subscription Detection Bridge
 *
 * Thin bridge file that re-exports subscription polling from packages.
 * All core logic lives in @sports-bar/directv and @sports-bar/firecube packages.
 */

// Re-export DirecTV subscription polling
export {
  pollRealDirecTVSubscriptions,
  determinePackageType,
  type Subscription,
  type DirecTVDeviceInfo
} from '@sports-bar/directv'

// Re-export FireTV subscription polling
export {
  pollRealFireTVSubscriptions,
  type FireTVDeviceInfo
} from '@sports-bar/firecube'

// Note: The Subscription type is identical between both packages,
// so we export it once from @sports-bar/directv
