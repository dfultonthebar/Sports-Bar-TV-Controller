/**
 * Bananas Entertainment Scraper (v2.51.0+)
 *
 * Source: https://www.bananasentertainment.com/events/schedule
 *
 * Bananas Entertainment is a regional Green Bay-area DJ/band booking agency.
 * Their public schedule page lists which artists play at which venues on
 * which nights. We ingest this into `neighborhood_events` for the
 * Neighborhood RF Interference Prediction subsystem — the SAME artist
 * appearing at MULTIPLE venues gives us statistical confidence about that
 * artist's interference signature faster than per-venue scraping alone.
 *
 * Strategy:
 *   1. cheerio-first — try a handful of common selectors / Schema.org JSON-LD
 *      blobs that event-calendar plugins typically emit.
 *   2. Ollama-fallback — if cheerio finds nothing, pipe the HTML body into
 *      llama3.1:8b with a strict-JSON prompt and let the LLM extract the
 *      event list. We keep the model + temperature pinned so the same HTML
 *      yields the same parse (deterministic-ish, given Ollama's seed behavior).
 *   3. Empty-fallback — return [] with a logged warning if BOTH paths fail,
 *      so the ingestion pipeline upstream still completes its cycle.
 *
 * This module ONLY returns parsed events; it does NOT write to the database.
 * That's the ingestion layer's job (`@sports-bar/scheduler/bananas-ingestion`).
 */

import * as cheerio from 'cheerio'
import { logger } from '@sports-bar/logger'

const BANANAS_URL = 'https://www.bananasentertainment.com/events/schedule'
// JSON API used by Bananas's own SPA — discovered 2026-05-19 by tracing
// fetch calls in their app bundle. The public /events/schedule page is a
// client-side SPA that renders a spinner server-side and pulls the actual
// event list from this endpoint after page load. Hitting the JSON
// directly is faster, structured, and avoids LLM HTML-parsing entirely.
// If the funct=EVENTS endpoint ever changes, we fall back to scraping the
// SPA HTML (which will normally be empty, but at least won't crash).
const BANANAS_JSON_URL = 'https://www.bananasentertainment.com/be/ajax.php?funct=EVENTS'
const USER_AGENT = 'Mozilla/5.0 (compatible; sports-bar-tv-controller/2.51.0)'
const FETCH_TIMEOUT_MS = 15000

// Ollama for HTML→JSON fallback. Default model + URL match the rest of the
// stack (chat route, RAG server). Override via env if a faster/dumber model
// is preferred for batch scraping.
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.BANANAS_OLLAMA_MODEL || process.env.OLLAMA_MODEL || 'llama3.1:8b'
const OLLAMA_TIMEOUT_MS = 60000

export interface BananasParsedEvent {
  /** Raw artist string as it appeared on the page, e.g. "DJ Marco" */
  artist: string
  /** Normalized lowercase form for joining (`dj marco` → `marco` after prefix strip) */
  artistNormalized: string
  /** Raw venue name as it appeared on the page, e.g. "Stoneyard Greenville" */
  venue: string
  /** Event start (ISO 8601). Best-effort — defaults to 21:00 local if the page only gave a date. */
  startTimeISO: string
  /** Event end (ISO 8601), nullable when page omits it. */
  endTimeISO: string | null
  /** 'dj' | 'band' | 'karaoke' | 'trivia' | 'other' */
  eventType: string
  /** Source page URL for provenance */
  sourceUrl: string
  /** Raw extracted source row (for raw_payload column / debugging) */
  raw: Record<string, unknown>
}

/**
 * Normalize an artist string for joining across sources.
 *
 *   "DJ Marco"        → "marco"
 *   "  DJ   marco  "  → "marco"
 *   "The Cover Band"  → "the cover band"
 *
 * We strip common stage-name prefixes ("DJ ", "Dj ", "MC ") so the same act
 * appearing as `DJ Marco` on Bananas and `Marco` on a venue site matches.
 * Keeps multi-word + non-prefix artist names untouched (lowercased, trimmed).
 */
export function normalizeArtistName(name: string): string {
  let n = name.trim().toLowerCase()
  n = n.replace(/\s+/g, ' ')
  // Strip leading DJ / MC / DJ. / MC. prefix(es).
  // "dj marco" → "marco". Use a loop for double-prefixed names like "dj mc marco".
  while (true) {
    const m = n.match(/^(dj|mc)\.?\s+(.+)/)
    if (!m) break
    n = m[2]
  }
  return n.trim()
}

