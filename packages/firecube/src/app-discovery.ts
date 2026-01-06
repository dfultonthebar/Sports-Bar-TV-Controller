/**
 * Fire Cube App Discovery and Management
 *
 * Provides functionality for:
 * - Discovering installed apps on Fire TV/Cube devices
 * - Managing app metadata and sports app detection
 * - Launching and stopping apps
 * - Syncing app data with database
 *
 * Uses dependency injection for database and connection management
 */

import { ADBClient } from './adb-client'
import { KNOWN_SPORTS_APPS } from './scheduler-types'
import type {
  ConnectionManagerAdapter,
  FireCubeApp,
  KnownSportsApp
} from './scheduler-types'

/**
 * Installed app information from ADB
 */
export interface InstalledApp {
  packageName: string
  appName: string
  version?: string
  versionCode?: number
  isSystemApp: boolean
  installedAt?: Date
}

/**
 * Logger interface for dependency injection
 */
export interface AppDiscoveryLogger {
  error(message: string, error?: any): void
  info?(message: string): void
  debug?(message: string): void
}

/**
 * Repository interface for app discovery database operations
 */
export interface AppDiscoveryRepository {
  /**
   * Find all apps for a device
   */
  findByDeviceId(deviceId: string): Promise<FireCubeApp[]>

  /**
   * Create a new app record
   */
  create(app: Omit<FireCubeApp, 'id'> & { id: string }): Promise<void>

  /**
   * Update an existing app record
   */
  update(
    deviceId: string,
    packageName: string,
    updates: Partial<FireCubeApp>
  ): Promise<void>

  /**
   * Delete an app record
   */
  delete(appId: string): Promise<void>

  /**
   * Find sports apps across all devices
   */
  findAllSportsApps(): Promise<FireCubeApp[]>
}

/**
 * Device repository interface for app launching
 */
export interface AppDiscoveryDeviceRepository {
  findById(deviceId: string): Promise<{
    id: string
    ipAddress: string
    port: number
  } | null>
}

/**
 * Configuration for AppDiscoveryService
 */
export interface AppDiscoveryConfig {
  connectionManager: ConnectionManagerAdapter
  appRepository: AppDiscoveryRepository
  deviceRepository: AppDiscoveryDeviceRepository
  logger?: AppDiscoveryLogger
  knownSportsApps?: KnownSportsApp[]
}

/**
 * App Discovery Service
 *
 * Manages Fire TV/Cube app discovery and lifecycle operations
 */
export class AppDiscoveryService {
  private connectionManager: ConnectionManagerAdapter
  private appRepository: AppDiscoveryRepository
  private deviceRepository: AppDiscoveryDeviceRepository
  private logger: AppDiscoveryLogger
  private knownSportsApps: KnownSportsApp[]

  constructor(config: AppDiscoveryConfig) {
    this.connectionManager = config.connectionManager
    this.appRepository = config.appRepository
    this.deviceRepository = config.deviceRepository
    this.logger = config.logger || this.createDefaultLogger()
    this.knownSportsApps = config.knownSportsApps || KNOWN_SPORTS_APPS
  }

  /**
   * Create a default console logger
   */
  private createDefaultLogger(): AppDiscoveryLogger {
    return {
      error: (msg, err) => console.error(msg, err),
      info: (msg) => console.log(msg),
      debug: (msg) => console.log(msg)
    }
  }

  /**
   * Discover all installed apps on a Fire Cube
   */
  async discoverApps(
    deviceId: string,
    ipAddress: string,
    port: number = 5555
  ): Promise<FireCubeApp[]> {
    const apps: FireCubeApp[] = []

    try {
      // Use connection manager for persistent connections
      const client = await this.connectionManager.getOrCreateConnection(
        deviceId,
        ipAddress,
        port
      )

      // Get all installed packages
      const packages = await client.getInstalledPackages()

      // Process each package
      for (const packageName of packages) {
        try {
          const appInfo = await this.getAppDetails(client, packageName)

          if (appInfo) {
            const knownApp = this.knownSportsApps.find(
              (app) => app.packageName === packageName
            )

            const app: FireCubeApp = {
              id: '', // Will be set by database
              deviceId,
              packageName,
              appName: appInfo.appName,
              isSportsApp: !!knownApp,
              hasSubscription: false, // Will be checked separately
              subscriptionStatus: 'unknown',
              lastChecked: new Date().toISOString()
            }

            // Add additional fields if available
            const appWithExtras = app as any
            appWithExtras.version = appInfo.version || null
            appWithExtras.versionCode = appInfo.versionCode || null
            appWithExtras.category = knownApp?.category || 'Other'
            appWithExtras.iconUrl = (knownApp as any)?.iconUrl || null
            appWithExtras.isSystemApp = appInfo.isSystemApp
            appWithExtras.installedAt = appInfo.installedAt?.toISOString() || new Date().toISOString()
            appWithExtras.updatedAt = new Date().toISOString()

            apps.push(app)
          }
        } catch (error) {
          this.logger.error(`Failed to get details for ${packageName}:`, error)
        }
      }

      return apps
    } catch (error) {
      this.logger.error('App discovery failed:', error)
      return []
    }
  }

