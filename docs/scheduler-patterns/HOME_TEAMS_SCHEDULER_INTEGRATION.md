# Home Teams Scheduler Integration — STATUS

**Status:** ✅ **SHIPPED.** All 11 scheduler-related fields exist on the `HomeTeam` table; the matcher and priority-calculator both consume them in production.

## Schema (verified in `apps/web/src/db/schema.ts` + production DB)

```
HomeTeam columns 13-23:
  aliases             TEXT     JSON array of name variations
  cityAbbreviations   TEXT     JSON array (e.g. ["MIL", "Milwaukee"])
  teamAbbreviations   TEXT     JSON array (e.g. ["GB", "GBP"])
  commonVariations    TEXT     JSON array of guide-text patterns
  matchingStrategy    TEXT     'exact' | 'fuzzy' (default 'fuzzy')
  minMatchConfidence  REAL     0.0-1.0 threshold (default 0.7)
  minTVsWhenActive    INTEGER  Minimum TVs while game is live (default 1)
  autoPromotePlayoffs INTEGER  Boolean — auto-bump playoff games (default 1)
  preferredZones      TEXT     JSON array of zone IDs
  rivalTeams          TEXT     JSON array of opponent names
  schedulerNotes      TEXT     Free-form notes for AI prompt context
```

Plus the pre-existing `priority` (0-100), `isPrimary`, `isActive`, `category`, `conference`, etc.

## Consumers

- **Matcher** (`packages/scheduler/src/team-name-matcher.ts`) — parses the JSON fields and applies `minMatchConfidence`. See companion doc `TEAM_NAME_MATCHING_SYSTEM.md`.
- **Priority calculator** (`packages/scheduler/src/priority-calculator.ts`) — uses `priority` as base, adds bonuses for `rivalTeams` matches and playoff games (when `autoPromotePlayoffs` is on). See `TEAM_PRIORITY_SYSTEM.md`.
- **Distribution engine** (`packages/scheduler/src/distribution-engine.ts`) — honors `minTVsWhenActive` and `preferredZones` during TV allocation.
- **Override-digester** (`packages/scheduler/src/override-digester.ts`) — flags home-team override patterns at `level=warn` so they're visible in `SchedulerLog`.

## Verification

```bash
sqlite3 /home/ubuntu/sports-bar-data/production.db "PRAGMA table_info(HomeTeam);" | wc -l
# Should be ≥ 26 (id + 25 columns including all the scheduler fields).
```

Per-location: rows in `HomeTeam` are seeded from JSON during fresh install, then DB is the source of truth (per CLAUDE.md device-DB pattern). At Holmgren this is Packers / Bucks / Brewers / Badgers (8 entries).

## Pending follow-ups

- None. The integration goal is met.
- For the original design rationale (proposed schema before implementation), see git history of this file before v2.32.45.
