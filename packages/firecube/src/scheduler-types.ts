/**
 * Scheduler Types and Interfaces for Fire Cube
 *
 * Defines interfaces for dependency injection to decouple
 * schedulers from database and connection manager implementations.
 */

import { ADBClient } from './adb-client'

/**
 * Fire Cube device data (abstracted from database schema)
 */
export interface FireCubeDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  status: 'online' | 'offline' | 'unknown'
  keepAwakeEnabled: boolean
  keepAwakeStart?: string | null
  keepAwakeEnd?: string | null
}

/**
 * Fire Cube app data (abstracted from database schema)
 */
export interface FireCubeApp {
  id: string
  deviceId: string
  packageName: string
  appName: string
  isSportsApp: boolean
  hasSubscription: boolean
  subscriptionStatus: 'active' | 'expired' | 'trial' | 'unknown'
  lastChecked?: string | null
}

/**
 * Keep-awake log entry
 */
export interface KeepAwakeLog {
  id: string
  deviceId: string
  action: string
  success: boolean
  errorMessage?: string | null
  timestamp: string
}

/**
 * Connection Manager Adapter Interface
 * Allows injection of connection management implementation
 */
export interface ConnectionManagerAdapter {
  getOrCreateConnection(deviceId: string, ipAddress: string, port: number): Promise<ADBClient>
}

/**
 * Repository interface for Fire Cube device operations
 */
export interface FireCubeDeviceRepository {
  findById(deviceId: string): Promise<FireCubeDevice | null>
  findByStatus(status: 'online' | 'offline' | 'unknown'): Promise<FireCubeDevice[]>
  findWithKeepAwakeEnabled(): Promise<FireCubeDevice[]>
  updateKeepAwakeSettings(
    deviceId: string,
    enabled: boolean,
    startTime?: string,
    endTime?: string
  ): Promise<void>
}

/**
 * Repository interface for Fire Cube app operations
 */
export interface FireCubeAppRepository {
  findByDeviceId(deviceId: string): Promise<FireCubeApp[]>
  findSportsAppsByDeviceId(deviceId: string): Promise<FireCubeApp[]>
  findSubscribedAppsByDeviceId(deviceId: string): Promise<FireCubeApp[]>
  updateSubscriptionStatus(
    appId: string,
    hasSubscription: boolean,
    status: 'active' | 'expired' | 'trial' | 'unknown',
    lastChecked: Date
  ): Promise<void>
}

/**
 * Repository interface for keep-awake log operations
 */
export interface KeepAwakeLogRepository {
  create(log: Omit<KeepAwakeLog, 'id'>): Promise<void>
  findByDeviceId(deviceId: string, limit?: number): Promise<KeepAwakeLog[]>
}

/**
 * Combined repository for all Fire Cube operations
 */
export interface FireCubeRepository {
  devices: FireCubeDeviceRepository
  apps: FireCubeAppRepository
  logs: KeepAwakeLogRepository
}

/**
 * Known sports app definition
 */
export interface KnownSportsApp {
  packageName: string
  appName: string
  subscriptionCheckMethod: 'shared_prefs' | 'login_file' | 'api'
  subscriptionIndicators: string[]
}

/**
 * Subscription check result
 */
export interface SubscriptionCheckResult {
  packageName: string
  hasSubscription: boolean
  subscriptionStatus: 'active' | 'expired' | 'trial' | 'unknown'
  lastChecked: Date
  method: 'login_check' | 'api_check' | 'heuristic'
}

/**
 * Keep-awake status for a device
 */
export interface KeepAwakeStatus {
  deviceId: string
  deviceName: string
  enabled: boolean
  schedule: string
  lastAction: KeepAwakeLog | null
  isScheduled: boolean
}

/**
 * Known sports apps database
 */
export const KNOWN_SPORTS_APPS: KnownSportsApp[] = [
  {
    packageName: 'com.espn.score_center',
    appName: 'ESPN',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['espn_plus_subscriber', 'premium_user']
  },
  {
    packageName: 'com.bamnetworks.mobile.android.gameday.atbat',
    appName: 'MLB.TV',
    subscriptionCheckMethod: 'login_file',
    subscriptionIndicators: []
  },
  {
    packageName: 'com.nfhs.network',
    appName: 'NFHS Network',
    subscriptionCheckMethod: 'login_file',
    subscriptionIndicators: []
  },
  {
    packageName: 'com.foxsports.android',
    appName: 'FOX Sports',
    subscriptionCheckMethod: 'shared_prefs',
    subscriptionIndicators: ['logged_in', 'subscriber']
  },
  {
    packageName: 'com.nbaimd.gametime.nba2011',
    appName: 'NBA',
    subscriptionCheckMethod: 'login_file',
    subscriptionIndicators: []
  },
  {
    packageName: 'com.gotv.nflgamecenter.us.lite',
    appName: 'NFL+',
    subscriptionCheckMethod: 'login_file',
    subscriptionIndicators: []
  }
]
