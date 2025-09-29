
import { EnhancedLogger } from './enhanced-logger'
import { promises as fs } from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'

export interface ConfigChangeEvent {
  type: 'matrix' | 'audio' | 'ir' | 'tv' | 'directv' | 'general'
  file: string
  action: 'created' | 'modified' | 'deleted'
  timestamp: string
  checksum?: string
  previousChecksum?: string
  changes?: any
}

class ConfigChangeTracker {
  private logger: EnhancedLogger
  private checksums: Map<string, string> = new Map()
  private watchers: Map<string, any> = new Map()

  constructor() {
    this.logger = new EnhancedLogger()
  }

  // Initialize file watching for configuration files
  async initializeWatching() {
    const configFiles = [
      'src/data/matrix-config.json',
      'src/data/device-mappings.json', 
      'src/data/ir-devices.json',
      'src/data/audio-zones.json',
      'src/data/directv-channels.json',
      '.env.local',
      'config/auto-sync.json'
    ]

    const projectRoot = '/home/ubuntu/Sports-Bar-TV-Controller'

    for (const configFile of configFiles) {
      const fullPath = path.join(projectRoot, configFile)
      
      try {
        // Calculate initial checksum
        const content = await fs.readFile(fullPath, 'utf-8')
        const checksum = this.calculateChecksum(content)
        this.checksums.set(configFile, checksum)

        // Start watching the file
        this.watchFile(fullPath, configFile)
      } catch (error) {
        // File doesn't exist yet, that's okay
        console.log(`Config file doesn't exist yet: ${configFile}`)
      }
    }
  }

  private watchFile(fullPath: string, configFile: string) {
    try {
      const fs = require('fs')
      
      const watcher = fs.watch(fullPath, async (eventType: string) => {
        if (eventType === 'change') {
          await this.handleFileChange(fullPath, configFile)
        }
      })

      this.watchers.set(configFile, watcher)
    } catch (error) {
      console.error(`Error watching file ${configFile}:`, error)
    }
  }

  private async handleFileChange(fullPath: string, configFile: string) {
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
        await this.logger.log({
          level: 'info',
          category: 'configuration',
          source: 'config-tracker',
          action: 'config_file_changed',
          message: `Configuration file changed: ${configFile}`,
          details: changeEvent,
          success: true
        })

        // Update stored checksum
        this.checksums.set(configFile, newChecksum)

        // Check if auto-sync is enabled and trigger sync if needed
        await this.checkAutoSync(changeEvent)
      }
    } catch (error) {
      console.error(`Error handling file change for ${configFile}:`, error)
    }
  }

  private async checkAutoSync(changeEvent: ConfigChangeEvent) {
    try {
      const response = await fetch('http://localhost:3000/api/github/auto-config-sync')
      if (response.ok) {
        const autoSyncConfig = await response.json()
        
        if (autoSyncConfig.enabled && autoSyncConfig.autoCommitOnConfigChange) {
          // Trigger auto-push
          const pushResponse = await fetch('http://localhost:3000/api/github/push-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              commitMessage: `Auto-sync: ${changeEvent.type} configuration changed`,
              configChanges: [{
                type: changeEvent.type,
                description: `Auto-detected change in ${changeEvent.file}`,
                files: [changeEvent.file]
              }],
              autoCommit: true
            })
          })

          const result = await pushResponse.json()
          
          await this.logger.log({
            level: result.success ? 'info' : 'warn',
            category: 'configuration',
            source: 'auto-sync',
            action: 'auto_push_config',
            message: result.success ? 'Auto-pushed configuration changes' : 'Auto-push failed',
            details: { changeEvent, result },
            success: result.success
          })
        }
      }
    } catch (error) {
      console.error('Error in auto-sync check:', error)
    }
  }

  private getConfigType(file: string): ConfigChangeEvent['type'] {
    if (file.includes('matrix')) return 'matrix'
    if (file.includes('audio')) return 'audio'
    if (file.includes('ir-device')) return 'ir'
    if (file.includes('directv')) return 'directv'
    if (file.includes('tv')) return 'tv'
    return 'general'
  }

  private calculateChecksum(content: string): string {
    return createHash('md5').update(content).digest('hex')
  }

  // Manual tracking method for explicit configuration changes
  async trackConfigChange(
    type: ConfigChangeEvent['type'],
    file: string,
    changes: any,
    action: ConfigChangeEvent['action'] = 'modified'
  ) {
    const changeEvent: ConfigChangeEvent = {
      type,
      file,
      action,
      timestamp: new Date().toISOString(),
      changes
    }

    await this.logger.log({
      level: 'info',
      category: 'configuration',
      source: 'manual-tracking',
      action: 'manual_config_change',
      message: `Manual configuration change tracked: ${file}`,
      details: changeEvent,
      success: true
    })

    return changeEvent
  }

  // Get configuration change history
  async getChangeHistory(type?: ConfigChangeEvent['type'], limit: number = 50) {
    // This would integrate with your log analytics to fetch configuration changes
    // For now, return a placeholder implementation
    return []
  }

  // Cleanup watchers
  cleanup() {
    for (const [file, watcher] of this.watchers) {
      try {
        watcher.close()
      } catch (error) {
        console.error(`Error closing watcher for ${file}:`, error)
      }
    }
    this.watchers.clear()
  }
}

export const configChangeTracker = new ConfigChangeTracker()

// Auto-initialize when module is imported
if (typeof window === 'undefined') {
  // Only initialize on server-side
  configChangeTracker.initializeWatching().catch(console.error)
}

export default ConfigChangeTracker
