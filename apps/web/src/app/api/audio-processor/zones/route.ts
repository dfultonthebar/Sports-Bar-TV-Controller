
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { audioZones } from '@/db/schema'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
import { HARDWARE_CONFIG } from '@/lib/hardware-config'
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error

  try {
    const { searchParams } = new URL(request.url)
    const processorId = searchParams.get('processorId')

    if (!processorId) {
      return NextResponse.json(
        { error: 'Processor ID is required' },
        { status: 400 }
      )
    }

    // If live=true, query Atlas hardware for current zone states and sync to DB
    const live = searchParams.get('live') === 'true'
    if (live) {
      try {
        const processor = await findFirst('audioProcessors', {
          where: eq(schema.audioProcessors.id, processorId)
        })
        if (processor?.ipAddress) {
          // v2.54.65: getAtlasClient is exported from @/lib/atlas-client-manager
          // (the singleton-aware bridge), NOT @/lib/atlasClient (the legacy
          // bridge that only re-exports AtlasTCPClient/createAtlasClient/
          // executeAtlasCommand). The old import returned `undefined`, the
          // very next line then threw "TypeError: getAtlasClient is not a
          // function", and the catch below swallowed it — so the DB mute
          // sync silently never ran, leaving every zone stuck at muted=1
          // forever after the last manual toggle. Holmgren operator
          // reported "Audio tab always shows muted even though zones are
          // not muted" — that was this. Fix: correct import path + await
          // (function is async) + (no longer needed to assign client; the
          // /api/atlas/output-meters call below uses the SHARED client
          // via its own getAtlasClient resolve).
          const _client = await (await import('@/lib/atlas-client-manager')).getAtlasClient(
            `processor-${processor.ipAddress}`,
            {
              ipAddress: processor.ipAddress,
              tcpPort: processor.tcpPort || HARDWARE_CONFIG.atlas.tcpPort,
              timeout: 5000,
            }
          )

          // Get live zone data from output meters (most reliable source of truth)
          const dbZones = await findMany('audioZones', {
            where: and(eq(schema.audioZones.processorId, processorId), eq(schema.audioZones.enabled, true)),
            orderBy: asc(schema.audioZones.zoneNumber),
            limit: 1000
          })

          const baseUrl = `http://127.0.0.1:${process.env.PORT || 3001}`
          const meterResp = await fetch(`${baseUrl}/api/atlas/output-meters?processorIp=${processor.ipAddress}`)

          if (meterResp.ok) {
            const meterData = await meterResp.json()
            const meters = meterData.meters || []

            for (const zone of dbZones) {
              const meter = meters.find((m: any) => m.index === zone.zoneNumber)
              if (!meter) continue

              // Update mute state directly via Drizzle (boolean field)
              const isMuted = meter.muted === true
              await db.update(schema.audioZones)
                .set({ muted: isMuted, updatedAt: new Date().toISOString() })
                .where(eq(schema.audioZones.id, zone.id))
            }
            logger.debug(`[ZONES] Synced ${dbZones.length} zones from Atlas output meters`)
          }
        }
      } catch (err) {
        // v2.54.65: include error message in the warn so future debugging
        // doesn't require attaching a debugger. The old "Failed to sync
        // live zone data from hardware:" with empty body hid the
        // TypeError that caused this bug for weeks.
        logger.warn(`[ZONES] Failed to sync live zone data from hardware: ${(err as Error)?.message ?? err}`, err)
      }
    }

    const zones = await findMany('audioZones', {
      where: and(
        eq(schema.audioZones.processorId, processorId),
        eq(schema.audioZones.enabled, true)
      ),
      orderBy: asc(schema.audioZones.zoneNumber),
      limit: 1000
    })

    return NextResponse.json({ zones })
  } catch (error) {
    logger.error('Error fetching audio zones:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audio zones' },
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
  const bodyValidation = await validateRequestBody(request, z.object({
    processorId: z.string(),
    zoneNumber: z.number(),
    name: z.string(),
    description: z.string().optional(),
    currentSource: z.string().optional(),
    volume: z.number().optional(),
    muted: z.boolean().optional()
  }))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { processorId, zoneNumber, name, description, currentSource, volume, muted } = bodyValidation.data

    const zone = await db.insert(audioZones).values({
        processorId,
        zoneNumber,
        name,
        description,
        currentSource,
        volume: volume ?? 50,
        muted: muted ?? false,
        enabled: true
      }).returning().get()

    return NextResponse.json({ zone })
  } catch (error) {
    logger.error('Error creating audio zone:', error)
    return NextResponse.json(
      { error: 'Failed to create audio zone' },
      { status: 500 }
    )
  }
}
