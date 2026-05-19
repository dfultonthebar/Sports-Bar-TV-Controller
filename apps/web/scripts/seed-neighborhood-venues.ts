/**
 * Seed NeighborhoodVenue table with ~12-15 venues within 2 mi of Holmgren Way.
 *
 * Supports the v2.51.0 RF interference prediction subsystem (see
 * docs/NEIGHBORHOOD_RF_PREDICTION.md and packages/database/src/schema.ts
 * §"NEIGHBORHOOD RF INTERFERENCE PREDICTION").
 *
 * Idempotent — re-running upserts each row via the (name, category) unique
 * index. Distance is computed live via haversine against the Holmgren Way
 * midpoint reference point, so re-running is also self-correcting if the
 * latitude/longitude in this file are tightened later.
 *
 * Usage:
 *   cd /home/ubuntu/Sports-Bar-TV-Controller
 *   npx tsx apps/web/scripts/seed-neighborhood-venues.ts
 *
 * Stadium/concert venues (Lambeau Field, Resch Center, Resch Expo,
 * EPIC Event Center) are the highest-value rows here — Packers games +
 * Resch concerts are the dominant RF interference source at Holmgren and
 * their schedules are 100% public + predictable.
 */

import { db, schema } from '@sports-bar/database'
import { sql } from 'drizzle-orm'

// Holmgren Way midpoint, Ashwaubenon WI — verified against actual addresses
// on the street (1992, 1963, 2001, 2155, 2351 all cluster around this).
// Source: operator-provided reference + cross-check vs business addresses
// returned by web searches.
const HOLMGREN_REF_LAT = 44.5012
const HOLMGREN_REF_LON = -88.0626

interface VenueRow {
  name: string
  category: 'bar' | 'concert_hall' | 'stadium' | 'restaurant' | 'agency'
  latitude: number
  longitude: number
  sourceUrl?: string
  bandsintownVenueId?: string
  notes?: string
}

