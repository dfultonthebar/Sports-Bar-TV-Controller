/**
 * Subscription Detection Service for Fire Cube Apps
 *
 * Detects subscription status for streaming apps on Fire TV devices.
 * Uses dependency injection for database and connection management.
 */

import { ADBClient } from './adb-client'
import {
  ConnectionManagerAdapter,
  FireCubeRepository,
  SubscriptionCheckResult,
  KNOWN_SPORTS_APPS
} from './scheduler-types'
import { logger } from '@sports-bar/logger'

export interface SubscriptionDetectorConfig {
  repository: FireCubeRepository
  connectionManager: ConnectionManagerAdapter
}

export class SubscriptionDetector {
  private repository: FireCubeRepository
  private connectionManager: ConnectionManagerAdapter

  constructor(config: SubscriptionDetectorConfig) {
    this.repository = config.repository
    this.connectionManager = config.connectionManager
  }

  /**
   * Check subscription status for an app
   */
  async checkSubscription(
    deviceId: string,
    packageName: string
  ): Promise<SubscriptionCheckResult> {
    const device = await this.repository.devices.findById(deviceId)

    if (!device) {
      throw new Error('Device not found')
    }

    const knownApp = KNOWN_SPORTS_APPS.find(
      app => app.packageName === packageName
    )

    if (!knownApp) {
      return {
        packageName,
        hasSubscription: false,
        subscriptionStatus: 'unknown',
        lastChecked: new Date(),
        method: 'heuristic'
      }
    }

    let client: ADBClient
    try {
      client = await this.connectionManager.getOrCreateConnection(
        deviceId,
        device.ipAddress,
        device.port
      )

      let hasSubscription = false
      let subscriptionStatus: 'active' | 'expired' | 'trial' | 'unknown' = 'unknown'
      let method: 'login_check' | 'api_check' | 'heuristic' = 'heuristic'

      switch (knownApp.subscriptionCheckMethod) {
        case 'shared_prefs':
          const prefsResult = await this.checkSharedPreferences(
            client,
            packageName,
            knownApp.subscriptionIndicators
          )
          hasSubscription = prefsResult.hasSubscription
          subscriptionStatus = prefsResult.status
          method = 'login_check'
          break

        case 'login_file':
          const loginResult = await this.checkLoginFiles(client, packageName)
          hasSubscription = loginResult.hasSubscription
          subscriptionStatus = loginResult.status
          method = 'login_check'
          break

        case 'api':
          const heuristicResult = await this.heuristicCheck(client, packageName)
          hasSubscription = heuristicResult.hasSubscription
          subscriptionStatus = heuristicResult.status
          method = 'heuristic'
          break

        default:
          const defaultResult = await this.heuristicCheck(client, packageName)
          hasSubscription = defaultResult.hasSubscription
          subscriptionStatus = defaultResult.status
          method = 'heuristic'
      }

      return {
        packageName,
        hasSubscription,
        subscriptionStatus,
        lastChecked: new Date(),
        method
      }
    } catch (error) {
      logger.error(`[SUBSCRIPTION] Check failed for ${packageName}:`, { error })
      return {
        packageName,
        hasSubscription: false,
        subscriptionStatus: 'unknown',
        lastChecked: new Date(),
        method: 'heuristic'
      }
    }
  }

