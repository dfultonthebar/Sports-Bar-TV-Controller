# Sports Guide Admin Consolidation — April 2026

**Version:** 2.4.0
**Status:** Phase A complete (dead-weight cleanup). Phase B (new `/sports-guide-admin` page) in progress.

## Background

The backend admin UI grew organically and ended up with **five different pages** all touching sports guide / scheduling concerns:

| URL | What it was | State before this cleanup |
|---|---|---|
| `/sports-guide` | Rail Media guide viewer + config link panel | Active |
| `/sports-guide-config` | 6-tab admin (API, Location, Providers, Teams, Scheduling, Leagues) | Deprecation banner in production; still fully wired |
| `/ai-gameplan` | AI Game Plan scheduling — the "new" home scheduling moved to | Active |
| `/scheduling` | "Smart Scheduling Dashboard" (Overview + Tournaments) | Unreachable — nav link typo pointed at `/scheduler` (404) |
| `/tv-guide` | Gracenote/Spectrum TV guide viewer + config | Completely broken — called a nonexistent `/api/tv-guide/unified` endpoint |
| `/system-admin` → Scheduler tab | Scheduler Logs Dashboard | Active, buried in system admin |

Plus `/remote` (bartender remote at port 3002) with its own Schedule tab — that is **not** touched by this consolidation, it's bartender-facing not admin.

The goal of this consolidation is one clear admin page, `/sports-guide-admin`, holding everything in tab form, with all of the above URLs deleted or redirected to the right tab. The bartender remote is left alone.

---

## Phase A — Dead-weight cleanup (this commit)

All items below had **zero runtime callers** verified by repo-wide grep including `packages/`, `scripts/`, `tests/`, cron entries, and the `instrumentation.ts` startup hook.

### Deleted — orphaned components

| File | Why |
|---|---|
| `apps/web/src/components/TVGuide.tsx` | Called removed `?action=spectrum-sports` Sports Guide action (gone in October 2025 v5 rewrite); zero imports |
| `apps/web/src/components/EnhancedChannelGrid.tsx` | Same — broken caller, zero imports |

### Deleted — broken `/tv-guide` route

| File | Why |
|---|---|
| `apps/web/src/app/tv-guide/page.tsx` | Not in nav; called nonexistent `/api/tv-guide/unified` |
| `apps/web/src/components/tv-guide/UnifiedTVGuideViewer.tsx` | Only used by the dead `/tv-guide` page |
| `apps/web/src/components/tv-guide/TVGuideConfigurationPanel.tsx` | Only used by the dead `/tv-guide` page |

### Deleted — abandoned dead files

| File | Why |
|---|---|
| `apps/web/src/app/sports-guide-config/page_updated.tsx` | Abandoned partial rewrite sibling of real `page.tsx` in the same route folder |
| `apps/web/src/app/api/sports-guide/route.ts.backup-20251016-030806` | Leftover backup file from the October 2025 v5 rewrite |
| `scripts/start-scheduler.js` | Stale bootstrap script — hit port 3000 (production is 3001), used a `{action:'start'}` body the route no longer honored, and is fully superseded by the `instrumentation.ts` startup hook that landed in v2.3.0 |

### Deleted — unused API routes (16 total)

#### `/api/scheduler/*` — 6 routes, all unused
| Route | Evidence |
|---|---|
| `/api/scheduler/status` | Only caller was the deleted stale `start-scheduler.js` script |
| `/api/scheduler/manage` | Zero callers |
| `/api/scheduler/settings` | Zero callers; wrote to raw-SQL `SmartSchedulerSettings` table with no Drizzle schema |
| `/api/scheduler/system-state` | Zero callers |
| `/api/scheduler/test-match` | Zero callers (dev debug endpoint) |
| `/api/scheduler/distribution-plan` | Zero callers; distribution engine still reachable via `@sports-bar/scheduler` package directly |

#### `/api/schedules/*` — 2 unused
| Route | Evidence |
|---|---|
| `/api/schedules/logs` | Zero callers; superseded by `/api/scheduler/logs` (which uses a different `schedulerLogs` table) |
| `/api/schedules/by-game` | Zero callers |

#### `/api/scheduling/*` — 2 unused (kept 2 others)
| Route | Evidence |
|---|---|
| `/api/scheduling/analyze` | Zero callers; pattern analyzer still runs via package |
| `/api/scheduling/auto-reallocate` | Zero callers; auto-reallocator still runs via package and `packages/scheduler/src/auto-reallocator.ts` |

#### `/api/sports-guide/*` — 5 unused
| Route | Evidence |
|---|---|
| `/api/sports-guide/test-providers` | Zero callers |
| `/api/sports-guide/current-time` | Zero callers |
| `/api/sports-guide/channels` | Zero callers |
| `/api/sports-guide/ollama/query` | Zero callers (was added during October 2025 simplification, never got a UI surface) |
| `/api/sports-guide/scheduled` | Zero callers (only a rate-limit policy entry, also cleaned up) |

