

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'streaming-credentials.json')

interface StreamingCredential {
  id: string
  platformId: string
  username: string
  passwordHash: string  // We'll store hashed passwords for security
  encrypted: boolean
  lastUpdated: string
  status: 'active' | 'expired' | 'error'
  lastSync?: string
}

// Simple encryption (in production, use proper encryption libraries)
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
    console.error('Error loading credentials:', error)
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
    console.error('Error saving credentials:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const credentials = loadCredentials()
    
    // Return credentials without sensitive data
    const safeCredentials = credentials.map(cred => ({
      id: cred.id,
      platformId: cred.platformId,
      username: cred.username,
      encrypted: cred.encrypted,
      lastUpdated: cred.lastUpdated,
      status: cred.status,
      lastSync: cred.lastSync
    }))

    return NextResponse.json({
      success: true,
      credentials: safeCredentials
    })
  } catch (error) {
    console.error('Error getting credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load credentials' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { platformId, username, password, rememberMe } = await request.json()

    if (!platformId || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const credentials = loadCredentials()
    const existingIndex = credentials.findIndex(c => c.platformId === platformId)

    const newCredential: StreamingCredential = {
      id: existingIndex >= 0 ? credentials[existingIndex].id : `cred_${Date.now()}`,
      platformId,
      username,
      passwordHash: simpleEncrypt(password), // In production, use proper hashing
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
      return NextResponse.json({
        success: true,
        credential: {
          id: newCredential.id,
          platformId: newCredential.platformId,
          username: newCredential.username,
          encrypted: newCredential.encrypted,
          lastUpdated: newCredential.lastUpdated,
          status: newCredential.status
        }
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to save credentials' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error saving credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save credentials' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { platformId } = await request.json()

    if (!platformId) {
      return NextResponse.json(
        { success: false, error: 'Platform ID is required' },
        { status: 400 }
      )
    }

    const credentials = loadCredentials()
    const filteredCredentials = credentials.filter(c => c.platformId !== platformId)

    if (saveCredentials(filteredCredentials)) {
      return NextResponse.json({
        success: true,
        message: 'Credentials removed successfully'
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to remove credentials' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error removing credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove credentials' },
      { status: 500 }
    )
  }
}
