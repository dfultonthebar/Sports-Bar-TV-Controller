import { logger } from '@sports-bar/logger'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

/**
 * NFHS Network page scraper.
 *
 * NFHS Network has no public API (see docs/NFHS_API_INTEGRATION.md). We fall
 * back to parsing the `__NUXT_DATA__` JSON blob embedded in each school's page
 * at `nfhsnetwork.com/schools/<slug>`. That blob is Nuxt 3's ref-based
 * compression — every nested field is an integer index into the outer array,
 * so we walk it with a `deref` helper.
 *
 * Fragile to NFHS frontend updates. Each successful/failed sync is recorded on
 * the `NFHSSchool` row so operators can see which school configs are stale.
 */

interface NuxtEvent {
  key: string
  site_url: string
  date: string
  city?: string | null
  state?: string | null
  publisher?: string | null
  publisher_short_name?: string | null
  headline?: string | null
  subheadline?: string | null
  first_title?: string | null
  second_title?: string | null
  content_type?: string | null
  level?: string | null
  gender?: string | null
  activity_or_sport?: string | null
  duration?: number | null
  progress?: unknown
}

function deref(arr: unknown[], v: unknown, seen = new Set<number>(), depth = 0): unknown {
  if (depth > 8) return v
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < arr.length) {
    if (seen.has(v)) return null
    seen.add(v)
    const resolved = deref(arr, arr[v], seen, depth + 1)
    seen.delete(v)
    return resolved
  }
  if (Array.isArray(v)) return v.map(x => deref(arr, x, seen, depth + 1))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) {
      out[k] = deref(arr, val, seen, depth + 1)
    }
    return out
  }
  return v
}

function extractEvents(nuxtArr: unknown[]): NuxtEvent[] {
  const events: NuxtEvent[] = []
  const seenKeys = new Set<string>()
  for (const entry of nuxtArr) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const obj = entry as Record<string, unknown>
    if (!('key' in obj)) continue
    // Resolve the key field — it may be an int ref or a string
    const keyVal = typeof obj.key === 'number' ? nuxtArr[obj.key] : obj.key
    if (typeof keyVal !== 'string' || !/^gam[a-f0-9]{6,}$/.test(keyVal)) continue
    if (seenKeys.has(keyVal)) continue
    const resolved = deref(nuxtArr, entry) as NuxtEvent
    if (!resolved?.key || typeof resolved.key !== 'string') continue
    seenKeys.add(resolved.key)
    events.push(resolved)
  }
  return events
}

/** Parse sport/level/gender out of headline + subheadline when sub-fields are missing. */
function inferSportFromHeadline(headline: string | null | undefined, subheadline: string | null | undefined): {
  sport: string
  level: string
  gender: string
} {
  const text = `${headline || ''} ${subheadline || ''}`
  const lower = text.toLowerCase()
  const sportMap = ['basketball', 'football', 'baseball', 'softball', 'hockey', 'soccer', 'lacrosse', 'wrestling', 'volleyball', 'tennis', 'track', 'swimming', 'golf', 'gymnastics']
  const sport = sportMap.find(s => lower.includes(s)) || 'Unknown'
  const gender = lower.includes('girls') ? 'Girls' : lower.includes('boys') || lower.includes('mens') ? 'Boys' : ''
  const level = lower.includes('varsity') ? 'Varsity' : lower.includes('junior varsity') || /\bjv\b/.test(lower) ? 'JV' : 'Varsity'
  return { sport: sport.charAt(0).toUpperCase() + sport.slice(1), level, gender }
}

export interface SchoolSyncResult {
  slug: string
  gamesAdded: number
  gamesUpdated: number
  skipped: number
  error?: string
}

