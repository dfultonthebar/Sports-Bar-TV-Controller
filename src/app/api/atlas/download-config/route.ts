import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { withAtlasConnection } from '@/lib/atlas-tcp-client'

const CONFIG_DIR = path.join(process.cwd(), 'data', 'atlas-configs')

// Ensure config directory exists
async function ensureConfigDir() {
  try {
    await fs.access(CONFIG_DIR)
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { processorId, ipAddress, inputCount = 8, outputCount = 8, sceneCount = 3 } = await request.json()

    if (!processorId || !ipAddress) {
      return NextResponse.json({ error: 'Processor ID and IP address are required' }, { status: 400 })
    }

    console.log('='.repeat(80))
    console.log('[Atlas Download] Starting configuration download from Atlas device')
    console.log(`[Atlas Download] Processor ID: ${processorId}`)
    console.log(`[Atlas Download] IP Address: ${ipAddress}`)
    console.log(`[Atlas Download] Parameters: ${inputCount} inputs, ${outputCount} outputs, ${sceneCount} scenes`)
    console.log('='.repeat(80))

    try {
      // Connect to Atlas device via TCP and download configuration
      console.log('[Atlas Download] Connecting to Atlas device via TCP port 5321...')
      
      const config = await withAtlasConnection(ipAddress, 5321, async (client) => {
        console.log('[Atlas Download] Connected! Downloading configuration from device...')
        return await client.downloadConfiguration(inputCount, outputCount, sceneCount)
      })
      
      console.log('[Atlas Download] Configuration successfully downloaded from device!')
      console.log(`[Atlas Download] Received: ${config.inputs?.length || 0} inputs, ${config.outputs?.length || 0} outputs, ${config.scenes?.length || 0} scenes`)
      
      // Save the downloaded configuration to local file system as backup
      await ensureConfigDir()
      
      const fullConfig = {
        processorId,
        ...config,
        lastUpdated: new Date().toISOString(),
        source: 'atlas_device'
      }
      
      const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
      await fs.writeFile(configPath, JSON.stringify(fullConfig, null, 2))
      
      // Create timestamped backup
      const backupPath = path.join(CONFIG_DIR, `${processorId}_backup_${Date.now()}.json`)
      await fs.writeFile(backupPath, JSON.stringify(fullConfig, null, 2))
      
      console.log('[Atlas Download] Configuration saved to local filesystem')
      console.log(`[Atlas Download] Main file: ${configPath}`)
      console.log(`[Atlas Download] Backup file: ${backupPath}`)
      console.log('='.repeat(80))
      console.log('[Atlas Download] Download complete!')
      console.log('='.repeat(80))

      return NextResponse.json({ 
        success: true, 
        message: 'Configuration downloaded successfully from Atlas device',
        inputs: config.inputs || [],
        outputs: config.outputs || [],
        scenes: config.scenes || [],
        messages: config.messages || [],
        source: 'atlas_device',
        savedToFile: true,
        savedAt: fullConfig.lastUpdated
      })
      
    } catch (deviceError) {
      console.error('[Atlas Download] Failed to download from device:', deviceError)
      console.log('[Atlas Download] Attempting to load from saved configuration file as fallback...')
      
      // Fallback: Try to read from saved configuration
      try {
        const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
        const configData = await fs.readFile(configPath, 'utf-8')
        const savedConfig = JSON.parse(configData)
        
        console.log('[Atlas Download] Configuration loaded from saved file (fallback)')
        console.log(`[Atlas Download] File: ${configPath}`)
        console.log(`[Atlas Download] Last updated: ${savedConfig.lastUpdated || 'unknown'}`)
        console.log('='.repeat(80))
        console.log('[Atlas Download] Fallback successful!')
        console.log('='.repeat(80))

        return NextResponse.json({ 
          success: true, 
          message: 'Configuration loaded from saved file (device connection failed)',
          inputs: savedConfig.inputs || [],
          outputs: savedConfig.outputs || [],
          scenes: savedConfig.scenes || [],
          messages: savedConfig.messages || [],
          source: 'saved_configuration',
          warning: `Could not connect to Atlas device: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}`,
          lastUpdated: savedConfig.lastUpdated
        })
        
      } catch (fileError) {
        console.error('[Atlas Download] No saved configuration found:', fileError)
        console.log('='.repeat(80))
        console.error('[Atlas Download] FAILED - No device connection and no saved file')
        console.log('='.repeat(80))
        
        return NextResponse.json({ 
          error: 'Failed to download configuration',
          details: {
            deviceError: deviceError instanceof Error ? deviceError.message : 'Unknown device error',
            fileError: fileError instanceof Error ? fileError.message : 'No saved configuration'
          },
          suggestion: 'Check device connectivity and ensure configuration has been uploaded at least once'
        }, { status: 500 })
      }
    }

  } catch (error) {
    console.error('[Atlas Download] Unexpected error:', error)
    console.log('='.repeat(80))
    console.error('[Atlas Download] FATAL ERROR')
    console.log('='.repeat(80))
    
    return NextResponse.json({ 
      error: 'Failed to download configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
