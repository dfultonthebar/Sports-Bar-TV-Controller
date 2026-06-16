/** Shared ingest gate: verify HMAC + freshness + known location, parse the envelope. */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyPayload, timestampFresh } from '@sports-bar/hub-agent/hmac'
import {
  SIG_HEADER,
  LOCATION_HEADER,
  TIMESTAMP_HEADER,
  type IngestEnvelope,
  type IngestKind,
} from '@sports-bar/hub-agent/types'
import { getLocation, touchLocation } from './repo'

type VerifyOk = { ok: true; env: IngestEnvelope; locId: string }
type VerifyErr = { ok: false; res: NextResponse }

export async function verifyIngest(
  req: NextRequest,
  expectedKind: IngestKind,
): Promise<VerifyOk | VerifyErr> {
  const body = await req.text() // raw body — needed for the signature
  const sig = req.headers.get(SIG_HEADER) || ''
  const locId = req.headers.get(LOCATION_HEADER) || ''
  const ts = Number(req.headers.get(TIMESTAMP_HEADER) || 0)

  if (!locId || !sig || !ts) {
    return { ok: false, res: NextResponse.json({ error: 'missing auth headers' }, { status: 400 }) }
  }
  if (!timestampFresh(ts, Date.now())) {
    return { ok: false, res: NextResponse.json({ error: 'stale timestamp' }, { status: 401 }) }
  }
  const loc = getLocation(locId)
  if (!loc || !loc.isActive) {
    return { ok: false, res: NextResponse.json({ error: 'unknown or inactive location' }, { status: 401 }) }
  }
  if (!verifyPayload(loc.hmacSecret, ts, body, sig)) {
    return { ok: false, res: NextResponse.json({ error: 'bad signature' }, { status: 401 }) }
  }

  let env: IngestEnvelope
  try {
    env = JSON.parse(body)
  } catch {
    return { ok: false, res: NextResponse.json({ error: 'bad json' }, { status: 400 }) }
  }
  if (env.kind !== expectedKind || env.locationId !== locId) {
    return { ok: false, res: NextResponse.json({ error: 'kind/location mismatch' }, { status: 400 }) }
  }

  touchLocation(locId, env.sentAt || Date.now())
  return { ok: true, env, locId }
}
