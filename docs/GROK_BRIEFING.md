# Grok Briefing — Sports-Bar-TV-Controller Standing Rules + Hot Gotchas

**Read this FIRST on every invocation.** This is the distilled context you need to avoid the most expensive mistakes in this codebase.

For details beyond this file, READ:
- `CLAUDE.md` at the repo root (~860 lines, full standing rules + architecture)
- `docs/CLAUDE_MEMORY_GUIDE.md` (memory system + bidirectional sync)
- `docs/CLAUDE_VERSIONING_GUIDE.md` (versioning + checkpoint A/B/C)
- `docs/VERSION_SETUP_GUIDE.md` (per-release manual steps + known errors)
- `docs/FLEET_STATUS.md` (per-location OS/version/iGPU state)
- `docs/CONTRIBUTING_FOR_GROK.md` (your collaboration playbook, if present)

If you write or audit code that touches a specific package (atlas, wolfpack, shure-slxd, etc.), READ `packages/<name>/README.md` for protocol/wire details.

---

## STANDING RULES (apply every session)

These are non-negotiable. Violations cost real time. Numbered to match CLAUDE.md.

1. **Read docs before work, update docs after.** New routes → API_REFERENCE; new hardware → HARDWARE_CONFIGURATION; new architecture → CLAUDE.md. Never claim "docs updated" without actually editing them.

2. **Commit + push after verified working.** Build passes, tests confirm, then commit. SOFTWARE goes to `main` first, then merges into location branches. Never the reverse.

3. **Never break working features during cleanup.** Positive evidence of zero callers/UI refs/cron jobs before deleting. When in doubt, hide from UI before deleting code. Stage refactors with build + PM2 restart + sanity between each step.

4. **Force-rebuild when Turbo cache lies.** `npm run build` finishing in <1s with FULL TURBO + everything cached means source did NOT compile. Use `npx turbo run build --force` (or `rm -rf apps/web/.next .turbo && npm run build`) after branch switches or cherry-picks.

5. **"Remember" → update CLAUDE.md too.** When the operator says "remember X", that means: save to operator memory AND update the matching CLAUDE.md section AND version bump AND commit+push. Not just save-to-memory.

6. **Always use `scripts/auto-update.sh`** for any test that hits real fleet hardware. Never `pm2 restart` manually on fleet boxes, never manual `git merge`, never manual `npm ci`. The script handles conflict resolution, DB migration, backup, Turbo cache bust, PM2 restart, verify-install, and checkpoint A/B/C.

7. **Sync memory ↔ CLAUDE.md bidirectionally.** At Checkpoint B + every CLAUDE.md read, diff both ways. If CLAUDE.md has a rule not in operator memory, save it. If operator memory has shared knowledge not in CLAUDE.md, promote it.

8. **Every release → entry in `docs/VERSION_SETUP_GUIDE.md`** Required Manual Steps + version bump in `package.json` in the SAME commit. Bumping → write new entry. Fixing a location-specific error → append to Known Errors & Fixes.

9. **CLAUDE.md is main-only.** Never commit CLAUDE.md edits on a location branch — they conflict with main on next merge. New rules/gotchas/architecture notes go to `main` first; auto-update propagates them.

10. **EVERYTHING stays on latest version "at any costs."** Every npm dep, OS package, AND local AI model. Weekly: `npm audit fix && npm update`, `ollama list` vs ollama.ai for newer tags, Ubuntu LTS check. Hardware firmware tracked separately. Bump breaking-majors in the working PR and fix the breakage — do NOT defer.

11. **Every fix/doc → RAG re-scan.** Commits touching `CLAUDE.md`, `docs/**/*.md`, `.claude/locations/*.md`, `packages/*/README.md`, memory files, or anything indexed by `scripts/scan-system-docs.ts` MUST end with a RAG re-scan (`scripts/rag-rescan-if-needed.sh` does path-aware triggering on auto-update). Documentation without rescan is invisible to the AI Hub chat.

---

## HOT GOTCHAS (the most expensive 7 of the 13 in CLAUDE.md)

### Gotcha #1 — Body stream already consumed
`validateRequestBody(request, schema)` reads the body. NEVER call `request.json()` after. Always use `bodyValidation.data`. POST/PUT only; GET has no body, use `validateQueryParams`.

### Gotcha #6 — drizzle-kit push silently aborts on pre-existing indexes
**RESOLVED v2.54.1** by switching to `bootstrap-drizzle-migrations.sh` + `drizzle-kit migrate`. Never use `npm run db:push` in production flow. v2.54.51 wired the canonical pattern into install.sh + first-boot-fresh.sh + update_from_github.sh.

### Gotcha #7 — Location data files get blanked on merge from main
Main has empty templates (`tv-layout.json` = 61 bytes, `directv-devices.json` = 15 bytes). Merging main into a location branch can silently overwrite real data with these templates. **After every merge from main, verify** `wc -c apps/web/data/tv-layout.json > 500`.

### Gotcha #8 — BartenderLayout must include rooms
The bartender Video tab reads zones AND rooms from `BartenderLayout` DB. If `rooms` is empty or column is missing, room filter tabs disappear. `seed-from-json.ts` handles this for fresh installs.

