# Rail Media SportsTV Guide API Reference

- **Sources:**
  - Product page: https://www.therail.media/sportstv-guide
  - Widget page: https://www.therail.media/sportstv-guide-schedule-widget
  - Login portal: https://guide.thedailyrail.com/
  - In-repo client (authoritative — no public API docs exist): `packages/sports-apis/src/sports-guide-api.ts`
- **Fetched:** 2026-05-18

> **No public API documentation exists.** Rail Media publishes a JS widget for embedding but the underlying REST API is private and undocumented externally. The shape below was reverse-engineered for this codebase and is the de-facto reference for the fleet.

> Used by `packages/sports-apis/src/sports-guide-api.ts`. Primary "what sports are on what channel at this venue right now" source. Per-location credentials.

---

## Base URL

```
https://guide.thedailyrail.com/api/v1
```

Environment overridable via `SPORTS_GUIDE_API_URL`.

---

## Authentication

Per-location credentials provisioned by Rail Media sales.

| Field | Header / location |
|---|---|
| API key | HTTP header `apikey: <key>` |
| User ID (a.k.a. configuration ID) | Path component — `/guide/{userId}` |

Both must be set in the location's `.env`:

```
SPORTS_GUIDE_API_KEY=<key>
SPORTS_GUIDE_USER_ID=<userId>
SPORTS_GUIDE_API_URL=https://guide.thedailyrail.com/api/v1   # optional
```

The `userId` is bound to the location's channel-provider mix (DirecTV / Spectrum cable / streaming subscriptions). Two locations with different provider sets get different `userId`s — never share between locations.

---

## Endpoints

### Verify API key

```
GET /guide/{userId}
apikey: <key>
Accept: application/json
```

- HTTP 200 → key valid
- HTTP 401/403 → key invalid or wrong `userId`
- HTTP 5xx → Rail Media infra (use the circuit breaker — see in-repo client)

### Fetch guide

```
GET /guide/{userId}
GET /guide/{userId}?start_date=YYYY-MM-DD
GET /guide/{userId}?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
apikey: <key>
Accept: application/json
```

No date params → returns whatever Rail considers "now relevant" (typically today + tomorrow).

---

## Response Shape

```jsonc
{
  "listing_groups": [
    {
      "group_title": "MLB - Major League Baseball",
      "data_descriptions": ["Sport", "Game", "Network"],
      "listings": [
        {
          "time": "19:10",
          "date": "2026-05-18",
          "stations": ["FS1", "Bally Sports Wisconsin+"],
          "channel_numbers": {
            "DRTV": { "FS1": [219], "Bally Sports Wisconsin+": [654] },
            "SAT":  { "FS1": [219] },
            "CABLE":{ "FS1": [83],  "Bally Sports Wisconsin+": [308] }
          },
          "data": {
            "Sport": "MLB",
            "Game": "Milwaukee Brewers at Chicago Cubs",
            "Network": "Bally Sports Wisconsin+"
          }
        }
      ]
    }
  ]
}
```

### Field notes

- **`stations`** — broadcast network names. May arrive as `string[]` OR `{key: value}` map; client tolerates both.
- **`channel_numbers`** — keyed by lineup. Common lineup codes:
  - `CABLE` — local cable (e.g. Spectrum)
  - `SAT` — generic satellite
  - `DRTV` — DirecTV
  - `STR` — streaming where applicable
- **`data`** — flexible — keys come from `data_descriptions` of the parent group, so iterate `group.data_descriptions` to label correctly.
- **`time`** — `HH:MM` 24-hour, location-local timezone (set in Rail dashboard, not in the API call).

---

## Client wrapper helpers (in-repo)

`SportsGuideApi` (sports-guide-api.ts) provides:

| Method | Behavior |
|---|---|
| `verifyApiKey()` | One-shot GET, returns `{ valid, message }` |
| `fetchGuide(start?, end?)` | Raw call, returns `SportsGuideResponse` |
| `fetchTodayGuide()` | `fetchGuide(today, today)` |
| `fetchDateRangeGuide(days = 7)` | Today through today+days |
| `getChannelsByLineup(guide, lineup)` | Flattens `listings[].channel_numbers[lineup]` to `{time, station, channel, data}[]` |

All calls go through `@sports-bar/circuit-breaker` (timeout 15s, 50% error threshold, 30s reset) with an empty-`listing_groups` fallback when the breaker trips — so the bartender remote degrades gracefully instead of erroring.

---

## Gotchas

1. **Two locations, two `userId`s.** Sharing a `userId` across locations gives both the same channel mix and breaks the channel-guide fallback.
2. **The 502 / "Service Unavailable" path is real** — Rail Media's backend is not as hardened as ESPN's. The circuit breaker is load-bearing.
3. **Rail's network names ≠ ESPN's network names.** `"Bally Sports Wisconsin+"` here vs `"FSWI"` from ESPN. The Channel Guide injection (CLAUDE.md §9) uses `network-channel-resolver.ts` to map both into a single `ChannelPreset` row — never collapse the alias bundles.
4. **`channel_numbers[lineup][station]` is an array.** Some networks have multiple channel numbers per lineup (SD + HD). Take the first or all, depending on UI need.
5. **No bulk endpoint.** One call per date range; cache the result for ~30 min — the sports-guide-channel-sync job in this codebase already does this.
6. **No officially published rate limit.** Empirically: don't hammer faster than ~10 req/min per location.

---

## Widget (no-API alternative)

For ops who just want a static schedule embed (no programmatic access):

```html
<script src="https://guide.thedailyrail.com/widget/v1/{userId}.js"></script>
```

Not used by this codebase (we consume the full API) — listed only because operators may ask "can we just use the widget?". Answer: yes if you don't need the channel-guide fallback / AI scheduling / preset auto-mapping; no if you do.
