# Neighborhood RF Interference Prediction — v2.51.x

**Audience:** anyone debugging the system that polls nearby venues for upcoming events and correlates them with Shure SLX-D wireless mic interference detections at each fleet bar.

**TL;DR:** ingest event calendars from nearby bars/concert venues → when our Shure receiver flags interference within ±30 min and ±0.5 mi of a known nearby event, write an InterferenceAttribution row → build an artist-level confidence profile across multiple gigs → tomorrow if a known-interferer artist is booked at a nearby venue, log a preemptive-strike warning so the operator can pre-move our channels to clean frequencies BEFORE the bands' wireless rigs set up.

---

## Why this exists

Holmgren Way is ~0.3 mi from Lambeau Field + the Resch Center. Packers home games and major concerts deploy enormous broadcast wireless rigs (NFL Network, Fox, Amazon Prime, ESPN — plus the venue's own pro AV) that saturate the entire UHF band for hours. Our Shure SLX-D mics share that band and get crushed.

The same pattern repeats at smaller scale: Anduzzi's books cover bands on Packers Saturday nights, Stadium View has DJ nights, EPIC Event Center hosts concerts. When those venues' bands/DJs are playing, our own mic frequencies may need to move.

**The insight:** event schedules are PUBLIC AND PREDICTABLE. Bananas Entertainment, Bandsintown, the Resch Center calendar — all list what's playing where, days or weeks in advance. If we know "DJ Marco has caused interference at Anduzzi's 8 of the last 11 gigs" — and Bananas shows DJ Marco at Anduzzi's tomorrow night — we can preemptively retune our mics to clean frequencies BEFORE Marco's rig turns on.

---

## Data model (4 tables in `packages/database/src/schema.ts`)

### NeighborhoodVenue
The places that book live entertainment near our bar.

```
id, name, category ('bar'|'concert_hall'|'stadium'|'restaurant'|'agency'|'other'),
latitude, longitude, distance_mi (precomputed haversine from our LOCATION),
source_url, bandsintown_venue_id, facebook_event_url, notes, is_active,
review_status ('manual'|'pending_review'|'approved'|'declined'),    -- v2.51.1
discovery_source ('manual'|'overpass_osm'|'bandsintown'|'google_places'), -- v2.51.1
osm_tags (JSON of OSM tags for auto-discovered rows),                -- v2.51.1
booking_confidence (0-1 Ollama-assigned),                            -- v2.51.1
created_at, updated_at

UNIQUE(name, category)
```

Holmgren has 17 manually-seeded venues + 53 auto-discovered (review_status='pending_review') = 70 total. Operator approves/declines auto-discovered rows via admin UI.

### NeighborhoodEvent
Specific gigs at specific venues, ingested from upstream sources.

```
id, venue_id (→ NeighborhoodVenue), artist_name, artist_normalized,
start_time, end_time, event_type ('band'|'dj'|'karaoke'|'trivia'|'sports'|'concert'|'other'),
source ('bananas'|'bandsintown'|'manual'|'scrape:epic'|'scrape:resch'|...),
source_url, source_event_id, raw_payload, ingested_at, created_at

UNIQUE(source, source_event_id)  -- idempotent re-ingestion
```

### InterferenceAttribution
Joined rows: a Shure rf_interference event temporally + spatially close to a known nearby event.

```
id, rf_event_id (→ shure_rf_events), neighborhood_event_id (→ NeighborhoodEvent),
time_delta_seconds (abs(rf.detected_at - event.start_time)),
distance_mi (venue.distance_mi at attribution time),
confidence (0-1, computed by correlation engine),
attribution_method ('correlation_v1'|'manual'),
created_at

UNIQUE(rf_event_id, neighborhood_event_id)  -- idempotent
```

### ArtistInterferenceProfile
Aggregated multi-gig confidence about each artist's interference signature at our location.

```
id, artist_normalized, location_id, total_gigs (last 180 days),
gigs_with_interference (attributions w/ confidence ≥ 0.4),
avg_severity_dbm, predicted_freqs_affected (JSON [510.9, 487.0, ...]),
first_observed, last_observed,
recommendation (Ollama-generated 2-3-sentence operational text),
confidence (hitRate * min(totalGigs/10, 1.0) — penalizes small samples),
updated_at

UNIQUE(artist_normalized, location_id)
```

---

## Ingestion sources

### 1. Bananas Entertainment scraper (`packages/sports-apis/src/bananas-scraper.ts`)

**Status: LIVE, primary source as of v2.51.0**

Bananas Entertainment is a Green Bay-area DJ/band booking agency. Their schedule at `https://www.bananasentertainment.com/events/schedule` lists which artists play which venues on which dates — the highest-signal data source because the SAME artist appears at MULTIPLE venues, letting the profile builder accumulate confidence faster than per-venue scraping alone.

**3-tier parse strategy:**
1. **JSON API (primary):** discovered `/be/ajax.php?funct=EVENTS` returns structured rows with ArtistName, JobPlace, EventStartUTC, Lat/Lon, Job_Number, Act_Genres. Verified live — pulled 89 events on 2026-05-19.
2. **cheerio HTML fallback:** Schema.org JSON-LD + microdata + table-heuristic selectors. Used if the JSON API ever changes.
3. **Ollama llama3.1:8b fallback:** strict-JSON extraction prompt on stripped HTML, 60s timeout, `format: 'json'`. Last resort — empty list returned if all three fail (pipeline never crashes).

Cadence: **daily** (v2.51.1 — was 6h; intra-day pulls returned identical payloads).

### 2. Overpass / OSM venue auto-discovery (`scripts/discover-venues.ts`)

**Status: LIVE, called weekly from scheduler**

Takes a fleet location's lat/long + radius → queries OpenStreetMap via Overpass API for `amenity in (bar, pub, nightclub, restaurant, fast_food, theatre, events_venue, community_centre)` + `leisure in (stadium, amusement_arcade)` + `tourism=hotel` within radius. Returns hundreds of candidates.

For each candidate, Ollama llama3.1:8b answers: "Does this venue book live entertainment (bands/DJs)? YES|MAYBE|NO, confidence 0-1, reason." YES and MAYBE candidates are written with `review_status='pending_review'`, `discovery_source='overpass_osm'`, `osm_tags=<JSON>`, `booking_confidence=<Ollama>`. NO candidates are skipped (Arby's, McDonald's, KFC, etc.).

Operator approves/declines pending_review rows via admin UI. Re-runs are idempotent — declined rows stay declined.

**Cost:** $0 (Overpass is volunteer-run OSM data, Ollama is local).
**Cadence:** weekly (v2.51.1 — once is plenty for catching new venues).
**Per-location bootstrap:** one CLI call at install: `npx tsx scripts/discover-venues.ts --lat <lat> --lon <lon> --radius-mi 2`

### 3. Bandsintown API (v2.51.2 planned)

Free public API, no auth required. Lists touring acts and their gigs by metro area. Better than Bananas for nationally-known artists; worse for local cover bands (which Bananas dominates). Will be wired in v2.51.2 as a third layer after Bananas + manual entry.

### 4. Per-venue scrapers (v2.51.2 planned)

Scrape specific venue calendars when an operator wants higher-fidelity data than Bananas provides for a specific high-impact venue:
- **EPIC Event Center**: https://epicgreenbay.com/upcoming-events/
- **Resch Center**: https://www.reschcomplex.com/events/venue/resch-center-green-bay-wi
- More to be added as operators request.

Each gets its own scraper module + scheduler poll, same 3-tier parse strategy as Bananas.

### 5. Manual operator entry (v2.51.x planned)

Some events are only on Facebook (Lighthouse DJ Service, smaller bars). A simple admin UI form lets the operator type "DJ Bob, Anduzi's, Friday 10pm" — covers the Facebook-only gap without building a Facebook scraper.

### Vendor signals (v2.51.x planned)

EPS (Event Production Systems, `eventproductionsystems.com`) and Lighthouse Productions (`lhprod.com`) are B2B AV/staging vendors, NOT event sources. They get hired BY venues. They're worth tracking as **vendor signals**: if Bananas event text mentions "sound by EPS" or "production by Lighthouse", auto-bump that event's interference confidence — pro AV deployments are aggressive on the UHF band.

---

## Correlation pipeline (`packages/scheduler/src/`)

### `interference-correlator.ts` — every 10 min

Queries fresh `shureRfEvents` (`event_type='rf_interference'`) and tries to attribute each to a nearby concurrent `NeighborhoodEvent`:

- Candidate match: `abs(rf.detected_at - event.start_time) ≤ 1800s` AND `venue.distance_mi ≤ 1.0`
- Confidence: `(1 - Δt/1800) × (1 - d/1.0) × 0.85` — closer in time + closer in space + cap below 1.0 (multi-gig profile delivers higher final confidence)
- Idempotent upsert on `(rf_event_id, neighborhood_event_id)` unique index

### `artist-profile-builder.ts` — every 6 h

For each artist with ≥3 gigs in last 180 days:
- `total_gigs` = COUNT distinct NeighborhoodEvent.id
- `gigs_with_interference` = COUNT distinct events with ≥1 attribution at confidence ≥ 0.4
- `avg_severity_dbm` = AVG(rfEvent.rssi_dbm) over attributed events
- `predicted_freqs_affected` = JSON array of distinct rfEvent.frequency_mhz rounded to 0.1 MHz
- Profile `confidence` = `(gigsWithInterference / totalGigs) × min(totalGigs/10, 1.0)` — penalizes small samples
- Artists ≥ 0.6 confidence get Ollama llama3.1:8b 2-3-sentence operational recommendation, stored in `recommendation`

Idempotent on `(artist_normalized, location_id)`.

### `preemptive-strike.ts` — every 1 h

Looks ahead 12 hours. For each upcoming NeighborhoodEvent, checks if the artist has an ArtistInterferenceProfile with confidence ≥ 0.6. If so:

- Logs `[PREEMPTIVE] artist 'X' booked at 'Y' in Zh — confidence 0.85, freqs [510.9, 502.3]. Recommend pre-scan + retune.`
- Returns the candidate list to callers
- **Stage 1 behavior:** logs only, does NOT actually retune. Stage 2 (planned for v2.52.x) wires this to the existing `POST /api/shure-rf/find-clean-freq` flow.

### `venue-discovery.ts` — weekly

Wraps `scripts/discover-venues.ts` as a child process. Reads `LOCATION_LAT` / `LOCATION_LON` from env. Catches new venues opening. Operator must approve pending_review rows.

---

## Scheduler-service integration (`packages/scheduler/src/scheduler-service.ts`)

Five new polls registered alongside the existing ones (v2.51.0–v2.51.1):

```
runBananasIngestion       24h cadence,  2 min initial delay  (v2.51.1)
correlateInterference     10 min,        3 min initial delay  (v2.51.0)
rebuildArtistProfiles      6 h,         10 min initial delay  (v2.51.0)
runPreemptiveStrike        1 h,         15 min initial delay  (v2.51.0)
runVenueDiscovery          7 d,         30 min initial delay  (v2.51.1)
```

All wrapped in try/catch wrappers (`*Safe()`) so a failure in one doesn't break the tick or any of the others. Logs `[BANANAS-INGEST] / [CORRELATOR] / [PROFILE-BUILDER] / [PREEMPTIVE] / [VENUE-DISCOVERY]` tags.

---

## API endpoints (`apps/web/src/app/api/neighborhood/`)

| Route | Method | Purpose |
|---|---|---|
| `/events` | GET | Query NeighborhoodEvent (filter by venue_id, artist_normalized, source) |
| `/ingest/bananas` | POST (ADMIN) | Manually trigger Bananas ingestion run |
| `/interference-profile/[artist]` | GET | Profile + last events + attributions for an artist |
| `/preemptive-strike` | GET | Next 24h preemptive-strike candidates |

---

## Per-location bootstrap (when adding to a new fleet box)

For a NEW fleet location (leglamp, luckys, graystone, greenville, appleton):

1. **Add LOCATION_LAT and LOCATION_LON to `.env`** at the new location:
   ```bash
   echo "LOCATION_LAT=44.5012" >> .env
   echo "LOCATION_LON=-88.0626" >> .env
   echo "NEIGHBORHOOD_DISCOVERY_RADIUS_MI=2" >> .env       # optional, default 2
   pm2 restart sports-bar-tv-controller --update-env
   ```

2. **Run the venue-discovery CLI once** to populate NeighborhoodVenue:
   ```bash
   npx tsx scripts/discover-venues.ts --lat 44.5012 --lon -88.0626 --radius-mi 2
   ```
   Or trigger via API: `POST /api/neighborhood/discover` (admin-auth).

3. **Operator reviews pending_review rows** in the admin UI (or via DB):
   ```sql
   UPDATE NeighborhoodVenue
     SET review_status='approved', is_active=1
     WHERE id IN (...);
   ```

4. **From here on:** weekly auto-discovery catches new venues automatically; daily Bananas ingestion populates events; correlation engine accumulates attributions.

After 30-60 days of data, the artist profile builder has enough confidence to flag preemptive-strikes.

---

## Real-world cost + latency

- Bananas ingestion (1× daily): ~3-5 sec wall-clock per run, $0
- Overpass discovery (1× weekly): ~30 sec Overpass + ~5 sec per candidate × 100 = ~9 min per run, $0
- Correlator (1× every 10 min): ~50-500 ms depending on recent rf event volume, $0
- Profile builder (1× every 6 h): ~2-5 sec per artist with Ollama, ~30-60 sec total per run, $0
- Preemptive strike (1× hourly): ~100 ms, $0
- Q-A Haiku gen (one-time training corpus): ~9 h, ~$7-9 in Anthropic credits

Total fleet-wide cost: **$0/month** ongoing.

---

## Standing Rule 11 — RAG ingestion

This doc lives in `docs/` so it's RAG-indexable. After every commit touching this file, the auto-update.sh finalize step kicks `scripts/rag-rescan-if-needed.sh --since $PRE_MERGE_SHA` which re-scans + re-embeds. AI Hub chat can answer "how does the neighborhood RF prediction work" with grounded responses from this doc within ~30 min of any commit.

---

## Related docs

- `docs/AUTO_UPDATE_TROUBLESHOOTING.md` — broader failure-mode catalog
- `docs/SCHEDULER_SERVICE.md` — the 60-sec scheduler tick that runs all of this
- `packages/shure-slxd/README.md` — Shure SLX-D protocol details
- CLAUDE.md §7a — Shure RF interference detection architecture
- CLAUDE.md §7b — SDR wide-band cross-confirmation (when hardware arrives)
