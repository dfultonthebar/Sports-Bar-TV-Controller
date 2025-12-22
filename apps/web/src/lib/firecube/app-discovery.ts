/**
 * Fire Cube App Discovery Bridge
 *
 * Re-exports from @sports-bar/firecube package with database and connection manager adapters
 */

import { connectionManager } from '@/services/firetv-connection-manager'
import { db } from '@/db'
import { fireCubeDevices, fireCubeApps } from '@/db/schema'
import { and, asc, create, deleteRecord, desc, eq, findMany, findUnique, updateMany } from '@/lib/db-helpers'
import { logger } from '@/lib/logger'
import {
  AppDiscoveryService,
  createAppDiscoveryService,
  type AppDiscoveryRepository,
  type AppDiscoveryDeviceRepository,
  type ConnectionManagerAdapter,
  type FireCubeApp,
  type AppDiscoveryLogger
} from '@sports-bar/firecube'

/**
 * Database adapter for app discovery repository
 */
class DatabaseAppRepository implements AppDiscoveryRepository {
  async findByDeviceId(deviceId: string): Promise<FireCubeApp[]> {
    const apps = await findMany('fireCubeApps', {
      where: eq(fireCubeApps.deviceId, deviceId),
      orderBy: [desc(fireCubeApps.isSportsApp), asc(fireCubeApps.appName)]
    })
    return apps as FireCubeApp[]
  }

  async create(app: Omit<FireCubeApp, 'id'> & { id: string }): Promise<void> {
    const appData = app as any
    await create('fireCubeApps', {
      id: app.id,
      deviceId: app.deviceId,
      packageName: app.packageName,
      appName: app.appName,
      version: appData.version || null,
      versionCode: appData.versionCode || null,
      category: appData.category || null,
      iconUrl: appData.iconUrl || null,
      isSystemApp: appData.isSystemApp || false,
      isSportsApp: app.isSportsApp,
      hasSubscription: app.hasSubscription,
      subscriptionStatus: app.subscriptionStatus || null,
      lastChecked: app.lastChecked || null,
      installedAt: appData.installedAt || null,
      updatedAt: appData.updatedAt || new Date().toISOString()
    })
  }

  async update(
    deviceId: string,
    packageName: string,
    updates: Partial<FireCubeApp>
  ): Promise<void> {
    const updateData: any = {
      updatedAt: new Date().toISOString()
    }

    if (updates.appName !== undefined) updateData.appName = updates.appName
    if (updates.lastChecked !== undefined) updateData.lastChecked = updates.lastChecked
    if ((updates as any).version !== undefined) updateData.version = (updates as any).version
    if ((updates as any).versionCode !== undefined) updateData.versionCode = (updates as any).versionCode

    await updateMany(
      'fireCubeApps',
      and(
        eq(fireCubeApps.deviceId, deviceId),
        eq(fireCubeApps.packageName, packageName)
      ),
      updateData
    )
  }

  async delete(appId: string): Promise<void> {
    await deleteRecord('fireCubeApps', {
      where: eq(fireCubeApps.id, appId)
    })
  }

  async findAllSportsApps(): Promise<FireCubeApp[]> {
    const apps = await findMany('fireCubeApps', {
      where: eq(fireCubeApps.isSportsApp, true),
      orderBy: [desc(fireCubeApps.hasSubscription), asc(fireCubeApps.appName)]
    })
    return apps as FireCubeApp[]
  }
}

/**
 * Database adapter for device repository
 */
class DatabaseDeviceRepository implements AppDiscoveryDeviceRepository {
  async findById(deviceId: string): Promise<{
    id: string
    ipAddress: string
    port: number
  } | null> {
    const device = await findUnique('fireCubeDevices', {
      where: eq(fireCubeDevices.id, deviceId)
    })

    if (!device) return null

    return {
      id: device.id,
      ipAddress: device.ipAddress,
      port: device.port
    }
  }
}

/**
 * Logger adapter
 */
const loggerAdapter: AppDiscoveryLogger = {
  error: (message: string, error?: any) => logger.error(message, error),
  info: (message: string) => logger.info(message),
  debug: (message: string) => logger.debug?.(message)
}

/**
 * Connection manager adapter
 */
const connectionManagerAdapter: ConnectionManagerAdapter = {
  getOrCreateConnection: (deviceId: string, ipAddress: string, port: number) =>
    connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
}

/**
 * Singleton instance with database adapters
 */
const appDiscoveryService = createAppDiscoveryService({
  connectionManager: connectionManagerAdapter,
  appRepository: new DatabaseAppRepository(),
  deviceRepository: new DatabaseDeviceRepository(),
  logger: loggerAdapter
})

// Re-export the configured service as a class for backward compatibility
export { AppDiscoveryService } from '@sports-bar/firecube'

// Export singleton instance as default
export default appDiscoveryService

// Also export as named export for direct usage
export { appDiscoveryService }

// Re-export types
export type {
  InstalledApp,
  AppDiscoveryConfig,
  AppDiscoveryRepository,
  AppDiscoveryDeviceRepository,
  AppDiscoveryLogger
} from '@sports-bar/firecube'

export type { FireCubeApp } from '@sports-bar/firecube'
