import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { verifyIngest } from '@/lib/ingest'
import { insertMetrics } from '@/lib/repo'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const v = await verifyIngest(req, 'metrics')
  if (!v.ok) return v.res
  insertMetrics(v.locId, v.env.sentAt, v.env.payload as any)
  return NextResponse.json({ ok: true })
}
