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
  type AutoSyncConfig
} from '@sports-bar/utils'
import { EnhancedLogger } from './enhanced-logger'
import { logger } from '@/lib/logger'

// Re-export types
export type { ConfigChangeEvent }

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
  enhancedLogger: new EnhancedLogger(),
  autoSyncClient: new WebAppAutoSyncClient(),
  projectRoot: '/home/ubuntu/Sports-Bar-TV-Controller',
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
