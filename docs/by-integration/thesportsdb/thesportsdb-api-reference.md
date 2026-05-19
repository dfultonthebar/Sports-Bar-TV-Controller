# TheSportsDB API Reference

- **Sources:**
  - https://www.thesportsdb.com/api.php
  - https://www.thesportsdb.com/free_api (502'd during fetch 2026-05-18 — content below from in-repo client + community)
  - In-repo client: `packages/sports-apis/src/thesportsdb-api.ts`
- **Fetched:** 2026-05-18

> Used by `packages/sports-apis/src/thesportsdb-api.ts`. Secondary schedule source — ESPN is primary, TheSportsDB fills gaps (e.g. niche leagues, NCAA cup competitions).

---

## Base URL & Auth

```
https://www.thesportsdb.com/api/v1/json/{API_KEY}/{endpoint}
```

| Tier | Key | Notes |
|---|---|---|
| Free demo | `3` | Used by this codebase (see `thesportsdb-api.ts:141`). Rate-limited, no livescore |
| Premium ($9/mo Patreon) | per-supporter | V2 features, 2-minute livescores, video highlights |

No headers required — key is in the URL path.

---

## Endpoints (Free)

All return JSON. Responses wrap the result in a top-level key (`teams`, `events`, `players`, `leagues`, etc.) which is `null` if no match.

### Discovery

```
GET /all_sports.php
GET /all_leagues.php
GET /all_countries.php
GET /search_all_leagues.php?c={country}&s={sport}
GET /search_all_teams.php?l={league_name}
```

### Search

```
GET /searchteams.php?t={team_name}
GET /searchplayers.php?t={team_name}&p={player_name}
GET /searchevents.php?e={event_name}
GET /searchevents.php?e={event_name}&s={season}
GET /searchvenues.php?t={venue_name}
```

### Lookup by ID

```
GET /lookupteam.php?id={teamId}
GET /lookupplayer.php?id={playerId}
GET /lookupevent.php?id={eventId}
GET /lookuptable.php?l={leagueId}&s={season}       # standings
GET /lookupleague.php?id={leagueId}
```

### Schedules / events

```
GET /eventsnextleague.php?id={leagueId}            # next 15 events in league
GET /eventspastleague.php?id={leagueId}            # last 15 events in league
GET /eventsnext.php?id={teamId}                    # team's next 5 events
GET /eventslast.php?id={teamId}                    # team's last 5 events
GET /eventsround.php?id={leagueId}&r={round}&s={season}
GET /eventsday.php?d=YYYY-MM-DD&l={leagueName}
GET /eventsday.php?d=YYYY-MM-DD&s={sport}
GET /eventsseason.php?id={leagueId}&s={season}     # full season
```

### Livescores (key=3 returns limited / cached; premium for real-time)

```
GET /livescore.php?s={sport}
GET /livescore.php?l={leagueId}
```

---

## Known League IDs (used in this codebase)

| League | ID | Notes |
|---|---|---|
| MLB | `4424` | |
| NBA | `4387` | |
| NHL | `4380` | |
| NFL | `4391` | |
| MLS | `4346` | |
| NCAA Football (FBS) | `4479` | |
| NCAA Men's Basketball | `4607` | |
| EPL | `4328` | |
| La Liga | `4335` | |
| UEFA Champions League | `4480` | |

Discover more: `GET /all_leagues.php` then filter by `strSport`.

---

## Response shape

### `lookupteam.php?id=...`

```jsonc
{
  "teams": [
    {
      "idTeam": "134860",
      "strTeam": "Milwaukee Brewers",
      "strLeague": "MLB",
      "idLeague": "4424",
      "strSport": "Baseball",
      "strStadium": "American Family Field",
      "strBadge": "https://www.thesportsdb.com/images/media/team/badge/...png",
      "strTeamFanart1": "...",
      "strDescriptionEN": "..."
    }
  ]
}
```

### `eventsnextleague.php?id=4424`

```jsonc
{
  "events": [
    {
      "idEvent": "...",
      "strEvent": "Milwaukee Brewers vs Chicago Cubs",
      "strHomeTeam": "Milwaukee Brewers",
      "strAwayTeam": "Chicago Cubs",
      "idHomeTeam": "134860",
      "idAwayTeam": "...",
      "dateEvent": "2026-05-18",
      "strTime": "19:10:00",
      "strTimestamp": "2026-05-18T19:10:00+00:00",
      "strLeague": "MLB",
      "strSeason": "2026",
      "strStatus": "Not Started"
    }
  ]
}
```

---

## Rate Limits

- Free tier (key=`3`): no published limit; observed soft-throttle around 30 req/min sustained
- 502s common during peak hours (saw one during this fetch) — wrap calls in retry-with-backoff
- This codebase wraps the client with `@sports-bar/circuit-breaker` — keep that pattern

---

## Gotchas

1. **`null` result, not 404** — when an event/team isn't found, the response is HTTP 200 with `{"teams": null}` (or `events: null`). Always null-check before iterating.
2. **`strTimestamp` is the right field** for game time — `dateEvent` + `strTime` is split and timezone-ambiguous.
3. **Premium V2 is a separate base URL** (`https://www.thesportsdb.com/api/v2/json/...`) — V1 endpoints don't accept V2 keys and vice versa for some routes.
4. **Image URLs return 200 even when image is missing** — check Content-Length before display.
5. **NCAA seasons** are stringly typed (`"2025-2026"`) not `"2026"` — copy the format from a known-good `lookuptable` response.
