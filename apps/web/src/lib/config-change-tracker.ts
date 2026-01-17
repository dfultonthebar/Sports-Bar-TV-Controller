/**
 * Bridge file for ConfigChangeTracker (SERVER-ONLY)
 * Re-exports from @sports-bar/utils package with app-specific adapters
 *
 * NOTE: This module uses Node.js 'fs' and should only be imported in server-side code
 */

import {
  ConfigChangeTracker,
  createConfigChangeTracker,
  type ConfigChangeEvent,
  type AutoSyncClient,
  type AutoSyncConfig,
  type ConfigEnhancedLogger as EnhancedLoggerInterface
} from '@sports-bar/utils'
import { EnhancedLogger as EnhancedLoggerImpl } from './enhanced-logger'
import { logger } from '@sports-bar/logger'

// Re-export types
export type { ConfigChangeEvent }

/**
 * Adapter to make EnhancedLogger compatible with the utils package interface
 */
class EnhancedLoggerAdapter implements EnhancedLoggerInterface {
  private impl: EnhancedLoggerImpl

  constructor() {
    this.impl = new EnhancedLoggerImpl()
  }

  async log(entry: { level: 'info' | 'warn' | 'error' | 'debug'; category: string; source: string; action: string; message: string; details?: any; success?: boolean }): Promise<void> {
    await this.impl.log({
      level: entry.level,
      category: entry.category as any,
      source: entry.source,
      action: entry.action,
      message: entry.message,
      details: entry.details,
      success: entry.success ?? true
    })
  }
}

/**
 * Auto-sync client adapter for the web app
 * Implements the AutoSyncClient interface by calling local API endpoints
 */
class WebAppAutoSyncClient implements AutoSyncClient {
  async getAutoSyncConfig(): Promise<AutoSyncConfig | null> {
    try {
      const response = await fetch('http://localhost:3001/api/github/auto-config-sync')
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      logger.error('[AutoSyncClient] Error fetching auto-sync config:', error)
      return null
    }
  }

  async pushConfig(params: {
    commitMessage: string
    configChanges: Array<{
      type: ConfigChangeEvent['type']
      description: string
      files: string[]
    }>
    autoCommit: boolean
  }): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch('http://localhost:3001/api/github/push-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      })

      return await response.json()
    } catch (error: any) {
      logger.error('[AutoSyncClient] Error pushing config:', error)
      return { success: false, message: error.message }
    }
  }
}

/**
 * Create and configure the ConfigChangeTracker instance for the web app
 */
const tracker = createConfigChangeTracker({
  logger,
  enhancedLogger: new EnhancedLoggerAdapter(),
  autoSyncClient: new WebAppAutoSyncClient(),
  projectRoot: '/home/ubuntu/Sports-Bar-TV-Controller/apps/web',
  configFiles: [
    'src/data/matrix-config.json',
    'src/data/device-mappings.json',
    'src/data/ir-devices.json',
    'src/data/audio-zones.json',
    'src/data/directv-channels.json',
    '.env.local',
    'config/auto-sync.json'
  ],
  enableFileWatching: true
})

// Auto-initialize when module is imported (server-side only)
if (typeof window === 'undefined') {
  tracker.initializeWatching().catch(console.error)
}

// Export singleton instance
export const configChangeTracker = tracker

// Export class for type compatibility
export default ConfigChangeTracker
