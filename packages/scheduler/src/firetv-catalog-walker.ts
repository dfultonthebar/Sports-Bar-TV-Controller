/**
 * Fire TV Catalog Walker
 *
 * For each active Fire TV input that scout reports with sports apps installed,
 * walk those apps to capture the per-box sports-content catalog and POST it
 * to /api/firestick-scout/catalog for downstream consumption (channel guide,
 * AI Suggest).
 *
 * Architecture choice — server-side ADB driver, not in-APK AccessibilityService:
 *
 *   Earlier plan was a Kotlin AccessibilityService inside the scout APK that
 *   walked apps locally and POSTed catalog over WiFi. Problems:
 *     1. AccessibilityService requires manual user toggle in
 *        Settings → Accessibility on each device — security gate ADB cannot
 *        reliably bypass (settings put secure enabled_accessibility_services
 *        works but is fragile across Fire OS versions and gets reset by
 *        OTAs).
 *     2. Kotlin iteration on per-app UI rules is slow — every change needs
 *        APK rebuild + ADB reinstall + Fire OS service restart per Fire TV.
 *     3. Adds attack surface (any installed app can probe Accessibility
 *        consent state) for marginal gain.
 *
 *   Server-side ADB walker is cleaner: launch app via /api/streaming/launch
 *   (which we already battle-tested), wait for first screen render, run
 *   `uiautomator dump /sdcard/scout_dump.xml`, read the XML, parse per-app
 *   tile patterns, POST to catalog endpoint, send HOME, move to next app.
 *   All TypeScript. No APK rebuild. No permission gate. Per-app rules
 *   iterate at edit-and-restart speed instead of compile-and-flash speed.
 *
 *   Tradeoff: the Fire TV's screen is occupied for ~30s per app during
 *   the walk. The daily cron runs at 04:00 local (Phase 3), which is well
 *   after bar close — no operator impact.
 *
 * What "walk" means in practice:
 *   1. Send HOME to clear any existing state.
 *   2. POST /api/streaming/launch with the app's catalog id.
 *   3. Wait for the first content screen to render (per-app delay; default 6s).
 *   4. Run `uiautomator dump /sdcard/scout_dump.xml` then `cat` it back.
 *   5. Hand the XML to the per-app extractor (parseAppTiles for the matched
 *      rule). Extractor returns a list of { contentTitle, isLive, sportTag }
 *      tiles found on screen.
 *   6. POST the list to /api/firestick-scout/catalog (per-app replace
 *      semantics — see catalog endpoint).
 *   7. Send HOME to return to launcher.
 *
 * Per-app rules in this file are the FIRST iteration. Add new entries to
 * APP_WALK_RULES as you confirm the dump format for each app. Apps without
 * a rule are skipped (no false data).
 */

import { db, schema, eq, and } from '@sports-bar/database'
import { logger } from '@sports-bar/logger'
import { schedulerLogger } from './scheduler-logger'

const API_PORT = process.env.PORT || 3001
const API_BASE = `http://127.0.0.1:${API_PORT}`

// Per-app walk rule: how long to wait after launch, and how to extract
// tile titles from the uiautomator XML dump. The tile extractor returns
// the visible sports content the app shows on its first screen — usually
// the home/landing screen which features Live + Upcoming sports rows.
//
// Add new entries here as you confirm the dump format for each app.
export interface AppWalkRule {
  catalogId: string                                    // /api/streaming/launch appId
  displayName: string                                  // matches input_sources.available_networks
  postLaunchDelayMs: number                            // wait for first screen
  // v2.31.4 — optional ADB key navigation to reach the app's sports tab
  // before dumping. ADB keyevent codes: UP=19 DOWN=20 LEFT=21 RIGHT=22
  // OK/CENTER=23. Sent in order with `interKeyDelayMs` between each.
  // Many apps' home screens rotate content (TV shows in afternoon, sports
  // in morning, etc.) — navigating to a dedicated Sports tab gives a
  // stable, sports-only catalog regardless of when the walk runs.
  navigation?: {
    keyevents: number[]
    interKeyDelayMs?: number  // default 400ms
    postNavDelayMs?: number   // default 4000ms — let new tab content render
  }
  extractTiles: (xmlDump: string) => CatalogTile[]
}

export interface CatalogTile {
  contentTitle: string
  isLive?: boolean
  sportTag?: string
  deepLink?: string
}

