# Streaming Provider Roadmap — beyond ESPN + Prime Video

**Purpose:** map the path to bartender-remote streaming-guide content for the apps the on-device walker can't extract from. As of v2.33.2 the catalog walker only produces tiles for ESPN (`com.espn.gtv`) and Prime Video (`com.amazon.firebat`). Operators at Lucky's 1313 and other locations have asked for bartender-guide tiles for their other subscriptions: Peacock, Hulu Live TV, fuboTV, Sling, Apple TV+, YouTube TV.

**This is a multi-week project per app.** This doc is the planning artifact, not an implementation. Read it before opening another session on this work.

---

## The fundamental problem

The Fire TV Cube walker reads each app's accessibility tree via `uiautomator dump` to extract tile titles. That worked for ESPN (native Android TV app, exposes a11y tree) and Prime Video (native, accessibility-rich). It DOES NOT work for the other apps because they use one of three rendering patterns that bypass Android's a11y tree:

1. **WebView shells** — Peacock (canvas-based JS render), Hulu (paywall WebView until login), fuboTV (sign-in wall WebView). Accessibility tree contains ONE `WebView` node with no extractable text content.
2. **Cobalt runtime** — YouTube TV, regular YouTube. Renders via OpenGL surfaces using Google's Cobalt browser-equivalent. Zero accessibility nodes for content.
3. **Custom GPU renderers** — Apple TV+ uses `lunaRenderView`, Apple's React Native + Metal pipeline. Accessibility-blind even though it's "native."

Empirical findings catalogued in `packages/scheduler/src/firetv-catalog-walker.ts` `APP_WALK_RULES` lines 501-619. Each entry includes the date probed + dump size + reason.

**Consequence:** to give the bartender remote tiles for these apps, we need a SECOND data source that's NOT the walker. Per-app, this means hitting an external API or scraping a web page.

---

## Per-app feasibility assessment

| App | Public API? | Auth required? | Schedule data shape | Effort estimate | Stability risk |
|---|---|---|---|---|---|
| **Peacock / NBC Sports** | NO (probed 2026-05-09: nbc.com/api, peacocktv.com/api → 404) | Authenticated TV app uses internal API | NBC Sports has an HTML schedule page; live events visible to scraper | 5-7 days | HIGH (HTML changes break scraper) |
| **Hulu Live TV** | NO (heavily protected) | OAuth + sub credentials | Live channels list behind auth | 7-10 days | HIGH (auth refresh breaks regularly) |
| **fuboTV** | Internal API only | OAuth + sub credentials | Channel guide via auth API | 5-7 days | MEDIUM-HIGH |
| **Sling TV** | Has a partial public schedule at `sling.com/whats-on` | None for public schedule | Hourly slots per channel; clean HTML structure | 3-5 days | MEDIUM |
| **Apple TV+** | Limited sports content (MLB Friday Night Baseball + soon MLS Season Pass) | Apple Music API has events; Apple Sports app has live schedule | iCloud Sports API exists but not documented for unaffiliated developers | 7-10 days | HIGH |
| **YouTube TV** | NO (Google API + auth + sub-tier check) | OAuth + sub | Internal API only used by their apps | 10+ days | HIGH |

**Realistic ranking for a sports-bar's needs:**

1. **Peacock** (NFL Sunday Night Football, NBA, Premier League, Big Ten Saturday CFB, NHL playoffs) — high content value, medium technical effort. ~5-7 days.
2. **Sling TV** (carries a lot of live channels including FS1/2, ACCN, BTN, NFL Network) — moderate value, lower effort if their public `whats-on` page is consistent. ~3-5 days.
3. **fuboTV** (carries CBS, NBC, Fox local stations) — high value if a location has fubo, moderate effort.
4. **Apple TV+ / YouTube TV / Hulu Live TV** — lower priority. Each is significantly more effort with limited stability.

---

## Two paths forward

### Path A — Per-app custom providers (the slog)

Build a `streaming-providers/<app>.ts` module per app that:
1. Hits the public schedule URL (or scrapes HTML)
2. Parses into the catalog tile shape (`contentTitle, isLive, sportTag, deepLink, startTime`)
3. Writes to a NEW table or a `source` column on `firetv_streaming_catalog`
4. Channel-guide reads from the unified table

