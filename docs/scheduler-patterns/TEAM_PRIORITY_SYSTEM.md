# Team Priority System — STATUS

**Status:** ✅ **SHIPPED.** `PriorityCalculator` in `packages/scheduler/src/priority-calculator.ts`. Drives the scheduler's TV-allocation decisions.

## What ships

A game's priority score = base score + bonuses, where the base comes from the matched `HomeTeam.priority` (0-100) or, if no home team is matched, a league-importance fallback table.

### Bonuses (additive)

| Bonus | Value | Trigger |
|---|---|---|
| `playoff` | +20 | Playoff/postseason game (when `autoPromotePlayoffs` is on) |
| `rivalry` | +15 | Opponent matches a team in `HomeTeam.rivalTeams` |
| `primeTime` | +10 | Game scheduled in prime-time hours |
| `primaryTeam` | +15 | Matched team's `isPrimary=true` |
| `dayOfWeek` | varies | League × day-of-week heuristic (e.g. Sunday NFL, Saturday NCAA football, Thursday/Monday NFL) |

### League-fallback base scores (when no home team matches)

```
NFL: 40, NBA: 35, college-football: 35, MLB: 30, NHL: 25,
mens-college-basketball: 25, womens-college-basketball: 20,
college-baseball: 20, mens-college-soccer: 15, womens-college-soccer: 15
```

This is what keeps TVs out of the "default to ESPN" hole when the operator's home teams aren't playing — non-home-team games still get a reasonable score so the scheduler picks something interesting.

## Public API

```ts
import { PriorityCalculator } from '@sports-bar/scheduler'
const calc = new PriorityCalculator()
const score = await calc.calculateGamePriority(game)
// → { baseScore, matchConfidence, bonuses: {playoff, rivalry, primeTime, ...},
//     totalBonus, finalScore, matchedTeam, reasoning: string[], isHomeTeamGame }
```

The `reasoning` array contains human-readable explanations (`"Base priority: 75"`, `"+20 playoff"`, etc.) for the AI prompt and admin UI.

## Consumers

- `packages/scheduler/src/distribution-engine.ts` — `calculateGamePriority()` per candidate game; sorts by `finalScore` desc, then allocates TVs respecting `minTVsWhenActive` from the matched team.
- `apps/web/src/app/api/scheduling/ai-suggest/route.ts` — sorts AI suggestions home-team-first using the `isHomeTeamGame` flag.

## Verification

```bash
grep -E "bonuses\.\w+ = [0-9]+" packages/scheduler/src/priority-calculator.ts
# Should list all 5 bonus assignments (playoff, rivalry, primeTime, primaryTeam, dayOfWeek).
```

## Pending follow-ups

- None. The priority system runs every scheduling cycle at every location.
- For the original 600-line design rationale (priority-tier hierarchy proposals, alternate scoring formulas), see git history of this file before v2.32.45.
