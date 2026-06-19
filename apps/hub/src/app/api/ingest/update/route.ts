import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyIngest } from '@/lib/ingest'
import { insertFleetUpdate } from '@/lib/repo'
import type { UpdatePayload } from '@sports-bar/hub-agent/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const v = await verifyIngest(req, 'update')
  if (!v.ok) return v.res
  const payload = v.env.payload as UpdatePayload
  const inserted = insertFleetUpdate(v.locId, payload.events || [])
  return NextResponse.json({ ok: true, inserted })
}
