# Channel Resolver Consolidation — STATUS

**Status:** ✅ **COMPLETE.** All 5 target routes migrated to the shared resolver. Hardcoded `NETWORK_TO_CABLE` / `NETWORK_TO_DIRECTV` / `stationToPreset` dicts removed. Single canonical `STREAMING_STATION_MAP` lives in `apps/web/src/lib/network-channel-resolver.ts`. Madison-numbers bug at Graystone/Holmgren fixed as a side effect once locations merged main (verified at Holmgren on 2026-05-06).

**History:** plan approved 2026-04-13 (v2 post Plan-review), shipped progressively across v2.5.0 → v2.32.x.

---

## Where the resolution actually lives now

| File | Purpose |
|---|---|
| `apps/web/src/lib/network-channel-resolver.ts` | Single source of truth. Exports `resolveChannelsForGame`, `resolveChannelsForNetworks`, `getStreamingAppForStation`, `getStreamingAppInfoForStation`, `normalizeStation`, `findLocalChannelOverride`, `getStationToPresetMaps`. Reads from `channel_presets` + `station_aliases` tables. |
| `packages/streaming/src/streaming-apps-database.ts` | Streaming-app catalog (package names, deep-link patterns) — separate concern, used by Fire TV launcher. NOT part of channel-number resolution. |

## Per-route migration record

| Route | Status | Resolver call | Remaining hardcoded dicts |
|---|---|---|---|
| `/api/sports-guide/live-dashboard` | ✅ migrated | `resolveChannelsForGame()` | `NETWORK_TO_STREAMING_APP` only (Fire TV launcher shape — kept on purpose, see comment in route) |
| `/api/sports-guide/live-by-channel` | ✅ migrated | `resolveChannelsForGame()` | none |
| `/api/schedules/ai-game-plan` | ✅ migrated | `resolveChannelsForGame()` + `getStreamingAppInfoForStation()` | none |
| `/api/scheduling/games` | ✅ migrated | `resolveChannelsForNetworks()` (was always shared-helper-based) | none |
| `/api/channel-guide` | ✅ migrated | `resolveChannelsForNetworks()` | none |
| `/api/sports-guide` | n/a | pure Rail Media passthrough — no resolution | none |

**Verification:**
```bash
# Should return zero hardcoded resolver-dict definitions in any route file:
grep -rnE '^const (NETWORK_TO_CABLE|NETWORK_TO_DIRECTV|stationToPreset)' \
  apps/web/src/app/api/
```

## What's still around (and intentionally so)

- **`NETWORK_TO_STREAMING_APP` in `live-dashboard/route.ts`** — Fire TV app launch metadata (`{appId, name, packageName}`), not channel-number resolution. The shared helper exposes the channel side via `getStreamingAppInfoForStation()` but the route's launcher needs this specific shape. Could be folded in later if the helper grows a Fire TV variant; not worth the churn today.
- **`STREAMING_STATION_MAP` definition** — exactly one (canonical) copy lives at `network-channel-resolver.ts:285`. The pre-consolidation duplicates have been removed.

## Genuinely-pending follow-ups (none architectural)

- None blocking. The consolidation goal is met.
- *Optional* future polish: extract `NETWORK_TO_STREAMING_APP` (in `live-dashboard/route.ts`) into the resolver as a sibling map so routes don't have to maintain their own. Low priority — only one consumer.

## Original problem (preserved for context)

Six independent code paths each answered "what local channel carries this game?" with their own logic. Bug fixes had to land in 6 places; location branches drifted apart with the wrong hardcoded numbers (Graystone/Holmgren had Madison Spectrum numbers despite serving Green Bay). `channel_presets` had no seeding mechanism so a fresh install started with zero presets. The consolidation collapsed all six paths to one resolver fed by DB tables, and seeded `channel_presets` from per-location JSON in `seed-from-json.ts`.

For the full historical analysis, see git history of this file before v2.32.44.