#### `/api/channel-presets/*` — 1 unused
| Route | Evidence |
|---|---|
| `/api/channel-presets/statistics` | Zero callers |

### Other Phase A changes

- **Nav link fix:** `apps/web/src/components/navigation-items.tsx` — the "Smart Scheduler" nav item pointed at `/scheduler` (404). Changed to `/scheduling` so the existing Smart Scheduling Dashboard is reachable during Phase B.
- **Leagues tab hidden:** `apps/web/src/app/sports-guide-config/page.tsx` — removed the "Leagues" TabsTrigger. The leagues tab rendered a static hardcoded `SPORTS_LEAGUES` constant with no backing API, telling users to use the Sports Guide viewer. Tab component file left in place for now; will be deleted in Phase B when the whole page is replaced.
- **Rate limits cleanup:** `packages/config/src/rate-limits.ts` — removed policy entries for `/api/sports-guide/scheduled` and `/api/tv-guide/unified` (routes no longer exist).

### Phase A totals

- **4,961 lines deleted** across 23 files removed
- **12 lines added** (nav link fix, leagues tab hide)
- **0 regressions** — build clean, PM2 restarts clean, `/sports-guide-config`, `/scheduling`, `/ai-gameplan`, `/remote` all return HTTP 200 post-cleanup, `/api/channel-guide` still returns 41 programs including tonight's Brewers game

---

## Routes deliberately KEPT (even with zero UI callers)

These have internal callers inside `packages/scheduler/src/scheduler-service.ts` that would start logging errors every hour if the routes went away. Leaving both route and caller in place; they'll be cleaned up together in a future pass that updates both sides at once.

| Route | Internal caller | Notes |
|---|---|---|
| `/api/sports-guide/cleanup-old` | `scheduler-service.ts:516` hourly cron | Handler is a no-op stub that returns `removed: 0` |
| `/api/scheduling/live-status` | `scheduler-service.ts:885` game state update loop | Primary code path commented out with "gameAllocations table doesn't exist" TODO |

---

## Explicitly NOT TOUCHED in this cleanup

- **Entire `n8n-workflows/` subsystem** including `/api/n8n/webhook/route.ts`, `docs/N8N_INTEGRATION.md`, workflow JSON files. N8n is not installed at Stoneyard Greenville but may be used on other location branches.
- **`packages/scheduler/`** — auto-reallocator, ESPN sync service, pattern analyzer, distribution engine, smart input allocator, all working logic.
- **`apps/web/src/instrumentation.ts`** — the ESPN sync hook from v2.3.0.
- **Bartender remote at `/remote`** (port 3002) — every tab, component, and API call untouched.
- **All DB tables** — schema changes are a separate pass with their own backups.
- **All v2.3.0 fixes** — auto-reallocator cable-box revert, Auto Pilot auto-create, channel-guide game_schedules fallback, Wisconsin RSN alias split (FanDuelWI for Bucks on ch 40 / BallyWIPlus for Brewers on ch 308), bartender-schedule `tvOutputIds` optional, league-match loosening, HomeTeam seeding.

---

## Phase B — New consolidated page (next commit)

Target: `apps/web/src/app/sports-guide-admin/page.tsx` as an 8-tab admin page that **thin-wraps existing extracted components**. No logic is copied — the new page is a structural wrapper around already-working components. Old pages at `/sports-guide-config`, `/scheduling`, `/ai-gameplan`, and `/sports-guide` continue to work throughout Phase B so the new page can be verified side-by-side before any nav flip.

### Target tab layout

| Tab | Sources |
|---|---|
| **Guide** | Extract `<SportsGuide />` from `/sports-guide` page |
| **Games** | Extract Overview + Tournaments content from `/scheduling` page; includes `<ConflictAlerts />` and `<TournamentBracket />` |
| **Schedule** | Extract `/ai-gameplan` page content into `<AIGamePlanDashboard />`; uses `/api/schedules/ai-game-plan`, `/api/schedules/bartender-schedule`, `/api/schedules/execute-single-game` |
| **Home Teams** | Extract Teams tab from `/sports-guide-config` into `<HomeTeamsManager />`; uses `/api/home-teams` |
| **Channels** | `<ChannelPresetsPanel />` (existing) + new `<StationAliasesManager />` + new `<LocalChannelOverridesManager />` |
| **Providers** | Extract Providers tab from `/sports-guide-config` into `<TVProvidersManager />` |
| **Configuration** | `<SportsGuideConfig />` (existing) + Location form (extracted from sports-guide-config Location tab) |
| **Logs** | `<SchedulerLogsDashboard />` (existing, moved from `/system-admin` → Scheduler tab) |

### Phase B constraints

