/**
 * Guard helper for Atlas API endpoints.
 *
 * Some locations don't have Atlas hardware at all (Lucky's 1313 uses dbx
 * ZonePRO, others use BSS London) but still have an AudioProcessor row
 * registered at a similar IP. If an Atlas endpoint is hit for one of
 * those IPs, the atlas-client-manager opens a TCP client that retries
 * forever, spamming the error log with hundreds of reconnect errors per
 * minute. This helper looks up the processor by IP and confirms it's
 * actually registered as `processorType='atlas'` before the caller
 * proceeds. Returns null when the guard passes; returns a Response when
 * the caller should short-circuit and return it.
 */

import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { and, eq } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'

export async function requireAtlasProcessor(
  processorIp: string | null | undefined,
  endpointTag: string
): Promise<Response | null> {
  if (!processorIp) return null // caller already validated required IPs

  const rows = await db.select({ id: schema.audioProcessors.id })
    .from(schema.audioProcessors)
    .where(and(
      eq(schema.audioProcessors.ipAddress, processorIp),
      eq(schema.audioProcessors.processorType, 'atlas'),
    ))
    .all()

  if (rows.length === 0) {
    logger.warn(`[${endpointTag}] refused — no atlas-type AudioProcessor at ${processorIp}`)
    return NextResponse.json(
      { success: false, error: 'No Atlas processor configured at this IP' },
      { status: 404 }
    )
  }
  return null
}
