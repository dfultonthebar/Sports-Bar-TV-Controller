
import { NextRequest, NextResponse } from 'next/server'
import { and, asc, deleteRecord, desc, eq, findFirst, findUnique, or, update } from '@/lib/db-helpers'
import { schema } from '@/db'
import { logger } from '@/lib/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'


// PUT /api/channel-presets/[id] - Update a preset
export async function PUT(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const { data: body } = bodyValidation
  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  try {
    const { id } = params
    const { name, channelNumber, deviceType, order, isActive } = body

    // Check if preset exists
    const existingPreset = await findFirst('channelPresets', {
      where: eq(schema.channelPresets.id, id)
    })

    if (!existingPreset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      )
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (channelNumber !== undefined) updateData.channelNumber = channelNumber
    if (deviceType !== undefined) {
      const deviceTypeStr = String(deviceType)
      if (!['cable', 'directv'].includes(deviceTypeStr)) {
        return NextResponse.json(
          { success: false, error: 'Invalid deviceType' },
          { status: 400 }
        )
      }
      updateData.deviceType = deviceTypeStr
    }
    if (order !== undefined) updateData.order = order
    if (isActive !== undefined) updateData.isActive = isActive

    await update('channelPresets', id, updateData)

    // Get the updated preset
    const preset = await findFirst('channelPresets', {
      where: eq(schema.channelPresets.id, id)
    })

    return NextResponse.json({ 
      success: true, 
      preset 
    })
  } catch (error) {
    logger.error('Error updating channel preset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update channel preset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/channel-presets/[id] - Delete a preset
export async function DELETE(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params

    // Check if preset exists
    const existingPreset = await findFirst('channelPresets', {
      where: eq(schema.channelPresets.id, id)
    })

    if (!existingPreset) {
      return NextResponse.json(
        { success: false, error: 'Preset not found' },
        { status: 404 }
      )
    }

    await deleteRecord('channelPresets', id)

    return NextResponse.json({ 
      success: true, 
      message: 'Preset deleted successfully' 
    })
  } catch (error) {
    logger.error('Error deleting channel preset:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete channel preset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