**Pros:** Total control. No external dependency. Free.
**Cons:** Each app is its own multi-day project. Breakages happen often (sites redesign, API tokens rotate). Maintenance burden grows linearly with apps added. Schedule scraping is legally gray (terms-of-service violations possible).

**Recommended POC scope if going this path:** ship Sling TV first (simpler HTML structure, public-facing). Estimate 3-5 days dedicated work. Then re-evaluate before tackling Peacock.

### Path B — Pay for a unified EPG provider (the pragmatic answer)

Sports-data + EPG providers like:
- **Gracenote/TMS (TheTVDB)** — comprehensive cable/satellite/streaming guide, API-based, $50-200/mo depending on volume
- **EPG.best / xmltv-epg.com** — community/paid EPG feeds in XMLTV format
- **Sportradar / The Sports DB** — sports-specific, includes streaming-availability metadata
- **The Rail Media** (already used for cable/satellite) — may have streaming coverage upgrade

A single integration (~3-5 days) gets you data for all major streaming services PLUS cable/satellite, and the provider handles the breakages.

**Pros:** Single integration covers ALL apps. Stability burden is on the provider. Faster ROI.
**Cons:** Recurring cost ($600-2400/year for fleet-scale usage). Coverage may be incomplete for niche apps. Vendor lock-in.

**Recommended POC scope if going this path:** evaluate The Rail Media's streaming-coverage upgrade first (already integrated with cable/satellite path). If insufficient, evaluate Gracenote.

### Path C — Operator-driven manual catalog seeding (the cheap interim)

Each location's bar manager manually adds tiles to `firetv_streaming_catalog` for the 5-10 highest-value events on their non-walked apps. Tiles are date-bounded so they auto-expire.

**Pros:** Zero engineering cost. Zero recurring cost. Operator picks exactly which games matter.
**Cons:** Manual labor every week. Operator must know the games + deep-link URLs. Doesn't scale.

**Recommended for:** locations where only 2-3 high-stakes games per week are important enough to schedule (e.g. SNF on Peacock).

---

## What v2.33.2 leaves the operator at Lucky's 1313 (and similar) with

- **ESPN tiles work** — walker captures them, bartender shows them, Watch button reaches PlayerActivity (or paywall if unentitled to that league on ESPN+).
- **Prime Video tiles fail at Lucky's specifically** — Cubes idle into screensaver before walker runs. Solvable in a smaller v2.33.x patch (add `KEYCODE_WAKEUP` + force-stop launcher before each walk). Estimated 2 hours.
- **Hulu / Peacock / fuboTV / Sling / Apple TV+ tiles do not appear** — this is the multi-day-per-app project documented above.

The Watch button on the bartender remote ALSO has app-launcher entries for these non-walked apps (sourced from `input_sources.available_networks`), which lets the bartender hit Watch and at least open the app — but it lands on the app's home screen, not on a specific game. That's the current gap.

---

## Decision before next session

Before opening another session on this work, decide:

1. **Path A or B or C** for non-walked apps?
2. If A: which app first? (Sling recommended as cheapest entry.)
3. If B: which provider? (Rail Media upgrade probe first.)
4. If C: hand a runbook to bar managers; ship a tile-add UI to make it easy.

This decision is a budget/strategy call, not an engineering one. The engineering work is straightforward once the path is picked.

---

## Quick fix that DOES fit in one session

The Lucky's-specific Prime Video screensaver issue is a separate, smaller problem from the multi-app gap. If the operator wants Prime Video tiles to start populating at Lucky's right now:

```typescript
// In packages/scheduler/src/firetv-catalog-walker.ts walkApp() function,
// before launching the app:
await adbShell(deviceId, 'input keyevent 224')  // KEYCODE_WAKEUP
await new Promise((r) => setTimeout(r, 500))
await adbShell(deviceId, 'input keyevent 3')    // HOME — dismisses screensaver
await new Promise((r) => setTimeout(r, 1000))
// THEN launch the target app
```

That fix alone may unblock Lucky's Prime Video catalog — but does nothing for Hulu/Peacock/fuboTV/Sling/Apple TV+/YouTube TV, which is the bigger ask.
