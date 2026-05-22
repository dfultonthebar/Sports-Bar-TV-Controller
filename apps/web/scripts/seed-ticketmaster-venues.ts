/**
 * Pre-seed Green Bay area concert/stadium venues for v2.53.1
 *
 * Idempotent: skips any venue whose canonical name already exists. Adds
 * Ticketmaster-style alias variants per venue so the ingestion pass hits
 * the alias-table O(1) lookup instead of fuzzy-matching (or worse,
 * auto-creating duplicate pending_review rows).
 *
 * Without this seed, the first Ticketmaster sweep will auto-create each
 * venue as pending_review, and the operator has to approve each one
 * manually. With this seed, the well-known Green Bay area venues land
 * pre-approved with the correct category/lat/lng/aliases.
 *
 * Usage:
 *   cd /home/ubuntu/Sports-Bar-TV-Controller
 *   npx tsx apps/web/scripts/seed-ticketmaster-venues.ts
 */

import { db, schema } from '@sports-bar/database'
import { eq } from 'drizzle-orm'

interface VenueSeed {
  name: string
  category: 'stadium' | 'concert_hall'
  lat: number
  lng: number
  aliases: string[] // Ticketmaster variant spellings
}

const HOLMGREN_LAT = 44.5012
const HOLMGREN_LNG = -88.0626

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,'']/g, '')
}

function distanceMiles(lat: number, lng: number): number {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat - HOLMGREN_LAT)
  const dLng = toRad(lng - HOLMGREN_LNG)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(HOLMGREN_LAT)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

const SEEDS: VenueSeed[] = [
  {
    name: 'Lambeau Field',
    category: 'stadium',
    lat: 44.5013,
    lng: -88.0622,
    aliases: ['Lambeau Field', 'Green Bay Packers — Lambeau Field'],
  },
  {
    name: 'Resch Center',
    category: 'concert_hall',
    lat: 44.4818,
    lng: -88.0712,
    aliases: ['Resch Center', 'Resch Center, Green Bay'],
  },
  {
    name: 'Resch Expo',
    category: 'concert_hall',
    lat: 44.481,
    lng: -88.072,
    aliases: ['Resch Expo', 'Resch Expo Center'],
  },
  {
    name: 'Brown County Arena',
    category: 'concert_hall',
    lat: 44.482,
    lng: -88.07,
    aliases: ['Brown County Arena'],
  },
  {
    name: 'KI Convention Center',
    category: 'concert_hall',
    lat: 44.5176,
    lng: -88.0153,
    aliases: ['KI Convention Center', 'KI Center'],
  },
  {
    name: 'Meyer Theatre',
    category: 'concert_hall',
    lat: 44.518,
    lng: -88.0148,
    aliases: ['Meyer Theatre', 'Meyer Theater'],
  },
  {
    name: 'Weidner Center',
    category: 'concert_hall',
    lat: 44.531,
    lng: -87.951,
    aliases: ['Weidner Center', 'Weidner Center for the Performing Arts'],
  },
  {
    name: 'Thornberry Creek at Oneida',
    category: 'concert_hall',
    lat: 44.3621,
    lng: -88.1844,
    aliases: ['Thornberry Creek at Oneida', 'Thornberry Creek'],
  },
]

async function main() {
  // Green-Bay-area specific. Refuse to run at other locations or the
  // operator gets 8 venues from another city polluting their DB.
  // Override with FORCE_SEED=1 if you really mean it (e.g., a new
  // Green Bay location).
  const locId = process.env.LOCATION_ID
  const force = process.env.FORCE_SEED === '1'
  const gbWhitelist = new Set(['holmgren-way', 'graystone', 'leg-lamp', 'lucky-s-1313'])
  if (!force && locId && !gbWhitelist.has(locId)) {
    console.error(`Refusing to seed Green Bay venues at LOCATION_ID=${locId}.`)
    console.error('Set FORCE_SEED=1 to override (only do this for a new Green Bay location).')
    process.exit(1)
  }

  let created = 0
  let skipped = 0
  let aliasesAdded = 0

  for (const seed of SEEDS) {
    const existing = await db
      .select()
      .from(schema.neighborhoodVenues)
      .where(eq(schema.neighborhoodVenues.name, seed.name))
      .get()

    if (existing) {
      skipped++
      // Top up missing aliases for already-seeded venues.
      for (const a of seed.aliases) {
        const norm = normalize(a)
        const aliasExists = await db
          .select()
          .from(schema.neighborhoodVenueAliases)
          .where(eq(schema.neighborhoodVenueAliases.aliasNormalized, norm))
          .get()
        if (!aliasExists) {
          await db.insert(schema.neighborhoodVenueAliases).values({
            venueId: existing.id,
            aliasText: a,
            aliasNormalized: norm,
            source: 'manual',
          })
          aliasesAdded++
        }
      }
      continue
    }

    const inserted = await db
      .insert(schema.neighborhoodVenues)
      .values({
        name: seed.name,
        category: seed.category,
        latitude: seed.lat,
        longitude: seed.lng,
        distanceMi: distanceMiles(seed.lat, seed.lng),
        isActive: true,
        reviewStatus: 'approved',
        discoverySource: 'manual',
        isSelf: false,
      })
      .returning({ id: schema.neighborhoodVenues.id })

    const venueId = inserted[0]?.id
    if (!venueId) continue
    created++

    for (const a of seed.aliases) {
      const norm = normalize(a)
      const aliasExists = await db
        .select()
        .from(schema.neighborhoodVenueAliases)
        .where(eq(schema.neighborhoodVenueAliases.aliasNormalized, norm))
        .get()
      if (!aliasExists) {
        await db.insert(schema.neighborhoodVenueAliases).values({
          venueId,
          aliasText: a,
          aliasNormalized: norm,
          source: 'manual',
        })
        aliasesAdded++
      }
    }
  }

  console.log(
    `Ticketmaster venue seed: created=${created} skipped(existing)=${skipped} aliases_added=${aliasesAdded}`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