/**
 * Infer event type from artist string. Cheap heuristic — the LLM fallback
 * sets this directly when it can.
 */
function inferEventType(artist: string): string {
  const a = artist.toLowerCase()
  if (a.startsWith('dj ') || a === 'dj' || a.includes(' dj ')) return 'dj'
  if (a.includes('karaoke')) return 'karaoke'
  if (a.includes('trivia')) return 'trivia'
  if (a.includes('band') || a.includes('quartet') || a.includes('trio')) return 'band'
  return 'other'
}

/**
 * Parse a fuzzy date/time string into ISO 8601 using JS Date as the parser.
 * Returns null when unparseable.
 *
 * If only a date is given (no time component), defaults the start to 21:00
 * America/Chicago (typical bar/DJ gig start). This matters because the
 * correlation engine joins on `start_time ± window` and a 00:00 default
 * would never line up with real evening RF interference events.
 */
function parseDateTimeFlexible(raw: string, fallbackHour = 21): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Direct ISO 8601 (handles `2026-05-30T21:00:00-05:00`, etc.)
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString()
  }
  // "May 30, 2026" / "5/30/2026" with no time → assume fallbackHour Central
  const dateOnly = trimmed.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]+ \d{1,2},?\s+\d{4})$/)
  if (dateOnly) {
    const d = new Date(`${trimmed} ${fallbackHour}:00:00`)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return null
}

/**
 * Bananas's ajax.php?funct=EVENTS row shape (as of 2026-05-19). Keys are
 * UPPER_SNAKE / mixed-case as the PHP API emits them. Document everything
 * we touch + use a flexible `Record` index so unknown keys don't break.
 */
interface BananasJsonRow {
  ArtistName?: string
  JD?: string                  // "2026-05-20" — start date in venue-local time
  JobDate?: string             // "WEDNESDAY MAY 20" — display only
  JobPlace?: string            // Venue name as shown
  JobCity?: string             // City uppercase
  StartTime?: string           // "06:00 PM" — display, venue-local
  EndTime?: string             // "09:00 PM" — display, venue-local
  Job_Number?: string          // Stable agency-side job ID — perfect source_event_id
  Lat?: string
  Lon?: string
  Act_Genres?: string          // JSON-encoded array as a string
  Venue_Name?: string          // "THE ANNEX AT FOXTOWN & ELEVENS LOUNGE IN MEQUON, WI"
  City_Name?: string           // "MEQUON, WI"
  EventStartUTC?: string       // ISO 8601 in Z — canonical start
  [k: string]: unknown
}

/**
 * Map Bananas's Act_Genres array into our event_type taxonomy.
 *
 *   ["dj"]                            → 'dj'
 *   ["karaoke"]                       → 'karaoke'
 *   ["rock", "country"]               → 'band'
 *   anything else with band-y genres  → 'band'
 *   nothing matched                   → 'other'
 *
 * Bananas only books live music + DJs (no trivia), so we keep the mapping
 * narrow. If a row tagged "trivia" ever appears we'll fall through to
 * `inferEventType` which has the keyword scan.
 */
function eventTypeFromGenres(genresRaw: string | undefined, artist: string): string {
  if (!genresRaw) return inferEventType(artist)
  let genres: string[]
  try {
    const parsed = JSON.parse(genresRaw)
    genres = Array.isArray(parsed) ? parsed.map((g) => String(g).toLowerCase()) : []
  } catch {
    return inferEventType(artist)
  }
  if (genres.includes('dj')) return 'dj'
  if (genres.includes('karaoke')) return 'karaoke'
  // Bananas tags every musical act with genre strings like "rock", "pop",
  // "country", "variety". Any non-empty genre set that isn't dj/karaoke is
  // a live band by their own definition.
  if (genres.length > 0) return 'band'
  return inferEventType(artist)
}

/**
 * Strip the trailing " IN CITY, ST" suffix that Bananas appends to the
 * Venue_Name field. The JobPlace field is the clean venue name in most
 * rows, but it occasionally repeats the city — we prefer JobPlace and
 * fall back to a cleaned Venue_Name.
 */
function cleanVenueName(jobPlace: string | undefined, venueName: string | undefined): string {
  if (jobPlace && jobPlace.trim()) return jobPlace.trim()
  if (!venueName) return ''
  // "THE ANNEX AT FOXTOWN & ELEVENS LOUNGE IN MEQUON, WI" → "THE ANNEX AT FOXTOWN & ELEVENS LOUNGE"
  return venueName.replace(/\s+IN\s+[A-Z\s,]+$/i, '').trim()
}

