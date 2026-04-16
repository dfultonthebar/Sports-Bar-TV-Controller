import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { schema } from '@/db'
import { eq, and } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validatePathParams, isValidationError } from '@/lib/validation'
import axios from 'axios'

const DIRECTV_SPORTS_CHANNELS = [
  // Major Sports Networks
  { ch: 206, name: 'ESPN', category: 'sports' },
  { ch: 209, name: 'ESPN2', category: 'sports' },
  { ch: 208, name: 'ESPNU', category: 'sports' },
  { ch: 207, name: 'ESPNews', category: 'sports' },
  { ch: 219, name: 'Fox Sports 1', category: 'sports' },
  { ch: 618, name: 'Fox Sports 2', category: 'sports' },
  { ch: 245, name: 'TNT', category: 'sports' },
  { ch: 246, name: 'TBS', category: 'sports' },
  { ch: 247, name: 'truTV', category: 'sports' },
  { ch: 220, name: 'NFL Network', category: 'sports' },
  { ch: 212, name: 'MLB Network', category: 'sports' },
  { ch: 216, name: 'NBA TV', category: 'sports' },
  { ch: 215, name: 'NHL Network', category: 'sports' },
  { ch: 213, name: 'Golf Channel', category: 'sports' },
  { ch: 602, name: 'CBS Sports Network', category: 'sports' },
  { ch: 610, name: 'Big Ten Network', category: 'sports' },
  { ch: 611, name: 'SEC Network', category: 'sports' },
  { ch: 612, name: 'ACC Network', category: 'sports' },
  { ch: 614, name: 'Pac-12 Network', category: 'sports' },
  { ch: 620, name: 'Olympic Channel', category: 'sports' },
  // Regional Sports
  { ch: 668, name: 'Bally Sports North', category: 'sports' },
  { ch: 669, name: 'Bally Sports Wisconsin', category: 'sports' },
  { ch: 671, name: 'Bally Sports Midwest', category: 'sports' },
  // Premium Sports
  { ch: 217, name: 'MLB Strike Zone', category: 'premium' },
  { ch: 703, name: 'NFL Sunday Ticket Red Zone', category: 'premium' },
  // Entertainment (used for sports)
  { ch: 242, name: 'USA Network', category: 'entertainment' },
  { ch: 248, name: 'Paramount Network', category: 'entertainment' },
  { ch: 296, name: 'Peacock/NBC Sports', category: 'sports' },
  // Broadcast locals
  { ch: 2, name: 'CBS (Local)', category: 'local' },
  { ch: 4, name: 'NBC (Local)', category: 'local' },
  { ch: 5, name: 'FOX (Local)', category: 'local' },
  { ch: 7, name: 'ABC (Local)', category: 'local' },
  { ch: 11, name: 'WLUK-TV', category: 'local' },
  { ch: 13, name: 'CW (Local)', category: 'local' },
]

interface ScanResult {
  channelNumber: number
  name: string
  category: string
  callsign: string | null
  exists: boolean
}

async function probeChannel(
  ipAddress: string,
  port: number,
  channel: { ch: number; name: string; category: string }
): Promise<ScanResult> {
  try {
    const response = await axios.get(
      `http://${ipAddress}:${port}/tv/getProgInfo?major=${channel.ch}`,
      { timeout: 3000 }
    )

    const data = response.data
    const statusCode = data?.status?.code

    if (statusCode === 200) {
      return {
        channelNumber: channel.ch,
        name: channel.name,
        category: channel.category,
        callsign: data.callsign || null,
        exists: true,
      }
    }

    return {
      channelNumber: channel.ch,
      name: channel.name,
      category: channel.category,
      callsign: null,
      exists: false,
    }
  } catch {
    return {
      channelNumber: channel.ch,
      name: channel.name,
      category: channel.category,
      callsign: null,
      exists: false,
    }
  }
}

// POST /api/input-channel-lists/[listId]/scan - Scan DirecTV receiver for channels
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ listId: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ listId: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error

  const bodySchema = z.object({
    ipAddress: z.string().ip(),
    port: z.number().int().min(1).max(65535).optional().default(8080),
  })

  const bodyValidation = await validateRequestBody(request, bodySchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  logger.api.request('POST', `/api/input-channel-lists/${params.listId}/scan`)

  try {
    const { listId } = params
    const { ipAddress, port } = bodyValidation.data

    // Verify list exists
    const list = await db.select()
      .from(schema.inputChannelLists)
      .where(eq(schema.inputChannelLists.id, listId))
      .get()

    if (!list) {
      return NextResponse.json(
        { success: false, error: 'Channel list not found' },
        { status: 404 }
      )
    }

    logger.info('[INPUT_CHANNEL_LISTS] Starting channel scan', { listId, ipAddress, port, totalChannels: DIRECTV_SPORTS_CHANNELS.length })

    // Scan channels in batches of 5
    const BATCH_SIZE = 5
    const allResults: ScanResult[] = []

    for (let i = 0; i < DIRECTV_SPORTS_CHANNELS.length; i += BATCH_SIZE) {
      const batch = DIRECTV_SPORTS_CHANNELS.slice(i, i + BATCH_SIZE)
      const batchResults = await Promise.allSettled(
        batch.map((channel) => probeChannel(ipAddress, port, channel))
      )

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allResults.push(result.value)
        }
      }
    }

    const foundChannels = allResults.filter((r) => r.exists)
    let added = 0
    let updated = 0
    const now = new Date().toISOString()

    for (const channel of foundChannels) {
      const channelNumberStr = String(channel.channelNumber)

      // Check if entry already exists
      const existing = await db.select()
        .from(schema.inputChannelListEntries)
        .where(and(
          eq(schema.inputChannelListEntries.listId, listId),
          eq(schema.inputChannelListEntries.channelNumber, channelNumberStr)
        ))
        .get()

      if (existing) {
        // Update existing entry
        await db.update(schema.inputChannelListEntries)
          .set({
            callsign: channel.callsign ?? existing.callsign,
            source: 'scan',
            lastVerified: now,
            updatedAt: now,
          })
          .where(eq(schema.inputChannelListEntries.id, existing.id))
          .run()
        updated++
      } else {
        // Insert new entry
        await db.insert(schema.inputChannelListEntries).values({
          id: crypto.randomUUID(),
          listId,
          channelNumber: channelNumberStr,
          channelName: channel.name,
          callsign: channel.callsign ?? null,
          network: channel.name,
          category: channel.category,
          isHD: false,
          isActive: true,
          displayOrder: channel.channelNumber,
          source: 'scan',
          lastVerified: now,
          createdAt: now,
          updatedAt: now,
        }).run()
        added++
      }
    }

    logger.info('[INPUT_CHANNEL_LISTS] Channel scan complete', {
      listId,
      scanned: DIRECTV_SPORTS_CHANNELS.length,
      found: foundChannels.length,
      added,
      updated,
    })

    logger.api.response('POST', `/api/input-channel-lists/${listId}/scan`, 200)
    return NextResponse.json({
      success: true,
      scanned: DIRECTV_SPORTS_CHANNELS.length,
      found: foundChannels.length,
      added,
      updated,
    })
  } catch (error) {
    logger.api.error('POST', `/api/input-channel-lists/${params.listId}/scan`, error)
    return NextResponse.json(
      { success: false, error: 'Failed to scan channels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
