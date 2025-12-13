/**
 * API Key Management Endpoint (Admin Only)
 *
 * GET /api/auth/api-keys - List all API keys
 * POST /api/auth/api-keys - Create new API key
 * DELETE /api/auth/api-keys - Revoke API key
 */

import { NextRequest, NextResponse } from 'next/server'
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey, requireAuth, logAuditAction } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function getIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown'
}

export async function GET(request: NextRequest) {
  // Require ADMIN role
  const authCheck = await requireAuth(request, 'ADMIN')
  if (!authCheck.allowed) {
    return authCheck.response!
  }

  try {
    const keys = await listApiKeys()

    return NextResponse.json({
      success: true,
      apiKeys: keys,
    })
  } catch (error) {
    logger.error('Error listing API keys:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  // Require ADMIN role
  const authCheck = await requireAuth(request, 'ADMIN')
  if (!authCheck.allowed) {
    return authCheck.response!
  }

  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const body = await request.json()
    const { name, permissions, expiresAt } = body

    if (!name || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { success: false, error: 'Name and permissions array are required' },
        { status: 400 }
      )
    }

    const result = await createApiKey(
      name,
      permissions,
      undefined, // Use default location
      authCheck.sessionId,
      expiresAt ? new Date(expiresAt) : undefined
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Log API key creation
    await logAuditAction({
      action: 'API_KEY_CREATED',
      resource: 'auth_api_key',
      resourceId: result.keyId,
      endpoint: '/api/auth/api-keys',
      method: 'POST',
      ipAddress,
      userAgent,
      sessionId: authCheck.sessionId,
      success: true,
      metadata: { name, permissions },
    })

    return NextResponse.json({
      success: true,
      message: 'API key created successfully. Save this key - it will not be shown again!',
      apiKey: result.apiKey, // Only returned on creation
      keyId: result.keyId,
    })
  } catch (error) {
    logger.error('Error creating API key:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to create API key' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  // Require ADMIN role
  const authCheck = await requireAuth(request, 'ADMIN')
  if (!authCheck.allowed) {
    return authCheck.response!
  }

  const ipAddress = getIpAddress(request)
  const userAgent = request.headers.get('user-agent') || undefined

  try {
    const body = await request.json()
    const { keyId, permanent } = body

    if (!keyId) {
      return NextResponse.json(
        { success: false, error: 'Key ID is required' },
        { status: 400 }
      )
    }

    let result
    if (permanent) {
      result = await deleteApiKey(keyId)
    } else {
      result = await revokeApiKey(keyId)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Log API key deletion
    await logAuditAction({
      action: permanent ? 'API_KEY_DELETED' : 'API_KEY_REVOKED',
      resource: 'auth_api_key',
      resourceId: keyId,
      endpoint: '/api/auth/api-keys',
      method: 'DELETE',
      ipAddress,
      userAgent,
      sessionId: authCheck.sessionId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: permanent ? 'API key deleted permanently' : 'API key revoked',
    })
  } catch (error) {
    logger.error('Error deleting API key:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}