export async function syncSchool(slug: string): Promise<SchoolSyncResult> {
  const result: SchoolSyncResult = { slug, gamesAdded: 0, gamesUpdated: 0, skipped: 0 }
  try {
    const res = await fetch(`https://www.nfhsnetwork.com/schools/${slug}`, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (!res.ok) {
      result.error = `HTTP ${res.status}`
      return result
    }
    const html = await res.text()
    // NFHS's script tag has attributes in non-predictable order (type first,
    // then data-*, then id) so we just anchor on id="__NUXT_DATA__" and don't
    // assert type attribute order.
    const m = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]+?)<\/script>/i)
    if (!m) {
      result.error = 'No __NUXT_DATA__ block found'
      return result
    }
    let nuxtArr: unknown[]
    try {
      nuxtArr = JSON.parse(m[1])
      if (!Array.isArray(nuxtArr)) throw new Error('not an array')
    } catch (err: any) {
      result.error = `Nuxt JSON parse failed: ${err.message}`
      return result
    }

    const events = extractEvents(nuxtArr)
    const now = new Date()
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    for (const ev of events) {
      // Only upcoming events (not past game recaps / highlights)
      if (ev.content_type !== 'game') { result.skipped++; continue }
      const evDate = ev.date ? new Date(ev.date) : null
      if (!evDate || isNaN(evDate.getTime())) { result.skipped++; continue }
      // Skip games more than 2 hours in the past, or more than 7 days out
      if (evDate.getTime() < now.getTime() - 2 * 60 * 60 * 1000) { result.skipped++; continue }
      if (evDate.getTime() > sevenDaysOut.getTime()) { result.skipped++; continue }

      const inferred = inferSportFromHeadline(ev.headline, ev.subheadline)
      const sport = ev.activity_or_sport || inferred.sport
      const level = ev.level || inferred.level
      const gender = ev.gender || inferred.gender
      const sportLabel = gender ? `${level} ${gender} ${sport}`.trim() : `${level} ${sport}`.trim()

      const homeTeam = ev.first_title || ev.publisher_short_name || ev.headline || 'Home'
      const awayTeam = ev.second_title || (ev.subheadline || '').split(/\s+vs\.?\s+/i)[1] || null
      const location = [ev.city, ev.state].filter(Boolean).join(', ')
      const time = evDate.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Chicago',
      })
      const dateStr = evDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
      })

      const record = {
        id: ev.key,
        schoolSlug: slug,
        sport: sportLabel,
        level,
        homeTeam,
        awayTeam,
        opponent: awayTeam,
        date: dateStr,
        time,
        dateTime: evDate.toISOString(),
        location,
        status: 'upcoming' as const,
        eventUrl: ev.site_url,
        updatedAt: new Date().toISOString(),
      }

      const existing = await db.select().from(schema.nfhsGames)
        .where(eq(schema.nfhsGames.id, ev.key)).get()
      if (existing) {
        await db.update(schema.nfhsGames).set(record).where(eq(schema.nfhsGames.id, ev.key))
        result.gamesUpdated++
      } else {
        await db.insert(schema.nfhsGames).values({ ...record, createdAt: new Date().toISOString() })
        result.gamesAdded++
      }
    }
  } catch (err: any) {
    result.error = err.message
  }
  return result
}

export async function syncAllActiveSchools(): Promise<SchoolSyncResult[]> {
  const schools = await db.select().from(schema.nfhsSchools)
    .where(eq(schema.nfhsSchools.isActive, true)).all()

  logger.info(`[NFHS SYNC] Syncing ${schools.length} active schools`)
  const results: SchoolSyncResult[] = []

  for (const school of schools) {
    const r = await syncSchool(school.slug)
    results.push(r)
    await db.update(schema.nfhsSchools).set({
      lastSyncedAt: new Date().toISOString(),
      lastSyncedGames: r.gamesAdded + r.gamesUpdated,
      lastSyncError: r.error || null,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.nfhsSchools.id, school.id))
    logger.info(
      `[NFHS SYNC] ${school.name} (${school.slug}): +${r.gamesAdded} new, ~${r.gamesUpdated} updated, ${r.skipped} skipped${r.error ? `, error: ${r.error}` : ''}`
    )
  }

  return results
}