// Helper: pull all text= and content-desc= attributes from a uiautomator
// XML dump. Filters out trivial tokens (numbers only, very short, common
// nav chrome strings). Returns deduped, in-order. Decodes the handful of
// XML entities uiautomator emits so downstream sees clean strings
// (`&amp;` → `&`, `&apos;` → `'`, etc.).
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, ' ')
}
function extractAccessibleText(xmlDump: string): string[] {
  const matches: string[] = []
  const re = /(?:text|content-desc)="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xmlDump)) !== null) {
    const t = decodeXmlEntities(m[1]).trim()
    if (t.length < 3) continue
    if (/^\d+$/.test(t)) continue
    matches.push(t)
  }
  // Dedupe preserving order
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of matches) {
    if (!seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

// Heuristic: classify a tile string into a sport tag based on common
// keywords. Best-effort — returns null when no signal is found.
function inferSportTag(title: string, contextSportRow: string | null): string | null {
  const lower = title.toLowerCase()
  if (contextSportRow) {
    const rl = contextSportRow.toLowerCase()
    if (/nba|playoffs|basketball/.test(rl)) return 'NBA'
    if (/nfl|football/.test(rl)) return 'NFL'
    if (/mlb|baseball/.test(rl)) return 'MLB'
    if (/nhl|hockey/.test(rl)) return 'NHL'
    if (/soccer|epl|premier|champions|mls/.test(rl)) return 'soccer'
    if (/tennis|atp|wta/.test(rl)) return 'tennis'
    if (/cricket|psl|ipl/.test(rl)) return 'cricket'
    if (/golf|pga|lpga/.test(rl)) return 'golf'
    if (/ufc|mma|boxing/.test(rl)) return 'mma'
    if (/f1|nascar|indycar|motorsport/.test(rl)) return 'motorsport'
  }
  if (/\bnba\b/.test(lower)) return 'NBA'
  if (/\bnfl\b/.test(lower)) return 'NFL'
  if (/\bmlb\b|brewers|cubs|yankees|dodgers/.test(lower)) return 'MLB'
  if (/\bnhl\b/.test(lower)) return 'NHL'
  // v2.31.5 — broaden tennis recognition. Prime Video also tags PTT
  // (Power Tennis Tour) events as "Apr 23 - PTT Clemson Men" / similar
  // — those were landing as untagged in earlier walks.
  if (/atp|wta|tennis|\bptt\b/.test(lower)) return 'tennis'
  if (/cricket|psl|ipl|hyderabad|sultan/.test(lower)) return 'cricket'
  if (/squash|grasshopper cup/.test(lower)) return 'squash'
  // v2.31.5 — soccer recognition for Saudi Pro League fixtures Prime
  // Video carries (Al-team-name vs Al-team-name pattern is distinctive).
  if (/^al |\bvs\.?\s+al /i.test(lower) || /\bsaudi\b|\bspl\b/i.test(lower)) return 'soccer'
  return null
}

// Prime Video tile extractor.
// Verified empirically against Fire TV Cube 2nd gen on 2026-04-22:
// LandingActivity shows "NBA Playoffs on Prime", "Sports for you", and
// other sports rows on the first screen. Tiles appear with "vs." in the
// title and a separate "LIVE" or "UPCOMING" tag adjacent in the dump.
// Some tiles have a single content-desc that combines title + status
// ("Knicks vs. Hawks, UPCOMING"). We extract any line containing " vs."
// or " vs " (the matchup signal) as a tile, then look back through the
// surrounding text for a sport-row context (e.g. "NBA Playoffs on Prime").
function extractPrimeVideoTiles(xmlDump: string): CatalogTile[] {
  const all = extractAccessibleText(xmlDump)
  const tiles: CatalogTile[] = []
  const seen = new Set<string>()
  let lastSportRow: string | null = null

  // Sport-row headers commonly seen: "NBA Playoffs on Prime", "Sports for you",
  // "Live now", "Live on Prime". Track the most recent so we can attribute
  // tiles to the sport correctly.
  const sportRowPatterns = [
    /^NBA Playoffs/i,
    /^NFL on Prime/i,
    /^Premier League/i,
    /^Champions League/i,
    /^WNBA/i,
    /^Sports for you/i,
    /^Live (now|on)/i,
    /^Sports$/i,
  ]

  for (const t of all) {
    // Track sport-row context
    if (sportRowPatterns.some((p) => p.test(t))) {
      lastSportRow = t
      continue
    }

    // Skip nav chrome ("Home, Tab, Selected, 1 of 8" etc.)
    if (/^(Home|Movies|TV shows|Sports|News|Live TV|Subscriptions|Search|My Stuff|Main menu|Settings|Profile)(,|$)/.test(t)) continue
    if (/Tab,\s*Selected/.test(t)) continue
    if (/^\d+ of \d+$/.test(t)) continue
    if (/^Watch now$/.test(t)) continue
    if (/^TV-(MA|14|PG|G|Y)/.test(t)) continue
    if (/^#\d+ in/.test(t)) continue
    // v2.31.4 — additional Sports-tab noise filters
    if (/^(More details|All|all)$/i.test(t)) continue
    if (/^(LIVE|LIVE NOW|UPCOMING)$/i.test(t)) continue       // standalone badge text
    if (/^Live at \d/i.test(t)) continue                        // "Live at 5:30 PM" generic timeslot
    if (/^Sports for you$/i.test(t)) { lastSportRow = t; continue }

    // Game matchup signal — the strongest tile indicator
    const isMatchup = / vs\.? /i.test(t)

    // LIVE / UPCOMING decoration
    const liveTag = /,?\s*(LIVE|LIVE NOW)\b/i.test(t) || /^LIVE$/i.test(t)
    const upcomingTag = /,?\s*UPCOMING\b/i.test(t)

    if (!isMatchup && !liveTag && !upcomingTag) {
      // Could still be a tile with a non-matchup title — accept if it's
      // long enough and inside a sport row context.
      if (lastSportRow && t.length >= 8 && t.length <= 100) {
        // Skip date/time tokens that appear standalone
        if (/^(Tomorrow|Today|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i.test(t)) continue
        if (/^\d{1,2}:\d{2}\s*(AM|PM)/i.test(t)) continue
        if (/^Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(t)) continue

        const key = t.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        tiles.push({
          contentTitle: t,
          isLive: false,
          sportTag: inferSportTag(t, lastSportRow),
        })
      }
      continue
    }

    // Strip trailing ", LIVE" / ", UPCOMING" from the title for cleanliness
    const cleanTitle = t.replace(/,?\s*(LIVE|LIVE NOW|UPCOMING)\s*$/i, '').trim()
    if (!cleanTitle || cleanTitle.length < 3) continue

    const key = cleanTitle.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    tiles.push({
      contentTitle: cleanTitle,
      isLive: liveTag,
      sportTag: inferSportTag(cleanTitle, lastSportRow),
    })
  }

  return tiles
}

// Add per-app rules here as you confirm dump formats. Apps without a rule
// are silently skipped (no false data lands in the catalog).
const APP_WALK_RULES: Record<string, AppWalkRule> = {
  'Prime Video': {
    catalogId: 'amazon-prime',
    displayName: 'Prime Video',
    postLaunchDelayMs: 6000,
    // v2.31.4 — Navigate to the Sports tab before dumping. Empirical
    // sequence on Fire TV Cube 2nd gen (AFTR) PVFTV-215.5200-L: from the
    // launcher's LandingActivity, two UPs focus the top tab row, three
    // RIGHTs land on Sports (Home → Movies → TV shows → Sports), OK
    // activates. Without this we get whatever Prime Video happens to be
    // featuring on the home screen — often non-sports (TV shows on
    // weekday afternoons, our 2026-04-23 4am walk only captured
    // "Live at 5:30 PM" because home screen was rotating).
    navigation: {
      keyevents: [19, 19, 22, 22, 22, 23],
      interKeyDelayMs: 400,
      postNavDelayMs: 4500,
    },
    extractTiles: extractPrimeVideoTiles,
  },
  // Future entries (Phase 2b-2.C):
  //   'Peacock': { catalogId: 'peacock', ..., extractTiles: extractPeacockTiles }
  //   'Hulu': ...
  //   'fuboTV': ...
}

// Helper: send a shell command via the existing send-command endpoint.
// Returns the raw stdout string (or empty on error). The endpoint reports
// false `success` on non-zero exit code, but the actual stdout often comes
// through anyway — we read it regardless.
async function adbShell(deviceId: string, command: string): Promise<string> {
  try {
    const resp = await fetch(`${API_BASE}/api/firetv-devices/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, command }),
    })
    if (!resp.ok) {
      logger.warn(`[FIRETV-CATALOG] send-command HTTP ${resp.status} for ${deviceId} (cmd: ${command.substring(0, 60)})`)
      return ''
    }
    const json: any = await resp.json()
    return String(json?.data?.result ?? '')
  } catch (err: any) {
    logger.warn(`[FIRETV-CATALOG] send-command threw for ${deviceId}: ${err.message}`)
    return ''
  }
}

async function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
}

interface WalkOneAppResult {
  app: string
  tilesFound: number
  uploaded: boolean
  error?: string
}

async function walkOneApp(
  inputSource: any,
  ipAddress: string,
  rule: AppWalkRule,
  correlationId: string
): Promise<WalkOneAppResult> {
  const deviceId = inputSource.deviceId
  if (!deviceId) {
    return { app: rule.displayName, tilesFound: 0, uploaded: false, error: 'no-device-id' }
  }

  try {
    // 1. HOME to clear
    await adbShell(deviceId, 'input keyevent 3')
    await sleep(1000)

    // 2. Launch the app
    const launchResp = await fetch(`${API_BASE}/api/streaming/launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        ipAddress,
        appId: rule.catalogId,
        port: 5555,
      }),
    })
    if (!launchResp.ok) {
      const errBody = await launchResp.text()
      return { app: rule.displayName, tilesFound: 0, uploaded: false, error: `launch failed: ${errBody.substring(0, 200)}` }
    }

    // 3. Wait for first screen to render
    await sleep(rule.postLaunchDelayMs)

    // 3a. (v2.31.4) Optional navigation to a sports/live tab. Without
    // this, apps whose home screen rotates content (Prime Video, Peacock,
    // etc.) yield inconsistent walks — TV shows in the afternoon, sports
    // in the morning. Navigation lets us land on the same Sports tab
    // every walk regardless of time of day.
    if (rule.navigation && rule.navigation.keyevents.length > 0) {
      const interKey = rule.navigation.interKeyDelayMs ?? 400
      for (const code of rule.navigation.keyevents) {
        await adbShell(deviceId, `input keyevent ${code}`)
        await sleep(interKey)
      }
      await sleep(rule.navigation.postNavDelayMs ?? 4000)
    }

    // 4. Dump UI hierarchy.
    //
    // Two implementation notes baked in from earlier diagnosis:
    //   - The send-command API mangles shell redirections (`2>/dev/null`),
    //     so we don't try to silence stderr — just call uiautomator directly.
    //   - Always remove the dump file first; if a previous walk left a stale
    //     copy and uiautomator silently fails, we don't want to read the
    //     wrong content.
    //   - `uiautomator dump` writes its success message ("UI hierchary
    //     dumped to: ...") to stderr on Fire OS 7, which the send-command
    //     wrapper sometimes misreports as failure. The actual file write
    //     succeeds — we read it back via `cat` regardless of dump's
    //     reported status. If the file is genuinely missing, cat returns
    //     empty and we surface "empty dump".
    const dumpPath = '/sdcard/scout_walker_dump.xml'
    await adbShell(deviceId, `rm -f ${dumpPath}`)
    await adbShell(deviceId, `uiautomator dump ${dumpPath}`)
    // small grace for the file write to flush
    await sleep(500)
    const xml = await adbShell(deviceId, `cat ${dumpPath}`)
    if (!xml || xml.length < 200) {
      logger.warn(
        `[FIRETV-CATALOG] empty dump on ${inputSource.name} / ${rule.displayName} — cat returned ${xml?.length ?? 0} chars`
      )
      return { app: rule.displayName, tilesFound: 0, uploaded: false, error: 'empty dump' }
    }

    // 5. Per-app extraction
    const tiles = rule.extractTiles(xml)
    if (tiles.length === 0) {
      logger.info(`[FIRETV-CATALOG] ${inputSource.name} / ${rule.displayName}: no tiles extracted (dump size ${xml.length})`)
    }

    // 6. POST to catalog endpoint
    const ingestResp = await fetch(`${API_BASE}/api/firestick-scout/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        ipAddress,
        items: tiles.map((t) => ({
          app: rule.displayName,
          contentTitle: t.contentTitle,
          isLive: !!t.isLive,
          sportTag: t.sportTag ?? undefined,
          deepLink: t.deepLink ?? undefined,
        })),
      }),
    })
    if (!ingestResp.ok) {
      const errBody = await ingestResp.text()
      return { app: rule.displayName, tilesFound: tiles.length, uploaded: false, error: `ingest failed: ${errBody.substring(0, 200)}` }
    }

    // 7. HOME to clean up
    await adbShell(deviceId, 'input keyevent 3')
    await sleep(500)

    return { app: rule.displayName, tilesFound: tiles.length, uploaded: true }
  } catch (err: any) {
    return { app: rule.displayName, tilesFound: 0, uploaded: false, error: err.message }
  }
}

export interface CatalogWalkStats {
  inputsConsidered: number
  inputsWalked: number
  appWalksAttempted: number
  appWalksSucceeded: number
  totalTilesUploaded: number
  errors: string[]
}

/**
 * Run a complete catalog walk across every active Fire TV input.
 * For each input, walks every app whose displayName is in
 * `input_sources.available_networks` AND has a rule in APP_WALK_RULES.
 *
 * Designed to run from the daily 04:00 cron (Phase 3) — sequential per
 * input, with HOME between apps. Total runtime scales linearly with
 * (inputs × apps_with_rules × postLaunchDelayMs).
 */
export async function runFiretvCatalogWalk(): Promise<CatalogWalkStats> {
  const correlationId = schedulerLogger.generateCorrelationId()
  const stats: CatalogWalkStats = {
    inputsConsidered: 0,
    inputsWalked: 0,
    appWalksAttempted: 0,
    appWalksSucceeded: 0,
    totalTilesUploaded: 0,
    errors: [],
  }

  try {
    const firetvInputs = await db
      .select()
      .from(schema.inputSources)
      .where(
        and(
          eq(schema.inputSources.isActive, true),
          eq(schema.inputSources.type, 'firetv')
        )
      )
      .all()

    stats.inputsConsidered = firetvInputs.length

    // Build a deviceId → ipAddress lookup from the FireTVDevice table
    const fireTVDevices = await db.select().from(schema.fireTVDevices).all()
    const ipByDeviceId = new Map(fireTVDevices.map((d) => [d.id, d.ipAddress]))

    await schedulerLogger.info(
      'firetv-catalog-walker',
      'walk',
      `Starting catalog walk across ${firetvInputs.length} firetv input(s)`,
      correlationId,
      { metadata: { inputCount: firetvInputs.length } }
    )

    for (const input of firetvInputs) {
      if (!input.deviceId) continue
      const ipAddress = ipByDeviceId.get(input.deviceId)
      if (!ipAddress) {
        logger.warn(`[FIRETV-CATALOG] No IP for ${input.name} (${input.deviceId}) — skipping`)
        continue
      }

      let availableNetworks: string[] = []
      try {
        availableNetworks = JSON.parse(input.availableNetworks || '[]')
      } catch { /* skip */ }

      const appsToWalk = availableNetworks.filter((n) => APP_WALK_RULES[n])
      if (appsToWalk.length === 0) {
        logger.info(`[FIRETV-CATALOG] ${input.name}: no walkable apps in available_networks`)
        continue
      }

      logger.info(`[FIRETV-CATALOG] ${input.name}: walking ${appsToWalk.length} app(s) — ${appsToWalk.join(', ')}`)
      stats.inputsWalked++

      for (const appName of appsToWalk) {
        const rule = APP_WALK_RULES[appName]
        stats.appWalksAttempted++
        const result = await walkOneApp(input, ipAddress, rule, correlationId)
        if (result.uploaded) {
          stats.appWalksSucceeded++
          stats.totalTilesUploaded += result.tilesFound
          logger.info(`[FIRETV-CATALOG] ✅ ${input.name} / ${appName}: ${result.tilesFound} tiles`)
          await schedulerLogger.info(
            'firetv-catalog-walker',
            'walk',
            `${input.name} / ${appName}: ${result.tilesFound} tiles uploaded`,
            correlationId,
            {
              inputSourceId: input.id,
              deviceId: input.deviceId,
              metadata: { app: appName, tiles: result.tilesFound },
            }
          )
        } else {
          const msg = `${input.name} / ${appName}: ${result.error || 'unknown failure'}`
          stats.errors.push(msg)
          logger.warn(`[FIRETV-CATALOG] ⚠️ ${msg}`)
        }
      }
    }

    await schedulerLogger.info(
      'firetv-catalog-walker',
      'walk',
      `Catalog walk complete: ${stats.inputsWalked} inputs, ${stats.appWalksSucceeded}/${stats.appWalksAttempted} apps, ${stats.totalTilesUploaded} total tiles`,
      correlationId,
      { metadata: stats as any }
    )
  } catch (err: any) {
    stats.errors.push(`fatal: ${err.message}`)
    logger.error('[FIRETV-CATALOG] Fatal walk error:', { error: err })
  }

  return stats
}
