/**
 * Configuration Change Tracking System
 *
 * Monitors configuration files for changes, calculates checksums,
 * and provides hooks for auto-sync functionality.
 *
 * This is a framework-agnostic implementation using dependency injection.
 */

import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import * as path from 'path'

export interface ConfigChangeEvent {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  file: string
  action: 'created' | 'modified' | 'deleted'
  timestamp: string
  checksum?: string
  previousChecksum?: string
  changes?: any
}

export interface ConfigLogger {
  info(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  debug?(message: string, ...args: any[]): void
}

export interface EnhancedLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug'
  category: string
  source: string
  action: string
  message: string
  details?: any
  success?: boolean
}

export interface EnhancedLogger {
  log(entry: EnhancedLogEntry): Promise<void>
}

export interface AutoSyncConfig {
  enabled: boolean
  autoCommitOnConfigChange: boolean
}

export interface AutoSyncClient {
  getAutoSyncConfig(): Promise<AutoSyncConfig | null>
  pushConfig(params: {
    commitMessage: string
    configChanges: Array<{
      type: ConfigChangeEvent['type']
      description: string
      files: string[]
    }>
    autoCommit: boolean
  }): Promise<{ success: boolean; message?: string }>
}

export interface ConfigChangeTrackerOptions {
  logger: ConfigLogger
  enhancedLogger?: EnhancedLogger
  autoSyncClient?: AutoSyncClient
  projectRoot?: string
  configFiles?: string[]
  enableFileWatching?: boolean
}

export class ConfigChangeTracker {
  private logger: ConfigLogger
  private enhancedLogger?: EnhancedLogger
  private autoSyncClient?: AutoSyncClient
  private checksums: Map<string, string> = new Map()
  private watchers: Map<string, any> = new Map()
  private projectRoot: string
  private configFiles: string[]
  private enableFileWatching: boolean

  constructor(options: ConfigChangeTrackerOptions) {
    this.logger = options.logger
    this.enhancedLogger = options.enhancedLogger
    this.autoSyncClient = options.autoSyncClient
    this.projectRoot = options.projectRoot || process.cwd()
    this.enableFileWatching = options.enableFileWatching ?? true
    this.configFiles = options.configFiles || [
      'src/data/matrix-config.json',
      'src/data/device-mappings.json',
      'src/data/ir-devices.json',
      'src/data/audio-zones.json',
      'src/data/directv-channels.json',
      '.env.local',
      'config/auto-sync.json'
    ]
  }

  /**
   * Initialize file watching for configuration files
   */
  async initializeWatching(): Promise<void> {
    if (!this.enableFileWatching) {
      this.logger.info('[ConfigTracker] File watching is disabled')
      return
    }

    for (const configFile of this.configFiles) {
      const fullPath = path.join(this.projectRoot, configFile)

      try {
        // Calculate initial checksum
        const content = await fs.readFile(fullPath, 'utf-8')
        const checksum = this.calculateChecksum(content)
        this.checksums.set(configFile, checksum)

        // Start watching the file
        this.watchFile(fullPath, configFile)
      } catch (error) {
        // File doesn't exist yet, that's okay
        this.logger.info(`[ConfigTracker] Config file doesn't exist yet: ${configFile}`)
      }
    }
  }

  /**
   * Watch a single file for changes
   */
  private watchFile(fullPath: string, configFile: string): void {
    try {
      const fs = require('fs')

      const watcher = fs.watch(fullPath, async (eventType: string) => {
        if (eventType === 'change') {
          await this.handleFileChange(fullPath, configFile)
        }
      })

      this.watchers.set(configFile, watcher)
    } catch (error) {
      this.logger.error(`[ConfigTracker] Error watching file ${configFile}:`, error)
    }
  }

  /**
   * Handle file change events
   */
  private async handleFileChange(fullPath: string, configFile: string): Promise<void> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8')
      const newChecksum = this.calculateChecksum(content)
      const previousChecksum = this.checksums.get(configFile)

