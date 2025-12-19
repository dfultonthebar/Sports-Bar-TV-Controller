/**
 * PIN Management API Endpoint (Admin Only)
 *
 * GET /api/auth/pins - List all PINs (without hashes)
 * POST /api/auth/pins - Create new PIN
 * DELETE /api/auth/pins - Delete PIN
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPIN, listPINs, deletePIN, deactivatePIN, requireAuth, logAuditAction } from '@/lib/auth'
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
    const pins = await listPINs()

    return NextResponse.json({
      success: true,
      pins,
    })
  } catch (error) {
    logger.error('Error listing PINs:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to list PINs' },
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
    const { pin, role, description, expiresAt } = body

    if (!pin || !role) {
      return NextResponse.json(
        { success: false, error: 'PIN and role are required' },
        { status: 400 }
      )
    }

    const result = await createPIN(
      pin,
      role,
      description,
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

    // Log PIN creation
    await logAuditAction({
      action: 'PIN_CREATED',
      resource: 'auth_pin',
      resourceId: result.pinId,
      endpoint: '/api/auth/pins',
      method: 'POST',
      ipAddress,
      userAgent,
      sessionId: authCheck.sessionId,
      success: true,
      metadata: { role, description },
    })

    return NextResponse.json({
      success: true,
      message: 'PIN created successfully',
      pinId: result.pinId,
    })
  } catch (error) {
    logger.error('Error creating PIN:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to create PIN' },
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
    const { pinId, permanent } = body

    if (!pinId) {
      return NextResponse.json(
        { success: false, error: 'PIN ID is required' },
        { status: 400 }
      )
    }

    let result
    if (permanent) {
      result = await deletePIN(pinId)
    } else {
      result = await deactivatePIN(pinId)
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      )
    }

    // Log PIN deletion
    await logAuditAction({
      action: permanent ? 'PIN_DELETED' : 'PIN_DEACTIVATED',
      resource: 'auth_pin',
      resourceId: pinId,
      endpoint: '/api/auth/pins',
      method: 'DELETE',
      ipAddress,
      userAgent,
      sessionId: authCheck.sessionId,
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: permanent ? 'PIN deleted permanently' : 'PIN deactivated',
    })
  } catch (error) {
    logger.error('Error deleting PIN:', error)

    return NextResponse.json(
      { success: false, error: 'Failed to delete PIN' },
      { status: 500 }
    )
  }
}
