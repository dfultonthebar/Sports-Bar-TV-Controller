import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyIngest } from '@/lib/ingest'
import { insertErrors } from '@/lib/repo'
import type { ErrorsPayload } from '@sports-bar/hub-agent/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const v = await verifyIngest(req, 'errors')
  if (!v.ok) return v.res
  const payload = v.env.payload as ErrorsPayload
  const inserted = insertErrors(v.locId, payload.events || [])
  return NextResponse.json({ ok: true, inserted })
}
