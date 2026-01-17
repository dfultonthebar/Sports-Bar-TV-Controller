

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
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

// Simple encryption helper
function simpleEncrypt(text: string): string {
  return Buffer.from(text).toString('base64')
}

function simpleDecrypt(encryptedText: string): string {
  return Buffer.from(encryptedText, 'base64').toString()
}

// Ensure data directory exists
function ensureDataDirectory() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
}

// Load credentials from file
function loadCredentials(): StreamingCredential[] {
  try {
    ensureDataDirectory()
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

// Save credentials to file
function saveCredentials(credentials: StreamingCredential[]): boolean {
  try {
    ensureDataDirectory()
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2))
    return true
  } catch (error) {
    logger.error('Error saving credentials:', error)
    return false
  }
}

// Mock authentication function (in production, integrate with actual APIs)
async function authenticateWithPlatform(platformId: string, username: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`🔐 Authenticating with ${platformId} for user: ${username}`)
    
    // Mock authentication logic
    // In production, this would make actual API calls to each platform
    switch (platformId) {
      case 'youtube-tv':
        // Mock YouTube TV authentication
        if (username.includes('@') && password.length >= 6) {
          return { success: true }
        }
        return { success: false, error: 'Invalid YouTube TV credentials' }
        
      case 'hulu-live':
        // Mock Hulu authentication
        if (username && password) {
          return { success: true }
        }
        return { success: false, error: 'Invalid Hulu credentials' }
        
      case 'paramount-plus':
        // Mock Paramount+ authentication
        if (username && password) {
          return { success: true }
        }
        return { success: false, error: 'Invalid Paramount+ credentials' }
        
      case 'peacock':
        // Mock Peacock authentication
        if (username && password) {
          return { success: true }
        }
        return { success: false, error: 'Invalid Peacock credentials' }
        
      case 'amazon-prime':
        // Mock Amazon Prime authentication
        if (username && password) {
          return { success: true }
        }
        return { success: false, error: 'Invalid Amazon Prime credentials' }
        
      default:
        return { success: false, error: 'Unsupported platform' }
    }
  } catch (error) {
    logger.error('Authentication error:', error)
    return { success: false, error: 'Authentication service error' }
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.streamingCredentials)
  if (isValidationError(bodyValidation)) return bodyValidation.error


  // Security: use validated data
  const { data } = bodyValidation
  const { platformId, username, password, rememberMe } = data
  try {
    

    if (!platformId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    logger.info(`🔐 Processing authentication for ${platformId}`)

    // Attempt authentication with the platform
    const authResult = await authenticateWithPlatform(platformId, username, password)
    
    if (!authResult.success) {
      return NextResponse.json(
        { success: false, error: authResult.response || "Unauthorized" || 'Authentication failed' },
        { status: 401 }
      )
    }

    // If authentication succeeds, save credentials
    const credentials = loadCredentials()
    const existingIndex = credentials.findIndex(c => c.platformId === platformId)

    const newCredential: StreamingCredential = {
      id: existingIndex >= 0 ? credentials[existingIndex].id : `cred_${Date.now()}`,
      platformId,
      username,
      passwordHash: simpleEncrypt(password),
      encrypted: true,
      lastUpdated: new Date().toISOString(),
      status: 'active',
      lastSync: new Date().toISOString()
    }

    if (existingIndex >= 0) {
      credentials[existingIndex] = newCredential
    } else {
      credentials.push(newCredential)
    }

    if (saveCredentials(credentials)) {
      logger.info(`✅ Successfully authenticated and saved credentials for ${platformId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        credential: {
          id: newCredential.id,
          platformId: newCredential.platformId,
          username: newCredential.username,
          encrypted: newCredential.encrypted,
          lastUpdated: newCredential.lastUpdated,
          status: newCredential.status,
          lastSync: newCredential.lastSync
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to save credentials' },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error in authentication:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication service error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AUTH)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { platformId } = bodyValidation.data

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      )
    }

    logger.info(`🔓 Logging out from ${platformId}`)

    const credentials = loadCredentials()
    const filteredCredentials = credentials.filter(c => c.platformId !== platformId)

    if (saveCredentials(filteredCredentials)) {
      logger.info(`✅ Successfully logged out from ${platformId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Successfully logged out'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to remove credentials' },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Error during logout:', error)
    return NextResponse.json(
      { success: false, error: 'Logout service error' },
      { status: 500 }
    )
  }
}