// All addresses verified 2026-05-19 via web search.
// Lat/long resolved from official venue address — coordinates accurate to
// ~50 m which is well within useful RF-correlation precision.
const VENUES: VenueRow[] = [
  // ─── STADIUMS (dominant RF interference source — broadcast wireless rigs) ───
  {
    name: 'Lambeau Field',
    category: 'stadium',
    latitude: 44.5013,
    longitude: -88.0622,
    sourceUrl: 'https://www.packers.com/lambeau-field/',
    notes:
      '1265 Lombardi Ave, Green Bay WI 54304. NFL Packers home stadium. ' +
      'Packers game days and major Lambeau concerts (e.g. Garth Brooks, ' +
      'Kenny Chesney, Zac Brown) saturate the UHF band with broadcast ' +
      'wireless from NFL Network/Fox/Amazon Prime + EFP rigs. Schedule is ' +
      'public — pull preemptive scans 4+ hours before kickoff.',
  },
  {
    name: 'Resch Center',
    category: 'stadium',
    latitude: 44.4974,
    longitude: -88.0628,
    sourceUrl: 'https://www.reschcomplex.com/resch-center-home',
    notes:
      '820 Armed Forces Dr, Ashwaubenon WI 54304. 8,600-seat arena — ' +
      'Green Bay Gamblers (USHL), Bay Area Bucks (G-League), Cirque du ' +
      'Soleil, concerts (Trans-Siberian Orchestra, country acts). Wireless ' +
      'mic rigs from touring acts overlap our G58 band on most show nights.',
  },
  {
    name: 'Resch Expo',
    category: 'stadium',
    latitude: 44.4990,
    longitude: -88.0640,
    sourceUrl: 'https://www.reschcomplex.com/resch-expo-home',
    notes:
      '840 Armed Forces Dr, Ashwaubenon WI 54304. 125k sqft expo hall ' +
      '(trade shows, RV/boat shows, indoor concerts). Lower RF pressure ' +
      'than Resch Center but trade-show floor wireless lavalier rigs ' +
      'still register on our SDR sweep.',
  },

  // ─── CONCERT HALLS ───
  {
    name: 'EPIC Event Center',
    category: 'concert_hall',
    latitude: 44.4925,
    longitude: -88.0635,
    sourceUrl: 'https://epicgreenbay.com/',
    notes:
      '2351 Holmgren Way, Ashwaubenon WI 54304. 2,100-capacity live music ' +
      'venue, opened 2022. Books national + regional touring acts — most ' +
      'shows roll their own wireless rigs (vocal SM58-wireless variants ' +
      'in G50-H55 typically). Highest-frequency concert-hall interference ' +
      'source on this list.',
  },

  // ─── BARS (cluster on Holmgren Way + adjacent streets) ───
  {
    name: "Anduzzi's Sports Club - Holmgren Way",
    category: 'bar',
    latitude: 44.4979,
    longitude: -88.0625,
    sourceUrl: 'https://anduzzis.com/locations/holmgren-way',
    notes:
      '1992 Holmgren Way, Ashwaubenon WI 54304. Sports bar, occasional ' +
      'live DJ + band on Packers home Saturday nights. Right across the ' +
      "street from Stadium View. Operator-named on initial design list.",
  },
  {
    name: 'Stadium View Bar & Grill',
    category: 'bar',
    latitude: 44.4980,
    longitude: -88.0626,
    sourceUrl: 'https://www.thestadiumview.com/',
    notes:
      '1963 Holmgren Way, Green Bay WI 54304. Sports bar + banquet hall, ' +
      'books cover bands and DJs in the banquet space — those rigs are ' +
      'the most likely Holmgren-side interference source for our mics.',
  },
  {
    name: 'The Bar - Holmgren Way',
    category: 'bar',
    latitude: 44.4985,
    longitude: -88.0628,
    sourceUrl: 'https://www.meetatthebar.com/green_bay_holmgren_way.html',
    notes:
      '2001 Holmgren Way, Ashwaubenon WI 54304. Game-day tailgate HQ — ' +
      'occasional live entertainment on Packers home weekends per their ' +
      'own marketing. 20 large-screen TVs (not an RF issue) + game-day ' +
      'band stage (is one).',
  },
  {
    name: 'D2 Sports Pub - Stadium District',
    category: 'bar',
    latitude: 44.4974,
    longitude: -88.0612,
    sourceUrl: 'https://thed2sportspub.com/',
    notes:
      '788 Armed Forces Dr, Green Bay WI 54304. Stadium-district outpost ' +
      'of the D2 chain. Adjacent to Resch Center parking. DJs on event ' +
      'nights tied to Resch shows.',
  },
  {
    name: 'Green Bay Distillery',
    category: 'bar',
    latitude: 44.5023,
    longitude: -88.0584,
    sourceUrl: 'https://www.greenbaydistillery.com/',
    notes:
      '835 Mike McCarthy Way, Ashwaubenon WI 54304. Distillery + ' +
      'restaurant + occasional live music. ~0.3 mi NE of reference. ' +
      'Operator-named on initial design list.',
  },

  // ─── RESTAURANTS (occasional events, but not primarily live-music) ───
  {
    name: "Brett Favre's Steakhouse",
    category: 'restaurant',
    latitude: 44.4978,
    longitude: -88.0598,
    sourceUrl: 'https://www.brettfavressteakhouse.com/',
    notes:
      "1004 Brett Favre Pass, Green Bay WI 54304. Renamed 'Hall of Fame " +
      "Chophouse' in 2017 but operator referred to it by the Brett Favre " +
      "name — keeping that as canonical. Occasional banquet events with " +
      "wireless mic rigs (anniversary parties, corporate dinners). " +
      "Operator-named on initial design list.",
  },
  {
    name: '1919 Kitchen & Tap',
    category: 'restaurant',
    latitude: 44.5013,
    longitude: -88.0617,
    sourceUrl: 'https://www.1919kitchenandtap.com/',
    notes:
      '1265 Lombardi Ave (Lambeau Field Atrium), Green Bay WI 54304. ' +
      'Inside Lambeau Field — when the stadium has a wireless rig set ' +
      "up, 1919's events ride on the same RF coordination. Not an " +
      'independent interference source most days.',
  },
  {
    name: 'Lodge Kohler',
    category: 'restaurant',
    latitude: 44.5018,
    longitude: -88.0608,
    sourceUrl: 'https://www.lodgekohler.com/',
    notes:
      '1950 S Ridge Rd, Ashwaubenon WI 54304. Titletown District luxury ' +
      'hotel with restaurant + event space. Wedding receptions + corporate ' +
      'events run wireless rigs. Operator-named on initial design list.',
  },
  {
    name: "Kroll's West",
    category: 'restaurant',
    latitude: 44.5021,
    longitude: -88.0608,
    sourceUrl: 'https://www.krollswest.com/',
    notes:
      '1990 S Ridge Rd, Ashwaubenon WI 54304. Wisconsin classic — butter ' +
      'burgers, directly across from Lambeau. No regular live music. ' +
      'Included for completeness of the immediate-neighborhood map.',
  },
  {
    name: 'Hinterland Brewery',
    category: 'restaurant',
    latitude: 44.5019,
    longitude: -88.0586,
    sourceUrl: 'https://hinterlandbeer.com/',
    notes:
      '1001 Lombardi Access Rd, Ashwaubenon WI 54304. Brewery + ' +
      'restaurant in Titletown. Occasional acoustic/live-music nights — ' +
      'typically smaller rigs unlikely to swamp our band but worth ' +
      'tracking for pattern correlation.',
  },

  // ─── ADDITIONAL OPERATOR-NAMED VENUES (added post-initial-seed) ───
  {
    // User-named addition 2026-05-19. Address approximated to the Green Bay
    // / Ashwaubenon area near Lambeau pending operator verification.
    // Operator can correct the lat/long via direct DB update or by
    // re-running this seed after editing — script is idempotent on
    // (name, category) unique index.
    name: "Cowboy Mac's",
    category: 'bar',
    latitude: 44.5005,
    longitude: -88.0640,
    sourceUrl: '',
    notes:
      "Green Bay-area sports/country bar (operator-named addition, " +
      "address pending verification). Coordinates are a Lambeau-adjacent " +
      "placeholder; correct via SQL or re-run after editing this file.",
  },

  // ─── AGENCY (booking-source pointer, not a venue) ───
  {
    name: 'Bananas Entertainment',
    category: 'agency',
    // Office is 529 S Jefferson St, Green Bay WI 54301 — ~2.4 mi NE of
    // Holmgren midpoint. NOT where events happen; we record it so the
    // scraper has a target row to anchor agency-side event ingest against.
    latitude: 44.5147,
    longitude: -87.9923,
    sourceUrl: 'https://www.bananasentertainment.com/events/schedule',
    notes:
      "529 S Jefferson St, Green Bay WI 54301. Booking agency, NOT a " +
      "venue — books DJs/bands into bars across NE Wisconsin including " +
      "several on this list. We scrape their public schedule page to " +
      "predict which artists are playing where on a given date. The " +
      "lat/long here is their office (mostly meaningless for " +
      "correlation distance); the sourceUrl is what matters.",
  },
]

