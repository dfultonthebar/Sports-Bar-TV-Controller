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
import { findStreamingAppByDisplayName } from '@sports-bar/streaming'
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
  // v2.31.9 + v2.32.8 — Mark apps the walker can't extract content from.
  // Two failure modes both flagged with this single flag:
  //   1. WebView-based apps: entire UI renders inside android.webkit.WebView.
  //      uiautomator dump shows one big WebView node with no text=. Confirmed
  //      on Peacock; likely Hulu/fubo/MLB.TV.
  //   2. Accessibility-blind native apps: native Android views but every
  //      node has empty text/content-desc. Confirmed on Apple TV+ on Fire TV
  //      Cube — dump returns 3KB but 0 unique text nodes.
  // Either way, walker skips with a single info log instead of attempting
  // a walk that would always return zero tiles. Future work: HTTP catalog
  // fetch from each provider's public API, or screen-capture + OCR.
  usesWebView?: boolean
  extractTiles: (xmlDump: string) => CatalogTile[]
}

export interface CatalogTile {
  contentTitle: string
  isLive?: boolean
  sportTag?: string
  deepLink?: string
  // v2.32.63 — game start time when the walker can extract it from the
  // tile's text. Unix seconds. Null when not parseable (most tiles).
  startTime?: number
}

// Parse a "7:30 PM" or "7:30 PM ET" or "Today 7:30 PM" string into a unix
// timestamp anchored to today's date in the local timezone. Returns null
// on no match. Used by both ESPN and Prime Video extractors so the time
// regex stays in one place.
function parseTileTime(text: string): number | undefined {
  // Capture optional "Today/Tomorrow/<weekday>" prefix + HH:MM AM/PM
  const m = text.match(/(Today|Tomorrow|Sun|Mon|Tue|Wed|Thu|Fri|Sat)?\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!m) return undefined
  const dayHint = (m[1] || '').toLowerCase()
  const h12 = parseInt(m[2], 10)
  const min = parseInt(m[3], 10)
  const ampm = m[4].toUpperCase()
  if (h12 < 1 || h12 > 12 || min < 0 || min > 59) return undefined
  let hour24 = ampm === 'PM' && h12 !== 12 ? h12 + 12 : (ampm === 'AM' && h12 === 12 ? 0 : h12)
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour24, min, 0, 0)
  if (dayHint === 'tomorrow') d.setDate(d.getDate() + 1)
  // If the parsed time is more than 6h in the past and there's no day
  // hint, assume tomorrow (a "7:30 PM" tile shown after midnight refers
  // to tonight already passed; the next showing is tomorrow). Walker
  // tiles for today's games show before midnight, so this is rare.
  else if (!dayHint && d.getTime() < now.getTime() - 6 * 60 * 60 * 1000) {
    d.setDate(d.getDate() + 1)
  }
  return Math.floor(d.getTime() / 1000)
}