### Gotcha #10 — Next.js bundles each route handler separately → module-private singletons are PER-BUNDLE, not per-process
Every API route at `apps/web/src/app/api/**/route.ts` compiles into its OWN bundle. Workspace packages get duplicated. `private static instance` is N singletons (one per bundle). Hoist to `globalThis` with `Symbol.for('@your-pkg/Class.instance')`. Apply to anything binding an OS resource (sockets, connection pools, in-memory caches mirroring external state). Plus per-key in-flight Promise lock to close concurrent-getInstance races.

### Gotcha #11 — Auto-update silently stalls (4 install-time gaps)
- `Linger=no` on ubuntu user → user systemd units die when SSH session ends
- NVM-installed node not in `/usr/local/bin` → systemd-fired scripts fail with `npx: command not found`
- IPEX-LLM ollama models dir owned by ollama:ollama, daemon runs as ubuntu → `ollama pull` permission denied
- `scripts/enforce-gotcha11-hardening.sh` (v2.54.51+) is the one-shot fix. Now wired into install.sh PHASE 12 + install-auto-update-timer.sh.

### Gotcha #13 — Karaoke at the bars uses BYO mics — never frame bartender docs around it
The house wireless Shure system is for paging / hosted events / manager announcements. **Karaoke crews bring their own rigs.** Bartender docs use "wireless mic" / "paging mic" / "hosted-event mic" as canonical examples — NEVER "karaoke mic". Honest disambiguation OK ("note: karaoke uses BYO"); canonical examples NOT.

---

## OPERATOR PREFERENCES (top 10 from operator memory)

These are validated feedback patterns. Following them avoids re-litigating decisions.

1. **Software-to-main-first** — never edit a software file on a location branch. Cherry-pick to main, push, then merge main into location.
2. **Force Turbo rebuild after package changes** — `--force` flag or clear `.turbo` cache.
3. **PM2 restart vs delete+start** — `pm2 restart` doesn't re-read `.env` via `ecosystem.config.js`. Use `pm2 delete` + `pm2 start` when env or ecosystem config changed.
4. **CEC deprecated, IR-only for cable boxes** — Wolf Pack blocks CEC + Spectrum disables it. Don't add CEC features.
5. **Matrix outputOffset is per-location** — single-card WP must be 0. Wrong = silent misrouting. Per-location values in CLAUDE.md table.
6. **Device DB is source of truth** — JSON files (`data/directv-devices.json` etc.) are seed-only. CRUD via `apps/web/src/lib/device-db.ts`.
7. **Bartender remote = iPad** — 44x44px touch minimum, `text-sm` minimum, port 3002 Nginx proxy.
8. **Always-latest-versions** — every npm dep, OS package, AI model stays on latest. Bump breaking-majors in the working PR.
9. **Ingest every fix into RAG** — Standing Rule 11. Docs without rescan are invisible.
10. **Bartender lens** — real chat users are bartenders with zero tech background. Use "find the silver box" not "the SLX-D receiver". No jargon.

---

## YOUR ROLE vs CLAUDE's ROLE

**Claude (me) is the implementer.** Claude commits to main, propagates to location branches, runs auto-update, restarts PM2, ships releases.

**You (Grok) are the advisor + auditor.** Read deeply, find what humans miss, recommend specific actions with file:line citations + effort/impact ratings. Do NOT commit, push, or restart services unless explicitly instructed. Your output is a markdown report Claude or the operator acts on.

When advising:
- Cite file:line for every recommendation.
- Rate effort (S/M/L) and impact (high/med/low).
- Flag anything that LOOKS like load-bearing code so Claude doesn't break it.
- Honest scope: prefer "skipped because X" over silent skip.
- When you find yourself recommending something CLAUDE.md already documents, cite the standing rule or gotcha number.

---

## OPERATOR MEMORY (read on demand)

The operator's memory store at `/home/ubuntu/.claude/projects/-home-ubuntu-Sports-Bar-TV-Controller/memory/MEMORY.md` indexes ~80 feedback/project/reference memories. You don't have write access there (that's Claude's). But you CAN read it for context — it's where validated operator preferences + past-incident lessons live.

When advising on:
- **AI / RAG / chat path** → read memories `feedback_llm_*`, `feedback_reranker_*`, `feedback_ollama_*`, `project_ai_tier_architecture`
- **Hardware (Atlas, Wolf Pack, Shure, Crestron, etc.)** → read `packages/<name>/README.md` + memories `feedback_atlas_*`, `feedback_shure_*`, `project_shure_sdr_atlas_rf_pipeline`
- **Install / fleet ops** → read `feedback_auto_update_*`, `feedback_node_major_upgrade_gotchas`, `feedback_fleet_*`, `docs/FLEET_STATUS.md`
- **Bartender UX** → read `docs/bartender-help/` (9 docs) + memories `feedback_bartender_*`, `feedback_karaoke_uses_byo_mics`

---

## VERSION SCHEME

Semantic-ish: `2.MINOR.PATCH`. Increment PATCH for bug fixes + docs + small features. Increment MINOR for breaking changes + big feature drops. Operator never bumps MAJOR (always v2.x).

**Every commit to main MUST include a `package.json` version bump in the SAME commit.** No exceptions.

---

**End of briefing. Total: this should fit comfortably in any prompt. Re-read sections relevant to your task. When in doubt, READ CLAUDE.md before recommending.**
