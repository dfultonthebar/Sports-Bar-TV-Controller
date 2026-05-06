# Team Name Matching — STATUS

**Status:** ✅ **SHIPPED.** Multi-strategy fuzzy matcher in production at `packages/scheduler/src/team-name-matcher.ts`.

## Problem (one-liner)

Sports guides spell teams a dozen different ways ("Wisconsin Badgers", "University of Wisconsin", "Badgers", "WIS"). The scheduler needs to map every variant back to the operator's `HomeTeam` rows.

## What ships

`packages/scheduler/src/team-name-matcher.ts` — `TeamNameMatcher` class with 6 strategies in priority order (highest confidence wins):

| # | Strategy | Confidence |
|---|---|---|
| 1 | EXACT — direct case-insensitive string match | 100% |
| 2 | ALIAS — matches `aliases` JSON field on `HomeTeam` | 95% |
| 3 | LEARNED — matches from previously-validated matches | 90-95% |
| 4 | FUZZY TOKEN — token-set Jaccard similarity | 70-90% |
| 5 | COMMON VARIATIONS — guide-text patterns from `commonVariations` field | 80-85% |
| 6 | ABBREVIATION — `cityAbbreviations` / `teamAbbreviations` | 65-70% |

Public API:
```ts
import { getTeamMatcher } from '@sports-bar/scheduler'
const matcher = getTeamMatcher()
const match = await matcher.match('University of Wisconsin Badgers')
// → { team: HomeTeam, confidence: 0.95, matchType: 'alias' } | null
```

`getTeamMatcher()` returns a process-wide singleton with cached `HomeTeam` rows. `resetTeamMatcher()` clears the cache (call after `HomeTeam` writes via the admin UI).

`minMatchConfidence` from `HomeTeam` is consulted before returning — if the best score falls below the team's threshold, the match is rejected.

## Consumers

- `packages/scheduler/src/priority-calculator.ts` — calls the matcher to identify home-team games for priority bonuses.
- `apps/web/src/lib/scheduling/game-context.ts` — annotates games with `isHomeTeam` flag for the AI prompt.
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — sorts AI suggestions with home-team games first.

## Verification

```bash
grep -c "EXACT match\|ALIAS match\|LEARNED match\|FUZZY match" \
  packages/scheduler/src/team-name-matcher.ts
# Should be ≥ 4 (one log line per strategy).
```

## Pending follow-ups

- None. The matcher is in production at all 6 locations.
- For the original 1000-line proposal (alternate algorithms considered, edge-case analysis), see git history of this file before v2.32.45.
