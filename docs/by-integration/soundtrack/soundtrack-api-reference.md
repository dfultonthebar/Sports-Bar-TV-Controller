# Soundtrack Your Brand — GraphQL API v2 Reference

- **Source:** https://api.soundtrackyourbrand.com/v2/docs
- **Fetched:** 2026-05-18
- **Interactive explorer:** https://api.soundtrackyourbrand.com/v2/explore
- **Example app:** https://github.com/soundtrackyourbrand/soundtrack_api-example_app

> Used by `packages/soundtrack/` in this monorepo. Powers the bartender remote's Music tab (now-playing tile, playlist artwork, play/pause).

---

## Endpoints

| Purpose | URL |
|---|---|
| Queries & mutations | `https://api.soundtrackyourbrand.com/v2` |
| Subscriptions (WebSocket) | `wss://api.soundtrackyourbrand.com/v2/graphql-transport-ws` |
| GraphiQL explorer | `https://api.soundtrackyourbrand.com/v2/explore` |

All POSTs send `Content-Type: application/json` with a standard GraphQL body: `{"query": "...", "variables": {...}}`.

---

## Authentication

Two schemes — production should use **Token (Basic)**, never user login.

### Token (recommended)

Request a token at https://www.soundtrackyourbrand.com/our-api/apply. Send as HTTP Basic:

```
Authorization: Basic <YOUR_API_TOKEN>
```

The token is already base64-ish encoded by Soundtrack — paste it verbatim after `Basic `, do NOT re-base64.

### User login (interactive only)

```graphql
mutation {
  loginUser(input: {email: "...", password: "..."}) {
    token
    refreshToken
  }
}
```

Then send `Authorization: Bearer <token>`. Refresh with `refreshLogin(input: {refreshToken: ...})` before the 401.

### Subscriptions

WebSocket `connection_init` payload:

```json
{"type":"connection_init","payload":{"Authorization":"Bearer <TOKEN>"}}
```

---

## Common Queries

### Now playing for a sound zone

```graphql
query NowPlaying($id: ID!) {
  nowPlaying(soundZone: $id) {
    track {
      name
      artists { name }
      album {
        name
        image { url width height }
      }
    }
  }
}
```

### List accounts → locations → sound zones

```graphql
query {
  me {
    ... on PublicAPIClient {
      accounts(first: 10) {
        edges {
          node {
            businessName
            locations(first: 20) {
              edges {
                node {
                  name
                  soundZones(first: 20) {
                    edges {
                      node { id name isPaired }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### Sound zone detail

```graphql
query Zone($id: ID!) {
  soundZone(id: $id) {
    id
    name
    isPaired
    device { id }
  }
}
```

### Generic node lookup (track, playlist, schedule)

```graphql
query Lookup($id: ID!) {
  node(id: $id) {
    ... on Track { name previewUrl }
    ... on Playlist { name description }
  }
}
```

---

## Common Mutations

### Set volume (0–16)

```graphql
mutation SetVol($id: ID!, $v: Int!) {
  setVolume(input: {soundZone: $id, volume: $v}) { volume }
}
```

### Play / pause / skip / change playlist

Available — operation names not fully enumerated in the public docs. Use the explorer (`/v2/explore`) to introspect:

```graphql
{
  __schema {
    mutationType {
      fields { name args { name type { name } } }
    }
  }
}
```

Known mutation prefixes seen in the wild: `play`, `pause`, `skipTrack`, `queueTracks`, `assignSchedule`, `setVolume`, `setPlayback`.

---

## Subscriptions

### Now-playing live updates

```graphql
subscription NowPlayingSub($id: ID!) {
  nowPlayingUpdate(input: {soundZone: $id}) {
    nowPlaying {
      track {
        name
        artists { name }
        album { name image { url width height } }
      }
    }
  }
}
```

Reconnect strategy on disconnect: re-query current state via the `nowPlaying` query, then re-subscribe — the subscription does NOT replay missed events.

---

## Object Types (highlights)

| Type | Key fields |
|---|---|
| `SoundZone` | `id`, `name`, `isPaired`, `device`, `nowPlaying`, `schedule` |
| `Account` | `businessName`, `locations` (connection) |
| `Location` | `name`, `soundZones` (connection) |
| `NowPlaying` | `track`, `startedAt` |
| `Track` | `name`, `artists[]`, `album`, `previewUrl` |
| `Album` | `name`, `image { url, width, height }` |
| `Playlist` | `name`, `description`, `tracks` |

All collection fields use Relay connections — wrap children in `edges { node { ... } }`.

---

## Rate Limits

Token-bucket per session.

| Aspect | Value |
|---|---|
| Starting balance | 3,600 tokens |
| Recovery | 50 tokens/sec |
| Cost basis | Query complexity (not response size) |

Response headers expose live state:

```
x-ratelimiting-cost: <int>
x-ratelimiting-tokens-available: <int>
```

Subscription complexity cap: **100**.

Approx field costs: `accounts` 1, `locations` 2, `soundZones` 3, `device` 4, each ID selection +1.

---

## Errors

GraphQL execution errors come back as **HTTP 200** with an `errors[]` array. Always check `errors` before reading `data`:

```json
{
  "errors": [
    { "path": ["soundZone"], "message": "Forbidden",
      "locations": [{"line": 2, "column": 3}] }
  ],
  "data": { "soundZone": null }
}
```

| Symptom | Cause |
|---|---|
| `"Forbidden"` | Token missing/invalid/expired or wrong account scope |
| HTTP 4xx | Rate-limited or malformed JSON |
| HTTP 5xx | Soundtrack infra; retry with backoff |

---

## Notes for this codebase

- Bridge code lives in `packages/soundtrack/`. Per-location credentials in `.env` (`SOUNDTRACK_API_TOKEN`).
- Account/location/zone IDs are stable opaque strings — cache them at config time, don't re-discover per request.
- Subscriptions count against complexity — for many zones, prefer a single query+poll over N parallel WebSocket subs.