  /**
   * Check shared preferences for subscription indicators
   */
  private async checkSharedPreferences(
    client: ADBClient,
    packageName: string,
    indicators: string[]
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      const clientAny = client as any
      const prefs = await clientAny.checkSharedPreferences?.(packageName, indicators) || {}

      const hasIndicators = Object.keys(prefs).length > 0

      if (!hasIndicators) {
        return { hasSubscription: false, status: 'unknown' }
      }

      const prefsString = JSON.stringify(prefs).toLowerCase()

      if (prefsString.includes('active') || prefsString.includes('true') || prefsString.includes('premium')) {
        return { hasSubscription: true, status: 'active' }
      } else if (prefsString.includes('expired') || prefsString.includes('false')) {
        return { hasSubscription: false, status: 'expired' }
      } else if (prefsString.includes('trial')) {
        return { hasSubscription: true, status: 'trial' }
      }

      return { hasSubscription: true, status: 'active' }
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' }
    }
  }

  /**
   * Check login files for authentication status
   */
  private async checkLoginFiles(
    client: ADBClient,
    packageName: string
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      const authFiles = [
        `/data/data/${packageName}/files/auth.json`,
        `/data/data/${packageName}/files/user.json`,
        `/data/data/${packageName}/files/session.json`,
        `/data/data/${packageName}/shared_prefs/auth.xml`,
        `/data/data/${packageName}/shared_prefs/user.xml`
      ]

      for (const file of authFiles) {
        try {
          const clientAny = client as any
          const exists = await clientAny.shell?.(`test -f ${file} && echo "exists" || echo "not found"`)
          if (exists?.includes('exists')) {
            return { hasSubscription: true, status: 'active' }
          }
        } catch (error) {
          // Continue checking other files
        }
      }

      return { hasSubscription: false, status: 'unknown' }
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' }
    }
  }

  /**
   * Heuristic check based on app usage patterns
   */
  private async heuristicCheck(
    client: ADBClient,
    packageName: string
  ): Promise<{ hasSubscription: boolean; status: 'active' | 'expired' | 'trial' | 'unknown' }> {
    try {
      const clientAny = client as any
      const packageInfo = await clientAny.getPackageInfo?.(packageName)

      if (packageInfo?.lastUpdateTime) {
        const lastUpdate = new Date(packageInfo.lastUpdateTime)
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)

        if (daysSinceUpdate < 30) {
          return { hasSubscription: true, status: 'active' }
        }
      }

      const dataSize = await clientAny.shell?.(`du -s /data/data/${packageName} 2>/dev/null | cut -f1`)
      const sizeKB = parseInt(dataSize?.trim() || '0')

      if (sizeKB > 10000) {
        return { hasSubscription: true, status: 'active' }
      }

      return { hasSubscription: false, status: 'unknown' }
    } catch (error) {
      return { hasSubscription: false, status: 'unknown' }
    }
  }

  /**
   * Check subscriptions for all sports apps on a device
   */
  async checkAllSubscriptions(deviceId: string): Promise<void> {
    try {
      const apps = await this.repository.apps.findSportsAppsByDeviceId(deviceId)

      for (const app of apps) {
        try {
          const result = await this.checkSubscription(deviceId, app.packageName)

          await this.repository.apps.updateSubscriptionStatus(
            app.id,
            result.hasSubscription,
            result.subscriptionStatus,
            result.lastChecked
          )
        } catch (error) {
          logger.error(`[SUBSCRIPTION] Failed to check ${app.packageName}:`, { error })
        }
      }
    } catch (error) {
      logger.error('[SUBSCRIPTION] Failed to check all subscriptions:', { error })
      throw error
    }
  }

  /**
   * Get subscribed apps for a device
   */
  async getSubscribedApps(deviceId: string): Promise<any[]> {
    try {
      return await this.repository.apps.findSubscribedAppsByDeviceId(deviceId)
    } catch (error) {
      logger.error('[SUBSCRIPTION] Failed to get subscribed apps:', { error })
      return []
    }
  }

  /**
   * Get subscription summary across all devices
   */
  async getSubscriptionSummary(): Promise<{
    totalDevices: number
    subscriptions: Record<string, {
      appName: string
      packageName: string
      deviceCount: number
      devices: Array<{ deviceId: string; deviceName: string; status: string }>
    }>
  }> {
    try {
      const devices = await this.repository.devices.findByStatus('online')

      const summary: {
        totalDevices: number
        subscriptions: Record<string, {
          appName: string
          packageName: string
          deviceCount: number
          devices: Array<{ deviceId: string; deviceName: string; status: string }>
        }>
      } = {
        totalDevices: devices.length,
        subscriptions: {}
      }

      for (const device of devices) {
        const subscribedApps = await this.getSubscribedApps(device.id)

        for (const app of subscribedApps) {
          if (!summary.subscriptions[app.packageName]) {
            summary.subscriptions[app.packageName] = {
              appName: app.appName,
              packageName: app.packageName,
              deviceCount: 0,
              devices: []
            }
          }

          summary.subscriptions[app.packageName].deviceCount++
          summary.subscriptions[app.packageName].devices.push({
            deviceId: device.id,
            deviceName: device.name,
            status: app.subscriptionStatus
          })
        }
      }

      return summary
    } catch (error) {
      logger.error('[SUBSCRIPTION] Failed to get summary:', { error })
      return { totalDevices: 0, subscriptions: {} }
    }
  }
}

// Factory function for creating detector with injected dependencies
export function createSubscriptionDetector(config: SubscriptionDetectorConfig): SubscriptionDetector {
  return new SubscriptionDetector(config)
}
