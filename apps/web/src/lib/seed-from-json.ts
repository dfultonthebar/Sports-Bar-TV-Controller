/**
 * Auto-Seed from JSON
 *
 * On first startup at a new location, the DB tables will be empty but
 * JSON data files (committed on the location branch) will have device data.
 * This module checks each table and seeds it from JSON if the table is empty
 * and corresponding JSON data exists.
 *
 * This ensures other locations don't lose their devices when pulling code updates.
 */

import { db, schema } from '@/db'
import { sql } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { saveDirecTVDevice, type DirecTVDeviceRecord } from '@/lib/device-db'
import { saveFireTVDevice, type FireTVDeviceRecord } from '@/lib/device-db'
import * as fs from 'fs'
import * as path from 'path'

// ---------------------------------------------------------------------------
// Standard station aliases (universal, not location-specific)
// ---------------------------------------------------------------------------
const STANDARD_ALIASES = [
  { standardName: 'ESPN', aliases: ['ESPNHD', 'ESPN HD', 'ESPN1'] },
  { standardName: 'ESPN2', aliases: ['ESPN2HD', 'ESPN2 HD'] },
  { standardName: 'ESPNU', aliases: ['ESPNUHD', 'ESPNU HD', 'ESPN U'] },
  { standardName: 'ESPNEWS', aliases: ['ESPNWHD', 'ESPNEWS HD', 'ESPNews', 'ESPN News'] },
  { standardName: 'FS1', aliases: ['FS1HD', 'FOX SPORTS 1', 'FOX SPORTS1', 'Fox Sports 1'] },
  { standardName: 'FS2', aliases: ['FS2HD', 'FOX SPORTS 2', 'Fox Sports 2'] },
  { standardName: 'FSN', aliases: ['FSNHD', 'FOX SPORTS NORTH', 'FSNWI', 'BSNOR'] },
  // Main Wisconsin RSN — preset name "Fan Duel" (channel 40 on Spectrum GB,
  // channel 669 on DirecTV). Carries Bucks and general WI sports content.
  // The Rail Media API returns these games under station code "FSWI".
  { standardName: 'FanDuelWI', aliases: ['Fan Duel', 'FanDuel', 'FSWI', 'BSWI', 'Bally Sports Wisconsin', 'Bally Sports WI', 'FanDuel Sports Wisconsin', 'FanDuel Sports Network Wisconsin', 'FanDuel SN WI', 'FanDuel SN Wisconsin', 'FOX Sports Wisconsin', 'Bucks.TV'] },
  // Brewers-only overflow RSN — preset name "Bally Sports WI" (channel 308
  // on cable, channel 670 on DirecTV). Used when Brewers games air at the
  // same time as something else on the main WI RSN. ESPN tags these
  // broadcasts as "Brewers.TV"; The Rail Media API uses station code "MILBRE".
  { standardName: 'BallyWIPlus', aliases: ['Bally Sports WI+', 'Bally Sports Wisconsin+', 'BSWI+', 'FSWI+', 'FanDuel SN WI+', 'FanDuel Sports WI+', 'Brewers.TV', 'MILBRE'] },
  // North RSN — FanDuel Sports Network North (channel 310 on Spectrum GB,
  // channel 668 on DirecTV). Carries Twins, Timberwolves, Wild content.
  { standardName: 'FanDuelNorth', aliases: ['FanDuel SN North', 'FanDuel Sports Network North', 'Bally Sports North', 'Fan Duel North', 'BSNORTH', 'FSNORTH', 'FOX SPORTS NORTH'] },
  // Midwest RSN — FanDuel Sports Network Midwest (channel 671 on DirecTV).
  // Carries Cardinals, Blues, etc.
  { standardName: 'FanDuelMidwest', aliases: ['FanDuel SN Midwest', 'FanDuel Sports Network Midwest', 'Bally Sports Midwest', 'BSMIDWEST', 'FSMIDWEST', 'FOX SPORTS MIDWEST'] },
  { standardName: 'TNT', aliases: ['TNTHD', 'TNT HD', 'TNTDRAMA'] },
  { standardName: 'TBS', aliases: ['TBSHD', 'TBS HD'] },
  { standardName: 'BTN', aliases: ['BIG TEN NETWORK', 'BIG TEN', 'B10', 'Big 10', 'BTNHD', 'BTN HD'] },
  { standardName: 'NBCSN', aliases: ['NBC SPORTS', 'NBC Sports', 'NBCSNHD', 'NBCSN HD', 'Peacock/NBC Sports'] },
  { standardName: 'USA', aliases: ['USAHD', 'USA HD', 'USA NETWORK', 'USA Network'] },
  // NOTE: Bare broadcast network names ("ABC", "NBC", "CBS", "FOX") are
  // intentionally NOT aliased here — each location has DIFFERENT OTA
  // affiliates (Green Bay = WBAY/WGBA/WFRV/WLUK; Madison = WKOW/WMTV/WISC/WMSN;
  // etc.). Location-specific affiliate aliases are seeded from
  // `apps/web/data/station-aliases-local.json` by seedLocalStationAliases().
  // Populating bare network names here would route Madison's "ABC" games to
  // Green Bay's WBAY preset — wrong channel.
  { standardName: 'MLBN', aliases: ['MLB', 'MLBNHD', 'MLB NETWORK', 'MLB NET', 'MLB Network', 'MLBNet'] },
  { standardName: 'NFLN', aliases: ['NFL', 'NFLNHD', 'NFL NETWORK', 'NFL NET', 'NFL Network', 'NFLNet'] },
  { standardName: 'NHLN', aliases: ['NHL', 'NHLNHD', 'NHL NETWORK', 'NHL NET', 'NHL Network', 'NHLNet'] },
  { standardName: 'NBATV', aliases: ['NBA', 'NBATVHD', 'NBA TV', 'NBATV'] },
  { standardName: 'SEC', aliases: ['SECN', 'SEC NETWORK', 'SEC Network', 'SECNHD'] },
  { standardName: 'ACC', aliases: ['ACCN', 'ACC NETWORK', 'ACC Network', 'ACCNHD'] },
  { standardName: 'PAC12', aliases: ['PAC-12', 'PAC 12', 'PAC12HD'] },
  { standardName: 'GOLF', aliases: ['GOLFHD', 'GOLF CHANNEL', 'GOLF CH', 'Golf Channel'] },
  { standardName: 'WACY', aliases: ['WACY32', 'MYN', 'MY NETWORK'] },
  { standardName: 'CW', aliases: ['CWHD', 'CW HD', 'WACY'] },
  { standardName: 'PEACOCK', aliases: ['PCCK', 'Peacock'] },
  { standardName: 'BIG12', aliases: ['BIG 12', 'BIG12HD'] },
  { standardName: 'CBSSN', aliases: ['CBS SPORTS', 'CBS SPORTS NETWORK', 'CBS Sports Network', 'CBSSNHD'] },
  { standardName: 'TRUTV', aliases: ['TRU TV', 'TRUTVHD', 'truTV'] },
  { standardName: 'PARAMOUNT', aliases: ['Paramount', 'Paramount Network', 'PARMOUNT', 'PAR'] },
  { standardName: 'MLBSZ', aliases: ['MLB Strike Zone', 'MLB STRIKE ZONE', 'Strike Zone'] },
  // Streaming apps (universal — these are service names, not local affiliates).
  // These aliases also help the cable/directv preset fallback path recognize
  // streaming-origin broadcast strings; the primary streaming resolution path
  // uses STREAMING_STATION_MAP in network-channel-resolver.ts.
  { standardName: 'PrimeVideo', aliases: ['Prime Video', 'Amazon Prime Video', 'Amazon Prime', 'PRIME VIDEO', 'Amazon'] },
  { standardName: 'AppleTVPlus', aliases: ['Apple TV', 'Apple TV+', 'AppleTV+', 'Apple TV Plus', 'APPLE TV+', 'APPLE TV'] },
  { standardName: 'ParamountPlus', aliases: ['Paramount+', 'Paramount Plus', 'PARAMOUNT+', 'P+'] },
  { standardName: 'Peacock', aliases: ['Peacock', 'PEACOCK', 'Peacock Premium', 'Peacock TV'] },
  { standardName: 'ESPNPlus', aliases: ['ESPN+', 'ESPN Plus', 'ESPNPLUS', 'ESPN +'] },
  { standardName: 'Netflix', aliases: ['Netflix', 'NETFLIX', 'Netflix Sports'] },
  { standardName: 'Max', aliases: ['Max', 'HBO Max', 'MAX', 'HBOMax'] },
  { standardName: 'YouTubeTV', aliases: ['YouTube TV', 'YoutubeTV', 'YTTV', 'YOUTUBE TV'] },
  { standardName: 'Hulu', aliases: ['Hulu', 'HULU', 'Hulu+'] },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SeedResult {
  direcTV: { seeded: boolean; count: number }
  fireTV: { seeded: boolean; count: number }
  stationAliases: { seeded: boolean; count: number }
  channelPresets: { seeded: boolean; count: number }
}

interface ChannelPresetSeedRow {
  id: string
  name: string
  channelNumber: string
  deviceType: string
  order?: number
  isActive?: boolean
  usageCount?: number
  lastUsed?: string | null
  createdAt?: string
  updatedAt?: string
}

/**
 * Try to read a JSON file from multiple candidate paths.
 * Returns the parsed object or null if none found / empty.
 */
function tryReadJson<T>(filename: string): T | null {
  const cwd = process.cwd()
  const candidates = [
    path.join(cwd, 'data', filename),
    path.join(cwd, '..', '..', 'data', filename),
    path.join(cwd, 'apps', 'web', 'data', filename),
  ]

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf-8')
        const parsed = JSON.parse(raw) as T
        logger.info(`[SEED] Found ${filename} at ${candidate}`)
        return parsed
      }
    } catch (err) {
      logger.warn(`[SEED] Failed to read ${candidate}: ${err}`)
    }
  }

  logger.info(`[SEED] No ${filename} found in any search path`)
  return null
}