/**
 * Fetch + parse Bananas's internal JSON API.
 *
 * Returns null on network/parse failure so the caller can fall back to
 * HTML scraping; returns [] when the API responded fine but had no rows.
 */
async function fetchFromJsonApi(): Promise<BananasParsedEvent[] | null> {
  logger.info(`[BANANAS-SCRAPE] Fetching JSON API ${BANANAS_JSON_URL}`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let body: any
  try {
    const resp = await fetch(BANANAS_JSON_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      logger.warn(`[BANANAS-SCRAPE] JSON API returned HTTP ${resp.status} — falling back to HTML scrape`)
      return null
    }
    body = await resp.json()
  } catch (err: any) {
    clearTimeout(timer)
    logger.warn('[BANANAS-SCRAPE] JSON API fetch failed:', err?.message || err)
    return null
  }

  if (!body || body.results !== true || !Array.isArray(body.data)) {
    logger.warn('[BANANAS-SCRAPE] JSON API response shape unexpected — falling back', {
      data: { hasResults: !!body?.results, dataType: typeof body?.data },
    })
    return null
  }

  const out: BananasParsedEvent[] = []
  for (const row of body.data as BananasJsonRow[]) {
    if (!row.ArtistName || !row.EventStartUTC) continue
    const venue = cleanVenueName(row.JobPlace, row.Venue_Name)
    if (!venue) continue

    const start = new Date(row.EventStartUTC)
    if (Number.isNaN(start.getTime())) continue

    // Bananas doesn't always include the event end as UTC, but it gives us
    // StartTime + EndTime in venue-local 12h format. Best-effort compose
    // an end ISO using the date portion of JD and EndTime. Leave it null
    // if either is missing — downstream code defaults to start + 3h.
    let endISO: string | null = null
    if (row.JD && row.EndTime) {
      const endLocal = new Date(`${row.JD} ${row.EndTime}`)
      if (!Number.isNaN(endLocal.getTime())) {
        // Bananas's StartTime+JD matches EventStartUTC modulo timezone, so we
        // can use the offset implied by start to convert end too.
        const startLocal = new Date(`${row.JD} ${row.StartTime || '00:00'}`)
        if (!Number.isNaN(startLocal.getTime())) {
          const offsetMs = start.getTime() - startLocal.getTime()
          endISO = new Date(endLocal.getTime() + offsetMs).toISOString()
        } else {
          endISO = endLocal.toISOString()
        }
      }
    }

    out.push({
      artist: row.ArtistName,
      artistNormalized: normalizeArtistName(row.ArtistName),
      venue,
      startTimeISO: start.toISOString(),
      endTimeISO: endISO,
      eventType: eventTypeFromGenres(row.Act_Genres, row.ArtistName),
      sourceUrl: BANANAS_URL,
      raw: {
        source: 'jsonapi',
        jobNumber: row.Job_Number,
        jobCity: row.JobCity,
        jobPlace: row.JobPlace,
        venueName: row.Venue_Name,
        actGenres: row.Act_Genres,
        lat: row.Lat,
        lon: row.Lon,
      },
    })
  }
  return out
}

/**
 * cheerio-first parsing. Looks for the patterns that event-calendar plugins
 * typically emit:
 *
 *   1. <script type="application/ld+json"> blocks with `@type: Event`
 *      (Schema.org — Squarespace, Wix, WordPress event plugins all do this)
 *   2. Generic `.event` / `[data-event]` / `[itemtype*=Event]` nodes
 *   3. Heuristic: tables/lists with date + venue columns
 *
 * Returns null when nothing parseable was found (caller falls back to LLM).
 */
function parseWithCheerio(html: string): BananasParsedEvent[] | null {
  const $ = cheerio.load(html)
  const out: BananasParsedEvent[] = []

  // (1) Schema.org JSON-LD Event blocks
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const text = $(el).text()
      if (!text) return
      const json = JSON.parse(text)
      const items: any[] = Array.isArray(json) ? json : [json]
      for (const item of items) {
        // Some sites wrap events inside an ItemList
        const candidates: any[] = []
        if (item['@type'] === 'Event' || item.type === 'Event') {
          candidates.push(item)
        } else if (Array.isArray(item.itemListElement)) {
          for (const e of item.itemListElement) {
            const node = e.item || e
            if (node['@type'] === 'Event' || node.type === 'Event') candidates.push(node)
          }
        }
        for (const ev of candidates) {
          const artist: string =
            ev.performer?.name ||
            ev.performer?.[0]?.name ||
            ev.name ||
            ''
          const venue: string =
            ev.location?.name ||
            ev.location?.[0]?.name ||
            ''
          const startRaw: string = ev.startDate || ev.startTime || ''
          const endRaw: string | undefined = ev.endDate || ev.endTime
          if (!artist || !venue || !startRaw) continue

          const startISO = parseDateTimeFlexible(startRaw)
          if (!startISO) continue
          const endISO = endRaw ? parseDateTimeFlexible(endRaw) : null

          out.push({
            artist,
            artistNormalized: normalizeArtistName(artist),
            venue,
            startTimeISO: startISO,
            endTimeISO: endISO,
            eventType: inferEventType(artist),
            sourceUrl: BANANAS_URL,
            raw: { source: 'jsonld', original: ev },
          })
        }
      }
    } catch {
      // Malformed JSON-LD blob — skip it, try the next one.
    }
  })

  // (2) Generic Schema.org microdata nodes
  $('[itemtype*="Event" i]').each((_i, el) => {
    const $el = $(el)
    const artist = $el.find('[itemprop="name"], .performer, .artist').first().text().trim()
    const venue = $el.find('[itemprop="location"] [itemprop="name"], .venue, .location').first().text().trim()
    const startRaw =
      $el.find('[itemprop="startDate"]').attr('content') ||
      $el.find('[itemprop="startDate"]').text().trim() ||
      $el.find('.date, time').first().attr('datetime') ||
      $el.find('.date, time').first().text().trim()
    if (!artist || !venue || !startRaw) return
    const startISO = parseDateTimeFlexible(startRaw)
    if (!startISO) return
    out.push({
      artist,
      artistNormalized: normalizeArtistName(artist),
      venue,
      startTimeISO: startISO,
      endTimeISO: null,
      eventType: inferEventType(artist),
      sourceUrl: BANANAS_URL,
      raw: { source: 'microdata' },
    })
  })

  // (3) Heuristic fallback: rows in a table or grid where the page lays out
  //     "Date | Artist | Venue". This is what a hand-coded Squarespace site
  //     would emit if the operator didn't use a plugin.
  if (out.length === 0) {
    $('tr, .event-row, .schedule-row, li.event, .calendar-item').each((_i, el) => {
      const $el = $(el)
      const cells = $el.find('td, .col, .cell').map((_j, c) => $(c).text().trim()).get()
      // We need at least 3 columns: date, artist, venue.
      if (cells.length < 3) return
      const [dateCell, artistCell, venueCell] = cells
      if (!artistCell || !venueCell) return
      const startISO = parseDateTimeFlexible(dateCell)
      if (!startISO) return
      out.push({
        artist: artistCell,
        artistNormalized: normalizeArtistName(artistCell),
        venue: venueCell,
        startTimeISO: startISO,
        endTimeISO: null,
        eventType: inferEventType(artistCell),
        sourceUrl: BANANAS_URL,
        raw: { source: 'tableheuristic', cells },
      })
    })
  }

  return out.length > 0 ? out : null
}

