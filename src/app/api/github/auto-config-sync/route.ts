
import { NextRequest, NextResponse } from 'next/server'
import { EnhancedLogger } from '@/lib/enhanced-logger'
import fs from 'fs/promises'
import path from 'path'

const logger = new EnhancedLogger()

interface AutoSyncConfig {
  enabled: boolean
  syncInterval: number // minutes
  autoCommitOnConfigChange: boolean
  monitoredPaths: string[]
  lastSync: string
}

const CONFIG_FILE = '/home/ubuntu/Sports-Bar-TV-Controller/config/auto-sync.json'

// Default auto-sync configuration
const DEFAULT_CONFIG: AutoSyncConfig = {
  enabled: false,
  syncInterval: 30, // 30 minutes
  autoCommitOnConfigChange: true,
  monitoredPaths: [
    'src/data/matrix-config.json',
    'src/data/device-mappings.json',
    'src/data/ir-devices.json',
    'src/data/audio-zones.json',
    'config/',
    '.env.local'
  ],
  lastSync: new Date().toISOString()
}

export async function GET() {
  try {
    let config = DEFAULT_CONFIG
    
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8')
      config = { ...DEFAULT_CONFIG, ...JSON.parse(configData) }
    } catch (error) {
      // Config file doesn't exist, use defaults
    }

    return NextResponse.json(config)
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      config: DEFAULT_CONFIG 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const updates = await request.json()
    
    // Read existing config
    let config = DEFAULT_CONFIG
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8')
      config = { ...DEFAULT_CONFIG, ...JSON.parse(configData) }
    } catch (error) {
      // Config file doesn't exist, will create new one
    }

    // Update config
    const newConfig = { ...config, ...updates }
    
    // Ensure config directory exists
    await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true })
    
    // Save updated config
    await fs.writeFile(CONFIG_FILE, JSON.stringify(newConfig, null, 2))

    // Log configuration change
    await logger.log({
      level: 'info',
      category: 'configuration',
      source: 'auto-sync',
      action: 'update_auto_sync_config',
      message: 'Auto-sync configuration updated',
      details: { 
        previousConfig: config,
        newConfig,
        changes: updates
      },
      success: true
    })

    return NextResponse.json({
      success: true,
      config: newConfig,
      message: 'Auto-sync configuration updated'
    })

  } catch (error: any) {
    await logger.log({
      level: 'error',
      category: 'configuration',
      source: 'auto-sync',
      action: 'update_auto_sync_config_error',
      message: 'Failed to update auto-sync configuration',
      details: { error: error.message },
      success: false,
      errorStack: error.stack
    })

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
