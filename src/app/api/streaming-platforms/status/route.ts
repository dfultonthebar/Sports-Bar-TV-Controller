

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'
export const dynamic = 'force-dynamic'

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'streaming-credentials.json')

interface StreamingCredential {
  id: string
  platformId: string
  username: string
  passwordHash: string
  encrypted: boolean
  lastUpdated: string
  status: 'active' | 'expired' | 'error'
  lastSync?: string
}

// Load credentials from file
function loadCredentials(): StreamingCredential[] {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8')
      return JSON.parse(data)
    }
    return []
  } catch (error) {
    logger.error('Error loading credentials:', error)
    return []
  }
}

// Mock status check for each platform
async function checkPlatformStatus(platformId: string, credential: StreamingCredential): Promise<'connected' | 'expired' | 'not-connected'> {
  try {
    // Mock status check logic
    // In production, this would make actual API calls to verify authentication
    const now = new Date()
    const lastUpdate = new Date(credential.lastUpdated)
    const daysSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    
    // Mock expiration logic - credentials expire after 30 days
    if (daysSinceUpdate > 30) {
      return 'expired'
    }
    
    // Mock connectivity check
    switch (platformId) {
      case 'youtube-tv':
        // Mock YouTube TV status check
        return Math.random() > 0.05 ? 'connected' : 'not-connected'
        
      case 'hulu-live':
        // Mock Hulu status check
        return Math.random() > 0.1 ? 'connected' : 'not-connected'
        
      case 'paramount-plus':
        // Mock Paramount+ status check
        return Math.random() > 0.1 ? 'connected' : 'not-connected'
        
      case 'peacock':
        // Mock Peacock status check
        return Math.random() > 0.1 ? 'connected' : 'not-connected'
        
      case 'amazon-prime':
        // Mock Amazon Prime status check
        return Math.random() > 0.05 ? 'connected' : 'not-connected'
        
      default:
        return 'not-connected'
    }
  } catch (error) {
    logger.error(`Error checking status for ${platformId}:`, error)
    return 'not-connected'
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    logger.info('🔍 Checking streaming platform statuses...')
    
    const credentials = loadCredentials()
    const statuses: Record<string, 'connected' | 'expired' | 'not-connected'> = {}
    
    // Check status for each platform with credentials
    for (const credential of credentials) {
      const status = await checkPlatformStatus(credential.platformId, credential)
      statuses[credential.platformId] = status
    }
    
    // Define all available platforms
    const allPlatforms = [
      'youtube-tv', 
      'hulu-live',
      'paramount-plus',
      'peacock',
      'amazon-prime'
    ]
    
    // Set 'not-connected' for platforms without credentials
    for (const platformId of allPlatforms) {
      if (!statuses[platformId]) {
        statuses[platformId] = 'not-connected'
      }
    }

    logger.info('📊 Platform statuses:', statuses)

    return NextResponse.json({
      success: true,
      statuses,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error checking platform statuses:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check platform statuses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error


  try {
    const { platformId } = await request.json()

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      )
    }

    logger.info(`🔍 Checking status for specific platform: ${platformId}`)

    const credentials = loadCredentials()
    const credential = credentials.find(c => c.platformId === platformId)
    
    if (!credential) {
      return NextResponse.json({
        success: true,
        status: 'not-connected',
        message: 'No credentials found for this platform'
      })
    }

    const status = await checkPlatformStatus(platformId, credential)
    
    // Update credential status in file
    const updatedCredentials = credentials.map(c => 
      c.platformId === platformId 
        ? { ...c, status, lastSync: new Date().toISOString() }
        : c
    )
    
    try {
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(updatedCredentials, null, 2))
    } catch (error) {
      logger.error('Error updating credential status:', error)
    }

    return NextResponse.json({
      success: true,
      status,
      lastChecked: new Date().toISOString()
    })
  } catch (error) {
    logger.error('Error checking single platform status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check platform status' },
      { status: 500 }
    )
  }
}