/**
 * Ollama fallback. Strips the HTML down to text-ish content (cheerio drop
 * scripts/styles) and asks llama3.1:8b for a JSON array of events. We
 * truncate to 12000 chars so we don't blow the context window on big pages.
 */
async function parseWithOllama(html: string): Promise<BananasParsedEvent[]> {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header').remove()
  let text = $('body').text().replace(/\s+/g, ' ').trim()
  if (text.length > 12000) text = text.slice(0, 12000) + '…[truncated]'

  const prompt = `You are extracting event listings from a music booking agency's HTML page.

The agency books DJs and bands at bars and venues in the Green Bay, Wisconsin area.
The page below lists their upcoming events.

Extract every event you can identify. Return ONLY a JSON array (no prose, no markdown fences),
each object with these exact keys:

  {
    "artist": "<performer name as shown>",
    "venue": "<venue name as shown>",
    "startTimeISO": "<ISO 8601 with timezone if known, else date-only YYYY-MM-DD>",
    "endTimeISO": "<ISO 8601 or null>",
    "eventType": "<one of: dj, band, karaoke, trivia, other>"
  }

If a date has no time, return it as YYYY-MM-DD (no time component). I will default to 9pm local.
If you can't determine the artist, venue, or start date, SKIP the event.
Return [] if no events are found.

HTML TEXT:
${text}

JSON OUTPUT:`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS)
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1 },
        format: 'json',
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      logger.warn(`[BANANAS-SCRAPE] Ollama returned ${resp.status} — giving up on LLM fallback`)
      return []
    }
    const body: any = await resp.json()
    const raw = (body.response || '').trim()
    // `format: 'json'` means Ollama tries to give us JSON directly, but
    // model can still wrap it. Be defensive.
    let parsed: any
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Try to find the first `[...]` slice in the response
      const m = raw.match(/\[[\s\S]*\]/)
      if (!m) {
        logger.warn('[BANANAS-SCRAPE] Ollama returned non-JSON; falling back to empty list')
        return []
      }
      parsed = JSON.parse(m[0])
    }
    // Some models wrap the array in an object like { events: [...] }
    const items: any[] = Array.isArray(parsed) ? parsed : (parsed.events || parsed.data || [])
    const out: BananasParsedEvent[] = []
    for (const item of items) {
      if (!item?.artist || !item?.venue || !item?.startTimeISO) continue
      const startISO = parseDateTimeFlexible(item.startTimeISO)
      if (!startISO) continue
      const endISO = item.endTimeISO ? parseDateTimeFlexible(item.endTimeISO) : null
      out.push({
        artist: String(item.artist).trim(),
        artistNormalized: normalizeArtistName(String(item.artist)),
        venue: String(item.venue).trim(),
        startTimeISO: startISO,
        endTimeISO: endISO,
        eventType: typeof item.eventType === 'string' ? item.eventType : inferEventType(String(item.artist)),
        sourceUrl: BANANAS_URL,
        raw: { source: 'ollama', original: item },
      })
    }
    return out
  } catch (err: any) {
    clearTimeout(timer)
    if (err?.name === 'AbortError') {
      logger.warn(`[BANANAS-SCRAPE] Ollama fallback timed out after ${OLLAMA_TIMEOUT_MS}ms`)
    } else {
      logger.warn('[BANANAS-SCRAPE] Ollama fallback failed:', err)
    }
    return []
  }
}

