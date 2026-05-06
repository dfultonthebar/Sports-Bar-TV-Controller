# Sports Scheduling System — STATUS

**Status:** ✅ **SHIPPED** (Phases 1-3). Phase 4 "Advanced Features" was an Optional Enhancements list — partially relevant items shipped, the rest are not on the roadmap.

**History:** original 3000-line design doc dated 2025-11-14. Code shipped progressively across v2.18-v2.32. Doc rewritten as STATUS in v2.32.46 (2026-05-06) after audit confirmed all in-scope phases were in production.

---

## Phase status

### Phase 1 — Foundation ✅
| Deliverable | Where it lives |
|---|---|
| `game_schedules` table | `apps/web/src/db/schema.ts` |
| `input_source_allocations` table | same |
| `input_sources` table | same |
| `tournament_brackets` table | same |
| ESPN sync service | `packages/scheduler/src/espn-sync-service.ts` |
| Game-priority calc | `packages/scheduler/src/priority-calculator.ts` (see `TEAM_PRIORITY_SYSTEM.md`) |

The original design called for separate `network_mappings` and `espn_sync_logs` tables. They didn't ship as separate tables — network resolution lives in `channel_presets` + `station_aliases` via the shared `network-channel-resolver` (see `CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md`), and sync activity is logged through `SchedulerLog`. Functionally equivalent, simpler schema.

### Phase 2 — Smart Allocation Engine ✅
APIs live under `/api/scheduling/`:
- `allocate`, `conflicts`, `games`, `ai-suggest`, `sync`, `live-status`, `input-sources`, `tournaments`, `logs`, `metrics`

Allocation logic in `packages/scheduler/src/distribution-engine.ts`. Reallocation/auto-revert in `packages/scheduler/src/auto-reallocator.ts`. AI-driven suggestions via Ollama llama3.1:8b in `apps/web/src/app/api/scheduling/ai-suggest/route.ts` (90s timeout).

### Phase 3 — Automation & UI ✅
- ESPN sync runs on startup (30s delay) + every 60min via `apps/web/src/instrumentation.ts`.
- Auto-reallocator polls each minute via `schedulerService` (also instrumentation.ts).
- Dashboard: `apps/web/src/components/admin/SmartSchedulingDashboard.tsx`.
- Bartender-facing schedule view: `EnhancedChannelGuideBartenderRemote.tsx`.
- DJ Mode (locks TVs during special events) wired through `bartender-schedule` POST.

### Phase 4 — Advanced Features (Optional Enhancements)
| Item | Status |
|---|---|
| Multi-bar support | ✅ Achieved via the 6-location branch model + Fleet Dashboard. Each location has its own DB and `Location` row; centralized priority management lives in `main` propagating via `auto-update.sh`. Different shape than the original "one DB, many locations" sketch — better fit for offline-tolerant on-prem deployments. |
| Predictive allocation (forecast next 24h, suggest source purchases) | ❌ Not shipped, not on roadmap. Operator hasn't requested it. |

## Verification

```bash
# Phase 1 tables
sqlite3 /home/ubuntu/sports-bar-data/production.db ".tables" | tr ' ' '\n' | \
  grep -E "game_schedules|input_source|tournament_brackets" | wc -l
# Should be ≥ 4

# Phase 2 endpoints
ls apps/web/src/app/api/scheduling/ | wc -l
# Should be ≥ 10

# Phase 3 services
test -f packages/scheduler/src/espn-sync-service.ts && \
  test -f packages/scheduler/src/auto-reallocator.ts && \
  echo OK
```

## Cross-references

- `CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md` — network → channel resolution (replaced the planned `network_mappings` table)
- `scheduler-patterns/HOME_TEAMS_SCHEDULER_INTEGRATION.md` — `HomeTeam` schema fields used by the scheduler
- `scheduler-patterns/TEAM_NAME_MATCHING_SYSTEM.md` — fuzzy matcher
- `scheduler-patterns/TEAM_PRIORITY_SYSTEM.md` — game priority scoring
- `SCHEDULER_FIXES_APRIL_2026.md` — recent bug-fix log

## Pending follow-ups

- None blocking. The design's in-scope work is complete.
- For the original 3000-line design (ESPN API research, DB schema rationale, full algorithm pseudocode, scenario walkthroughs), see git history of this file before v2.32.46.