// Helper: pull all text= and content-desc= attributes from a uiautomator
// XML dump. Filters out trivial tokens (numbers only, very short, common
// nav chrome strings). Returns deduped, in-order. Decodes the handful of
// XML entities uiautomator emits so downstream sees clean strings
// (`&amp;` → `&`, `&apos;` → `'`, etc.).
function decodeXmlEntities(s: string): string {
  // Decode numeric entities first (`&#10;`, `&#9;`, etc.) so any LF/TAB
  // becomes whitespace before the named-entity pass. uiautomator on Fire OS 7
  // emits both — the named-only decoder we shipped in v2.31.5 missed the
  // numeric ones and corrupted any title with a tab in it.
  return s
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n)
      // 9=TAB, 10=LF, 13=CR — collapse to space; everything else fromCharCode
      return code === 9 || code === 10 || code === 13 ? ' ' : String.fromCharCode(code)
    })
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
    // v2.32.9 — Order matters: check 'ncaa'/'college' BEFORE NFL, because
    // "NCAA Football" matched /nfl|football/ and tagged College GameDay
    // (clearly a college show) as NFL. Check the more specific labels
    // first.
    if (/college|ncaa/.test(rl)) {
      if (/football/.test(rl)) return 'college-football'
      if (/basketball|hoops/.test(rl)) return 'college-basketball'
      if (/baseball/.test(rl)) return 'college-baseball'
      if (/hockey/.test(rl)) return 'college-hockey'
      return 'college-sports'
    }
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
    if (/volleyball/.test(rl)) return 'volleyball'
    if (/lacrosse/.test(rl)) return 'lacrosse'
    if (/wrestling/.test(rl)) return 'wrestling'
    if (/rugby/.test(rl)) return 'rugby'
  }
  if (/\bnba\b/.test(lower)) return 'NBA'
  if (/\bnfl\b/.test(lower)) return 'NFL'
  if (/\bmlb\b|brewers|cubs|yankees|dodgers/.test(lower)) return 'MLB'
  if (/\bnhl\b/.test(lower)) return 'NHL'
  // v2.31.5 — broaden tennis recognition. Prime Video also tags PTT
  // (Power Tennis Tour) events as "Apr 23 - PTT Clemson Men" / similar
  // — those were landing as untagged in earlier walks.
  if (/atp|wta|tennis|\bptt\b/.test(lower)) return 'tennis'
  if (/cricket|\bpsl\b|\bipl\b|hyderabad|sultan|mumbai indians|super kings|royal challengers|kolkata knight|delhi capitals|punjab kings|rajasthan royals/.test(lower)) return 'cricket'
  if (/squash|grasshopper cup/.test(lower)) return 'squash'
  if (/\bchess\b/.test(lower)) return 'chess'
  if (/\brace(s)?\b|day at the races|horse|kentucky derby|breeders/.test(lower)) return 'horse-racing'
  // v2.32.9 — beach volleyball + indoor volleyball misses (Sun Belt /
  // OVC women's beach volleyball was untagged in the v2.31.6 walks)
  if (/volleyball/.test(lower)) return 'volleyball'
  if (/lacrosse/.test(lower)) return 'lacrosse'
  if (/wrestling/.test(lower)) return 'wrestling'
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
  // v2.32.84 — extended to cover MLB/NHL/MLS/UFC/college variants. Without
  // these, a row like "MLB on Prime" wouldn't match and tiles beneath would
  // inherit the previous section's `lastSportRow` (e.g. NBA), so MLB games
  // would be tagged as basketball. Code-reviewer caught this on 2026-05-08.
  const sportRowPatterns = [
    /^NBA Playoffs/i,
    /^NBA on Prime/i,
    /^NFL on Prime/i,
    /^Thursday Night Football/i,
    /^MLB on Prime/i,
    /^NHL on Prime/i,
    /^MLS on Prime/i,
    /^UFC on Prime/i,
    /^WNBA/i,
    /^Premier League/i,
    /^Champions League/i,
    /^College (Football|Basketball|Baseball|Hockey|Sports)/i,
    /^Sports for you/i,
    /^Live (now|on)/i,
    /^Sports$/i,
  ]

  // v2.32.84 — promotional copy that the non-matchup fallback branch was
  // accepting as tiles. The audit on 2026-05-08 caught Amazon promo strings
  // like "Included with Prime", "Watch trailer", "Go ad free with Ultra"
  // surviving into the channel guide. None of these are content the bartender
  // can route to.
  const promoBlocklist = [
    /^Included with Prime$/i,
    /^Start your \d+-day trial$/i,
    /^Free trial available$/i,
    /^Watch trailer$/i,
    /^Go ad free/i,
    /^New episodes? available$/i,
    /^Coming soon$/i,
    /^Watchlist$/i,
    /^Like$/i,
    /^Not for me$/i,
  ]

  // v2.33.2 — Comprehensive non-game noise filter. Applied to BOTH the
  // non-matchup branch AND the matchup/LIVE branch (was only on the
  // former in v2.33.1; "Season 2026 LIVE" leaked through because LIVE-
  // tagged tiles took the matchup branch and never re-validated).
  // Patterns observed in fleet catalogs 2026-05-09 across Graystone,
  // Stoneyard Appleton, Stoneyard Greenville:
  //   - Series-metadata: "Season 2026", "Season 1", year strings
  //   - UI labels: "Audio languages", "Subtitles", "How do I choose..."
  //   - Section headers caught as tiles: "Recently watched", "Live
  //     events for you", "Sports for you", "Watch live"
  //   - Non-sports shows + news in the "Live now" rail: "ABC News",
  //     "Dateline NBC", "Dateline 24/7", news ticker text
  //   - Channel/network shells: "RugbyPass TV" (NOT a game; the actual
  //     event name is e.g. "Highlanders vs. NSW Waratahs")
  //   - Promotional / non-game events that get caught by Live-tag:
  //     "Rolling Loud" (music festival)
  const nonGameNoise = [
    // Series metadata
    /^Season\s+(\d+|\d{4})$/i,
    /^Episode\s+\d+/i,
    /^S\d+\s*[•·]?\s*E\d+/i,
    /^\d{4}$/,
    /^Documentary$/i,
    // UI labels (already in non-matchup branch; promote to global)
    /^Audio languages?\b/i,
    /^Subtitles?\b/i,
    /^Closed [Cc]aptions?\b/i,
    /^(English|Spanish|French|German|Portuguese)([,\s]+(English|Spanish|French|German|Portuguese))*\s*$/i,
    /^(English|Spanish|French|German|Portuguese)\s+Commentary\b/i,
    /^(Español|Français|Deutsch|Italiano)\b/i,
    /^Choose (subtitle|audio|language|caption)/i,
    /^(How|What|Why|When|Where|Which) /i,
    /^Watchlist$/i,
    /^Skip (intro|recap|credits)$/i,
    /^Next (up|episode)$/i,
    /^Resume watching$/i,
    // Section headers / nav strings caught as tiles
    /^Recently watched$/i,
    /^Live events for you$/i,
    /^Sports for you$/i,
    /^Watch live$/i,
    /^Live (now|today)$/i,
    /^Featured\b/i,
    /^Continue watching$/i,
    /^Up next$/i,
    /^Top picks$/i,
    /^Browse all$/i,
    /^More to watch$/i,
    /^See all$/i,
    /^My stuff$/i,
    // Non-sports shows / news (when they bleed into a sports row context)
    /^ABC News\b/i,
    /^NBC News\b/i,
    /^CBS News\b/i,
    /^Fox News\b/i,
    /^Dateline (NBC|24\/7)$/i,
    /^Dateline$/i,
    /^The Daily Show\b/i,
    /^60 Minutes\b/i,
    // Long descriptive strings (>80 chars) are typically tile descriptions
    // that got lifted as titles by the walker — too long to be a real
    // game title. Real game tiles cap around 60-70 chars at the longest.
    /^.{90,}$/,
    // Music/entertainment events that aren't sports (catch-all for known
    // Prime Video entertainment tiles in the Live-now rail)
    /^Rolling Loud$/i,
    /^Coachella$/i,
    /^Lollapalooza$/i,
    // Channel/network shells (the row header for the channel, not the game)
    /^RugbyPass TV$/i,
    /^MLB Network$/i,
    /^NHL Network$/i,
    /^NBA TV$/i,
  ]
  const isPrimeVideoNoise = (s: string): boolean =>
    nonGameNoise.some((p) => p.test(s))

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
    // v2.31.4 + v2.31.6 — additional Sports-tab noise filters
    if (/^(More details|All|all)$/i.test(t)) continue
    if (/^(LIVE|LIVE NOW|UPCOMING)$/i.test(t)) continue       // standalone badge text
    if (/^Live at \d/i.test(t)) continue                        // "Live at 5:30 PM" generic timeslot
    if (/^(Live and upcoming events|Live now|Live & upcoming)$/i.test(t)) {
      lastSportRow = t; continue                                // row header, not a tile
    }
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
        // v2.32.84 — reject Amazon promotional copy
        if (promoBlocklist.some((p) => p.test(t))) continue
        // v2.33.2 — Question-marked text is never a game title (Q&A help):
        if (/\?$/.test(t)) continue
        // v2.33.2 — Unified non-game noise filter (series metadata,
        // UI labels, section headers, news shows, channel shells).
        if (isPrimeVideoNoise(t)) continue

        const key = t.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        tiles.push({
          contentTitle: t,
          isLive: false,
          sportTag: inferSportTag(t, lastSportRow),
          // v2.32.84 — search-by-title deep link works for any Prime Video
          // discoverable content. Bartender's launchPrimeVideoToContent
          // path then runs the autoplay nav sequence to start playback.
          deepLink: `https://watch.amazon.com/search?phrase=${encodeURIComponent(t)}`,
        })
      }
      continue
    }

    // v2.32.63 — capture embedded time BEFORE the strip loop runs.
    // Prime Video upcoming tiles include "Today 7:30 PM" or just "7:30 PM"
    // as a comma segment that the strip loop would otherwise consume.
    const startTime = parseTileTime(t)

    // v2.31.6 — Strip trailing decoration suffixes from the title.
    // Prime Video tiles often have multi-segment trailers like
    //   "Foo Bar, LIVE, Free trial"
    //   "Foo Bar, LIVE, Subscribe"
    //   "Foo Bar, UPCOMING, Today 7:30 PM"
    // Run the strip in a loop so multiple suffix segments come off cleanly.
    let cleanTitle = t
    for (let i = 0; i < 6; i++) {
      const stripped = cleanTitle.replace(
        /,?\s*(LIVE|LIVE NOW|UPCOMING|Free trial|Subscribe|Watch now|Today|Tomorrow|\d{1,2}:\d{2}\s*(?:AM|PM)(?:\s*ET|\s*PT|\s*CT)?)\s*$/i,
        ''
      ).trim()
      if (stripped === cleanTitle) break
      cleanTitle = stripped
    }
    if (!cleanTitle || cleanTitle.length < 3) continue

    // v2.33.2 — Re-validate the stripped title against the non-game
    // noise filter. Pre-fix "Season 2026 LIVE" stripped to "Season 2026"
    // and bypassed all filters because the LIVE-tag branch never
    // re-checked. Same for "Recently watched LIVE", "Live events for
    // you LIVE" — all non-games that the original loop accepted as
    // legit because they had a LIVE/UPCOMING decoration.
    if (isPrimeVideoNoise(cleanTitle)) continue
    if (/\?$/.test(cleanTitle)) continue
    if (promoBlocklist.some((p) => p.test(cleanTitle))) continue

    const key = cleanTitle.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    tiles.push({
      contentTitle: cleanTitle,
      isLive: liveTag,
      sportTag: inferSportTag(cleanTitle, lastSportRow),
      startTime,
      // v2.32.84 — see comment in the non-matchup branch above.
      deepLink: `https://watch.amazon.com/search?phrase=${encodeURIComponent(cleanTitle)}`,
    })
  }

  return tiles
}

