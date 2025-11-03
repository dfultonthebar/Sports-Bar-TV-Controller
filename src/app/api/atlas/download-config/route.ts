import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

const CONFIG_DIR = path.join(process.cwd(), 'data', 'atlas-configs')

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { processorId, ipAddress } = await request.json()

    if (!processorId || !ipAddress) {
      return NextResponse.json({ error: 'Processor ID and IP address are required' }, { status: 400 })
    }

    console.log(`Downloading configuration from Atlas processor at ${ipAddress}`)

    // CRITICAL FIX: Read from saved configuration file instead of generating random data
    // The previous implementation was generating random configuration which wiped user settings!
    
    try {
      // First, try to read the saved configuration
      const configPath = path.join(CONFIG_DIR, `${processorId}.json`)
      const configData = await fs.readFile(configPath, 'utf-8')
      const savedConfig = JSON.parse(configData)
      
      console.log('Configuration loaded from saved file:', {
        processorId,
        inputsCount: savedConfig.inputs?.length || 0,
        outputsCount: savedConfig.outputs?.length || 0,
        scenesCount: savedConfig.scenes?.length || 0
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Configuration loaded from saved file',
        inputs: savedConfig.inputs || [],
        outputs: savedConfig.outputs || [],
        scenes: savedConfig.scenes || [],
        messages: savedConfig.messages || [],
        source: 'saved_configuration'
      })
      
    } catch (fileError) {
      // If no saved configuration exists, return empty configuration
      // DO NOT generate random data!
      console.log('No saved configuration found, returning empty configuration')
      
      return NextResponse.json({ 
        success: true, 
        message: 'No saved configuration found. Please configure inputs and outputs manually.',
        inputs: [],
        outputs: [],
        scenes: [],
        messages: [],
        source: 'empty_default',
        warning: 'No configuration file found. This is a fresh setup.'
      })
    }

  } catch (error) {
    console.error('Error downloading configuration:', error)
    return NextResponse.json({ 
      error: 'Failed to download configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
