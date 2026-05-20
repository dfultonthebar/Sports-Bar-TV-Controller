/**
 * Ticketmaster Discovery API scraper (v2.53.1+, task #161)
 *
 * Second neighborhood-events source after Bananas. Covers big venues
 * Bananas doesn't index — Lambeau Field, Resch Center, Brown County
 * Arena, KI Convention Center, Meyer Theatre, Weidner Center.
 *
 * Free tier: 5 calls/sec, 5000/day. We use ~4 calls/day so we are way
 * under quota.
 *
 * Default OFF: if TICKETMASTER_API_KEY env is unset, scrape returns []
 * and logs an info-level "Ticketmaster disabled" line. Locations
 * without a key continue using Bananas-only.
 */

import { logger } from '@sports-bar/logger'

export interface TicketmasterParsedEvent {
  externalId: string          // 'tm-{event.id}' — the Ticketmaster event ID, stable
  name: string                // event name verbatim ('Green Bay Packers vs Chicago Bears' or 'Tyler Childers')
  artistName: string          // best-effort: event name for now
  startTimeUnix: number       // unix seconds (UTC)
  endTimeUnix: number | null
  venueName: string
  venueLat: number
  venueLng: number
  venueCity: string | null
  venueState: string | null
  eventType: 'concert' | 'sports' | 'other'
  segment: string             // raw 'Music' | 'Sports' | etc
  genre: string | null
  sourceUrl: string
  rawPayload: any
}

const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json'

export interface TicketmasterFetchOptions {
  latlong: string           // 'lat,lng'
  radiusMiles: number       // default 30
  lookaheadDays: number     // default 14
  maxPages?: number         // safety cap, default 3 (most queries return 1 page)
}

export async function fetchTicketmasterEvents(
  opts: TicketmasterFetchOptions,
): Promise<TicketmasterParsedEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY
  if (!apiKey) {
    logger.info(
      '[TM-SCRAPER] TICKETMASTER_API_KEY not set — Ticketmaster scraper disabled (Bananas-only mode)',
    )
    return []
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + opts.lookaheadDays * 24 * 60 * 60 * 1000)

  // Ticketmaster wants ISO-8601 to second precision, no millis, with Z suffix
  const startDateTime = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const endDateTime = horizon.toISOString().replace(/\.\d{3}Z$/, 'Z')

  const params = new URLSearchParams({
    apikey: apiKey,
    latlong: opts.latlong,
    radius: String(opts.radiusMiles),
    unit: 'miles',
    startDateTime,
    endDateTime,
    size: '200',
    sort: 'date,asc',
  })

  const maxPages = opts.maxPages ?? 3
  const all: TicketmasterParsedEvent[] = []
  let page = 0
  while (page < maxPages) {
    params.set('page', String(page))
    const url = `${TICKETMASTER_BASE_URL}?${params.toString()}`

    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { 'User-Agent': 'Sports-Bar-TV-Controller/2.53.1' },
      })

      if (!resp.ok) {
        // Redact the apikey query param before logging the URL — it
        // ends up in PM2 logs + enhanced-logger DB rows that
        // System Admin can view. Never echo the secret.
        const redactedUrl = url.replace(/apikey=[^&]+/, 'apikey=REDACTED')
        if (resp.status === 429) {
          logger.warn('[TM-SCRAPER] Rate-limited by Ticketmaster (HTTP 429)', {
            data: { reset: resp.headers.get('Rate-Limit-Reset') },
          })
        } else if (resp.status === 401 || resp.status === 403) {
          logger.warn('[TM-SCRAPER] Auth failed — check TICKETMASTER_API_KEY', {
            data: { status: resp.status },
          })
        } else if (resp.status >= 500) {
          // 5xx is a Ticketmaster-side failure — log at error level so
          // operators distinguish "API down" from "calendar empty".
          logger.error('[TM-SCRAPER] Ticketmaster server error', {
            data: { status: resp.status, url: redactedUrl },
          })
        } else {
          logger.warn('[TM-SCRAPER] Non-OK response', {
            data: { status: resp.status, url: redactedUrl },
          })
        }
        break
      }

      const json: any = await resp.json()
      const events = json?._embedded?.events ?? []
      if (events.length === 0) break

      for (const ev of events) {
        const parsed = parseTicketmasterEvent(ev)
        if (parsed) all.push(parsed)
      }

      // Pagination — Ticketmaster page.totalPages, 0-indexed
      const totalPages: number = json?.page?.totalPages ?? 1
      if (page >= totalPages - 1) break
      page++

      // Stay under 5/sec — sleep 250ms between pages
      await new Promise((r) => setTimeout(r, 250))
    } catch (e: any) {
      logger.warn('[TM-SCRAPER] Fetch error', { data: { error: e?.message ?? String(e) } })
      break
    }
  }

  logger.info(`[TM-SCRAPER] Fetched ${all.length} events across ${page + 1} page(s)`)
  return all
}