      if (previousChecksum !== newChecksum) {
        const changeEvent: ConfigChangeEvent = {
          type: this.getConfigType(configFile),
          file: configFile,
          action: previousChecksum ? 'modified' : 'created',
          timestamp: new Date().toISOString(),
          checksum: newChecksum,
          previousChecksum
        }

        // Log the configuration change
        if (this.enhancedLogger) {
          await this.enhancedLogger.log({
            level: 'info',
            category: 'configuration',
            source: 'config-tracker',
            action: 'config_file_changed',
            message: `Configuration file changed: ${configFile}`,
            details: changeEvent,
            success: true
          })
        } else {
          this.logger.info(`[ConfigTracker] Configuration file changed: ${configFile}`)
        }

        // Update stored checksum
        this.checksums.set(configFile, newChecksum)

        // Check if auto-sync is enabled and trigger sync if needed
        await this.checkAutoSync(changeEvent)
      }
    } catch (error) {
      this.logger.error(`[ConfigTracker] Error handling file change for ${configFile}:`, error)
    }
  }

  /**
   * Check if auto-sync is enabled and trigger if needed
   */
  private async checkAutoSync(changeEvent: ConfigChangeEvent): Promise<void> {
    if (!this.autoSyncClient) {
      return
    }

    try {
      const autoSyncConfig = await this.autoSyncClient.getAutoSyncConfig()

      if (autoSyncConfig?.enabled && autoSyncConfig.autoCommitOnConfigChange) {
        // Trigger auto-push
        const result = await this.autoSyncClient.pushConfig({
          commitMessage: `Auto-sync: ${changeEvent.type} configuration changed`,
          configChanges: [{
            type: changeEvent.type,
            description: `Auto-detected change in ${changeEvent.file}`,
            files: [changeEvent.file]
          }],
          autoCommit: true
        })

        if (this.enhancedLogger) {
          await this.enhancedLogger.log({
            level: result.success ? 'info' : 'warn',
            category: 'configuration',
            source: 'auto-sync',
            action: 'auto_push_config',
            message: result.success ? 'Auto-pushed configuration changes' : 'Auto-push failed',
            details: { changeEvent, result },
            success: result.success
          })
        } else {
          const logMethod = result.success ? 'info' : 'warn'
          this.logger[logMethod](`[ConfigTracker] Auto-push ${result.success ? 'succeeded' : 'failed'}`)
        }
      }
    } catch (error) {
      this.logger.error('[ConfigTracker] Error in auto-sync check:', error)
    }
  }

  /**
   * Determine configuration type from filename
   */
  private getConfigType(file: string): ConfigChangeEvent['type'] {
    if (file.includes('matrix')) return 'matrix'
    if (file.includes('audio')) return 'audio'
    if (file.includes('ir-device')) return 'ir'
    if (file.includes('directv')) return 'directv'
    if (file.includes('tv')) return 'tv'
    return 'general'
  }

  /**
   * Calculate MD5 checksum of content
   */
  private calculateChecksum(content: string): string {
    return createHash('md5').update(content).digest('hex')
  }

  /**
   * Manual tracking method for explicit configuration changes
   */
  async trackConfigChange(
    type: ConfigChangeEvent['type'],
    file: string,
    changes: any,
    action: ConfigChangeEvent['action'] = 'modified'
  ): Promise<ConfigChangeEvent> {
    const changeEvent: ConfigChangeEvent = {
      type,
      file,
      action,
      timestamp: new Date().toISOString(),
      changes
    }

    if (this.enhancedLogger) {
      await this.enhancedLogger.log({
        level: 'info',
        category: 'configuration',
        source: 'manual-tracking',
        action: 'manual_config_change',
        message: `Manual configuration change tracked: ${file}`,
        details: changeEvent,
        success: true
      })
    } else {
      this.logger.info(`[ConfigTracker] Manual configuration change tracked: ${file}`)
    }

    return changeEvent
  }

  /**
   * Get configuration change history
   * @param type - Optional filter by config type
   * @param limit - Maximum number of entries to return
   */
  async getChangeHistory(
    type?: ConfigChangeEvent['type'],
    limit: number = 50
  ): Promise<ConfigChangeEvent[]> {
    // This would integrate with your log analytics to fetch configuration changes
    // For now, return a placeholder implementation
    // Implementers should override this method or provide a query function
    return []
  }

  /**
   * Get current checksums for all tracked files
   */
  getChecksums(): Map<string, string> {
    return new Map(this.checksums)
  }

  /**
   * Manually verify a file's checksum
   */
  async verifyChecksum(configFile: string): Promise<{
    file: string
    currentChecksum: string
    storedChecksum?: string
    isModified: boolean
  }> {
    const fullPath = path.join(this.projectRoot, configFile)
    const content = await fs.readFile(fullPath, 'utf-8')
    const currentChecksum = this.calculateChecksum(content)
    const storedChecksum = this.checksums.get(configFile)

    return {
      file: configFile,
      currentChecksum,
      storedChecksum,
      isModified: storedChecksum !== undefined && storedChecksum !== currentChecksum
    }
  }

  /**
   * Cleanup watchers
   */
  cleanup(): void {
    for (const [file, watcher] of Array.from(this.watchers.entries())) {
      try {
        watcher.close()
      } catch (error) {
        this.logger.error(`[ConfigTracker] Error closing watcher for ${file}:`, error)
      }
    }
    this.watchers.clear()
  }
}

/**
 * Factory function to create a ConfigChangeTracker instance
 */
export function createConfigChangeTracker(
  options: ConfigChangeTrackerOptions
): ConfigChangeTracker {
  return new ConfigChangeTracker(options)
}
