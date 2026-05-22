/**
 * Operator CLI for triaging pending_review NeighborhoodVenue rows
 * (v2.53.4 / task #182).
 *
 * Reads venues from the local DB, prints a numbered list, then asks
 * for an action per row: approve / decline / skip / merge / quit.
 *
 * Usage:
 *   npx tsx apps/web/scripts/review-pending-venues.ts
 *   npx tsx apps/web/scripts/review-pending-venues.ts --source=ticketmaster
 *
 * Behind the scenes this calls the same API endpoints
 * (POST /api/admin/venues/[id]/review) the future admin UI will use,
 * so the operator can start cleaning up the queue today.
 */

import readline from 'readline'

const API_BASE = process.env.SHIFT_BRIEF_BASE_URL || 'http://localhost:3001'

interface PendingVenue {
  id: string
  name: string
  category: string
  distanceMi: number | null
  discoverySource: string
  createdAt: number
  eventCount: number
  latestEvent: { name: string; startTime: number } | null
}

async function fetchPending(source?: string): Promise<PendingVenue[]> {
  const url = new URL('/api/admin/venues/pending', API_BASE)
  if (source) url.searchParams.set('source', source)
  url.searchParams.set('limit', '500')
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const data: any = await resp.json()
  if (!data.success) throw new Error(data.error || 'Unknown API error')
  return data.venues as PendingVenue[]
}

async function postAction(
  id: string,
  body: { action: 'approve' } | { action: 'decline' } | { action: 'merge'; targetVenueId: string },
): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/admin/venues/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data: any = await resp.json()
  if (!data.success) throw new Error(data.error || `HTTP ${resp.status}`)
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

async function main() {
  const args = process.argv.slice(2)
  const sourceArg = args.find((a) => a.startsWith('--source='))?.split('=')[1]

  console.log('\nFetching pending venues...')
  const venues = await fetchPending(sourceArg)
  if (venues.length === 0) {
    console.log('Nothing to review. Queue is clean.')
    return
  }

  console.log(`\nFound ${venues.length} pending venues:\n`)
  for (let i = 0; i < venues.length; i++) {
    const v = venues[i]
    const dist = v.distanceMi != null ? `${v.distanceMi.toFixed(1)} mi` : '? mi'
    const ev = v.latestEvent
      ? `${v.eventCount} events, latest: ${v.latestEvent.name}`
      : `${v.eventCount} events`
    console.log(`  [${i + 1}] ${v.name.padEnd(40)} | ${v.category.padEnd(13)} | ${dist.padStart(7)} | ${v.discoverySource.padEnd(14)} | ${ev}`)
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  console.log('\nFor each venue:')
  console.log('  a = approve  d = decline (deactivate)  s = skip  m <num> = merge into venue #num  q = quit')

  let approved = 0
  let declined = 0
  let merged = 0
  let skipped = 0

  try {
    for (let i = 0; i < venues.length; i++) {
      const v = venues[i]
      const answer = (await prompt(rl, `\n[${i + 1}/${venues.length}] ${v.name}? `)).trim().toLowerCase()
      if (answer === 'q') break
      if (answer === '' || answer === 's') {
        skipped++
        continue
      }
      if (answer === 'a') {
        try {
          await postAction(v.id, { action: 'approve' })
          approved++
          console.log('  ✓ approved')
        } catch (e: any) {
          console.error('  ! approve failed:', e?.message ?? e)
        }
        continue
      }
      if (answer === 'd') {
        try {
          await postAction(v.id, { action: 'decline' })
          declined++
          console.log('  ✓ declined (deactivated)')
        } catch (e: any) {
          console.error('  ! decline failed:', e?.message ?? e)
        }
        continue
      }
      const mergeMatch = answer.match(/^m\s+(\d+)$/)
      if (mergeMatch) {
        const targetNum = parseInt(mergeMatch[1], 10)
        const target = venues[targetNum - 1]
        if (!target) {
          console.log(`  ! no venue at index ${targetNum}`)
          continue
        }
        if (target.id === v.id) {
          console.log("  ! can't merge into itself")
          continue
        }
        try {
          const ok = (await prompt(rl, `  Merge "${v.name}" → "${target.name}"? [y/N] `)).trim().toLowerCase()
          if (ok !== 'y') { console.log('  cancelled'); continue }
          await postAction(v.id, { action: 'merge', targetVenueId: target.id })
          merged++
          console.log(`  ✓ merged into "${target.name}"`)
        } catch (e: any) {
          console.error('  ! merge failed:', e?.message ?? e)
        }
        continue
      }
      console.log("  ? didn't understand, skipping")
      skipped++
    }
  } finally {
    rl.close()
  }

  console.log(`\nDone. approved=${approved} declined=${declined} merged=${merged} skipped=${skipped}`)
}

main().catch((e) => {
  console.error('FAIL:', e?.message ?? e)
  process.exit(1)
})