function parseTicketmasterEvent(ev: any): TicketmasterParsedEvent | null {
  const id = ev?.id
  const name = ev?.name
  const startIso: string | undefined = ev?.dates?.start?.dateTime
  const venue = ev?._embedded?.venues?.[0]
  const lat = venue?.location?.latitude
  const lng = venue?.location?.longitude

  // Skip events with no venue location — can't compute distance, can't seed
  if (!id || !name || !startIso || !venue?.name || lat == null || lng == null) {
    return null
  }

  // parseFloat tolerates "abc" → NaN. Guard explicitly so a malformed
  // venue location can't poison haversine + DB rows downstream.
  const venueLat = parseFloat(String(lat))
  const venueLng = parseFloat(String(lng))
  if (!Number.isFinite(venueLat) || !Number.isFinite(venueLng)) return null

  const startTimeUnix = Math.floor(new Date(startIso).getTime() / 1000)
  if (!Number.isFinite(startTimeUnix)) return null

  const endIso: string | undefined = ev?.dates?.end?.dateTime
  const endTimeUnix = endIso ? Math.floor(new Date(endIso).getTime() / 1000) : null

  const segment: string = ev?.classifications?.[0]?.segment?.name ?? 'Unknown'
  const genre: string | null = ev?.classifications?.[0]?.genre?.name ?? null

  let eventType: 'concert' | 'sports' | 'other'
  if (segment === 'Music' || segment === 'Arts & Theatre') {
    eventType = 'concert'
  } else if (segment === 'Sports') {
    eventType = 'sports'
  } else {
    eventType = 'other'
  }

  // Slim down what we persist. The full Ticketmaster event is 5-10KB
  // (images[], priceRanges, _links, products[]). We only ever query
  // by structured columns, never re-read rawPayload — but neighborhood_events
  // has no TTL so 4 sweeps/day × 20 events × 5KB × 365 ≈ 150MB/year/box.
  // Keep just the bits useful for operator debugging: id, dateTime,
  // classifications, venue summary.
  const rawPayload = {
    id: ev?.id,
    name: ev?.name,
    dates: ev?.dates,
    classifications: ev?.classifications,
    url: ev?.url,
    venue: venue ? {
      name: venue.name,
      city: venue?.city?.name,
      state: venue?.state?.stateCode,
      location: venue?.location,
    } : undefined,
  }

  return {
    externalId: `tm-${id}`,
    name,
    artistName: name, // events at Lambeau like "Packers vs Bears" stay verbatim
    startTimeUnix,
    endTimeUnix,
    venueName: String(venue.name),
    venueLat,
    venueLng,
    venueCity: venue?.city?.name ?? null,
    venueState: venue?.state?.stateCode ?? null,
    eventType,
    segment,
    genre,
    sourceUrl: ev?.url ?? '',
    rawPayload,
  }
}
