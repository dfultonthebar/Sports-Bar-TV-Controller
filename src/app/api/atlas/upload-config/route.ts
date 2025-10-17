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
    const { processorId, ipAddress, inputs, outputs, scenes } = await request.json()

    if (!processorId || !ipAddress) {
      return NextResponse.json({ error: 'Processor ID and IP address are required' }, { status: 400 })
    }

    console.log('='.repeat(80))
    console.log('[Atlas Upload] Starting configuration upload to Atlas device')
    console.log(`[Atlas Upload] Processor ID: ${processorId}`)
    console.log(`[Atlas Upload] IP Address: ${ipAddress}`)
    console.log(`[Atlas Upload] Configuration: ${inputs?.length || 0} inputs, ${outputs?.length || 0} outputs, ${scenes?.length || 0} scenes`)
    console.log('='.repeat(80))

    // Save configuration to file system FIRST (backup before attempting device upload)
    await ensureConfigDir()
    
    const config = {
      processorId,
      inputs: inputs || [],
      outputs: outputs || [],
      scenes: scenes || [],
      messages: [],
      lastUpdated: new Date().toISOString()
    }

    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    
    // Create timestamped backup
    const backupPath = path.join(CONFIG_DIR, `${processorId}_backup_${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2))
    
    console.log('[Atlas Upload] Configuration saved to local filesystem')
    console.log(`[Atlas Upload] Main file: ${configPath}`)
    console.log(`[Atlas Upload] Backup file: ${backupPath}`)

    // Now attempt to upload to Atlas device via TCP
    try {
      console.log('[Atlas Upload] Connecting to Atlas device via TCP port 5321...')
      
      await withAtlasConnection(ipAddress, 5321, async (client) => {
        console.log('[Atlas Upload] Connected! Uploading configuration to device...')
        await client.uploadConfiguration(config)
        console.log('[Atlas Upload] Configuration successfully uploaded to device!')
      })
      
      console.log('='.repeat(80))
      console.log('[Atlas Upload] Upload complete!')
      console.log('[Atlas Upload] ✓ Saved to local filesystem')
      console.log('[Atlas Upload] ✓ Uploaded to Atlas device')
      console.log('='.repeat(80))

      return NextResponse.json({ 
        success: true, 
        message: 'Configuration uploaded successfully to Atlas device and saved locally',
        savedAt: config.lastUpdated,
        savedToFile: true,
        uploadedToDevice: true
      })
      
    } catch (deviceError) {
      console.error('[Atlas Upload] Failed to upload to device:', deviceError)
      console.log('[Atlas Upload] Configuration is saved locally but device upload failed')
      console.log('='.repeat(80))
      console.warn('[Atlas Upload] Partial success - saved locally only')
      console.log('[Atlas Upload] ✓ Saved to local filesystem')
      console.log('[Atlas Upload] ✗ Failed to upload to Atlas device')
      console.log('='.repeat(80))
      
      return NextResponse.json({ 
        success: true, 
        message: 'Configuration saved locally but device upload failed',
        savedAt: config.lastUpdated,
        savedToFile: true,
        uploadedToDevice: false,
        warning: `Device upload failed: ${deviceError instanceof Error ? deviceError.message : 'Unknown error'}`,
        details: 'Configuration has been saved to local filesystem. Device upload can be retried later.'
      })
    }

  } catch (error) {
    console.error('[Atlas Upload] Unexpected error:', error)
    console.log('='.repeat(80))
    console.error('[Atlas Upload] FATAL ERROR')
    console.log('='.repeat(80))
    
    return NextResponse.json({ 
      error: 'Failed to upload configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
