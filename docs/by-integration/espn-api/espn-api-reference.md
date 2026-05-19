# ESPN Public API Reference

- **Sources:**
  - Community canonical: https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b
  - ESPN devcenter (now 404): https://www.espn.com/apis/devcenter/docs/
- **Fetched:** 2026-05-18
- **Auth:** None — all endpoints below are public, no key required.

> Used by `packages/sports-apis/src/espn-scoreboard-api.ts` and `espn-teams-api.ts` in this monorepo. Powers the ESPN sync that populates `game_schedules` every 60 min (see CLAUDE.md §9).

---

## Base URLs

| Host | Purpose |
|---|---|
| `https://site.api.espn.com/apis/site/v2` | **Primary** — scoreboards, news, teams, summary |
| `https://sports.core.api.espn.com/v2` | Core entity refs (athletes, events, venues) — `$ref` chase |
| `https://site.web.api.espn.com/apis/site/v2` | Mirror of site.api with some extra surfaces |
| `https://a.espncdn.com` | CDN for team/player headshot images |

HTTP is auto-upgraded to HTTPS on all of them.

---

## Sport / League Path Combinations

URL pattern: `/sports/{sport}/{league}/...`

| Sport | League slug(s) |
|---|---|
| `football` | `nfl`, `college-football` |
| `baseball` | `mlb`, `college-baseball` |
| `basketball` | `nba`, `wnba`, `mens-college-basketball`, `womens-college-basketball` |
| `hockey` | `nhl` |
| `soccer` | `usa.1` (MLS), `eng.1` (EPL), `uefa.champions`, `fifa.world` |
| `cricket` | `{eventId}` (cricket uses event-id paths, no league slug) |

---

## Scoreboard

The system's bread-and-butter endpoint.

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard?dates=YYYYMMDD-YYYYMMDD&limit=365
```

Examples:

```
# Today's MLB games
https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard

# NFL games on 2026-09-07
https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=20260907

# Full CFB season (use groups for FBS)
https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?dates=20260901-20270101&groups=80&limit=365
```

### Useful query params

| Param | Notes |
|---|---|
| `dates` | `YYYYMMDD` or `YYYYMMDD-YYYYMMDD` |
| `limit` | Cap result count (default ~25, useful with date range) |
| `groups` | College only — `80`=FBS, `81`=FCS, `50`=D-I basketball |
| `calendar` | `blacklist` for CFB to drop bye weeks |
| `lang`, `region`, `tz` | Localization |

### Response shape (highlights)

```jsonc
{
  "leagues": [{ "id": "...", "abbreviation": "MLB", "calendar": [...] }],
  "events": [
    {
      "id": "401570123",
      "date": "2026-05-18T23:10Z",
      "name": "Milwaukee Brewers at Chicago Cubs",
      "shortName": "MIL @ CHI",
      "status": {
        "type": { "name": "STATUS_SCHEDULED" | "STATUS_IN_PROGRESS" | "STATUS_FINAL",
                  "state": "pre"|"in"|"post", "completed": false }
      },
      "competitions": [{
        "competitors": [
          { "homeAway": "home", "team": { "id": "...", "displayName": "Cubs",
            "abbreviation": "CHC", "logo": "https://a.espncdn.com/..." } },
          { "homeAway": "away", "team": { "displayName": "Brewers", "abbreviation": "MIL" } }
        ],
        "broadcasts": [
          { "market": "national", "names": ["ESPN"] },
          { "market": "home", "names": ["Marquee"] }
        ],
        "venue": { "fullName": "Wrigley Field" }
      }]
    }
  ]
}
```

**Channel mapping note (this codebase):** `broadcasts[].names[]` is the string the Channel Guide fallback (CLAUDE.md §9) maps via `network-channel-resolver.ts`. Watch for ESPN's exact strings — e.g. `"Bally Sports Wisconsin+"` vs `"FanDuel SN WI"` vs `"Brewers.TV"` — and add ALL variants to the alias bundle when seen.

---

## Event / Game Summary

```
GET https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={gameId}
```

Returns box score, plays, drives (NFL), pitchers (MLB), etc.

---

## Teams

```
GET /sports/{sport}/{league}/teams                  # all teams in league
GET /sports/{sport}/{league}/teams/{teamId}         # single team detail
GET /sports/basketball/nba/teams/{teamId}/depthcharts
GET /sports/basketball/nba/teams/{teamId}/roster
GET /sports/basketball/nba/teams/{teamId}/schedule  # full season schedule
```

Example:

```
https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams
https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/9        # Packers
```

---

## News

```
GET /sports/{sport}/{league}/news
GET /sports/{sport}/{league}/news?limit=50
```

---

## Rankings (CFB / CBB)

```
GET /sports/football/college-football/rankings
GET /sports/basketball/mens-college-basketball/rankings
```

---

## Athletes / Players

Use the core API for entity refs:

```
GET https://sports.core.api.espn.com/v2/sports/football/athletes?limit=20000&active=true
GET https://sports.core.api.espn.com/v2/sports/football/athletes/{playerId}
```

Headshot image:

```
https://a.espncdn.com/i/headshots/{sport}/players/full/{playerId}.png
```

---

## Calendar (which dates have games)

```
GET https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard
```

The top-level `leagues[0].calendar` array tells you the week structure / valid `dates=` values.

---

## Rate Limits

- No officially published rate limit.
- Community observation: aggressive bursting (>10 req/s sustained) eventually returns 429 or stale cached payloads.
- In this codebase the ESPN sync runs at startup + every 60min — well under any threshold.

---

## Gotchas

1. **`status.type.state`** is the cleanest "is the game live?" signal (`pre` / `in` / `post`). Don't string-match on `name`.
2. **CFB `groups` param** — without `groups=80` you get FCS games mixed in, which will pollute Packers-day TV plans.
3. **Soccer league IDs** are dotted country-code format (`eng.1`, `usa.1`), NOT slugs.
4. **`competitions[0]` is always the game**; outer `events[]` is the schedule wrapper. Old code that read `events[i].competitors` directly is wrong.
5. **`broadcasts[].market`** values are `national` | `home` | `away` — the bar usually wants `national` + the `home`-market broadcast for the home team.