// ESPN extractor (v2.31.9).
// Verified empirically on Fire TV Cube 2nd gen 2026-04-23: the ESPN Fire TV
// app (com.espn.gtv) is a NATIVE Android TV app — uiautomator dump returns
// rich text/content-desc data for every visible tile.
//
// Tile shapes seen on the landing screen:
//   text:         "College GameDay ESPN • NCAA Football Live"
//   content-desc: "College GameDay, College GameDay, NCAA Football, Live Now,"
//
// The text version pairs `<title> <network> • <sport> [Live]`.
// The content-desc version is a comma-separated tuple `<title>, <title>, <sport>, <status>,`.
// We prefer the content-desc when available because it splits cleanly; fall
// back to text and parse around the bullet separator.
function extractEspnTiles(xmlDump: string): CatalogTile[] {
  const all = extractAccessibleText(xmlDump)
  const tiles: CatalogTile[] = []
  const seen = new Set<string>()

  // Skip ESPN nav chrome — including subscription-tier labels (ESPN /
  // ESPN+ / ESPN Unlimited) that are NOT games. v2.33.0 — added the
  // bare network/tier names + content tier suffix detection. v2.33.1 —
  // added show names + network-acronym variants (SECN+, ACCN, ESPNU,
  // SportsCenter, "All ACC ACCN" etc.) caught after a Cube-3 walk
  // captured them as fake live-tile rows. None are launchable games,
  // all confuse the bartender remote and AI Suggest.
  const navChrome = /^(Search|Home|Films & Shows|Browse|Highlights|Settings|Featured|Featured Group \d|Watch, button \d of \d|button \d of \d|ESPN(\+| Unlimited| 2|U)?|ABC|FS1|FS2|FOX|NBC|CBS|TBS|TNT|SEC Network\+?|SECN\+?|ACC Network\+?|ACCN\+?|Big Ten Network\+?|BTN\+?|SportsCenter|NFL Live|NBA Live|MLB Live|College GameDay|All ACC|All SEC|All Big Ten|All ACCN|All SECN)$/i
  // Strip a trailing subscription-tier suffix from accumulated tile
  // text. Matches "<title> ESPN+" / "<title> ESPN Unlimited" / "<title>
  // ESPN2" — leaves a clean title.
  const tierSuffix = /\s+(ESPN(\+| Unlimited| 2|U)?|ABC|FS1|FS2|FOX|NBC|CBS|TBS|TNT|SEC Network\+?|SECN\+?|ACC Network\+?|ACCN\+?|Big Ten Network\+?|BTN\+?)\s*$/
  // After title extraction, require it to look like a game/event:
  // either a matchup ("vs", "@", " at ") OR a known event format
  // (Grand Prix, Open, Final, Championship, Cup, Tournament, Match).
  // This catches "SportsCenter", "NFL Live", "All ACC ACCN", and other
  // section-header / show-name strings that survive the chrome filter
  // because they're embedded as comma-segment tile titles.
  const looksLikeGame = (s: string): boolean => {
    if (/(vs\.?|\sat\s|@)/i.test(s)) return true
    if (/(Grand Prix|Open|Final|Championship|Cup|Tournament|\bMatch\b|Series|Race|Qualifying|Stage \d)/i.test(s)) return true
    return false
  }

  for (const t of all) {
    if (navChrome.test(t.trim())) continue
    if (t.length < 5) continue

    let title = ''
    let sportTag: string | null = null
    let isLive = false

    // Pattern A: comma-separated content-desc — "Title, Title, Sport, Live Now,"
    const commaParts = t.split(',').map(s => s.trim()).filter(Boolean)
    if (commaParts.length >= 3 && /Live( Now)?/i.test(commaParts[commaParts.length - 1])) {
      // Last segment is status; second-to-last is sport; first is title
      title = commaParts[0]
      sportTag = inferSportTag(commaParts[commaParts.length - 2], commaParts[commaParts.length - 2])
      isLive = true
    }
    // Pattern B: bullet-separated text — "Title NETWORK • Sport • 7:30 PM"
    else if (/ • /.test(t)) {
      const parts = t.split(' • ')
      const beforeBullet = parts[0]
      const afterBullet = parts[1]
      // Strip trailing network token from title (last word: ESPN, ESPN2, ESPN+, etc.)
      title = beforeBullet.replace(/\s+(ESPN\+?|ESPN2|ABC|SEC Network|ACC Network|Big Ten Network|FS1|FS2)\s*$/, '').trim()
      sportTag = inferSportTag(afterBullet || '', afterBullet || '')
      isLive = / Live\b/i.test(afterBullet || '')
    } else {
      continue
    }

    // Strip trailing subscription-tier label that the dump occasionally
    // glues onto the title (Pattern B path catches most of these via
    // its existing replace, but Pattern A doesn't — re-apply globally).
    title = title.replace(tierSuffix, '').trim()
    if (!title || title.length < 3) continue
    // Skip pure tier/network labels even if they survive earlier filters
    // (e.g. accumulated text was "ESPN+ ESPN+" → after strip → "ESPN+").
    if (navChrome.test(title)) continue
    // v2.33.1 — drop tiles whose title doesn't look like a game/event.
    // Catches "SportsCenter", "NFL Live", "All ACC ACCN" etc that
    // sneak through Pattern A as the first comma segment.
    if (!looksLikeGame(title)) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    // v2.32.63 — capture game start time when the tile text contains a
    // "H:MM AM/PM" token (ESPN renders upcoming games with the time in
    // the third bullet segment). The full raw line is searched so the
    // regex picks up the time wherever ESPN puts it.
    const startTime = parseTileTime(t)
    tiles.push({
      contentTitle: title,
      isLive,
      sportTag,
      startTime,
      // v2.32.94 — Per-tile ESPN deep link with the tile title encoded as
      // `?q=<title>`. ESPN's app ignores the query (the `sportscenter://`
      // scheme is a Comrade-gated catch-all that always lands on home),
      // but our streaming-service-manager extracts the `q` value at
      // bartender-Watch time and feeds it to launchEspnToLiveContent's
      // search-by-title autoplay path. Pre-fix the deepLink was a generic
      // home-tab URL and ESPN autoplay just navigated to whatever ESPN
      // featured first — niche tiles (e.g. college softball) never reached
      // PlayerActivity. Per-tile title preserves the bartender's intent
      // through to ESPN's in-app search.
      deepLink: `sportscenter://x-callback-url/showHomeTab?q=${encodeURIComponent(title)}`,
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
  'ESPN': {
    catalogId: 'espn-plus',
    displayName: 'ESPN',
    postLaunchDelayMs: 8000,           // ESPN's content cards finish rendering ~7s after launch
    // No navigation needed — ESPN's first screen IS the live-sports landing.
    extractTiles: extractEspnTiles,
  },
  // v2.31.9 — Peacock (and likely Hulu, MLB.TV, Netflix on Fire TV)
  // renders inside an android.webkit.WebView. uiautomator can't read text
  // content from inside a WebView — the dump shows one big WebView node
  // with no extractable text/content-desc. Walker skips with a logged
  // info line instead of pretending to walk and capturing zero. Future
  // work: pull Peacock's NBC Sports schedule from a public API, or
  // screen-capture + OCR.
  'Peacock': {
    catalogId: 'peacock',
    displayName: 'Peacock',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // v2.32.8 — Apple TV+ on Fire TV Cube is NATIVE (no WebView) but
  // accessibility-blind. uiautomator dump on its MainActivity returns
  // ~3KB with 0 unique text nodes — every node has empty text and
  // content-desc, so tile titles can't be extracted. Same effective
  // behavior as a WebView app from the walker's perspective; reuses
  // the usesWebView flag (see AppWalkRule docstring).
  'Apple TV+': {
    catalogId: 'apple-tv',
    displayName: 'Apple TV+',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // v2.32.8 — fuboTV on Fire TV is web-based (consumer pattern: most
  // sports streaming services are WebView shells with a thin native
  // launcher). Pre-emptive skip with usesWebView; if a future operator
  // logs in and a manual probe shows accessibility text IS available,
  // remove the flag and add an extractor at that point.
  // packageAlias com.fubo.firetv.screen registered in
  // packages/streaming/src/streaming-apps-database.ts so launch resolves
  // to the right APK on these Cubes.
  'fuboTV': {
    catalogId: 'fubo-tv',
    displayName: 'fuboTV',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // v2.32.90 — Fleet-wide probe results: most sports-relevant streaming apps
  // are non-walkable. Three patterns observed:
  //   1. Cobalt-runtime apps (YouTube TV, likely YouTube proper) — render
  //      via dev.cobalt.app.MainActivity using OpenGL surfaces with no
  //      accessibility tree. Dump size 5KB, 0 text nodes. Same effective
  //      behavior as Apple TV+'s accessibility-blind native pattern.
  //   2. Paywall-gated apps when a Cube isn't subscribed/logged in —
  //      walker captures only "App Not Owned"/"See Details"/"Quit" text
  //      until an operator signs in via the TV remote.
  //   3. Cross-app redirects — e.g. Fox Sports's MainActivity at graystone
  //      shows a single "OPEN FOX ONE" button; the actual catalog lives
  //      in com.fox.foxone (which is itself paywalled).
  // For each below, the entry is intentional documentation: future Claude
  // sessions / operators will see the per-app reason without repeating the
  // probe. Remove `usesWebView: true` ONLY after a fresh probe confirms
  // accessibility text IS readable on a logged-in Cube.

  // Hulu: probed at greenville-stoneyard 2026-05-08 on a logged-out Cube.
  // Dump = 5.5KB, 4 text nodes all "App Not Owned" paywall variants.
  // No catalog content visible. Operator action required to log in
  // before walking will produce real tiles.
  'Hulu': {
    catalogId: 'hulu',
    displayName: 'Hulu',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // YouTube TV (com.google.android.youtube.tvunplugged): probed at
  // graystone-tvcontroller 2026-05-08. dev.cobalt.app.MainActivity is
  // YouTube's Cobalt runtime — renders via OpenGL surfaces. Dump =
  // 5.4KB, 0 readable text nodes (same pattern as Apple TV+).
  // uiautomator cannot extract tile titles regardless of login state.
  // Future work: HTTP catalog fetch from YouTube TV's public lineup
  // endpoint, or screen-capture + OCR.
  'YouTube TV': {
    catalogId: 'youtube-tv',
    displayName: 'YouTube TV',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // YouTube (regular, com.amazon.firetv.youtube): Amazon's pre-installed
  // YouTube on Fire TV, NOT the same product as YouTube TV above.
  // Holmgren Cube 2 probed 2026-05-08: 4.6KB / 14 nodes (FrameLayout
  // chrome + 11 empty Views), zero readable text. Same Cobalt runtime
  // as YouTube TV — uiautomator cannot extract regardless of login.
  // Tracked separately because at locations with regular YouTube
  // installed (vs. YouTube TV), package matching for app-launch needs
  // the right key; without an entry the walker silently skips on YouTube-
  // having Cubes when checking installed-package coverage.
  'YouTube': {
    catalogId: 'youtube',
    displayName: 'YouTube',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // Sling (com.sling): probed at holmgren-way 2026-05-08 on a signed-out
  // Cube 2 (AFTR). React Native shell with WORKING a11y exposure —
  // content-desc strings like "LIVE, <Channel>, <Show>" are extractable
  // for live tiles. However: Cube 2 is on Sling Freestream (free,
  // signed-out) tier, which has zero sports content on home (Dateline,
  // ION, A&E Crime 360, news/entertainment only — keyword scan of full
  // 45KB dump returned 0 matches for NBA/NFL/MLB/NHL/sports/ESPN/FS1).
  // Acceptance threshold (>=3 sports tiles) FAILS for the signed-out
  // probe → deferred. If a future operator subscribes Sling and a
  // re-probe shows a Sports row, build an extractor on top of the
  // proven `^LIVE, <ChannelName>, <ShowTitle>$` pattern (same shape as
  // ESPN's comma-segmented Pattern A).
  'Sling': {
    catalogId: 'sling',
    displayName: 'Sling',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // Fox Sports (com.foxsports.videogo): probed at graystone 2026-05-08.
  // MainActivity shows only "OPEN FOX ONE" — the foxsports.videogo APK is
  // a stub redirecting to com.fox.foxone for actual content. Walking the
  // stub captures nothing useful. com.fox.foxone (also installed at
  // graystone) was not separately probed; if a future operator confirms
  // its content surfaces in uiautomator, replace this entry.
  'Fox Sports': {
    catalogId: 'fox-sports',
    displayName: 'Fox Sports',
    postLaunchDelayMs: 0,
    usesWebView: true,
    extractTiles: () => [],
  },
  // Future entries (deferred for the same reasons documented above):
  //   'NFHS Network': native + extractable IF logged in. Probed on FT2
  //     2026-04-23: walker landed on IntroActivity (Subscribe / Log In /
  //     Skip For Now) — operator login required. Once logged in, NFHS
  //     likely has a native catalog grid similar to ESPN. Tracked
  //     separately because NFHS games already flow through the
  //     /api/nfhs sync path (global, not per-Cube).
  //   'Netflix': no live sports — walker would never produce useful tiles
  //     even if walkable. Skipped permanently for sports-bar use case.
  //   'MLB.TV', 'NBA App', 'NFL App': not yet probed. Likely Cobalt-style
  //     (similar to YouTube TV) given they're cross-platform native apps,
  //     but verify before assuming. Probe on a logged-in Cube before
  //     deciding usesWebView vs extractor.
}

// Helper: send a shell command via the existing send-command endpoint.
// Returns the raw stdout string (or empty on error). The endpoint reports
// false `success` on non-zero exit code, but the actual stdout often comes
// through anyway — we read it regardless.
async function adbShell(deviceId: string, command: string, timeoutMs?: number): Promise<string> {
  try {
    const resp = await fetch(`${API_BASE}/api/firetv-devices/send-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, command, ...(timeoutMs ? { timeoutMs } : {}) }),
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

  // v2.31.9 — WebView-based apps (Peacock, likely Hulu/fubo/MLB.TV)
  // can't be walked via uiautomator (the dump shows one big WebView
  // node with no extractable text). Mark in the rule + skip cleanly
  // instead of attempting a no-op walk every cycle.
  if (rule.usesWebView) {
    logger.info(
      `[FIRETV-CATALOG] ${inputSource.name} / ${rule.displayName}: skipped (webview-based — uiautomator can't read)`
    )
    return { app: rule.displayName, tilesFound: 0, uploaded: true }
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
    // 10s timeout on `uiautomator dump` — the default 3s in adb-client.ts
    // truncates dumps of complex UIs (e.g. Fire TV launcher home screen with
    // ~20+ tiles in row groups). Verified live on Cube 3: 3s aborts, 10s
    // succeeds with a 33KB dump. Walker is the only call site that needs the
    // override.
    await adbShell(deviceId, `uiautomator dump ${dumpPath}`, 10000)
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
          startTime: t.startTime ?? undefined,
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

    // v2.32.78 — fan out across inputs in parallel. Each Fire TV is a
    // physically distinct device with its own ADB session; the per-app loop
    // within a single device must stay serial (only one screen), but the
    // outer per-device loop is fully parallelizable. At Holmgren with 2
    // Fire TVs × 2 walkable apps this ~halves wall-clock walk time
    // (~56s → ~28s).
    await Promise.all(
      firetvInputs.map(async (input) => {
        if (!input.deviceId) return
        const ipAddress = ipByDeviceId.get(input.deviceId)
        if (!ipAddress) {
          logger.warn(`[FIRETV-CATALOG] No IP for ${input.name} (${input.deviceId}) — skipping`)
          return
        }

        let availableNetworks: string[] = []
        try {
          availableNetworks = JSON.parse(input.availableNetworks || '[]')
        } catch { /* skip */ }

        // v2.32.91 — Resolve `available_networks` entries to walker rules via
        // the streaming catalog's alias map. Pre-fix used exact key match
        // (`APP_WALK_RULES[name]`) which silently failed whenever a location
        // wrote a different naming variant ("Amazon Prime Video" vs "Prime
        // Video", "Apple TV" vs "Apple TV+", etc.). Holmgren stored
        // "Amazon Prime Video" → never matched the 'Prime Video'-keyed rule
        // → walker never walked Prime Video → bartender saw zero Prime Video
        // games on the Fire TV channel guide → operator reported the Watch
        // button "broken on Amazon devices". The bartender was right; there
        // was nothing to click.
        //
        // Resolution: each network name → findStreamingAppByDisplayName
        // (case-insensitive across name + displayNameAliases) → catalog
        // entry .id → look up rule whose catalogId matches. Direct key
        // match still wins as a fast path.
        const rulesByCatalogId: Record<string, { ruleKey: string; rule: AppWalkRule }> = {}
        for (const [k, r] of Object.entries(APP_WALK_RULES)) {
          rulesByCatalogId[r.catalogId] = { ruleKey: k, rule: r }
        }
        const appsToWalk: Array<{ network: string; ruleKey: string; rule: AppWalkRule }> = []
        for (const network of availableNetworks) {
          if (APP_WALK_RULES[network]) {
            appsToWalk.push({ network, ruleKey: network, rule: APP_WALK_RULES[network] })
            continue
          }
          const catalogApp = findStreamingAppByDisplayName(network)
          if (catalogApp && rulesByCatalogId[catalogApp.id]) {
            const entry = rulesByCatalogId[catalogApp.id]
            appsToWalk.push({ network, ruleKey: entry.ruleKey, rule: entry.rule })
          }
        }
        if (appsToWalk.length === 0) {
          logger.info(`[FIRETV-CATALOG] ${input.name}: no walkable apps in available_networks`)
          return
        }

        logger.info(`[FIRETV-CATALOG] ${input.name}: walking ${appsToWalk.length} app(s) — ${appsToWalk.map((a) => a.ruleKey).join(', ')}`)
        stats.inputsWalked++

        for (const { ruleKey: appName, rule } of appsToWalk) {
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
      })
    )

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