/**
 * Fetch + parse the Bananas Entertainment schedule page.
 *
 * Does NOT write to the database — callers handle persistence so we can
 * dry-run / debug-print / unit-test the parser without DB side-effects.
 */
export async function fetchBananasSchedule(): Promise<BananasParsedEvent[]> {
  // Path A: internal JSON API. This is the fastest, most reliable path
  // because Bananas's own SPA uses it — it's effectively their public
  // event data feed even though the URL isn't documented.
  const jsonEvents = await fetchFromJsonApi()
  if (jsonEvents && jsonEvents.length > 0) {
    logger.info(`[BANANAS-SCRAPE] JSON API returned ${jsonEvents.length} events`)
    return jsonEvents
  }
  if (jsonEvents && jsonEvents.length === 0) {
    logger.info('[BANANAS-SCRAPE] JSON API returned 0 events — calendar may be empty')
    // Still attempt the HTML fallback in case the JSON endpoint just doesn't
    // have what the page shows (e.g. paywalled rows excluded from public JSON).
  }

  logger.info(`[BANANAS-SCRAPE] JSON API unavailable or empty — falling back to HTML scrape of ${BANANAS_URL}`)

  let html: string
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(BANANAS_URL, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      logger.warn(`[BANANAS-SCRAPE] Source returned HTTP ${resp.status} — returning empty list`)
      return []
    }
    html = await resp.text()
  } catch (err: any) {
    clearTimeout(timer)
    logger.warn('[BANANAS-SCRAPE] Fetch failed — returning empty list:', err?.message || err)
    return []
  }

  // Try cheerio first
  let events: BananasParsedEvent[] | null = null
  try {
    events = parseWithCheerio(html)
  } catch (err: any) {
    logger.warn('[BANANAS-SCRAPE] cheerio parse threw — falling through to LLM:', err?.message || err)
    events = null
  }

  if (events && events.length > 0) {
    logger.info(`[BANANAS-SCRAPE] cheerio extracted ${events.length} events`)
    return events
  }

  // Fall back to Ollama
  logger.info('[BANANAS-SCRAPE] cheerio found nothing — falling back to Ollama LLM extraction')
  const llmEvents = await parseWithOllama(html)
  if (llmEvents.length > 0) {
    logger.info(`[BANANAS-SCRAPE] Ollama extracted ${llmEvents.length} events`)
    return llmEvents
  }

  logger.warn('[BANANAS-SCRAPE] Neither cheerio nor Ollama produced events — page layout may have changed or rate-limit triggered. Returning empty list so the pipeline still completes.')
  return []
}
