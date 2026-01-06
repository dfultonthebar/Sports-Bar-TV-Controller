/**
 * Atlas Meters SSE Stream
 *
 * Real-time Server-Sent Events endpoint for Atlas audio meter data.
 * Streams meter updates as they arrive from the Atlas processor via UDP.
 *
 * This provides ~10-20ms latency vs ~500ms+ with HTTP polling.
 */

import { NextRequest } from 'next/server'
import { atlasMeterManager } from '@/lib/atlas-meter-manager'
import { logger } from '@sports-bar/logger'

// Store zone metadata (names, mute states) - refreshed periodically
const zoneMetadataCache = new Map<string, {
  names: string[]
  muteStates: boolean[]
  lastFetched: number
}>()

// Store source/input metadata (names) - refreshed periodically
const sourceMetadataCache = new Map<string, {
  names: string[]
  lastFetched: number
}>()

const METADATA_CACHE_TTL = 60000 // 1 minute

async function fetchZoneMetadata(processorIp: string): Promise<{ names: string[], muteStates: boolean[] }> {
  const cached = zoneMetadataCache.get(processorIp)
  const now = Date.now()

  if (cached && (now - cached.lastFetched) < METADATA_CACHE_TTL) {
    return { names: cached.names, muteStates: cached.muteStates }
  }

  try {
    const { getAtlasClient, releaseAtlasClient } = await import('@/lib/atlas-client-manager')
    const client = await getAtlasClient(
      `processor-${processorIp}`,
      { ipAddress: processorIp, tcpPort: 5321, timeout: 5000 }
    )

    const names: string[] = []
    const muteStates: boolean[] = []

    // Fetch all zone names and mute states in parallel
    const promises = []
    for (let i = 0; i < 8; i++) {
      promises.push(
        client.sendCommand({ method: 'get', param: `ZoneName_${i}`, format: 'str' }).catch(() => null),
        client.sendCommand({ method: 'get', param: `ZoneMute_${i}`, format: 'val' }).catch(() => null)
      )
    }

    const results = await Promise.all(promises)

    for (let i = 0; i < 8; i++) {
      const nameResult = results[i * 2]
      const muteResult = results[i * 2 + 1]

      let name = `Zone ${i + 1}`
      if (nameResult?.result && Array.isArray(nameResult.result)) {
        name = nameResult.result[0]?.str || name
      }
      names.push(name)

      let muted = false
      if (muteResult?.result && Array.isArray(muteResult.result)) {
        muted = muteResult.result[0]?.val === 1
      }
      muteStates.push(muted)
    }

    releaseAtlasClient(processorIp, 5321)

    // Cache the metadata
    zoneMetadataCache.set(processorIp, {
      names,
      muteStates,
      lastFetched: now
    })

    return { names, muteStates }
  } catch (error) {
    logger.error('[METER_STREAM] Error fetching zone metadata:', error)
    // Return defaults on error
    return {
      names: Array.from({ length: 8 }, (_, i) => `Zone ${i + 1}`),
      muteStates: Array(8).fill(false)
    }
  }
}

async function fetchSourceMetadata(processorIp: string, sourceCount: number = 14): Promise<{ names: string[] }> {
  const cached = sourceMetadataCache.get(processorIp)
  const now = Date.now()

  if (cached && (now - cached.lastFetched) < METADATA_CACHE_TTL) {
    return { names: cached.names }
  }

  try {
    const { getAtlasClient, releaseAtlasClient } = await import('@/lib/atlas-client-manager')
    const client = await getAtlasClient(
      `processor-${processorIp}`,
      { ipAddress: processorIp, tcpPort: 5321, timeout: 5000 }
    )

    const names: string[] = []

    // Fetch all source names in parallel
    const promises = []
    for (let i = 0; i < sourceCount; i++) {
      promises.push(
        client.sendCommand({ method: 'get', param: `SourceName_${i}`, format: 'str' }).catch(() => null)
      )
    }

    const results = await Promise.all(promises)

    for (let i = 0; i < sourceCount; i++) {
      const nameResult = results[i]

      let name = `Input ${i + 1}`
      if (nameResult?.result && Array.isArray(nameResult.result)) {
        name = nameResult.result[0]?.str || name
      }
      names.push(name)
    }

    releaseAtlasClient(processorIp, 5321)

    // Cache the metadata
    sourceMetadataCache.set(processorIp, {
      names,
      lastFetched: now
    })

    logger.info(`[METER_STREAM] Fetched source names: ${names.join(', ')}`)
    return { names }
  } catch (error) {
    logger.error('[METER_STREAM] Error fetching source metadata:', error)
    // Return defaults on error
    return {
      names: Array.from({ length: sourceCount }, (_, i) => `Input ${i + 1}`)
    }
  }
}

