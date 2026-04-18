# Version Setup Guide

**Purpose:** This file tells Claude (and operators) what each version
release REQUIRES to work correctly at a location — new software to install,
DB rows to seed, env vars to set, verification steps to run.

It is different from `LOCATION_UPDATE_NOTES.md`:

- **`LOCATION_UPDATE_NOTES.md`** answers "should this auto-update proceed?"
  (GO/CAUTION/STOP risk assessment per commit).
- **`VERSION_SETUP_GUIDE.md`** (this file) answers "what do I need to DO
  for this version to function correctly?" (prescriptive setup tasks).

**How Claude uses it:**

During Checkpoint B of auto-update, after reading `LOCATION_UPDATE_NOTES.md`,
Claude reads the entry for every version between `PRE_MERGE_VERSION` and
`POST_MERGE_VERSION` in this file. For each entry with a "Required Manual
Step", Claude must either:

1. Verify the step was completed at this location (check the verification
   command), OR
2. Perform the step automatically if safe (`sqlite3 INSERT`, file seed, etc.), OR
3. Flag it in the checkpoint response so the operator knows to do it post-update.

**How to add an entry:**

Prepend a new section below the "Current entries" marker when bumping the
version on main. Keep entries under ~30 lines. If a version is purely
additive (no setup required), still include an entry saying "No setup
required" so Claude can confirm it read the doc.

**Cutoff:** entries older than 2 major versions can be pruned. Git history
is the archive.

---

## OPERATOR HEADS-UP — 2026-04-17 batch (v2.18.0 through v2.22.x)

**Applies to every location auto-updating tonight.** 14 versions shipped
in a single night at Lucky's 1313. Most are additive and pure software;
the `auto-update.sh` pipeline handles the merge, schema push, cache
bust, and PM2 restart automatically — you do NOT need to run any manual
steps for the update itself. Checkpoint B will reconcile these entries
for you. This section exists so you know what to watch for on the OTHER
side of the update.

### What changed (one-line per version)

- **v2.18.0–2.18.2** — Scheduler bug fixes: per-tune matrix routing was
  silently mis-routing TVs for bartender-scheduled games (UUID parseInt
  passed garbage to Wolf Pack). Plus: scheduler UI "Idle" state fix
  + override-learn hook that records bartender corrections.
- **v2.19.0** — ESPN sync now tracks real game durations per league,
  scheduler uses the learned average for `expected_free_at` instead of
  hardcoded 3h. Atlas endpoint guards stop reconnect-loop log spam at
  non-Atlas locations.
- **v2.20.0** — Autonomous agents: override-digester + failure-sweeper
  run hourly, surface recurring bartender corrections and recurring
  SchedulerLog failures as high-visibility warn rows. n8n dead code
  removed (iframe pointed at a stranger's IP — unused at all locations).
- **v2.21.0** — Four new `/api/ai/*` endpoints: shift-brief,
  distribution-plan, conflict-suggestion, weekly-summary.
- **v2.22.0** — UI wiring for v2.21.0 endpoints on the bartender
  remote + AI Suggest tab. Also fixed a pre-existing bug where college
  baseball games on ESPN/ESPNU were invisible in the Live Games list.

### What bartenders will notice the night of update

- **Scheduled tunes now land TVs on the correct input the first time.**
  Many bartenders have been manually moving TVs to the right cable box
  after every scheduled game fire — that behavior is no longer needed.
  If they've been compensating, the change will feel sudden. Brief them.
- **New Shift Brief card at the top of the remote's Video tab.** Shows
  tonight's games and anything unusual. Can be dismissed for 4 hours.
- **New "Smart Distribute" button next to "Approve All"** in the AI
  Suggest tab. Recommended flow when approving 3+ games at once.
- **College baseball shows up in Live Games** where it didn't before.
- **No UI regression expected anywhere else.**

### What to verify AFTER update (5-minute checklist)

Run each block. All commands are safe / read-only unless noted.

**1. `OLLAMA_MODEL` env var points at an installed model** (critical —
the shift-brief 404s silently if wrong):
```bash
grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
# If .env value isn't in the installed list, edit .env and do:
# pm2 delete sports-bar-tv-controller && pm2 start ecosystem.config.js
```

**2. No in-flight scheduler routing drift** (the v2.18.2 detection query):
```bash
DB=/home/ubuntu/sports-bar-data/production.db
sqlite3 "$DB" <<'SQL'
WITH alloc_outputs AS (
  SELECT s.name AS src, mi.channelNumber AS expected_input, j.value AS output
  FROM input_source_allocations a
  JOIN input_sources s ON s.id = a.input_source_id
  JOIN MatrixInput mi ON mi.id = s.matrix_input_id
  JOIN json_each(a.tv_output_ids) j
  WHERE a.status = 'active'
)
SELECT ao.src, ao.output, ao.expected_input AS expected, mr.inputNum AS actual,
       CASE WHEN ao.expected_input = mr.inputNum THEN 'ok' ELSE 'MIS-ROUTED' END AS state
FROM alloc_outputs ao LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
ORDER BY ao.src, CAST(ao.output AS INT);
SQL
```
Any `MIS-ROUTED` = an allocation created pre-v2.18.2 that the fix
didn't repair. Curl-loop repair per the v2.18.2 entry below.

**3. Atlas reconnect loop absent** (post-v2.19.0 should be zero):
```bash
pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
  | grep -c "Failed to connect to Atlas processor"
```
Expect 0. Non-zero at a non-Atlas location = guard didn't apply (check
that the build picked up the new `atlas-guard.ts`).

**4. Autonomous agents fired on restart:**
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT component, operation, message FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
   ORDER BY createdAt DESC LIMIT 4;"
```
Expect 2 summary rows per hourly tick (one each).

**5. ChannelPreset seeded** (distribution-optimizer preflight depends
on this — without it, every plan line shows `chan ✗`):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT deviceType, COUNT(*) FROM ChannelPreset WHERE isActive=1 GROUP BY deviceType;"
```
A running location should have 20+ cable / 50+ directv presets. If
zero, seed through the bartender remote preset UI before trusting
distribution-plan output.

