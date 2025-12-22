/**
 * Subscription Detector Bridge
 *
 * Re-exports from scheduler-bridge for backward compatibility.
 * The actual implementation is in @sports-bar/firecube package.
 */

export {
  getSubscriptionDetector,
  type SubscriptionDetector,
  type SubscriptionCheckResult,
  type FireCubeApp
} from './scheduler-bridge'