// Force dynamic rendering for SSE
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const processorIp = searchParams.get('processorIp')

  if (!processorIp) {
    return new Response('Processor IP is required', { status: 400 })
  }

  logger.info(`[METER_STREAM] SSE connection opened for ${processorIp}`)

  // Ensure we're subscribed to meters
  if (!atlasMeterManager.isSubscribed(processorIp)) {
    logger.info(`[METER_STREAM] Subscribing to meters for ${processorIp}...`)
    try {
      await atlasMeterManager.subscribeToMeters(
        `processor-${processorIp}`,
        processorIp,
        14, // input count
        8,  // output count
        8   // group count
      )
    } catch (error) {
      logger.error(`[METER_STREAM] Failed to subscribe to meters:`, error)
    }
  }

  // Pre-fetch zone metadata
  let zoneNames: string[] = []
  let muteStates: boolean[] = []
  try {
    const metadata = await fetchZoneMetadata(processorIp)
    zoneNames = metadata.names
    muteStates = metadata.muteStates
  } catch (error) {
    logger.error(`[METER_STREAM] Failed to fetch zone metadata:`, error)
    zoneNames = Array.from({ length: 8 }, (_, i) => `Zone ${i + 1}`)
    muteStates = Array(8).fill(false)
  }

  // Pre-fetch source/input metadata
  let sourceNames: string[] = []
  try {
    const sourceMetadata = await fetchSourceMetadata(processorIp, 14)
    sourceNames = sourceMetadata.names
  } catch (error) {
    logger.error(`[METER_STREAM] Failed to fetch source metadata:`, error)
    sourceNames = Array.from({ length: 14 }, (_, i) => `Input ${i + 1}`)
  }

  // Create a TransformStream for SSE - more reliable than ReadableStream
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let isConnected = true
      let updateCount = 0

      // Send initial connection message
      controller.enqueue(encoder.encode(`event: connected\ndata: {"processorIp":"${processorIp}"}\n\n`))

      // Send meter updates at 100ms intervals (10 FPS - more reliable)
      const intervalId = setInterval(() => {
        if (!isConnected) {
          clearInterval(intervalId)
          return
        }

        try {
          // Get cached meter values (instant - no network call)
          const outputMeters = atlasMeterManager.getOutputMeters(processorIp, 8)
          const inputMeters = atlasMeterManager.getInputMeters(processorIp, 14)
          const groupMeters = atlasMeterManager.getGroupMeters(processorIp, 8)

          // Enrich with zone names (from cache)
          const enrichedOutputMeters = outputMeters.map((meter, i) => ({
            ...meter,
            name: zoneNames[i] || meter.name,
            muted: muteStates[i] || false
          }))

          // Enrich with source names (from cache)
          const enrichedInputMeters = inputMeters.map((meter, i) => ({
            ...meter,
            name: sourceNames[i] || meter.name
          }))

          const data = JSON.stringify({
            timestamp: Date.now(),
            outputs: enrichedOutputMeters,
            inputs: enrichedInputMeters,
            groups: groupMeters
          })

          controller.enqueue(encoder.encode(`event: meters\ndata: ${data}\n\n`))
          updateCount++

          // Log every 100 updates (every 10 seconds at 10 FPS)
          if (updateCount % 100 === 0) {
            logger.debug(`[METER_STREAM] Sent ${updateCount} updates to ${processorIp}`)
          }
        } catch (error: any) {
          // Check if the stream was closed
          if (error.code === 'ERR_INVALID_STATE' || error.message?.includes('Controller is already closed')) {
            isConnected = false
            clearInterval(intervalId)
            logger.info(`[METER_STREAM] Stream closed for ${processorIp}`)
          } else {
            logger.error('[METER_STREAM] Error sending meter update:', error)
          }
        }
      }, 100) // 100ms = 10 updates per second (more reliable)

      // Handle abort signal from client disconnect
      request.signal.addEventListener('abort', () => {
        isConnected = false
        clearInterval(intervalId)
        logger.info(`[METER_STREAM] Client disconnected from ${processorIp}`)
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
