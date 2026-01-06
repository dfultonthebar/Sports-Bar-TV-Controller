/**
 * Fire Cube Scheduler Bridge
 *
 * Provides repository implementations that connect the @sports-bar/firecube
 * scheduler package to the web application's database and connection manager.
 */

import { connectionManager } from '@/services/firetv-connection-manager'
import { and, asc, desc, eq, findMany, findUnique, create, update } from '@/lib/db-helpers'
import { db } from '@/db'
import { fireCubeDevices, fireCubeApps, fireCubeKeepAwakeLogs } from '@/db/schema'
import {
  createKeepAwakeScheduler,
  createSubscriptionDetector,
  KeepAwakeScheduler,
  SubscriptionDetector,
  ConnectionManagerAdapter,
  FireCubeRepository,
  FireCubeDevice,
  FireCubeApp,
  KeepAwakeLog
} from '@sports-bar/firecube'

/**
 * Connection Manager Adapter Implementation
 * Wraps the web app's firetv-connection-manager
 */
class ConnectionManagerAdapterImpl implements ConnectionManagerAdapter {
  async getOrCreateConnection(deviceId: string, ipAddress: string, port: number) {
    return connectionManager.getOrCreateConnection(deviceId, ipAddress, port)
  }
}

/**
 * Fire Cube Repository Implementation
 * Provides database operations for the scheduler package
 */
const fireCubeRepository: FireCubeRepository = {
  devices: {
    async findById(deviceId: string): Promise<FireCubeDevice | null> {
      const device = await findUnique('fireCubeDevices', {
        where: eq(fireCubeDevices.id, deviceId)
      })
      return device ? mapDevice(device) : null
    },

    async findByStatus(status: 'online' | 'offline' | 'unknown'): Promise<FireCubeDevice[]> {
      const devices = await findMany('fireCubeDevices', {
        where: eq(fireCubeDevices.status, status)
      })
      return devices.map(mapDevice)
    },

    async findWithKeepAwakeEnabled(): Promise<FireCubeDevice[]> {
      const devices = await findMany('fireCubeDevices', {
        where: eq(fireCubeDevices.keepAwakeEnabled, true)
      })
      return devices.map(mapDevice)
    },

    async updateKeepAwakeSettings(
      deviceId: string,
      enabled: boolean,
      startTime?: string,
      endTime?: string
    ): Promise<void> {
      const updateData: any = { keepAwakeEnabled: enabled }
      if (startTime) updateData.keepAwakeStart = startTime
      if (endTime) updateData.keepAwakeEnd = endTime

      await update('fireCubeDevices',
        eq(fireCubeDevices.id, deviceId),
        updateData
      )
    }
  },

  apps: {
    async findByDeviceId(deviceId: string): Promise<FireCubeApp[]> {
      const apps = await findMany('fireCubeApps', {
        where: eq(fireCubeApps.deviceId, deviceId)
      })
      return apps.map(mapApp)
    },

    async findSportsAppsByDeviceId(deviceId: string): Promise<FireCubeApp[]> {
      const apps = await findMany('fireCubeApps', {
        where: and(
          eq(fireCubeApps.deviceId, deviceId),
          eq(fireCubeApps.isSportsApp, true)
        )
      })
      return apps.map(mapApp)
    },

    async findSubscribedAppsByDeviceId(deviceId: string): Promise<FireCubeApp[]> {
      const apps = await findMany('fireCubeApps', {
        where: and(
          eq(fireCubeApps.deviceId, deviceId),
          eq(fireCubeApps.hasSubscription, true)
        ),
        orderBy: [asc(fireCubeApps.appName)]
      })
      return apps.map(mapApp)
    },

    async updateSubscriptionStatus(
      appId: string,
      hasSubscription: boolean,
      status: 'active' | 'expired' | 'trial' | 'unknown',
      lastChecked: Date
    ): Promise<void> {
      await update('fireCubeApps',
        eq(fireCubeApps.id, appId),
        {
          hasSubscription,
          subscriptionStatus: status,
          lastChecked: lastChecked.toISOString(),
          updatedAt: new Date().toISOString()
        }
      )
    }
  },

  logs: {
    async create(log: Omit<KeepAwakeLog, 'id'>): Promise<void> {
      await create('fireCubeKeepAwakeLogs', {
        id: crypto.randomUUID(),
        ...log
      })
    },

    async findByDeviceId(deviceId: string, limit: number = 100): Promise<KeepAwakeLog[]> {
      const logs = await findMany('fireCubeKeepAwakeLogs', {
        where: eq(fireCubeKeepAwakeLogs.deviceId, deviceId),
        orderBy: [desc(fireCubeKeepAwakeLogs.timestamp)],
        limit
      })
      return logs.map(mapLog)
    }
  }
}

/**
 * Map database device to interface type
 */
function mapDevice(device: any): FireCubeDevice {
  return {
    id: device.id,
    name: device.name,
    ipAddress: device.ipAddress,
    port: device.port,
    status: device.status,
    keepAwakeEnabled: device.keepAwakeEnabled,
    keepAwakeStart: device.keepAwakeStart,
    keepAwakeEnd: device.keepAwakeEnd
  }
}

/**
 * Map database app to interface type
 */
function mapApp(app: any): FireCubeApp {
  return {
    id: app.id,
    deviceId: app.deviceId,
    packageName: app.packageName,
    appName: app.appName,
    isSportsApp: app.isSportsApp,
    hasSubscription: app.hasSubscription,
    subscriptionStatus: app.subscriptionStatus || 'unknown',
    lastChecked: app.lastChecked
  }
}

/**
 * Map database log to interface type
 */
function mapLog(log: any): KeepAwakeLog {
  return {
    id: log.id,
    deviceId: log.deviceId,
    action: log.action,
    success: log.success,
    errorMessage: log.errorMessage,
    timestamp: log.timestamp
  }
}

// Create singleton instances with injected dependencies
const connectionManagerAdapter = new ConnectionManagerAdapterImpl()

let _keepAwakeScheduler: KeepAwakeScheduler | null = null
let _subscriptionDetector: SubscriptionDetector | null = null

/**
 * Get the keep-awake scheduler singleton
 */
export function getKeepAwakeScheduler(): KeepAwakeScheduler {
  if (!_keepAwakeScheduler) {
    _keepAwakeScheduler = createKeepAwakeScheduler({
      repository: fireCubeRepository,
      connectionManager: connectionManagerAdapter
    })
  }
  return _keepAwakeScheduler
}

/**
 * Get the subscription detector singleton
 */
export function getSubscriptionDetector(): SubscriptionDetector {
  if (!_subscriptionDetector) {
    _subscriptionDetector = createSubscriptionDetector({
      repository: fireCubeRepository,
      connectionManager: connectionManagerAdapter
    })
  }
  return _subscriptionDetector
}

/**
 * Reset schedulers (for testing)
 */
export function resetSchedulers(): void {
  if (_keepAwakeScheduler) {
    _keepAwakeScheduler.stopAll()
    _keepAwakeScheduler = null
  }
  _subscriptionDetector = null
}

// Re-export types for convenience
export type {
  KeepAwakeScheduler,
  SubscriptionDetector,
  FireCubeDevice,
  FireCubeApp,
  KeepAwakeLog,
  KeepAwakeStatus,
  SubscriptionCheckResult
} from '@sports-bar/firecube'