- All extracted components must preserve their existing API calls, state shape, and behavior exactly.
- No schema changes.
- No API route deletions (those already happened in Phase A).
- Old pages stay working until Phase C flips the nav.

---

## Phase C — Flip navigation (v2.4.1, completed)

**Completed changes:**

1. **`apps/web/src/components/navigation-items.tsx`** — Consolidated three separate nav entries (AI Game Plan, Sports Guide, Smart Scheduler) into a single "Sports Guide" entry pointing at `/sports-guide-admin`. The Sports Guide item uses the Trophy icon (previously only on AI Game Plan) since the consolidated page covers everything the old three did plus more.

2. **`apps/web/next.config.js`** — Added `async redirects()` returning four rules that forward old admin URLs to the corresponding tab on the consolidated page:
   ```js
   /sports-guide        → /sports-guide-admin?tab=guide
   /sports-guide-config → /sports-guide-admin?tab=configuration
   /ai-gameplan         → /sports-guide-admin?tab=schedule
   /scheduling          → /sports-guide-admin?tab=games
   ```
   Redirects use `permanent: false` (HTTP 307) so bookmarks work without being burned into browser history, and so Phase D's reversibility story stays clean.

3. **`apps/web/src/app/sports-guide-admin/page.tsx`** — Added `?tab=` query param handling using `useSearchParams()` and `useRouter()`. The initial tab is read from the URL on mount (validated against an allowlist of the 8 valid tab values; invalid or missing falls back to `'guide'`). The active tab is synced back to the URL via `router.replace()` on every tab change, so deep links, browser back/forward, and redirects from old URLs all land on the right tab cleanly.

4. **`apps/web/src/app/page.tsx`** — Updated the dashboard home page's "Sports Guide" card to link directly at `/sports-guide-admin` (previously linked to `/sports-guide`). Saves a redirect hop and updates the card description to reflect the broader feature set.

5. **`/system-admin` "Scheduler" tab — left in place.** Removed in Phase D after the trial period, not now.

**What still works exactly as before (verified post-Phase C):**

- Direct navigation to any old URL (`/sports-guide`, `/sports-guide-config`, `/ai-gameplan`, `/scheduling`) lands on the correct tab of the new page via HTTP 307 redirect.
- The bartender remote at `/remote` is completely unaffected — it does not use any of the redirected URLs.
- The `/api/*` endpoints (scheduled, bartender-schedule, channel-guide, ai-game-plan, home-teams, etc.) are not affected by the redirects, which only match page paths.
- All v2.3.0 fixes remain load-bearing (auto-reallocator revert, ESPN sync, Auto Pilot auto-create, channel-guide fallback, Wisconsin RSN alias split, league-match loosening, HomeTeam seeding).

**Rollback:** Revert the Phase C commit. The four redirect rules disappear, the nav item goes back to three entries pointing at the old URLs, the `?tab=` handling becomes a no-op (the page still works with its internal useState default). Old pages are still on disk and immediately navigable again.

## Phase D — Delete old pages after trial period (future)

After one full evening of bar operations running on the new page without issues, delete:
- `apps/web/src/app/sports-guide/page.tsx`
- `apps/web/src/app/sports-guide-config/page.tsx`
- `apps/web/src/app/ai-gameplan/page.tsx`
- `apps/web/src/app/scheduling/page.tsx`
- Old component files only used by the above
- `/system-admin` Scheduler tab entry

---

## Deferred to future passes (NOT in this consolidation)

- **DB schema cleanup** — `SmartSchedulerSettings` (raw SQL table, no Drizzle schema, zero readers/writers after Phase A), `scheduleLogs` (table, superseded by `schedulerLogs`), possibly `scheduling_patterns` (pattern analyzer wraps queries in try/catch because the table "may not exist"). Schema changes need their own pass with DB backups.
- **Merging `/api/schedules/` vs `/api/scheduling/` namespaces.** They do different things and touching this is a big-bang refactor unsuitable for a cleanup pass.
- **Cleaning up `/api/sports-guide/cleanup-old` and `/api/scheduling/live-status`** — requires coordinated edits to both the route and `scheduler-service.ts` caller, and a decision about whether the cron is still useful at all.
- **Removing the `@sports-bar/directv` package's JSON-reading tech debt** — flagged in CLAUDE.md for months.
- **Building the admin UI for team alias / match validation** that `docs/AI_SCHEDULER_IMPLEMENTATION_SUMMARY.md` described but was never built.

---

## Rollback

Every phase is a single commit. Rolling back any phase is `git revert <sha>` followed by `npm run build && pm2 restart sports-bar-tv-controller`. Phase A specifically rolls back cleanly because:
- Deleted code has zero callers (verified by grep pre-deletion), so reverting restores working state
- No DB changes
- No API contract changes for routes that remained
- The nav link fix, tab hide, and rate-limits edit are all one-line changes
