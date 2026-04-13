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
  { standardName: 'ESPNU', aliases: ['ESPNUHD', 'ESPNU HD'] },
  { standardName: 'ESPNEWS', aliases: ['ESPNWHD', 'ESPNEWS HD'] },
  { standardName: 'FS1', aliases: ['FS1HD', 'FOX SPORTS 1', 'FOX SPORTS1'] },
  { standardName: 'FS2', aliases: ['FS2HD', 'FOX SPORTS 2'] },
  { standardName: 'FSN', aliases: ['FSNHD', 'FOX SPORTS NORTH', 'FSNWI', 'BSNOR'] },
  // Main Wisconsin RSN — preset name "Fan Duel" (channel 40 on Spectrum GB).
  // Carries Bucks and general WI sports content. The Rail Media API returns
  // these games under station code "FSWI".
  { standardName: 'FanDuelWI', aliases: ['Fan Duel', 'FanDuel', 'FSWI', 'BSWI', 'Bally Sports Wisconsin', 'Bally Sports WI Main', 'FanDuel Sports Wisconsin', 'FanDuel SN WI', 'FanDuel SN Wisconsin', 'FOX Sports Wisconsin', 'Bucks.TV'] },
  // Brewers-only overflow RSN — preset name "Bally Sports WI" (channel 308).
  // Used when Brewers games air at the same time as something else on the main
  // WI RSN. ESPN tags these broadcasts as "Brewers.TV"; The Rail Media API
  // uses the station code "MILBRE".
  { standardName: 'BallyWIPlus', aliases: ['Bally Sports WI', 'Bally Sports WI+', 'Bally Sports Wisconsin+', 'BSWI+', 'FSWI+', 'FanDuel SN WI+', 'FanDuel Sports WI+', 'Brewers.TV', 'MILBRE'] },
  { standardName: 'TNT', aliases: ['TNTHD', 'TNT HD', 'TNTDRAMA'] },
  { standardName: 'TBS', aliases: ['TBSHD', 'TBS HD'] },
  { standardName: 'BTN', aliases: ['BIG TEN NETWORK', 'BIG TEN', 'B10', 'BTNHD', 'BTN HD'] },
  { standardName: 'NBCSN', aliases: ['NBC SPORTS', 'NBCSNHD', 'NBCSN HD'] },
  { standardName: 'USA', aliases: ['USAHD', 'USA HD', 'USA NETWORK'] },
  { standardName: 'ABC', aliases: ['ABCHD', 'WABC', 'ABC HD', 'WBAY'] },
  { standardName: 'NBC', aliases: ['NBCHD', 'NBC HD', 'WGBA'] },
  { standardName: 'CBS', aliases: ['CBSHD', 'CBS HD', 'WFRV'] },
  { standardName: 'FOX', aliases: ['FOXHD', 'FOX HD', 'WLUK'] },
  { standardName: 'MLBN', aliases: ['MLB', 'MLBNHD', 'MLB NETWORK', 'MLB NET'] },
  { standardName: 'NFLN', aliases: ['NFL', 'NFLNHD', 'NFL NETWORK', 'NFL NET'] },
  { standardName: 'NHLN', aliases: ['NHL', 'NHLNHD', 'NHL NETWORK', 'NHL NET'] },
  { standardName: 'NBATV', aliases: ['NBA', 'NBATVHD', 'NBA TV'] },
  { standardName: 'SEC', aliases: ['SECN', 'SEC NETWORK', 'SECNHD'] },
  { standardName: 'ACC', aliases: ['ACCN', 'ACC NETWORK', 'ACCNHD'] },
  { standardName: 'PAC12', aliases: ['PAC-12', 'PAC 12', 'PAC12HD'] },
  { standardName: 'GOLF', aliases: ['GOLFHD', 'GOLF CHANNEL', 'GOLF CH'] },
  { standardName: 'WACY', aliases: ['WACY32', 'MYN', 'MY NETWORK'] },
  { standardName: 'CW', aliases: ['CWHD', 'CW HD', 'WACY'] },
  { standardName: 'PEACOCK', aliases: ['PCCK'] },
  { standardName: 'BIG12', aliases: ['BIG 12', 'BIG12HD'] },
  { standardName: 'CBSSN', aliases: ['CBS SPORTS', 'CBS SPORTS NETWORK', 'CBSSNHD'] },
  { standardName: 'TRUTV', aliases: ['TRU TV', 'TRUTVHD'] },
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
    const count = await tableRowCount('station_aliases')
    if (count > 0) {
      logger.info(`[SEED] station_aliases table already has ${count} rows, skipping`)
      return { seeded: false, count: 0 }
    }

    logger.info(`[SEED] Seeding ${STANDARD_ALIASES.length} standard station aliases...`)
    for (const entry of STANDARD_ALIASES) {
      await db.insert(schema.stationAliases).values({
        standardName: entry.standardName,
        aliases: JSON.stringify(entry.aliases),
      }).onConflictDoNothing()
      logger.info(`[SEED]   Alias: ${entry.standardName} -> ${entry.aliases.join(', ')}`)
    }

    logger.info(`[SEED] Station alias seeding complete: ${STANDARD_ALIASES.length} entries`)
    return { seeded: true, count: STANDARD_ALIASES.length }
  } catch (error) {
    logger.error('[SEED] Failed to seed station aliases:', error)
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

export async function seedFromJson(): Promise<SeedResult> {
  logger.info('[SEED] Checking if database needs seeding from JSON files...')

  const direcTV = await seedDirecTV()
  const fireTV = await seedFireTV()
  const stationAliases = await seedStationAliases()
  const channelPresets = await seedChannelPresets()

  if (!direcTV.seeded && !fireTV.seeded && !stationAliases.seeded && !channelPresets.seeded) {
    logger.info('[SEED] All tables already populated, no seeding needed')
  }

  return { direcTV, fireTV, stationAliases, channelPresets }
}
