import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

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
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { processorId, ipAddress, inputs, outputs, scenes } = await request.json()

    if (!processorId || !ipAddress) {
      return NextResponse.json({ error: 'Processor ID and IP address are required' }, { status: 400 })
    }

    console.log(`Uploading configuration to Atlas processor at ${ipAddress}`)

    // CRITICAL FIX: Save configuration to file BEFORE attempting to upload to processor
    // This ensures we don't lose the configuration even if the processor upload fails
    
    await ensureConfigDir()
    
    const config = {
      processorId,
      inputs: inputs || [],
      outputs: outputs || [],
      scenes: scenes || [],
      messages: [],
      lastUpdated: new Date().toISOString()
    }

    // Save main configuration file
    const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
    await fs.writeFile(configPath, JSON.stringify(config, null, 2))
    
    // Save backup with timestamp
    const backupPath = path.join(CONFIG_DIR, `${processorId}_backup_${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(config, null, 2))
    
    console.log('Configuration saved to file system:', {
      mainFile: configPath,
      backupFile: backupPath,
      inputsCount: inputs?.length || 0,
      outputsCount: outputs?.length || 0,
      scenesCount: scenes?.length || 0
    })

    // Note: Actual Atlas processor upload would happen here via HTTP API
    // For now, we're just saving the configuration locally
    // The Atlas processor retains its own configuration independently

    return NextResponse.json({ 
      success: true, 
      message: 'Configuration saved successfully',
      savedAt: config.lastUpdated,
      warning: 'Configuration saved to application. Atlas processor retains its own settings independently.'
    })

  } catch (error) {
    console.error('Error uploading configuration:', error)
    return NextResponse.json({ 
      error: 'Failed to upload configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