  /**
   * Get detailed information about an app
   */
  private async getAppDetails(
    client: ADBClient,
    packageName: string
  ): Promise<InstalledApp | null> {
    try {
      const clientAny = client as any
      const packageInfo = await clientAny.getPackageInfo?.(packageName)
      const appLabel = await clientAny.getAppLabel?.(packageName)
      const isSystemApp = await clientAny.isSystemApp?.(packageName)

      return {
        packageName,
        appName: appLabel || packageName,
        version: packageInfo?.versionName,
        versionCode: packageInfo?.versionCode,
        isSystemApp: isSystemApp || false
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Sync apps for a device to database
   */
  async syncAppsToDatabase(deviceId: string, apps: FireCubeApp[]): Promise<void> {
    try {
      // Get existing apps
      const existingApps = await this.appRepository.findByDeviceId(deviceId)

      const existingPackages = new Set(existingApps.map((app) => app.packageName))

      // Add new apps
      for (const app of apps) {
        if (!existingPackages.has(app.packageName)) {
          const appWithId = {
            ...app,
            id: this.generateId()
          }
          await this.appRepository.create(appWithId)
        } else {
          // Update existing app
          await this.appRepository.update(deviceId, app.packageName, {
            appName: app.appName,
            lastChecked: new Date().toISOString(),
            ...(app as any).version && { version: (app as any).version },
            ...(app as any).versionCode && { versionCode: (app as any).versionCode }
          })
        }
      }

      // Remove apps that are no longer installed
      const currentPackages = new Set(apps.map((app) => app.packageName))
      for (const existingApp of existingApps) {
        if (!currentPackages.has(existingApp.packageName)) {
          await this.appRepository.delete(existingApp.id)
        }
      }
    } catch (error) {
      this.logger.error('Failed to sync apps to database:', error)
      throw error
    }
  }

  /**
   * Get apps for a device from database
   */
  async getDeviceApps(deviceId: string): Promise<FireCubeApp[]> {
    try {
      const apps = await this.appRepository.findByDeviceId(deviceId)
      return apps
    } catch (error) {
      this.logger.error('Failed to get device apps:', error)
      return []
    }
  }

  /**
   * Get sports apps across all devices
   */
  async getAllSportsApps(): Promise<FireCubeApp[]> {
    try {
      const apps = await this.appRepository.findAllSportsApps()
      return apps
    } catch (error) {
      this.logger.error('Failed to get sports apps:', error)
      return []
    }
  }

  /**
   * Launch app on device
   */
  async launchApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await this.deviceRepository.findById(deviceId)

      if (!device) {
        throw new Error('Device not found')
      }

      // Use connection manager for persistent connections
      const client = await this.connectionManager.getOrCreateConnection(
        device.id,
        device.ipAddress,
        device.port
      )
      const result = await client.launchApp(packageName)

      return !!result
    } catch (error) {
      this.logger.error(`Failed to launch app ${packageName}:`, error)
      return false
    }
  }

  /**
   * Stop app on device
   */
  async stopApp(deviceId: string, packageName: string): Promise<boolean> {
    try {
      const device = await this.deviceRepository.findById(deviceId)

      if (!device) {
        throw new Error('Device not found')
      }

      // Use connection manager for persistent connections
      const client = await this.connectionManager.getOrCreateConnection(
        device.id,
        device.ipAddress,
        device.port
      )
      const result = await client.stopApp(packageName)

      return !!result
    } catch (error) {
      this.logger.error(`Failed to stop app ${packageName}:`, error)
      return false
    }
  }

  /**
   * Get app icon URL (from known sports apps database)
   */
  async getAppIcon(packageName: string): Promise<string | null> {
    const knownApp = this.knownSportsApps.find(
      (app) => app.packageName === packageName
    )
    return (knownApp as any)?.iconUrl || null
  }

  /**
   * Generate a unique ID (can be overridden by injecting crypto.randomUUID)
   */
  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }
}

/**
 * Factory function to create AppDiscoveryService
 */
export function createAppDiscoveryService(
  config: AppDiscoveryConfig
): AppDiscoveryService {
  return new AppDiscoveryService(config)
}