/**
 * Count rows in a table using raw SQL count.
 */
async function tableRowCount(tableName: string): Promise<number> {
  const result = await db.get<{ cnt: number }>(
    sql.raw(`SELECT COUNT(*) as cnt FROM "${tableName}"`)
  )
  return result?.cnt ?? 0
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedDirecTV(): Promise<{ seeded: boolean; count: number }> {
  try {
    const count = await tableRowCount('DirecTVDevice')
    if (count > 0) {
      logger.info(`[SEED] DirecTVDevice table already has ${count} rows, skipping`)
      return { seeded: false, count: 0 }
    }

    const data = tryReadJson<{ devices: Partial<DirecTVDeviceRecord>[] }>('directv-devices.json')
    if (!data || !Array.isArray(data.devices) || data.devices.length === 0) {
      logger.info('[SEED] No DirecTV devices to seed (empty or missing JSON)')
      return { seeded: false, count: 0 }
    }

    logger.info(`[SEED] Seeding ${data.devices.length} DirecTV devices from JSON...`)
    for (const device of data.devices) {
      if (!device.id) continue
      await saveDirecTVDevice(device as Partial<DirecTVDeviceRecord> & { id: string })
      logger.info(`[SEED]   DirecTV: ${device.name} (${device.ipAddress})`)
    }

    logger.info(`[SEED] DirecTV seeding complete: ${data.devices.length} devices`)
    return { seeded: true, count: data.devices.length }
  } catch (error) {
    logger.error('[SEED] Failed to seed DirecTV devices:', error)
    return { seeded: false, count: 0 }
  }
}

async function seedFireTV(): Promise<{ seeded: boolean; count: number }> {
  try {
    const count = await tableRowCount('FireTVDevice')
    if (count > 0) {
      logger.info(`[SEED] FireTVDevice table already has ${count} rows, skipping`)
      return { seeded: false, count: 0 }
    }

    const data = tryReadJson<{ devices: Partial<FireTVDeviceRecord>[] }>('firetv-devices.json')
    if (!data || !Array.isArray(data.devices) || data.devices.length === 0) {
      logger.info('[SEED] No Fire TV devices to seed (empty or missing JSON)')
      return { seeded: false, count: 0 }
    }

    logger.info(`[SEED] Seeding ${data.devices.length} Fire TV devices from JSON...`)
    for (const device of data.devices) {
      if (!device.id) continue
      await saveFireTVDevice(device as Partial<FireTVDeviceRecord> & { id: string })
      logger.info(`[SEED]   FireTV: ${device.name} (${device.ipAddress})`)
    }

    logger.info(`[SEED] Fire TV seeding complete: ${data.devices.length} devices`)
    return { seeded: true, count: data.devices.length }
  } catch (error) {
    logger.error('[SEED] Failed to seed Fire TV devices:', error)
    return { seeded: false, count: 0 }
  }
}

async function seedStationAliases(): Promise<{ seeded: boolean; count: number }> {
  try {
    // Per-row upsert: merge new entries into whatever is already in the DB.
    // This lets later code releases add new universal aliases (e.g. new
    // streaming apps) and have them take effect on locations that already
    // have the table populated. The previous "skip-if-any-rows" behavior
    // made adding entries to STANDARD_ALIASES a no-op at existing installs.
    const existing = await db.select({ name: schema.stationAliases.standardName, aliases: schema.stationAliases.aliases }).from(schema.stationAliases)
    const existingMap = new Map<string, string[]>()
    for (const row of existing) {
      try { existingMap.set(row.name, JSON.parse(row.aliases)) } catch { existingMap.set(row.name, []) }
    }

    let added = 0
    let merged = 0
    for (const entry of STANDARD_ALIASES) {
      const current = existingMap.get(entry.standardName)
      if (!current) {
        await db.insert(schema.stationAliases).values({
          standardName: entry.standardName,
          aliases: JSON.stringify(entry.aliases),
        }).onConflictDoNothing()
        logger.info(`[SEED]   +Alias: ${entry.standardName} -> ${entry.aliases.join(', ')}`)
        added++
      } else {
        // Union — preserve any location-edited aliases, add new universal ones
        const unionSet = new Set([...current, ...entry.aliases])
        if (unionSet.size > current.length) {
          await db.update(schema.stationAliases)
            .set({ aliases: JSON.stringify([...unionSet]) })
            .where(sql`standard_name = ${entry.standardName}`)
          logger.info(`[SEED]   ~Alias merge: ${entry.standardName} (+${unionSet.size - current.length} new)`)
          merged++
        }
      }
    }

    logger.info(`[SEED] Station alias seed complete: ${added} added, ${merged} merged (of ${STANDARD_ALIASES.length} universal entries)`)
    return { seeded: added > 0 || merged > 0, count: added + merged }
  } catch (error) {
    logger.error('[SEED] Failed to seed station aliases:', error)
    return { seeded: false, count: 0 }
  }
}

interface LocalAliasEntry {
  standardName: string
  aliases: string[]
}

async function seedLocalStationAliases(): Promise<{ seeded: boolean; count: number }> {
  // Location-specific OTA broadcast-affiliate aliases. Each location has
  // different ABC/NBC/CBS/FOX affiliates (Green Bay uses WBAY/WGBA/WFRV/WLUK;
  // Madison uses WKOW/WMTV/WISC/WMSN; etc.). This file is populated per
  // location branch; it's an empty template on main. Format:
  //   {"aliases": [{"standardName": "WBAY", "aliases": ["ABC", "ABC 2", ...]}, ...]}
  try {
    const data = tryReadJson<{ aliases: LocalAliasEntry[] }>('station-aliases-local.json')
    if (!data || !Array.isArray(data.aliases) || data.aliases.length === 0) {
      logger.info('[SEED] No station-aliases-local.json entries to seed (empty template or missing — normal on main)')
      return { seeded: false, count: 0 }
    }

    // Reload current aliases after seedStationAliases() may have just run
    const existing = await db.select({ name: schema.stationAliases.standardName, aliases: schema.stationAliases.aliases }).from(schema.stationAliases)
    const existingMap = new Map<string, string[]>()
    for (const row of existing) {
      try { existingMap.set(row.name, JSON.parse(row.aliases)) } catch { existingMap.set(row.name, []) }
    }

    let added = 0
    let merged = 0
    for (const entry of data.aliases) {
      if (!entry.standardName || !Array.isArray(entry.aliases)) continue
      const current = existingMap.get(entry.standardName)
      if (!current) {
        await db.insert(schema.stationAliases).values({
          standardName: entry.standardName,
          aliases: JSON.stringify(entry.aliases),
        }).onConflictDoNothing()
        logger.info(`[SEED]   +Local alias: ${entry.standardName} -> ${entry.aliases.join(', ')}`)
        added++
      } else {
        const unionSet = new Set([...current, ...entry.aliases])
        if (unionSet.size > current.length) {
          await db.update(schema.stationAliases)
            .set({ aliases: JSON.stringify([...unionSet]) })
            .where(sql`standard_name = ${entry.standardName}`)
          logger.info(`[SEED]   ~Local alias merge: ${entry.standardName} (+${unionSet.size - current.length} new)`)
          merged++
        }
      }
    }

    logger.info(`[SEED] Local station alias seed complete: ${added} added, ${merged} merged (of ${data.aliases.length} local entries)`)
    return { seeded: added > 0 || merged > 0, count: added + merged }
  } catch (error) {
    logger.error('[SEED] Failed to seed local station aliases:', error)
    return { seeded: false, count: 0 }
  }
}

async function seedChannelPresets(): Promise<{ seeded: boolean; count: number }> {
  try {
    const count = await tableRowCount('ChannelPreset')
    if (count > 0) {
      logger.info(`[SEED] ChannelPreset table already has ${count} rows, skipping`)
      return { seeded: false, count: 0 }
    }

    // Read both cable and directv seed files. Either may be missing on
    // fresh main-branch installs — that's OK, we just skip the missing one.
    const cableData = tryReadJson<{ presets: ChannelPresetSeedRow[] }>('channel-presets-cable.json')
    const directvData = tryReadJson<{ presets: ChannelPresetSeedRow[] }>('channel-presets-directv.json')

    const cableRows = Array.isArray(cableData?.presets) ? cableData!.presets : []
    const directvRows = Array.isArray(directvData?.presets) ? directvData!.presets : []
    const allRows = [...cableRows, ...directvRows]

    if (allRows.length === 0) {
      logger.info('[SEED] No channel presets to seed (both JSON files empty or missing)')
      return { seeded: false, count: 0 }
    }

    logger.info(`[SEED] Seeding ${allRows.length} channel presets from JSON (cable=${cableRows.length}, directv=${directvRows.length})...`)
    let inserted = 0
    for (const row of allRows) {
      if (!row.id || !row.name || !row.channelNumber || !row.deviceType) {
        logger.warn(`[SEED]   Skipping invalid preset row: ${JSON.stringify(row)}`)
        continue
      }
      await db.insert(schema.channelPresets).values({
        id: row.id,
        name: row.name,
        channelNumber: row.channelNumber,
        deviceType: row.deviceType,
        order: row.order ?? 0,
        isActive: row.isActive ?? true,
        usageCount: row.usageCount ?? 0,
        lastUsed: row.lastUsed ?? null,
        ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        ...(row.updatedAt ? { updatedAt: row.updatedAt } : {}),
      }).onConflictDoNothing()
      logger.info(`[SEED]   Preset: ${row.name} (${row.deviceType} ch ${row.channelNumber}${row.isActive === false ? ', inactive' : ''})`)
      inserted++
    }

    logger.info(`[SEED] Channel preset seeding complete: ${inserted} presets`)
    return { seeded: inserted > 0, count: inserted }
  } catch (error) {
    logger.error('[SEED] Failed to seed channel presets:', error)
    return { seeded: false, count: 0 }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function seedBartenderLayout(): Promise<{ seeded: boolean; count: number }> {
  const count = await tableRowCount('BartenderLayout')
  if (count > 0) return { seeded: false, count }

  const layoutPath = path.join(process.cwd(), 'apps/web/data/tv-layout.json')
  if (!fs.existsSync(layoutPath)) {
    // Try root data mirror
    const altPath = path.join(process.cwd(), 'data/tv-layout.json')
    if (!fs.existsSync(altPath)) return { seeded: false, count: 0 }
  }

  try {
    const raw = fs.readFileSync(
      fs.existsSync(layoutPath) ? layoutPath : path.join(process.cwd(), 'data/tv-layout.json'),
      'utf-8'
    )
    const data = JSON.parse(raw)
    const zones = data.zones || (Array.isArray(data) ? data : [])
    if (zones.length === 0) return { seeded: false, count: 0 }
    const rooms = data.rooms || []

    // Normalize image URLs: JSON may use /api/uploads/ prefix, DB stores /uploads/
    const normalizeImageUrl = (url?: string) =>
      url ? url.replace('/api/uploads/', '/uploads/') : null

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    await db.insert(schema.bartenderLayouts).values({
      name: data.name || 'Bar Layout',
      zones: JSON.stringify(zones),
      rooms: JSON.stringify(rooms),
      imageUrl: normalizeImageUrl(data.imageUrl),
      originalFileUrl: normalizeImageUrl(data.imageUrl),
      professionalImageUrl: normalizeImageUrl(data.professionalImageUrl),
      isDefault: true,
      isActive: true,
      displayOrder: 0,
      createdAt: now,
      updatedAt: now,
    })

    logger.info(`[SEED] Seeded BartenderLayout with ${zones.length} zones from tv-layout.json`)
    return { seeded: true, count: 1 }
  } catch (err) {
    logger.error('[SEED] Error seeding BartenderLayout:', err)
    return { seeded: false, count: 0 }
  }
}

// ---------------------------------------------------------------------------
// INPUT SOURCES (v2.25.4) — derived from the 3 device-source-of-truth tables.
//
// AI Suggest and the scheduler read `input_sources` for their candidate list
// of places to route a game. Historically this table was populated by hand
// (or by a bootstrap that missed receivers added later), which is why
// Holmgren was running with 1 of 6 DirecTVs in input_sources even though
// all 6 were in DirecTVDevice. AI Suggest then never considered the other 5.
//
// This seeder enumerates DirecTVDevice, FireTVDevice, and irDevices
// (filtered to Cable Box entries) and inserts one input_sources row per
// device that doesn't yet have one. Idempotent — existing rows are left
// alone (we don't overwrite manually-tuned fields like available_networks
// or priority_rank). Locations with 2 receivers get 2 rows; locations
// with 8 get 8. Fleet-wide shape works regardless of count.
// ---------------------------------------------------------------------------
async function seedInputSources(): Promise<{ seeded: boolean; count: number }> {
  try {
    const existing = await db.select({
      id: schema.inputSources.id,
      deviceId: schema.inputSources.deviceId,
      type: schema.inputSources.type,
    }).from(schema.inputSources).all()
    const existingByDeviceId = new Map<string, boolean>()
    for (const r of existing) {
      if (r.deviceId) existingByDeviceId.set(`${r.type}:${r.deviceId}`, true)
    }

    const inserts: Array<{ name: string; type: string; deviceId: string; priorityRank: number; matrixInputId: string | null; availableNetworks: string }> = []

    // DirecTV boxes
    const directvs = await db.select().from(schema.direcTVDevices).all()
    for (const d of directvs) {
      const key = `directv:${d.id}`
      if (!existingByDeviceId.has(key)) {
        inserts.push({
          name: d.name,
          type: 'directv',
          deviceId: d.id,
          priorityRank: 70,
          matrixInputId: null,
          availableNetworks: '[]',
        })
      }
    }

    // Fire TV devices
    const firetvs = await db.select().from(schema.fireTVDevices).all()
    for (const d of firetvs) {
      const key = `firetv:${d.id}`
      if (!existingByDeviceId.has(key)) {
        inserts.push({
          name: d.name,
          type: 'firetv',
          deviceId: d.id,
          priorityRank: 60,
          matrixInputId: null,
          availableNetworks: '[]',
        })
      }
    }

    // Cable boxes via IRDevice
    const irs = await db.select().from(schema.irDevices).all()
    for (const d of irs) {
      const t = (d.deviceType || '').toLowerCase()
      if (t !== 'cablebox' && t !== 'cable box' && t !== 'cable') continue
      const key = `cable:${d.id}`
      if (!existingByDeviceId.has(key)) {
        inserts.push({
          name: d.name,
          type: 'cable',
          deviceId: d.id,
          priorityRank: 80,
          matrixInputId: d.matrixInput != null ? String(d.matrixInput) : null,
          availableNetworks: '[]',
        })
      }
    }

    if (inserts.length === 0) {
      logger.info('[SEED] input_sources already covers all 3 device tables (no new rows needed)')
      return { seeded: false, count: 0 }
    }

    const now = Math.floor(Date.now() / 1000)
    for (const i of inserts) {
      await db.insert(schema.inputSources).values({
        id: crypto.randomUUID(),
        name: i.name,
        type: i.type,
        deviceId: i.deviceId,
        matrixInputId: i.matrixInputId,
        availableNetworks: i.availableNetworks,
        isActive: true,
        currentlyAllocated: false,
        priorityRank: i.priorityRank,
        createdAt: now,
        updatedAt: now,
      })
      logger.info(`[SEED]   +InputSource: ${i.name} (${i.type}) deviceId=${i.deviceId}`)
    }

    logger.info(`[SEED] input_sources seeded: ${inserts.length} new rows (existing rows left alone)`)
    return { seeded: true, count: inserts.length }
  } catch (error) {
    logger.error('[SEED] Failed to seed input_sources:', error)
    return { seeded: false, count: 0 }
  }
}

export async function seedFromJson(): Promise<SeedResult> {
  logger.info('[SEED] Checking if database needs seeding from JSON files...')

  const direcTV = await seedDirecTV()
  const fireTV = await seedFireTV()
  const inputSourcesResult = await seedInputSources()
  const stationAliases = await seedStationAliases()
  const localStationAliases = await seedLocalStationAliases()
  const channelPresets = await seedChannelPresets()
  const bartenderLayout = await seedBartenderLayout()
  void inputSourcesResult // result logged inside; not part of SeedResult shape

  if (!direcTV.seeded && !fireTV.seeded && !stationAliases.seeded && !localStationAliases.seeded && !channelPresets.seeded && !bartenderLayout.seeded) {
    logger.info('[SEED] All tables already populated, no seeding needed')
  }

  // Merge universal + local alias counts into the stationAliases slot so
  // callers see a single "stationAliases" result (backward compatible with
  // any consumer that logs SeedResult).
  const combinedAliases = {
    seeded: stationAliases.seeded || localStationAliases.seeded,
    count: stationAliases.count + localStationAliases.count,
  }

  return { direcTV, fireTV, stationAliases: combinedAliases, channelPresets }
}