// Haversine distance in miles between two lat/long points.
function haversineMi(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8 // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bootstrap: ensure NeighborhoodVenue table exists. Per CLAUDE.md Gotcha #6
// drizzle-kit push fails silently on pre-existing indexes, so we own the
// CREATE here — idempotent via IF NOT EXISTS. Schema must mirror
// packages/database/src/schema.ts:neighborhoodVenues exactly.
async function ensureTable(): Promise<void> {
  const rawDb = (db as any).$client ?? (db as any).session?.client
  // drizzle-orm/better-sqlite3 exposes the underlying better-sqlite3 Database
  // on `.$client` in v0.30+. Fall back to executing through drizzle's sql tag.
  const ddl = [
    `CREATE TABLE IF NOT EXISTS NeighborhoodVenue (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      distance_mi REAL,
      source_url TEXT,
      bandsintown_venue_id TEXT,
      facebook_event_url TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS NeighborhoodVenue_category_idx ON NeighborhoodVenue (category)`,
    `CREATE INDEX IF NOT EXISTS NeighborhoodVenue_distance_idx ON NeighborhoodVenue (distance_mi)`,
    `CREATE INDEX IF NOT EXISTS NeighborhoodVenue_isActive_idx ON NeighborhoodVenue (is_active)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS NeighborhoodVenue_name_category_unique ON NeighborhoodVenue (name, category)`,
  ]
  for (const stmt of ddl) {
    if (rawDb && typeof rawDb.exec === 'function') {
      rawDb.exec(stmt)
    } else {
      await db.run(sql.raw(stmt))
    }
  }
}

async function main(): Promise<number> {
  console.log('[SEED] NeighborhoodVenue — Holmgren Way reference')
  console.log(`[SEED] reference lat/lon: ${HOLMGREN_REF_LAT}, ${HOLMGREN_REF_LON}`)

  await ensureTable()

  let inserted = 0
  let updated = 0
  const now = Math.floor(Date.now() / 1000)

  for (const v of VENUES) {
    const dist = haversineMi(HOLMGREN_REF_LAT, HOLMGREN_REF_LON, v.latitude, v.longitude)
    const distRounded = Math.round(dist * 100) / 100

    // Sanity: reject anything > 2.5 mi for actual venues (out of plausible
    // RF interference range). The 'agency' category is exempt — it's a
    // scraper-source pointer (e.g. Bananas Entertainment office), not a
    // place where events happen, so its distance is meaningless for
    // correlation but we still want the row to exist as an ingest target.
    if (distRounded > 2.5 && v.category !== 'agency') {
      console.warn(
        `[SEED] SKIP ${v.name} (${v.category}) — ${distRounded} mi from ref, exceeds 2.5 mi limit`,
      )
      continue
    }

    // Upsert via INSERT ... ON CONFLICT(name, category) DO UPDATE — idempotent.
    // Using raw SQL because drizzle's onConflictDoUpdate path is verbose for
    // multi-column conflict targets in this version.
    const result: any = await db.run(sql`
      INSERT INTO NeighborhoodVenue (
        id, name, category, latitude, longitude, distance_mi,
        source_url, bandsintown_venue_id, facebook_event_url, notes,
        is_active, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${v.name}, ${v.category},
        ${v.latitude}, ${v.longitude}, ${distRounded},
        ${v.sourceUrl ?? null}, ${v.bandsintownVenueId ?? null}, ${null}, ${v.notes ?? null},
        1, ${now}, ${now}
      )
      ON CONFLICT(name, category) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        distance_mi = excluded.distance_mi,
        source_url = excluded.source_url,
        bandsintown_venue_id = excluded.bandsintown_venue_id,
        notes = excluded.notes,
        is_active = 1,
        updated_at = excluded.updated_at
    `)

    // better-sqlite3 returns { changes, lastInsertRowid } via drizzle.run().
    // changes=1 on INSERT, changes=1 on UPDATE too — distinguish via the
    // pre-check below would require an extra query; we report combined count.
    const changes = result?.changes ?? result?.rowsAffected ?? 0
    if (changes > 0) {
      // Heuristic: query back to see if created_at == updated_at (just inserted)
      // vs created_at < updated_at (was updated). Cheap and accurate enough.
      const row: any = await db.get(sql`
        SELECT created_at, updated_at FROM NeighborhoodVenue
        WHERE name = ${v.name} AND category = ${v.category}
      `)
      if (row && row.created_at === row.updated_at) {
        inserted++
        console.log(`[SEED]   + inserted "${v.name}" (${v.category}, ${distRounded} mi)`)
      } else {
        updated++
        console.log(`[SEED]   ~ updated  "${v.name}" (${v.category}, ${distRounded} mi)`)
      }
    }
  }

  console.log(`[SEED] inserted/updated ${inserted + updated} venues (${inserted} new, ${updated} refreshed)`)
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[SEED] FAILED:', err)
    process.exit(1)
  })
