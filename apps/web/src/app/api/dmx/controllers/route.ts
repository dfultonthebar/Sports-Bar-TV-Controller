import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { randomUUID } from 'crypto'

const createControllerSchema = z.object({
  name: z.string().min(1).max(100),
  controllerType: z.enum(['usb', 'artnet', 'maestro']),
  // USB fields
  serialPort: z.string().optional(),
  baudRate: z.number().int().positive().optional(),
  adapterModel: z.string().optional(),
  // Art-Net fields
  ipAddress: z.string().optional(),
  artnetPort: z.number().int().min(1).max(65535).optional(),
  artnetSubnet: z.number().int().min(0).max(15).optional(),
  artnetNet: z.number().int().min(0).max(127).optional(),
  // Universe assignment
  universeStart: z.number().int().min(0).max(255).optional(),
  universeCount: z.number().int().min(1).max(4).optional(),
  // Maestro
  maestroPresetCount: z.number().int().min(1).max(99).optional(),
  maestroFunctionCount: z.number().int().min(1).max(20).optional(),
  description: z.string().optional(),
}).refine(data => {
  if (data.controllerType === 'usb') return !!data.serialPort
  if (data.controllerType === 'artnet' || data.controllerType === 'maestro') return !!data.ipAddress
  return false
}, { message: 'USB controllers require serialPort, Art-Net/Maestro require ipAddress' })

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const controllers = await db.select()
      .from(schema.dmxControllers)
      .all()

    return NextResponse.json({
      success: true,
      controllers,
      count: controllers.length,
    })
  } catch (error) {
    logger.error('[DMX] Error loading controllers:', error)
    return NextResponse.json(
      { error: 'Failed to load DMX controllers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createControllerSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  const data = bodyValidation.data

  try {
    const now = new Date().toISOString()
    const id = randomUUID()

    const controller = await db.insert(schema.dmxControllers)
      .values({
        id,
        name: data.name,
        controllerType: data.controllerType,
        serialPort: data.serialPort || null,
        baudRate: data.baudRate ?? 250000,
        adapterModel: data.adapterModel || null,
        ipAddress: data.ipAddress || null,
        artnetPort: data.artnetPort ?? 6454,
        artnetSubnet: data.artnetSubnet ?? 0,
        artnetNet: data.artnetNet ?? 0,
        universeStart: data.universeStart ?? 0,
        universeCount: data.universeCount ?? 1,
        maestroPresetCount: data.maestroPresetCount || null,
        maestroFunctionCount: data.maestroFunctionCount || null,
        description: data.description || null,
        status: 'offline',
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    logger.info('[DMX] Created controller', { id, name: data.name, type: data.controllerType })

    return NextResponse.json({
      success: true,
      controller,
    }, { status: 201 })
  } catch (error) {
    logger.error('[DMX] Error creating controller:', error)
    return NextResponse.json(
      { error: 'Failed to create DMX controller' },
      { status: 500 }
    )
  }
}