**6. HomeTeam seeded** (drives home-team priority in every AI feature):
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT teamName, sport, league FROM HomeTeam WHERE isActive=1 ORDER BY sport;"
```
If empty, shift-brief and distribution-plan won't prioritize home-team
games. Populate per your market — see CLAUDE.md §10 reference example.

**7. `LOCATION_TIMEZONE` is set** if you're not in Central Time. The
weekly owner summary fires Monday 6am in `LOCATION_TIMEZONE` local time:
```bash
grep LOCATION_TIMEZONE /home/ubuntu/Sports-Bar-TV-Controller/.env
```

### Location-specific notes

- **Holmgren Way** (only Atlas-using location): the v2.19.0 atlas-guard
  passes through for type='atlas' and is a no-op performance-wise.
  Expected zero change in log spam volume.
- **Graystone + Holmgren Way** (multi-card Wolf Pack): the v2.18.2
  matrix routing fix is orthogonal to your non-zero `outputOffset`
  settings — those remain per-card and correct per your layout. The
  fix only repairs the parseInt-of-UUID bug. Verify-install's
  `matrix_config` layer still only catches the single-card variant;
  multi-card drift is operator-maintained per CLAUDE.md §5a.
- **Lucky's 1313**: all features built and verified tonight against
  real scheduled games. Reference implementation for the other sites.

### What NOT to panic about

- **`bartender-proxy` restart counter jumping by 1-2** during the
  update is expected (the proxy re-handshakes with the main app when
  PM2 recycles it). Only worry if it's restarting AFTER the update
  finishes and sports-bar-tv-controller is stable.
- **Hundreds of new SchedulerLog rows** with component=override-digest
  or failure-sweep every hour — that's the new autonomous agents
  reporting in. Info-level rows are the heartbeat; warn rows are the
  signal.
- **One merge conflict possible** on `apps/web/src/app/ai-hub/page.tsx`
  if your location had a local edit to that file. `auto-update.sh`'s
  `LOCATION_PATHS_OURS` doesn't cover it. If Checkpoint B reports a
  conflict here, the safe resolution is `git checkout --theirs` —
  this page is a shared AI UI, not location-specific data.

---

## Current entries

### v2.23.5 — Extract memory + versioning guides out of CLAUDE.md
**Released:** 2026-04-18

**What changed:**
- `docs/CLAUDE_MEMORY_GUIDE.md` (new) — full details on the three memory systems (auto-memory at `~/.claude/projects/.../memory/`, in-repo Memory Bank at `apps/web/src/lib/memory-bank/`, and CLAUDE.md itself). Contains the complete "how to apply" for Standing Rules 5 and 7 plus the memory-saving two-step process, edge cases, and stale-entry handling.
- `docs/CLAUDE_VERSIONING_GUIDE.md` (new) — full details on version-bumping rules, the interlock between `VERSION_SETUP_GUIDE.md` / `LOCATION_UPDATE_NOTES.md` / CLAUDE.md (disjoint responsibilities — whether-to-update vs. what-to-do vs. permanent-rules), commit strategy for release changes, and how auto-update Checkpoint A/B/C consume all three documents. Contains the complete "how to apply" for Standing Rule 8.
- `CLAUDE.md` — added a prominent "⚠️ READ FIRST" banner at the top pointing at both guides as required reading before non-trivial work. Trimmed Standing Rules 5, 7, 8 to one-line summaries that point to the guides. Replaced the 28-line Memory Bank System description (§6) with a one-paragraph summary + pointer. Replaced the Version Bumping section with a one-paragraph summary + pointer. Net: ~15 lines shorter, but much more scannable.

**Required Claude step at each location** (Claude: execute during Checkpoint B of the update that merges v2.23.5):

1. Read the READ FIRST block at the top of CLAUDE.md. Verify it references BOTH `docs/CLAUDE_MEMORY_GUIDE.md` AND `docs/CLAUDE_VERSIONING_GUIDE.md`:
```bash
head -25 /home/ubuntu/Sports-Bar-TV-Controller/CLAUDE.md | grep -c "CLAUDE_MEMORY_GUIDE\|CLAUDE_VERSIONING_GUIDE"
```
Expected: `2` (both appear in the banner).

2. Read both new guides fully. They contain the authoritative version of Standing Rules 5, 7, 8 — CLAUDE.md's one-liners are only summaries.

3. **Sync memory ↔ new guides** per Rule 7 bidirectional sync. Since the content in the guides is derived from (not new vs.) prior CLAUDE.md content, most host auto-memory entries will already match. Do a pass to confirm. If memory references `CLAUDE.md §6 Memory Bank System` by line number, update the reference to `docs/CLAUDE_MEMORY_GUIDE.md` (the full text now lives there).

**Rollback:** `git revert` is clean — restores the full text into CLAUDE.md and removes the two guide files. All previously-authoritative rules remain intact after revert.

---

### v2.23.3 — context7 + brave-search MCP servers project-wide
**Released:** 2026-04-18

**What changed:**
- `.mcp.json` (new, at repo root) — declares two MCP (Model Context Protocol) servers that every Claude Code session inside this repo gets:
  - **`context7`** by Upstash (`@upstash/context7-mcp`) — fetches up-to-date, version-accurate library docs on demand (React, Next.js, Drizzle, Tailwind, any npm package). Free tier, no API key. Invoke by saying something like "use context7 to check the latest Drizzle ORM schema API" in a Claude session.
  - **`brave-search`** by MCP org (`@modelcontextprotocol/server-brave-search`) — web search. Requires `BRAVE_API_KEY` in each location's `.env` file. Works like a web-search tool (current-events questions, looking up hardware specs, checking vendor sites).
- `.claude/settings.json` — added `"enableAllProjectMcpServers": true` so MCP servers declared in the project's `.mcp.json` auto-approve without a human having to click through the Claude Code consent prompt on first session. Safe here because we only pull from `@modelcontextprotocol/*` (MCP org — protocol maintainers) and `@upstash/*` (reputable vendor).

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.3):

1. Verify `.mcp.json` arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.mcp.json
```
Expected: contains `mcpServers.context7` and `mcpServers.brave-search` entries. The `$comment` key is intentional metadata — Claude Code ignores unknown top-level keys.

2. Confirm the auto-approve flag is in `.claude/settings.json`:
```bash
grep enableAllProjectMcpServers /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: `"enableAllProjectMcpServers": true`. If missing, the first Claude Code session at this repo will prompt a human to approve each server.

3. **(Optional but recommended)** Set up `BRAVE_API_KEY` so the `brave-search` MCP works at this location. **Without this step, Context7 works but Brave Search silently fails** when invoked — the MCP process starts, tries to read the key, aborts, and subsequent searches return empty. Not fatal to the Sports Bar app; just means that location loses the web-search tool.
    - Free tier (2,000 queries/month per key) is enough for operator/debugging use. Sign up at <https://api.search.brave.com/app/keys> — 2-minute flow, no credit card for free tier.
    - **Important — how the key actually reaches the MCP:** `.mcp.json` uses `${BRAVE_API_KEY}` which Claude Code interpolates from *its own process environment*, not from the project's `.env` file. Just editing `.env` is NOT enough — the shell that launches `claude` must have the variable exported. Two complementary places to set it:
      ```bash
      # (a) Export in every shell — works for interactive claude sessions:
      echo 'export BRAVE_API_KEY=<paste-key-here>' >> ~/.bashrc
      # Reload in your current shell or open a new one:
      source ~/.bashrc

      # (b) Also add to the project .env — so anything else at this location
      # (scripts, scheduled jobs) that reads .env sees it:
      echo 'BRAVE_API_KEY=<paste-key-here>' >> /home/ubuntu/Sports-Bar-TV-Controller/.env
      ```
    - Both files stay on this host — `.env` is gitignored, `~/.bashrc` is per-user. Neither gets pushed to any branch.
    - No restart needed for the Sports Bar app; the next time you start a **new** Claude Code session in the repo, `npx` spawns the MCP with the new env var. If the session already running, exit and restart `claude`.

4. **Smoke-test both MCPs are wired correctly.** Start a Claude Code session at the repo and ask:
    - "Use context7 to look up the current @sports-bar/drizzle-orm type for a nullable column." → expect a real answer citing docs.
    - "Use brave search to find recent Spectrum cable firmware release notes." → expect search hits, OR a clear error if `BRAVE_API_KEY` isn't set.
    - If context7 reports "server not found" but the flag is set, force a reload: inside Claude Code run `/mcp` to see connected servers, or kill the session and restart.

**Why this matters for each location:**
- Context7 is particularly useful when debugging build errors — "why did this Next.js 16 API change" gets an accurate answer without the model hallucinating an API version.
- Brave Search is useful when Claude doesn't know the cable lineup in a new city, vendor docs aren't in the repo, or a firmware release note mention is needed (e.g., "is Spectrum re-enabling CEC on their new firmware?"). It also fills the gap in checkpoint A/B decisions when external context is needed.

**Rollback:** Delete `.mcp.json` and remove `"enableAllProjectMcpServers": true` from `.claude/settings.json` — MCP servers stop loading. The Sports Bar app itself has no runtime dependency on these; they only affect Claude Code sessions inside the repo.

---

### v2.23.2 — Enable frontend-design + feature-dev Claude Code plugins project-wide
**Released:** 2026-04-18

**What changed:**
- `.claude/settings.json` — new file at project scope. Sets `enabledPlugins` for `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official`. These are plugins from Anthropic's built-in official marketplace (`claude-plugins-official`, auto-available in Claude Code — no `extraKnownMarketplaces` entry needed).
- **frontend-design** — design philosophy + system prompts that guide Claude to produce distinctive, production-grade UI (bold aesthetic choices, purposeful typography, intentional animations). Applies whenever the dev works on React/Next.js components. Invoked automatically by Claude when it detects UI/frontend work, or explicitly via `/frontend-design:*` skills after `/reload-plugins`.
- **feature-dev** — comprehensive feature-development workflow. Provides specialized subagents for codebase exploration, architecture design, and quality review. Also invokable via `/feature-dev:*` slash commands.

**Required Claude step at each location** (Claude: execute this during Checkpoint B of the update that merges v2.23.2):

1. Verify the `.claude/settings.json` file arrived with the merge:
```bash
cat /home/ubuntu/Sports-Bar-TV-Controller/.claude/settings.json
```
Expected: contains `enabledPlugins` with `frontend-design@claude-plugins-official` and `feature-dev@claude-plugins-official` both set to `true`.

2. The `claude-plugins-official` marketplace is built into Claude Code, so no marketplace-add is needed. However, the plugins themselves must be installed/cached. On most locations the official marketplace auto-updates at startup, so the plugins should be present. If a session later reports "plugin not found," run in Claude Code interactively:
```
/plugin marketplace update claude-plugins-official
/plugin install frontend-design@claude-plugins-official
/plugin install feature-dev@claude-plugins-official
/reload-plugins
```

3. Verify plugins are loaded. In Claude Code CLI:
```bash
claude plugin list 2>&1 | grep -E "frontend-design|feature-dev"
```
Expected: both plugins listed as enabled. If missing from the list but present in `.claude/settings.json`, the plugin files need to be cached — run the `/plugin install` commands from step 2 in an interactive session once and Claude Code will remember them.

4. Confirm a Claude Code session invoked at the repo picks them up:
```bash
ls ~/.claude/plugins/cache/ 2>&1 | grep -E "frontend-design|feature-dev" || echo "(plugins not yet cached — run /plugin install as step 2)"
```

**Why this is a project-scoped commit rather than a per-host install:** installing user-scope (`~/.claude/`) at each location would require a manual step that's easy to skip. Committing `enabledPlugins` to `.claude/settings.json` means every location that trusts this repo in Claude Code inherits the same enabled plugin set, and `git pull` + next session start is enough to pick up new plugins added to the list later.

**Rollback:** `git revert` the commit — drops the `.claude/settings.json` file, plugins become disabled for project sessions. The underlying plugin files (if cached at user scope) stay. No DB or runtime impact.

---

### v2.23.0 — AI Suggest diversity + per-location station-alias seeding
**Released:** 2026-04-18

**What changed:**
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — Ollama prompt loosened so the AI now proposes up to `min(totalInputs*2, games.length, 20)` suggestions (previously hard-capped at 6). Rule 4/5/6 rewritten to encourage diverse league coverage and alternate routes (e.g. Brewers game on BOTH cable ch 308 and firetv Apple TV+) so the manager can pick. Parser dedup now allows up to 2 suggestions per input and 2 per game, rejecting only exact game+input duplicates. The pattern-analyzer then learns from the manager's approve choices (this is the feedback loop — scheduler reads `input_source_allocations.tv_output_ids` hourly and builds team-routing patterns from accepted suggestions).
- `apps/web/src/lib/seed-from-json.ts` — `seedStationAliases()` changed from "skip-if-any-rows" to per-row upsert (union-merge of aliases for existing rows, insert for new rows). Without this, new entries added to `STANDARD_ALIASES` in a future release would be no-ops at already-seeded locations. **Removed** hardcoded Green Bay broadcast affiliates (ABC→WBAY, NBC→WGBA, CBS→WFRV, FOX→WLUK) from `STANDARD_ALIASES` — these are location-specific and were wrong for Madison/Appleton/other cities. **Added** 9 universal streaming alias rows (PrimeVideo, AppleTVPlus, ParamountPlus, Peacock, ESPNPlus, Netflix, Max, YouTubeTV, Hulu).
- `apps/web/src/lib/seed-from-json.ts` — New `seedLocalStationAliases()` function that reads `apps/web/data/station-aliases-local.json` and upserts the entries. This file is an empty template on `main` and populated per-location on each `location/<name>` branch.
- `apps/web/data/station-aliases-local.json` — New file. On main: `{"aliases": []}`. On each location branch: populated with that city's OTA affiliate mappings.

**Bug this fixes:** AI Suggest was only surfacing 6 games to the manager, and many of them were MLB/NHL because the Green Bay-specific affiliate aliases (WBAY as ABC, etc.) didn't exist at non-Green-Bay locations — so NBA on ABC, UFL on FOX, EPL on NBC silently failed to resolve and were dropped from the "playable" pool. Manager couldn't approve games that the system had no idea existed.

---

**Required Claude step at each location (Claude: execute this during Checkpoint B of the update that merges v2.23.0):**

You MUST populate `apps/web/data/station-aliases-local.json` with this location's OTA broadcast affiliates BEFORE the build step runs, or broadcast-network games (anything on ABC, FOX, NBC, CBS that isn't on cable-specific affiliate channels) will fail to resolve. Do NOT just read this section — execute the steps below.

**Step 1.** Identify the location by reading `/home/ubuntu/Sports-Bar-TV-Controller/.env` for `LOCATION_NAME`, and cross-check the current `station_aliases` table to see what affiliate callsigns are already seeded:
```bash
grep LOCATION_NAME /home/ubuntu/Sports-Bar-TV-Controller/.env
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT standard_name, aliases FROM station_aliases WHERE aliases LIKE '%ABC%' OR aliases LIKE '%FOX%' OR aliases LIKE '%NBC%' OR aliases LIKE '%CBS%';"
```

**Step 2.** Determine the correct OTA affiliate callsigns for this city. Use this reference table — if your city isn't listed, look up "ABC affiliate <city>" / "FOX affiliate <city>" / "NBC affiliate <city>" / "CBS affiliate <city>" via web search:

| City | ABC | FOX | NBC | CBS |
|---|---|---|---|---|
| Green Bay, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |
| Madison, WI | WKOW (ch 27) | WMSN-TV (ch 47) | WMTV (ch 15) | WISC-TV (ch 3) |
| Milwaukee, WI | WISN (ch 12) | WITI (ch 6) | WTMJ (ch 4) | WDJT (ch 58) |
| Appleton/Fox Cities, WI | WBAY (ch 2) | WLUK-TV (ch 11) | WGBA-TV (ch 26) | WFRV (ch 5) |

(Green Bay and Appleton share affiliates — they're the same DMA.)

**Step 3.** Write the file at `apps/web/data/station-aliases-local.json`. Replace the `standardName` values with this location's callsigns and adjust the `aliases` array to include `"<NETWORK>"` (bare), the callsign (`"WBAY"`), a `-TV` variant (`"WBAY-TV"`), and a display variant like `"ABC 2"` (callsign's actual OTA channel number):
```json
{
  "_location": "<LOCATION_NAME from .env>",
  "aliases": [
    {
      "standardName": "<ABC_CALLSIGN>",
      "aliases": ["ABC", "<ABC_CALLSIGN>", "<ABC_CALLSIGN>-TV", "ABC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<FOX_CALLSIGN>",
      "aliases": ["FOX", "<FOX_CALLSIGN>", "<FOX_CALLSIGN>-TV", "FOX <OTA_CHANNEL>"]
    },
    {
      "standardName": "<NBC_CALLSIGN>",
      "aliases": ["NBC", "<NBC_CALLSIGN>", "<NBC_CALLSIGN>-TV", "NBC <OTA_CHANNEL>"]
    },
    {
      "standardName": "<CBS_CALLSIGN>",
      "aliases": ["CBS", "<CBS_CALLSIGN>", "<CBS_CALLSIGN>-TV", "CBS <OTA_CHANNEL>"]
    }
  ]
}
```

**Step 4.** Also patch the live `station_aliases` DB so the fix is active WITHOUT waiting for the next fresh install to run `seedLocalStationAliases()` (the seeder only runs on empty tables). Run this SQL, substituting the callsigns and channel numbers for YOUR city:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
UPDATE station_aliases
SET aliases = json_array('ABC','<ABC_CALLSIGN>','<ABC_CALLSIGN>-TV','ABC <OTA_CHANNEL>')
WHERE standard_name='<ABC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('FOX','<FOX_CALLSIGN>','<FOX_CALLSIGN>-TV','FOX <OTA_CHANNEL>')
WHERE standard_name='<FOX_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('NBC','<NBC_CALLSIGN>','<NBC_CALLSIGN>-TV','NBC <OTA_CHANNEL>')
WHERE standard_name='<NBC_CALLSIGN>';

UPDATE station_aliases
SET aliases = json_array('CBS','<CBS_CALLSIGN>','<CBS_CALLSIGN>-TV','CBS <OTA_CHANNEL>')
WHERE standard_name='<CBS_CALLSIGN>';
SQL
```

If the existing `station_aliases` table does NOT have a row for one of these callsigns (e.g., the location was seeded before any OTA affiliate seeding), insert it instead:
```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db <<'SQL'
INSERT OR IGNORE INTO station_aliases (id, standard_name, aliases, created_at) VALUES
  (lower(hex(randomblob(16))), '<CALLSIGN>', json_array('NETWORK','<CALLSIGN>','<CALLSIGN>-TV','NETWORK <OTA_CHANNEL>'), CURRENT_TIMESTAMP);
SQL
```

**Step 5.** Commit the populated JSON file to the location branch (NOT to main — main keeps the empty template):
```bash
cd /home/ubuntu/Sports-Bar-TV-Controller
git add apps/web/data/station-aliases-local.json
git commit -m "feat(station-aliases): populate OTA affiliates for <LOCATION_NAME>"
# Push happens via auto-update.sh's normal push step — do not push manually.
```

**Step 6.** Verify the AI Suggest fix worked. After the build+restart, call the endpoint:
```bash
curl -s 'http://localhost:3001/api/scheduling/ai-suggest' | python3 -c '
import json, sys, collections
d = json.load(sys.stdin)
leagues = collections.Counter(s["league"] for s in d.get("suggestions", []))
print("leagues in suggestions:", dict(leagues))
print("total suggestions:", len(d.get("suggestions", [])))
'
```
Expected: more than 6 suggestions, spanning multiple leagues (MLB + NHL + NBA + MLS + UFL + UFC + etc., whatever has games in the 12h window). If you still see only MLB/NHL, one of the affiliate aliases was typed wrong — re-check Step 2's callsigns against the actual ESPN broadcast data (`sqlite3 .../production.db "SELECT DISTINCT broadcast_networks FROM game_schedules WHERE league='ufl' LIMIT 5;"` should show `["ABC"]` or `["FOX"]` — confirm your alias catches those bare names).

**Rollback:** The `seedStationAliases()` upsert change is additive (union-merge never deletes aliases). Reverting the code is safe; the DB rows stay. The AI Suggest prompt loosening is a prompt-text change — `git revert` removes it cleanly, and any in-flight AI suggestions from the new prompt continue to work because `parseOllamaResponse` handles both shapes.

---

### v2.22.6 — Checkpoint C enforces CLAUDE.md ↔ memory sync post-update
**Released:** 2026-04-17

**What changed:**
- `scripts/prompts/checkpoint-c.txt` — new "REQUIRED FIRST STEP" section that makes the post-restart Claude re-read `CLAUDE.md` in full, compare it against `~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md`, add missing rules as new memory entries, correct memories that conflict, remove memories for deleted features, and scan the "Known Errors & Fixes" section of `VERSION_SETUP_GUIDE.md` for any fixes that still apply at this host — all BEFORE deciding GO/CAUTION.
- Backfill entries for v2.22.2/3/4/5 (previously shipped without doc entries) and two "Known Errors & Fixes" entries (Claude CLI 2.1.113+ TTY bug, Tailwind-lockfile drift) so the updated Checkpoint C has concrete content to sync.

**Required Manual Step:** None. Triggered automatically during every successful auto-update run.

**Verification:**
```bash
# After v2.22.6 lands, the most recent auto-update log should show the
# Checkpoint C response mention memory file edits or a "no drift found" note:
grep -A3 "Checkpoint C: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)

# The memory file should have a last-modified time close to the update:
stat -c "%y %n" ~/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md
```

**Rollback:** Prompt-only change. Revert safely removes the REQUIRED-FIRST-STEP block; Checkpoint C reverts to its prior behavior (holistic health sanity check only).

---

### v2.22.5 — Shift brief: real game times + anti-hallucination guardrail
**Released:** 2026-04-17

**What changed:**
- `apps/web/src/app/api/ai/shift-brief/route.ts` — `activeAllocations` query now selects `scheduled_start` + `status` from the joined `game_schedules` row. The mapped payload includes `startLocal` (formatted in `HARDWARE_CONFIG.venue.timezone`) and `status`. The Ollama prompt's "Currently playing" section now says `"Marlins @ Brewers (8 TVs, started 6:10 PM, in_progress)"` instead of a time-less version.
- Added a CRITICAL guardrail to the prompt: "Only reference game start times that are explicitly listed above. Never invent, estimate, or round times." This stops llama3.1:8b from fabricating times for in-progress games it had no time data for.
- Deterministic fallback brief (for when Ollama is down) also shows `"started <time>"` for active allocations.

**Bug this fixes:** Shift brief was reporting "Brewers starting at 9pm" for a game that actually started at 6:10pm CT. Root cause was a lossy prompt — the active-allocations context didn't carry the start time, so the LLM made one up. Verified on Stoneyard that the DB had the correct 23:10 UTC timestamp all along.

**Required Manual Step:** None. The fix is entirely code-side; the existing `scheduling_patterns` and `game_schedules` data is already correct.

**Verification:**
```bash
# After auto-update lands, force-refresh the brief and confirm times match DB:
curl -s 'http://localhost:3001/api/ai/shift-brief?force=true' | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["brief"])'

# Compare against the actual DB times for any in-progress games:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT home_team_name, away_team_name, datetime(scheduled_start, 'unixepoch', 'localtime') FROM game_schedules WHERE status='in_progress';"
```

**Rollback:** Strictly additive fields + prompt-string change. `git revert` cleanly.

---

### v2.22.4 — Wrap claude -p in pseudo-TTY for CLI 2.1.113+
**Released:** 2026-04-17

**What changed:**
- `scripts/auto-update.sh` — the `run_checkpoint` function now wraps `claude -p --dangerously-skip-permissions` in `script -qfc "..." /dev/null` which creates a pty. The prompt is written to a mktemp file and read via `"$(cat ...)"` because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack up.

**Bug this fixes:** Claude Code CLI 2.1.113+ aborts non-interactive `claude -p` with `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. Checkpoint B/C on every location that auto-updated past 2.1.112 would fail and roll back. Affected Appleton, Graystone, Lucky's during the v2.22.x rollout. Stoneyard / Holmgren / Leg Lamp escaped because they were on 2.1.112 when their merges ran.

**Required Manual Step:** None. The fix lives in `auto-update.sh` itself; self-update re-exec ensures every location uses the fixed version starting with the run that merges it.

**Verification:**
```bash
# After a location auto-updates to v2.22.4+, the auto-update log should show
# Checkpoint B returned a DECISION (not "Claude Code timed out or errored"):
grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)
```

**Rollback:** `git revert` is safe — removes the pty wrapper. Only valid rollback target is back to `claude -p` direct invocation, which requires Claude CLI ≤ 2.1.112 to work. Do not revert unless every location's Claude CLI is downgraded.

---

### v2.22.3 — Revert Tailwind 4 → Tailwind 3 (v2.17.0 migration was incomplete)
**Released:** 2026-04-17

**What changed:**
- `apps/web/tailwind.config.js` restored from `5209838a^` (the commit that had deleted it claiming migration to `@theme` in globals.css, which was never actually done).
- `apps/web/postcss.config.js` reverted to `{ tailwindcss, autoprefixer }` plugins.
- `apps/web/package.json`: removed `@tailwindcss/postcss ^4.2.2`, added `autoprefixer ^10.4.21` back, `tailwindcss ^4.2.2` → `^3.4.18`.
- `package-lock.json` regenerated via `npm install --package-lock-only`.

**Bug this fixes:** v2.17.0's Tailwind 3→4 migration was half-done — `globals.css` still had v3 `@tailwind base/components/utilities` directives, `tailwind.config.js` was deleted with no `@theme` replacement, postcss.config still listed v3 plugins. Every location auto-update from v2.17.0 onward either failed `npm ci` (EUSAGE lockfile drift) or failed the build with "Cannot find module 'autoprefixer'" / "Cannot apply unknown utility class text-slate-100", rolled back cleanly.

**Required Manual Step:** None. Locations pulling this update will get the Tailwind 3 config + autoprefixer restored atomically.

**Verification:**
```bash
# Build should compile without the Tailwind errors that blocked v2.17.0-v2.22.2:
npx turbo run build --force --filter=@sports-bar/web 2>&1 | grep -E "Compiled|Cannot find|unknown utility" | head -5
# Expected: "✓ Compiled successfully in ~38s" and no Cannot-find/unknown-utility lines.
```

**Rollback:** If Tailwind 4 is re-attempted in the future, the migration MUST include: (a) rewrite `globals.css` from `@tailwind ...` to `@import 'tailwindcss'`, (b) add `@theme { ... }` block for custom colors, (c) update `postcss.config.js` to only `@tailwindcss/postcss`, (d) audit every `@apply` usage for v4 compatibility (v4 requires `@reference` in CSS modules). Don't ship without a successful local build at the operator's machine first.

---

### v2.22.2 — Tailwind 4 lockfile drift hotfix + npm-ci fail-safe
**Released:** 2026-04-17

**What changed:**
- `apps/web/package.json`: `tailwindcss ^3.4.18` → `^4.2.2` (matching the `@tailwindcss/postcss ^4.2.2` that commit 5209838a had added). Regenerated `package-lock.json`.
- `scripts/auto-update.sh` + `scripts/rollback.sh`: added a fail-safe — if `npm ci` exits with EUSAGE, fall back to `npm install` to regenerate node_modules from package.json. Location-side lockfile is rebuilt in-place but NOT committed back to git.

**Note:** This was an incomplete hotfix — v2.22.3 is the full Tailwind 3 revert that actually unblocks locations. The npm-ci fallback from v2.22.2 is kept because it's a strictly defensive addition for any future lockfile drift.

**Required Manual Step:** None.

**Verification:** Superseded by v2.22.3 verification.

---

### v2.22.0 — AI UI tiles + college baseball in Live Games
**Released:** 2026-04-17

**UI for v2.21.0 endpoints (all three wired in this release):**

1. **ShiftBriefTile** on the bartender remote (top of Video tab).
   Fetches `/api/ai/shift-brief` on mount, renders the LLM or
   deterministic brief, `Refresh` button forces regenerate,
   `Dismiss` hides for 4 hours (localStorage-backed).

2. **DistributionPlanModal** — the "Smart Distribute" button next to
   "Approve All" in the AI Suggest tab of ScheduledGamesPanel. Opens
   a modal that calls `/api/ai/distribution-plan` with the selected
   suggestions, shows per-line plan + preflight pills (chan ✓ / src ✓
   / outs ✓), lets bartender skip any line, and commits the selected
   rows through the existing `/api/schedules/bartender-schedule`
   POST one-at-a-time.

3. **ConflictAdvisor** — embedded inline when a bartender-schedule
   POST returns 409 inside the DistributionPlanModal. Calls
   `/api/ai/conflict-suggestion` with the rejected + conflicting
   allocation IDs. Renders recommendation + reasoning + optional
   one-line LLM summary. "Displace & retry" button triggers a force
   DELETE of the conflicting allocation followed by re-POST of the
   original body.

**Force-displace support in bartender-schedule DELETE:** Previously
only allowed cancellation of `pending` allocations. Now accepts
`?id=X&force=true` to displace `active` allocations — used exclusively
by the ConflictAdvisor flow. Sets status to `displaced` (not
`cancelled`) so forensics can tell the difference later, and clears
`input_sources.currentlyAllocated` so the replay POST can claim the
freed input.

**College baseball in Live Games (fix):** `ESPN_SPORTS` array in
`/api/sports-guide/live-by-channel/route.ts` did NOT include
`baseball/college-baseball`, so LSU/SEC games on ESPN/ESPNU never
appeared in the bartender remote's Live Games list even though they
were fully scheduled. Added the league. At Lucky's on April 17 this
went from showing 1 live game (Brewers) to 4 (Brewers + 3 college
baseball). No schema changes.

**Required manual steps:** None. Pure additive UI + one-line league
list fix. Restart PM2 after pulling.

**Verification:**
```bash
# Live games should include college baseball games that map to
# cable presets on ESPN/ESPNU/SEC Network / Longhorn Network:
curl -s 'http://localhost:3001/api/sports-guide/live-by-channel?deviceType=cable' \
  | jq '.channels | to_entries | map({ch: .key, league: .value.league, game: (.value.awayTeam + " @ " + .value.homeTeam)})'
```

**Bundle impact:** The three AI UI components are code-split into the
remote/page and ScheduledGamesPanel bundles. No runtime cost until
the user opens those views. ShiftBriefTile's `/api/ai/shift-brief`
call defers to the server-side 10-min cache, so back-to-back page
refreshes are cheap.

---

### v2.21.0 — AI features: shift brief, distribution optimizer, conflict advisor, weekly summary
**Released:** 2026-04-17

**Four new AI endpoints** (all under `/api/ai/*`):

1. **`GET /api/ai/shift-brief`** — Ollama-generated pre-shift summary
   (under 120 words) for the bartender opening the remote. Pulls
   upcoming games (next 12h), currently-playing games, recent
   failure-sweep clusters, and new override-digest recommendations.
   10-minute response cache. Graceful fallback to a deterministic
   text brief when Ollama is slow or unavailable.

2. **`POST /api/ai/distribution-plan`** — bulk scheduling optimizer.
   Give it an array of `{ gameScheduleId }`, get back an assignment
   plan that maximizes coverage: games routed to the right input
   sources with the right TV outputs using **historical data learned
   from prior games**: `scheduling_patterns` (team→input from
   pattern-analyzer), override-digest recommendations (bartender
   corrections), and per-league duration stats (game-duration-stats,
   v2.19.0). Spreads load across cable boxes automatically. Dry-run —
   caller commits each line through the existing bartender-schedule
   POST.

3. **`POST /api/ai/conflict-suggestion`** — when bartender-schedule
   returns 409, pass the rejected allocation and the conflicting
   allocation to get a ranked displacement recommendation
   (`displace` / `keep` / `ambiguous`) with factor-by-factor
   reasoning and an optional one-line LLM summary. Suggest-only — the
   UI must delete+re-POST to execute.

4. **`GET/POST /api/ai/weekly-summary`** — generates a markdown report
   of last week's operations: games aired, top teams by TV-hours,
   bartender corrections, stable learning patterns, failure clusters,
   AI Suggest usage. POST also writes the report to
   `apps/web/data/reports/week-YYYY-Www.md`. Auto-fired by
   scheduler-service on Mondays 06:00 local time.

**No schema changes.** Reads only from existing tables.

**Required manual steps:**
- [ ] **Ensure `OLLAMA_MODEL` matches an installed model.** Running
  `OLLAMA_MODEL=llama3.2` is common in older `.env` files but `latest`
  tag isn't always fetched. Check:
  ```bash
  curl -s http://localhost:11434/api/tags | jq -r '.models[].name'
  grep OLLAMA_MODEL /home/ubuntu/Sports-Bar-TV-Controller/.env
  ```
  Set `OLLAMA_MODEL=llama3.1:8b` (or whichever model is listed + you
  want to use) and `pm2 delete/start` to reload. The shift-brief + AI
  Suggest endpoints 404 silently if the model tag is wrong, falling
  back to deterministic text — still usable, but loses the LLM layer.
- [ ] **No new cron entry** — weekly summary hook piggybacks on the
  existing scheduler-service tick.

**Verification:**
```bash
# Smoke-test shift brief (may take ~50s on CPU-only Ollama first call)
curl -s http://localhost:3001/api/ai/shift-brief | jq '.brief' | head -30

# Smoke-test distribution plan against some upcoming games
curl -s -X POST http://localhost:3001/api/ai/distribution-plan \
  -H 'Content-Type: application/json' \
  -d "{\"games\":[{\"gameScheduleId\":\"<some-uuid>\"}]}" | jq '.plan'
```

**Where the historical signal comes from:**
- `scheduling_patterns` table (team_routing rows) — written hourly by
  `packages/scheduler/src/pattern-analyzer.ts`
- `SchedulerLog component='override-digest' operation='recommend'` —
  written hourly by `packages/scheduler/src/override-digester.ts` (v2.20.0)
- `game_schedules.duration_minutes` — written by ESPN sync (v2.19.0)

All three need at least a few days of real scheduler use before the
optimizer's recommendations become meaningfully specific. Before that,
it falls back to broad-spread across cable boxes, which is still a net
improvement over the pre-v2.21.0 behavior of "first-come-first-served".

---

### v2.20.0 — Autonomous agents + n8n cleanup + GPU benchmark
**Released:** 2026-04-17

**What changed:**

1. **`override-digester` (autonomous, hourly).** New
   `packages/scheduler/src/override-digester.ts`. Reads 30 days of
   `SchedulerLog component='override-learn'` events, buckets by
   (team, outputNum, action), and emits an hourly
   `[override-digest/summarize]` summary plus one
   `[override-digest/recommend]` row per stable pattern
   (≥3 occurrences). Home-team recommendations emit at `level='warn'`
   for prominence. Does NOT auto-mutate allocation defaults — it
   surfaces recommendations for a human review.

2. **`failure-sweeper` (autonomous, hourly).** New
   `packages/scheduler/src/failure-sweeper.ts`. Tails the last hour of
   `SchedulerLog` for `success=0` or `level∈(error,warn)` rows
   (excluding intentional high-vis override signals), buckets by
   (component, operation, first 60 chars of message), emits
   `[failure-sweep/scan]` every hour and a `[failure-sweep/cluster]`
   warn row per recurring signature (≥3 occurrences). Tonight's UUID
   parseInt bug would have been flagged within an hour under this.

3. **n8n dead code removed.** Deleted `n8n-workflows/` directory,
   `/api/n8n/webhook` route, n8n tab from AI Hub UI, `N8nWebhookLog` +
   `N8nWorkflowConfig` schema tables (both empty), and
   `/api/n8n` entry from `packages/auth/src/config.ts`
   webhook-endpoint patterns. The embedded iframe used to point at
   `http://24.123.87.42:5678` (a non-internal IP). ~300 lines gone.

**Schema changes:** `N8nWebhookLog` and `N8nWorkflowConfig` tables
dropped. Both were empty at every location. Drizzle schema no longer
declares them.

**Required manual steps:**
- [ ] **Drop n8n tables** (safe — always empty in practice):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "DROP TABLE IF EXISTS N8nWebhookLog; DROP TABLE IF EXISTS N8nWorkflowConfig;"
  ```
- [ ] **Restart PM2** — autonomous agents fire inside the existing
  hourly cleanup tick; no new scheduler entry point needed.

**Verification:**
```bash
# Agents should emit one summary + scan row per hour. Check last 4 hours:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT datetime(createdAt,'unixepoch','localtime'), component, operation, message
   FROM SchedulerLog
   WHERE component IN ('override-digest','failure-sweep')
     AND createdAt >= strftime('%s','now','-4 hours')
   ORDER BY createdAt DESC LIMIT 20;"
```

**GPU acceleration notes (for other locations deciding whether to try):**
- Ollama ships with a Vulkan backend at `/usr/local/lib/ollama/vulkan/`.
  Enable with `OLLAMA_VULKAN=1` (the environment var must be set — not
  just `OLLAMA_LLM_LIBRARY=vulkan`).
- **Intel Iris Xe (13900HK at Lucky's 1313): Vulkan is SLOWER than CPU.**
  CPU baseline 10.8 tok/sec, Vulkan 7.4 tok/sec on llama3.1:8b. The iGPU
  shares RAM (no bandwidth win) and has too few EUs to beat an
  alderlake-tuned ggml CPU build. **Don't enable.**
- Discrete GPU (NVIDIA ≥ 8GB, AMD RX with ROCm, Apple Silicon): very
  likely worth enabling. If a future location gets one, benchmark with
  the same `curl ... /api/generate ... "options":{"num_predict":80}`
  pattern against a CPU baseline and pick the winner.
- Do NOT add `OLLAMA_VULKAN=1` to `/etc/systemd/system/ollama.service`
  unless a per-location benchmark proves it's a net win. The default
  CPU path is the safe choice.

---

### v2.19.0 — Per-league duration learning + Atlas endpoint guards
**Released:** 2026-04-17

**What changed (two independent features, bundled at minor bump):**

1. **Atlas endpoint guards.** Every `/api/atlas/*` endpoint that opens a
   TCP client now calls `requireAtlasProcessor()` before touching the
   processorIp. Locations using dbx ZonePRO or BSS London (but not Atlas)
   no longer get endless reconnect-loop errors when the audio UI is open —
   the endpoint returns 404 and the Atlas client is never constructed.
   New helper: `apps/web/src/lib/atlas-guard.ts`.

2. **Per-league game duration learning.** ESPN sync now populates
   `game_schedules.duration_minutes` when both `actual_start` and
   `actual_end` timestamps are known. The scheduler's bartender-schedule
   endpoint uses the per-league historical average (5+ samples required,
   5-minute cache) to default `expected_free_at` instead of the hardcoded
   3-hour value. New helper: `apps/web/src/lib/game-duration-stats.ts`.
   Each sport converges to its real duration over a few completed games,
   which gives the scheduler tighter allocation windows (NBA ~2h15m
   instead of 3h, NFL ~3h30m instead of 3h, etc.).

**Schema changes:** None. Uses existing `duration_minutes` column.

**Required manual steps:**
- [ ] **Backfill historical durations** (one-time, safe):
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" "UPDATE game_schedules
    SET duration_minutes = CAST(ROUND((actual_end - actual_start)/60.0) AS INTEGER)
    WHERE actual_start IS NOT NULL AND actual_end IS NOT NULL
      AND duration_minutes IS NULL
      AND (actual_end - actual_start)/60 BETWEEN 20 AND 360;"
  ```
  Rows outside 20-360 min are treated as outliers (cancelled / sync
  glitches) and left NULL. Durations will accrue naturally from new
  games going forward.

**Verification:**
```bash
# Show current per-league averages once enough samples exist:
sqlite3 /home/ubuntu/sports-bar-data/production.db \
  "SELECT league, COUNT(*) AS n, ROUND(AVG(duration_minutes),0) AS avg_min
   FROM game_schedules WHERE duration_minutes IS NOT NULL
   GROUP BY league HAVING n >= 5 ORDER BY n DESC;"
```

**Caveats:**
- Before v2.19.0 ESPN sync overwrote `actual_start` with `scheduled_start`
  on every sync. Historical durations are relative to scheduled time, not
  real tune-in time, and will be slightly inflated (often 20-40 min) for
  late-starting games. Data from v2.19.0+ is accurate.
- First 5 completed games per league use the 3-hour default; after that
  the learned average kicks in.

---

### v2.18.0 — Override-learn hook for bartender matrix changes
**Released:** 2026-04-17

**What changed:**
`POST /api/matrix/route` now closes the scheduler's feedback loop. When
a bartender issues a manual route within 10 min of an active scheduled
allocation, the route handler patches that allocation's `tv_output_ids`
to reflect the correction so the hourly pattern-analyzer learns from it.
Home-team overrides (teams in the `HomeTeam` table) log at `warn` level
for stronger filtering.

**Schema changes:** None. Uses existing `input_source_allocations`,
`HomeTeam`, `SchedulerLog`, `input_sources`, `MatrixInput`.

**Required manual steps:** None. Hook activates on next `pm2 restart`
after the build completes.

**Verification:**
```bash
# After a bartender manually reroutes a scheduled TV, watch SchedulerLog:
sqlite3 /home/ubuntu/sports-bar-data/production.db <<SQL
SELECT datetime(createdAt,'unixepoch','localtime') AS ts,
       level, operation, message
FROM SchedulerLog
WHERE component='override-learn'
ORDER BY createdAt DESC LIMIT 10;
SQL
```

**Home team readiness (optional per-location):**
The hook flags overrides as `isHomeTeam=true` only when the team name
appears in the `HomeTeam` table. Lucky's 1313 has Brewers, Bucks, and
Badgers seeded; **Packers is not currently seeded** at Lucky's. To add:
```sql
INSERT INTO HomeTeam (id, teamName, sport, league, category, location, conference, isPrimary, isActive, priority, matchingStrategy, minMatchConfidence, minTVsWhenActive, autoPromotePlayoffs)
VALUES (lower(hex(randomblob(16))), 'Green Bay Packers', 'football', 'nfl', 'professional', 'Green Bay', 'NFC North', 1, 1, 0, 'fuzzy', 0.7, 1, 1);
```

**Why this matters:** Pattern-analyzer reads `tv_output_ids` hourly to
build per-team routing patterns. Bartender corrections within 10 min of
a scheduled tune are the highest-quality training signal the system can
capture — the bartender knows which sight-lines serve which teams best.

---

### v2.17.0 — Dep major upgrades (Tailwind 4, lucide-react 1, eslint 10)
**Released:** 2026-04-17

**New dependencies:**
- **`@tailwindcss/postcss`** installed as the replacement PostCSS plugin
  for Tailwind v4. `autoprefixer` was removed (baked into the new plugin).

**Dependencies removed:**
- **`sqlite3`** (the legacy package, not better-sqlite3). It was listed as
  a dependency but not imported anywhere in source — only appeared as a
  string literal in a shell-command allowlist. Removing it killed ~7
  security advisories that lived under its cacache/tar transitive tree.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Tailwind CSS** — `apps/web/src/app/globals.css` no longer uses
  `@tailwind base/components/utilities` directives; it now uses
  `@import 'tailwindcss'` + `@theme { ... }`. If a location has custom
  CSS that extends Tailwind utilities, verify those still work after
  the upgrade. The `tailwind.config.js` file was retired — all theme
  customization lives inline in `globals.css` via `@theme`.
- [ ] **lucide-react 0.x → 1.x** — icon naming stable across this range,
  but any location that pinned to a specific 0.x version in its own code
  should re-verify renders. All icons used in the bartender remote and
  admin UI were confirmed working at Lucky's.

**Verification:**
```bash
# Build must succeed — any Tailwind class that v4 removed (e.g.,
# rounded default→rounded-sm) will surface here:
NODE_ENV=development npm run build

# verify-install 7/7
bash scripts/verify-install.sh

# Pages load with CSS intact
curl -s http://localhost:3001/remote | grep -c "tailwindcss"   # should be 0 (v4 inlines styles)
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3001/remote   # 200
```

**Rollback:** If Tailwind 4 breaks UI at a location, the rollback tag
`pre-dep-upgrade-YYYYMMDD-HHMMSS` (see `git tag | grep pre-dep`) captures
the pre-upgrade state. `git reset --hard <tag>` + `npm ci` + `npm run build`
restores Tailwind 3.

**Remaining vulnerabilities:** 11 (all in drizzle-kit + next-pwa dev
dependencies; upstream maintainers haven't released fixes). These are
build-time only, not exposed to runtime attackers, and cannot currently
be patched.

---

### v2.16.x — dbx ZonePRO audio + single-card Wolf Pack support
**Released:** 2026-04-17

**New dependencies:** None.

**Schema changes:** None.

**Required manual steps:**
- [ ] **If this location uses a dbx ZonePRO (not Atlas):** verify
  `AudioProcessor.processorType = 'dbx-zonepro'` in production.db. Set if
  missing:
  ```bash
  sqlite3 $DB "UPDATE AudioProcessor SET processorType='dbx-zonepro' WHERE model LIKE 'ZonePRO%';"
  ```
- [ ] **If single-card Wolf Pack (WP-8X8/16X16/36X36):** verify
  `MatrixConfiguration.outputOffset = 0` and `audioOutputCount = 0` (unless
  Wolf Pack outputs are wired to speakers). See CLAUDE.md §5a.
- [ ] **Populate `input_sources` table** if empty — AI Suggest requires rows.
  Seed from `IRDevice` (cable boxes) and `FireTVDevice` (streaming) via
  `/api/scheduling/input-sources` POST or direct SQL.

**Verification:**
```bash
# 1. Audio control reaches correct device
curl -s http://localhost:3001/api/audio-processor | grep processorType

# 2. Matrix routing lands on expected outputs (no outputOffset drift)
bash scripts/verify-install.sh   # matrix_config layer catches single-card drift

# 3. AI Suggest returns non-empty suggestions
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest | jq .suggestions
```

---

### v2.15.x — Ollama-powered AI scheduling suggestions
**Released:** 2026-04-16

**New dependencies:**
- **Ollama CLI + `llama3.1:8b` model (~4.7GB)** required on the host.
  Auto-update.sh's `ollama_model` step runs `scripts/ensure-ollama-model.sh`
  which pulls the model on first run. First-run update extends by ~4-6
  minutes while the model downloads.

**Schema changes:** None.

**Required manual steps:**
- [ ] **Install Ollama if not already present.** Ubuntu 22+:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ```
  The `ensure-ollama-model.sh` script will then pull `llama3.1:8b`
  automatically on the first update after installation.
- [ ] **Verify Ollama is running:**
  ```bash
  curl -s http://localhost:11434/api/tags | jq '.models[].name'
  # Expect to see "llama3.1:8b"
  ```

**Verification:**
```bash
# Manual probe
ollama run llama3.1:8b "Say ok" --verbose
# Should respond with a short "ok" within ~3s of first run

# AI Suggest via API
curl -s -b cookiejar http://localhost:3001/api/scheduling/ai-suggest
```

**If Ollama fails:** AI Suggest degrades gracefully — the endpoint returns
`suggestions: []` with an explanatory message. Other app features continue
to work. Ollama is non-fatal.

---

### v2.12.x — Auto-update hardening + bidirectional memory sync
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:**
- Added `MatrixConfiguration.chassisId` (nullable TEXT) for multi-card
  support. Auto-applied by drizzle-kit push.

**Required manual steps:**
- [ ] **Install the auto-update systemd timer** (one-time per host):
  ```bash
  bash scripts/install-auto-update-timer.sh
  sudo loginctl enable-linger ubuntu   # headless hosts
  ```
- [ ] **Sync memory with CLAUDE.md Rule 7** — Checkpoint B reads this
  section and saves any missing entries to host memory automatically.

**Verification:**
```bash
# Timer armed
systemctl --user list-timers sports-bar-autoupdate.timer

# verify-install 7/7 (includes matrix_config layer added in v2.16.x)
bash scripts/verify-install.sh
```

---

### v2.11.x — Drizzle schema push resilience
**Released:** 2026-04-16

**New dependencies:** None.

**Schema changes:** Iterative + bulk-regenerate fallback added to handle
drizzle-kit push's atomic-rollback-on-duplicate-index behavior at
locations with months of pre-existing indexes.

**Required manual steps:** None — fully automatic. If a location's
auto-update hangs at the `schema_push` step, check logs for
`[SCHEMA] bulk-regenerate fallback` — that's the new path kicking in.

**Verification:**
```bash
# Verify schema is in sync
NODE_ENV=development npx drizzle-kit push
# Expect clean success OR the documented benign "already exists" warning
```

---

### v2.8.x — Samsung model probe + TV power audit trail
**Released:** 2026-04-15

**New dependencies:** None.

**Schema changes:**
- New `ChannelTuneLog` table — auto-applied by drizzle-kit push. If
  missing after an update, see CLAUDE.md Gotcha #7 for manual CREATE.

**Required manual steps:**
- [ ] **If Samsung TVs present:** run the model probe once after first
  update to populate the `model` column with real identifiers:
  ```bash
  curl -sS -b cookiejar -X POST http://localhost:3001/api/tv-discovery/probe-models
  ```
  (Runs automatically every 4 hours via instrumentation.ts after v2.8.0.)
- [ ] **If LG TVs present:** each TV must accept a one-time pairing
  dialog to populate `clientKey`. Triggered by the first power command
  from the bartender remote.

**Verification:**
```bash
sqlite3 $DB "SELECT ipAddress, brand, model, CASE WHEN authToken IS NULL THEN 'unpaired' ELSE 'paired' END FROM NetworkTVDevice;"
```

---

## Known Errors & Fixes

Append entries here whenever a location hits an error that was non-obvious
to diagnose. Format:

- **Symptom:** what the operator/UI showed
- **Root cause:** why it happened
- **Fix:** the exact SQL/command/code change that resolved it
- **Verification:** how to confirm the fix worked
- **Applies to:** `all locations` or a specific location tag
- **First seen:** YYYY-MM-DD at which location

The goal: every other location inheriting this file from main should find
the answer here instead of re-debugging from scratch. Per CLAUDE.md Rule
8, you MUST add an entry when you fix a non-trivial error.

### Auto-update rolls back at Checkpoint B after Claude CLI 2.1.113+ install

- **Symptom:** `auto-update.sh` runs through merge, npm_ci, schema_push, then fails at Checkpoint B with `FAIL at step 'checkpoint_b': Checkpoint B: Claude Code CLI failure`. The checkpoint output log contains `Error: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false)`. The auto-update rolls back cleanly (exit 4), no on-disk damage, but the location stays on its pre-merge version run after run.
- **Root cause:** Claude Code CLI 2.1.113 and later require a TTY for `claude -p` even when `--dangerously-skip-permissions` is set and stdin is piped. The auto-update runs via `setsid -f` detached from any TTY, so the check fails. Locations still on 2.1.112 don't hit this; locations where Claude CLI auto-updated past 2.1.112 do.
- **Fix:** Included in v2.22.4. `scripts/auto-update.sh` now wraps the invocation in `script -qfc "claude -p --dangerously-skip-permissions \"\$(cat $prompt_file_tmp)\"" /dev/null`, which provides a pty. Prompt goes through a mktemp file because multi-KB prompts on the command line overflow ARG_MAX once script/sh layers stack. If a location is stuck pre-v2.22.4, the workaround is to manually `git reset --hard` the location branch forward to v2.22.4 (or temporarily downgrade Claude CLI back to 2.1.112 with `curl -fsSL https://claude.ai/install.sh | bash -s -- --version 2.1.112`).
- **Verification:** `grep "Checkpoint B: DECISION" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` should return a DECISION line. Also confirm `claude --version` is ≥ 2.1.113 so you know the pty wrapper is actually what unblocked it.
- **Applies to:** all locations with Claude CLI ≥ 2.1.113. As of 2026-04-17 that's: Appleton, Graystone, Lucky's, Stoneyard-Greenville (post-upgrade). Holmgren + Leg Lamp escaped because their successful runs happened before their Claude CLI upgraded.
- **First seen:** 2026-04-17 at Appleton during v2.22.x batch rollout; Graystone and Lucky's hit the same within minutes. Fixed in v2.22.4.

### Every location rolls back at `npm_ci` with EUSAGE lockfile drift

- **Symptom:** Auto-update fails at `npm_ci` step with `npm error code EUSAGE / npm ci can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with npm install before continuing.` followed by a list of `Missing: <pkg>@<version> from lock file`. Rolls back cleanly.
- **Root cause:** A commit on main bumped a dep in a workspace `package.json` (typically `apps/web/package.json`) but the root `package-lock.json` wasn't regenerated in the same commit. `npm ci` is strict about this — correctly, since a stale lock means reproducible builds aren't actually reproducible. The concrete instance on 2026-04-17 was commit `5209838a` (v2.17.0 "Tailwind 4") that added `@tailwindcss/postcss ^4.2.2` to `apps/web/package.json` but didn't bump `tailwindcss` from `^3.4.18` to `^4.2.2` there, so the regenerated lockfile had inconsistent transitive deps.
- **Fix:** Two parts, both in v2.22.2:
  1. Fix the package.json drift on main: bump the misaligned dep, run `npm install --package-lock-only`, commit both files together.
  2. Defensive fallback in `scripts/auto-update.sh` (mirrored in `scripts/rollback.sh`): if `npm ci` exits with EUSAGE, fall back to `npm install --include=dev` which regenerates node_modules from package.json. The location's rebuilt lockfile is NOT pushed back to git — main still needs to be fixed — but one missed regen on main can no longer strand the fleet.
- **Verification:** `grep "npm install fallback succeeded" $(ls -t /home/ubuntu/sports-bar-data/update-logs/auto-update-*.log | head -1)` — if this line is present the fallback fired and the root cause needs a main-side fix.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at all 6 locations simultaneously when v2.17.0 rolled out. Fallback added in v2.22.2.

### Location stuck at pre-v2.17.0 version because `npm ci` keeps failing

- **Symptom:** Location is on, say, v2.13.2 or v2.16.x. Auto-update log shows `FAIL at step 'npm_ci'` with `Missing: tailwindcss@3.4.19 from lock file` plus ~20 transitive deps. Rolls back, repeats on next cron cycle. Days pass with no actual update.
- **Root cause:** v2.17.0 shipped an incomplete Tailwind 3→4 migration — `globals.css` still used v3 syntax, `tailwind.config.js` was deleted with no `@theme` replacement, and the package.json ↔ lockfile drift from the entry above compounded. Even with v2.22.2's fallback landing the install, the build then failed with `Cannot find module 'autoprefixer'` or `Cannot apply unknown utility class text-slate-100`.
- **Fix:** v2.22.3 reverts the Tailwind 4 migration entirely — restores `apps/web/tailwind.config.js`, reverts `postcss.config.js` to `{ tailwindcss, autoprefixer }`, `apps/web/package.json` back to `tailwindcss ^3.4.18` + `autoprefixer ^10.4.21`, regenerates lockfile. Keeps the non-Tailwind parts of v2.17.0 (lucide-react 1.x, eslint 10, sqlite3 removal) since those worked.
- **Verification:** `grep version /home/ubuntu/Sports-Bar-TV-Controller/package.json` should read ≥ 2.22.3 after a successful auto-update. Then `ls apps/web/tailwind.config.js` should exist, and `npx turbo run build --force --filter=@sports-bar/web` should compile in ~38s with no Tailwind errors.
- **Applies to:** all locations.
- **First seen:** 2026-04-17 at Stoneyard, Graystone, Appleton, Holmgren, Lucky's, Leg Lamp — essentially the entire fleet during the v2.17.0 → v2.22.x batch.

### Atlas endpoint reconnect loop on dbx/BSS locations

- **Symptom:** PM2 error log fills with thousands of
  `[ERROR] [CONNECTION] Failed to connect to Atlas processor at X.X.X.X:5321`
  messages per minute. Happens at locations that use **dbx ZonePRO** or
  **BSS Soundweb London** for audio (not Atlas). The X.X.X.X is the
  real audio processor's IP, but port 5321 is the Atlas TCP port — the
  non-Atlas device rejects the connection immediately and the Atlas
  client-manager retries forever.
- **Root cause:** Atlas endpoints (`/api/atlas/meters/stream`,
  `/api/atlas/output-meters`, etc.) didn't check the AudioProcessor's
  `processorType` before handing the IP to `getAtlasClient()`. Any
  component that polled `/api/atlas/*` on page load (audio meters,
  sources UI) started a persistent retry loop.
- **Fix (code — v2.19.0):** new helper `apps/web/src/lib/atlas-guard.ts`
  added to every Atlas endpoint. It looks up the AudioProcessor row by
  IP and returns 404 unless `processorType='atlas'`. Eliminates the
  loop at the source — no Atlas client is ever constructed for a
  non-Atlas processor.
- **Verification:**
  ```bash
  # After restart, count Atlas errors in the last minute. Should be 0:
  pm2 logs sports-bar-tv-controller --err --lines 500 --nostream \
    | awk -v ts="$(date -u -d '-1 minute' '+%Y-%m-%d %H:%M:')" '$0 >= ts' \
    | grep -c "Atlas processor"
  ```
- **Applies to:** any location whose audio processor is NOT Atlas.
  Atlas-using locations are unaffected (the guard passes when the
  AudioProcessor row has `processorType='atlas'`).
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m at
  192.168.10.50 — the Atlas client was hammering port 5321 on that IP
  while the dbx answered on 3804).

### Scheduler tunes the right channel but TVs never switch to the right input

- **Symptom:** A scheduled game fires — `scheduler-service/tune` log
  shows success, the cable box is confirmed on the correct channel —
  but the TVs that were assigned to that allocation are displaying
  something completely different (another sport, a menu, the previous
  input). The bartender has to go to the Video tab and manually move
  each TV onto the right input for every single scheduled game. This
  has been silently broken for the entire life of the bartender-
  scheduling feature; no one caught it because the tune itself always
  logged success and the channel change was visible on the cable box
  LEDs / TV-it-happened-to-land-on.
- **Root cause:** In `packages/scheduler/src/scheduler-service.ts` the
  matrix-routing loop inside `checkAndExecuteBartenderSchedules` did:
  ```ts
  const matrixInput = parseInt(inputSource.matrixInputId, 10);
  ```
  But `inputSource.matrixInputId` is a **UUID foreign key** to
  `MatrixInput.id`, not the physical input channel number.
  `parseInt("a9a2828b9eb...", 10)` returns `NaN`, and
  `parseInt("99ad5b127e...", 10)` returns `99` (reads leading digits
  until the letter). Either result gets passed as `input:` to
  `/api/matrix/route`. The Wolf Pack silently rejects NaN / out-of-range
  values OR routes the output to an unrelated physical input. Either
  way the TV ends up on the wrong source.
- **Detection:** Check whether any output claimed by an active
  scheduled allocation is actually routed to that allocation's source:
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  sqlite3 "$DB" <<'SQL'
  WITH alloc_outputs AS (
    SELECT s.name AS src, mi.channelNumber AS expected_input, j.value AS output
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    JOIN MatrixInput mi ON mi.id = s.matrix_input_id
    JOIN json_each(a.tv_output_ids) j
    WHERE a.status = 'active'
  )
  SELECT ao.src, ao.output, ao.expected_input AS expected, mr.inputNum AS actual,
         CASE WHEN ao.expected_input = mr.inputNum THEN 'ok' ELSE 'MIS-ROUTED' END AS state
  FROM alloc_outputs ao
  LEFT JOIN MatrixRoute mr ON mr.outputNum = ao.output
  ORDER BY ao.src, ao.output;
  SQL
  ```
  Any row showing `MIS-ROUTED` means the scheduler's matrix loop failed.
- **Fix (code — v2.18.2):** Replace the broken parseInt with a DB
  lookup that resolves the UUID to the actual `channelNumber`:
  ```ts
  const matrixInputRow = await db.select({
      channelNumber: schema.matrixInputs.channelNumber,
    })
    .from(schema.matrixInputs)
    .where(eq(schema.matrixInputs.id, inputSource.matrixInputId))
    .limit(1)
    .all();
  const matrixInput = matrixInputRow[0]?.channelNumber ?? NaN;
  ```
  After deploying v2.18.2, every future scheduled tune routes TVs
  correctly without bartender rescue.
- **Fix (live state for active games, tonight only):** While the new
  code only helps the NEXT tune, existing active games are still on
  the wrong inputs. Patch them directly via `/api/matrix/route` per
  output, using the correct input channel from `input_sources` →
  `MatrixInput.channelNumber`. Example for Cable Box 1 (input 1):
  ```bash
  for out in 1 3 5 6 8 10 12 13 14 16; do
    curl -s -X POST http://localhost:3001/api/matrix/route \
      -H 'Content-Type: application/json' \
      -d "{\"input\":1,\"output\":$out,\"source\":\"system\"}"
  done
  ```
- **Verification:** re-run the detection query above; `state` should
  be `ok` for every row. Also watch the next scheduled tune in
  `SchedulerLog`: `[OVERRIDE-LEARN]` entries will STOP appearing
  immediately after a schedule fires, because the bartender no longer
  needs to correct TVs — a quiet log here means the scheduler is
  doing its job.
- **Applies to:** all locations running any version prior to v2.18.2.
  The bug has been there for the entire life of the bartender-schedule
  feature — silently defeating every scheduled tune at every
  location.
- **First seen:** 2026-04-17 at Lucky's 1313. Noticed when investigating
  why the Brewers allocation on 10 TVs was only actually landing on 3,
  and confirmed on the SE Louisiana tune at 18:25 CDT — the channel
  fired correctly but all 4 TVs stayed on their prior inputs. The
  LSU tune earlier the same evening was partially correct by pure
  coincidence (one TV had already been manually routed to input 2).

### Scheduler shows cable box as "Idle" while a game is actively tuned on it

- **Symptom:** On the Sports Guide admin scheduler page, a Cable Box card
  shows "Idle" even though:
  - `input_source_allocations` has a row with `status='active'` for that box
  - The physical box is correctly tuned to the game's channel
  - `SchedulerLog` shows a successful `scheduler-service/tune` entry
  Other cable boxes in the same UI show their games correctly.
- **Root causes (two variants — check both):**
  1. **`input_sources.currently_allocated` / `current_channel` not set
     after tune.** Prior to v2.18.0, `scheduler-service.checkAndExecute
     BartenderSchedules()` flipped the allocation to `active` but never
     updated the `input_sources` row. The UI reads both tables — if the
     source row is stale, the card renders as idle. Fixed in v2.18.0,
     but existing rows need one-time backfill.
  2. **`InputCurrentChannel.inputLabel` mismatch.** The scheduler UI
     joins allocations to current-channel rows by exact string match on
     `inputLabel`. Historical rows may have a shortened label like
     `"Cable 1"` while the allocation returns `"Cable Box 1"` (from
     `input_sources.name`). The join fails → card shows idle. Other
     boxes with matching labels render correctly. No automated UI
     surface reveals the mismatch — you have to diff the two API
     responses.
- **Diagnostic commands:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db
  # Variant 1: any active allocation whose source row is still idle?
  sqlite3 "$DB" "SELECT s.name, s.currently_allocated, a.status, a.channel_number
    FROM input_source_allocations a
    JOIN input_sources s ON s.id = a.input_source_id
    WHERE a.status = 'active';"
  # (currently_allocated should be 1 — if it's 0, variant 1 applies)

  # Variant 2: does InputCurrentChannel.inputLabel match input_sources.name?
  sqlite3 "$DB" "SELECT icc.inputNum, icc.inputLabel AS channel_label,
    s.name AS source_name,
    CASE WHEN icc.inputLabel = s.name THEN 'match' ELSE 'MISMATCH' END AS status
    FROM InputCurrentChannel icc
    LEFT JOIN input_sources s ON s.matrix_input_id = (
      SELECT id FROM MatrixInput WHERE channelNumber = icc.inputNum LIMIT 1)
    ORDER BY icc.inputNum;"
  ```
- **Fix:**
  ```bash
  DB=/home/ubuntu/sports-bar-data/production.db

  # Variant 1: backfill input_sources state from active allocations
  sqlite3 "$DB" "UPDATE input_sources
    SET currently_allocated = 1,
        current_channel = (SELECT a.channel_number FROM input_source_allocations a
                           WHERE a.input_source_id = input_sources.id
                             AND a.status = 'active'
                           ORDER BY a.allocated_at DESC LIMIT 1),
        updated_at = strftime('%s','now')
    WHERE EXISTS (SELECT 1 FROM input_source_allocations a
                  WHERE a.input_source_id = input_sources.id AND a.status = 'active');"

  # Variant 2: normalize InputCurrentChannel.inputLabel to match input_sources.name
  # For each mismatch row from the diagnostic above:
  sqlite3 "$DB" "UPDATE InputCurrentChannel SET inputLabel = 'Cable Box 1' WHERE inputNum = 1;"
  # Repeat per inputNum as needed. The UPDATE path in channel-presets/tune does
  # not touch inputLabel, so the corrected value persists across future tunes.
  ```
- **Verification:** refresh the Sports Guide admin scheduler page. The
  previously-idle box now shows the game's teams below the channel number.
  Also:
  ```bash
  diff <(curl -s http://localhost:3001/api/schedules/bartender-schedule | jq -r '.schedules[] | select(.status=="active") | .inputLabel') \
       <(curl -s http://localhost:3001/api/matrix/current-channels | jq -r '.channels | to_entries[] | .value.inputLabel')
  # Empty diff = all labels match.
  ```
- **Applies to:** all locations. Variant 1 affects any deployment with
  bartender allocations that activated before v2.18.0 upgrade. Variant 2
  affects any deployment with historical short-label rows in
  `InputCurrentChannel`.
- **First seen:** 2026-04-17 at Lucky's 1313. Variant 1 was found first
  (both cable boxes 1 and 2 affected); variant 2 was exposed after
  variant 1 was backfilled and Box 1 still showed idle while Box 2
  correctly displayed LSU game — the label diff between Box 1
  (`"Cable 1"`) and Box 2 (`"Cable Box 2"`) was the tell.

### AI Suggest returns `suggestions: []` with "No active input sources configured"

- **Symptom:** clicking "Get Suggestions" on the scheduler UI does
  nothing; `GET /api/scheduling/ai-suggest` returns empty with message
  `"No active input sources configured. Add cable boxes or streaming
  devices first."`
- **Root cause:** the `input_sources` table is empty. AI Suggest reads
  from this normalized table, which is supposed to be seeded from
  `IRDevice` + `FireTVDevice` + `DirecTVDevice` but the seed step was
  missed.
- **Fix:** populate `input_sources` from existing device tables. SQL
  template (adjust IDs to match your `IRDevice.id` and
  `MatrixInput.id` values):
  ```sql
  INSERT INTO input_sources (id, name, type, device_id, matrix_input_id,
    available_networks, is_active, currently_allocated, priority_rank,
    created_at, updated_at)
  VALUES ('is-cable-1','Cable Box 1','cable','<IRDevice-id>',
    '<MatrixInput-id>','[]',1,0,50, strftime('%s','now'), strftime('%s','now'));
  ```
- **Verification:** `curl -s -b cookiejar
  http://localhost:3001/api/scheduling/ai-suggest | jq '.suggestions | length'`
  should return > 0 when games are live.
- **Applies to:** all locations
- **First seen:** 2026-04-17 at Lucky's 1313

### Default Source Settings UI spinner forever

- **Symptom:** `/system-admin` → Default Source Settings tab loads
  indefinitely (perpetual spinner), never shows form.
- **Root cause:** `loadData()` sequentially awaits
  `/api/atlas/sources?processorIp=<ip>` with no timeout. The Atlas
  HiQnet probe hangs on a non-Atlas audio processor (e.g., dbx ZonePRO)
  because HiQnet isn't spoken by those devices.
- **Fix:** patched in v2.16.5 —
  `apps/web/src/components/DefaultSourceSettings.tsx` now checks
  `processor.processorType === 'atlas'` before probing + wraps the
  fetch in a 5s `AbortController`. If you hit this on a pre-v2.16.5
  location: either cherry-pick the patch, or temporarily unset the
  AudioProcessor row to skip the fetch path.
- **Verification:** open the page, it should render form controls
  within 3 seconds regardless of audio processor type.
- **Applies to:** all non-Atlas locations (dbx/BSS/etc.)
- **First seen:** 2026-04-17 at Lucky's 1313 (dbx ZonePRO 1260m)

### Matrix routing lands on wrong physical output

- **Symptom:** clicking "route to Output 1" on bartender remote
  changes the TV on output 27 (or wherever +26 lands). Operator sees
  "nothing happens" when the intended TV is actually fine; a different
  TV silently changed source.
- **Root cause:** `MatrixConfiguration.outputOffset` is set to a
  non-zero value on a single-card Wolf Pack (WP-8X8/16X16/36X36).
  `wolfpack-matrix-service.ts` adds the offset to every output number
  before sending the routing command. Single-card matrices route 1:1
  and must have `outputOffset=0`.
- **Fix:**
  ```sql
  UPDATE MatrixConfiguration SET outputOffset=0, audioOutputCount=0,
    updatedAt=datetime('now') WHERE model LIKE 'WP-%X%';
  ```
  (Only set `audioOutputCount=0` if audio is NOT wired to the Wolf
  Pack — Lucky's routes audio via dbx ZonePRO, not Wolf Pack outputs.)
  After the UPDATE, `pm2 restart sports-bar-tv-controller` to clear
  any cached route maps.
- **Verification:** v2.16.6+ adds `matrix_config` layer to
  `scripts/verify-install.sh` which FAILs if a single-card model has
  non-zero outputOffset. Also `[MATRIX-CONFIG] ⚠` is logged at every
  PM2 boot for the same condition. See CLAUDE.md §5a.
- **Applies to:** any location with a single-card Wolf Pack
- **First seen:** 2026-04-17 at Lucky's 1313 (`outputOffset=26` on
  WP-36X36 for weeks)

### `/api/bartender/layout` renders "No Layout Uploaded" despite layout existing

- **Symptom:** bartender remote Video tab shows "No Layout Uploaded"
  even though the DB has a `BartenderLayout` row with valid
  `imageUrl` and 20+ zones.
- **Root cause:** the API response uses `backgroundImage` but the
  `InteractiveBartenderLayout` component reads
  `layout.imageUrl || layout.professionalImageUrl` — name mismatch.
- **Fix:** patched in v2.16.7 —
  `apps/web/src/app/api/bartender/layout/route.ts` now returns both
  `imageUrl` and `professionalImageUrl` alongside `backgroundImage`
  for backward compat.
- **Verification:** `curl -s
  http://localhost:3001/api/bartender/layout | jq '.layout.imageUrl'`
  should be the `/api/uploads/layouts/...` path, not `null`.
- **Applies to:** all locations pre-v2.16.7
- **First seen:** 2026-04-17 at Lucky's 1313

### Auto-update schema_push never converges (350-iter cap hit)

- **Symptom:** `[SCHEMA] iterative retry hit cap (350) without
  converging` in the auto-update log. Run rolls back.
- **Root cause:** drizzle-kit push cycles through the same duplicate
  indexes at locations with many hotfix-era indexes. Iterative
  drop-and-retry never gets ahead of the cycling.
- **Fix:** v2.12.5 added a bulk-regenerate fallback — drop all
  user-defined indexes, run `drizzle-kit generate` to get the
  canonical CREATE list, apply `CREATE ... IF NOT EXISTS` in one
  transaction, final push reports benign already-exists (schema IS
  in sync). Pre-v2.12.5 locations: upgrade the auto-update.sh
  manually before the next run.
- **Verification:** auto-update log shows `[SCHEMA] bulk-apply:
  created N indexes from generate output` followed by `[SCHEMA]
  bulk-regenerate fallback: final push reports benign pre-existing
  objects — schema IS in sync`.
- **Applies to:** all locations
- **First seen:** 2026-04-16 at Lucky's 1313

---

## Archive

Older entries (>2 major versions back) pruned from this file. `git log docs/VERSION_SETUP_GUIDE.md` is the archive.
