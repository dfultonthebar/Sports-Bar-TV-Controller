/**
 * Unit tests for network-channel-resolver
 *
 * Phase 1 of CHANNEL_RESOLVER_CONSOLIDATION_PLAN.md. Covers both the
 * pre-existing v2.4.8 helpers and the Phase 1 additions
 * (resolveChannelsForGame, findLocalChannelOverride, getStreamingAppForStation,
 * getStationToPresetMaps, invalidateChannelResolverCache).
 *
 * The DB is fully mocked — these tests must NEVER touch production.db. We
 * mock `@/db` to return synthetic in-memory rows that mirror the canonical
 * Stoneyard / Holmgren station_aliases conventions (FanDuelWI ch 40 vs
 * BallyWIPlus ch 308) so the Wisconsin RSN split regression tests are
 * meaningful.
 */

// ---------- Mock @/db BEFORE importing the helper ----------

interface FakePresetRow {
  name: string
  channelNumber: string
  deviceType: string
  isActive: boolean
}
interface FakeAliasRow {
  standardName: string
  aliases: string // JSON-encoded array
}
interface FakeOverrideRow {
  teamName: string
  channelNumber: number
  channelName: string
  deviceType: string
  isActive: boolean
}

const fakeData = {
  presets: [] as FakePresetRow[],
  aliases: [] as FakeAliasRow[],
  overrides: [] as FakeOverrideRow[],
}

// Track DB call counts so cache tests can assert single-fetch behavior
const dbCalls = {
  presets: 0,
  aliases: 0,
  overrides: 0,
}

// Drizzle-style chainable query builder mock. The helper code uses:
//   db.select().from(table).where(...)
//   db.select().from(table)
// It awaits these directly (they should resolve to row arrays).
function makeChain(rows: any[], onRead: () => void) {
  // The chain object is itself thenable so `await db.select().from(t)` works
  const chain: any = {
    where: (_pred: any) => chain, // ignore predicate; test fixtures are pre-filtered
    then: (resolve: (rows: any[]) => any, reject?: any) => {
      try {
        onRead()
        return Promise.resolve(rows).then(resolve, reject)
      } catch (e) {
        return reject ? reject(e) : Promise.reject(e)
      }
    },
  }
  return chain
}

// Sentinel table identifiers — the helper imports `schema` and passes
// schema.channelPresets / schema.stationAliases / schema.localChannelOverrides
// to db.select().from(...). We only need to distinguish them by reference.
const fakeSchema = {
  channelPresets: { __table: 'channelPresets', isActive: { name: 'isActive' } },
  stationAliases: { __table: 'stationAliases' },
  localChannelOverrides: { __table: 'localChannelOverrides', isActive: { name: 'isActive' } },
}

const fakeDb = {
  select: () => ({
    from: (t: any) => {
      if (t.__table === 'channelPresets') {
        return makeChain(
          fakeData.presets.filter(p => p.isActive),
          () => {
            dbCalls.presets++
          }
        )
      }
      if (t.__table === 'stationAliases') {
        return makeChain(fakeData.aliases, () => {
          dbCalls.aliases++
        })
      }
      if (t.__table === 'localChannelOverrides') {
        return makeChain(
          fakeData.overrides.filter(o => o.isActive),
          () => {
            dbCalls.overrides++
          }
        )
      }
      return makeChain([], () => {})
    },
  }),
}

jest.mock('@/db', () => ({
  db: fakeDb,
  schema: fakeSchema,
}))

// drizzle-orm's `eq` is called for predicate construction. We don't actually
// inspect it — return a placeholder.
jest.mock('drizzle-orm', () => ({
  eq: (_a: any, _b: any) => ({ __pred: true }),
}))

// ---------- Now import the helper ----------

import {
  resolveChannelsForNetworks,
  resolveChannelsForGame,
  findLocalChannelOverride,
  getStreamingAppForStation,
  getStationToPresetMaps,
  invalidateChannelResolverCache,
  normalizeStation,
} from '../network-channel-resolver'

// ---------- Fixture builders ----------

function loadStoneyardFixtures() {
  fakeData.presets = [
    // Cable presets — Green Bay Spectrum
    { name: 'ESPN', channelNumber: '27', deviceType: 'cable', isActive: true },
    { name: 'ESPN2', channelNumber: '28', deviceType: 'cable', isActive: true },
    { name: 'Fox Sports 1', channelNumber: '83', deviceType: 'cable', isActive: true },
    { name: 'MLB Network', channelNumber: '326', deviceType: 'cable', isActive: true },
    { name: 'Fan Duel', channelNumber: '40', deviceType: 'cable', isActive: true },
    { name: 'Bally Sports WI', channelNumber: '308', deviceType: 'cable', isActive: true },
    { name: 'WLUK', channelNumber: '11', deviceType: 'cable', isActive: true },
    // DirecTV presets
    { name: 'ESPN', channelNumber: '206', deviceType: 'directv', isActive: true },
    { name: 'MLB Network', channelNumber: '213', deviceType: 'directv', isActive: true },
  ]
  fakeData.aliases = [
    {
      standardName: 'FanDuelWI',
      aliases: JSON.stringify([
        'Fan Duel',
        'FanDuel SN WI',
        'FanDuel Sports Network Wisconsin',
        'FSWI',
        'Bally Sports Wisconsin',
        'BSWI',
        'Bucks.TV',
      ]),
    },
    {
      standardName: 'BallyWIPlus',
      aliases: JSON.stringify(['Bally Sports WI', 'BSWIP', 'Brewers.TV', 'MILBRE']),
    },
    {
      standardName: 'ESPN',
      aliases: JSON.stringify(['ESPN', 'ESPN HD', 'ESPN-HD']),
    },
  ]
  fakeData.overrides = []
}

function resetCallCounts() {
  dbCalls.presets = 0
  dbCalls.aliases = 0
  dbCalls.overrides = 0
}

beforeEach(() => {
  invalidateChannelResolverCache()
  resetCallCounts()
  loadStoneyardFixtures()
})

// ============================================================================
// Wisconsin RSN split regression tests (the v2.4.9 bug)
// ============================================================================

describe('Wisconsin RSN split — must NEVER collapse', () => {
  test('Bucks.TV resolves to cable channel 40 (FanDuelWI), NOT 308', async () => {
    const result = await resolveChannelsForNetworks(['Bucks.TV'])
    expect(result.cable).not.toBeNull()
    expect(result.cable!.channelNumber).toBe('40')
    expect(result.cable!.channelNumber).not.toBe('308')
  })

  test('Brewers.TV resolves to cable channel 308 (BallyWIPlus), NOT 40', async () => {
    const result = await resolveChannelsForNetworks(['Brewers.TV'])
    expect(result.cable).not.toBeNull()
    expect(result.cable!.channelNumber).toBe('308')
    expect(result.cable!.channelNumber).not.toBe('40')
  })

  test('MILBRE (ESPN code for Brewers overflow) resolves to cable 308', async () => {
    const result = await resolveChannelsForNetworks(['MILBRE'])
    expect(result.cable).not.toBeNull()
    expect(result.cable!.channelNumber).toBe('308')
  })

  test('FSWI (main WI RSN code) resolves to cable 40', async () => {
    const result = await resolveChannelsForNetworks(['FSWI'])
    expect(result.cable).not.toBeNull()
    expect(result.cable!.channelNumber).toBe('40')
  })

  test('resolveChannelsForGame for a Bucks game routes to 40, not 308', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['Bucks.TV'],
        primaryNetwork: 'Bucks.TV',
        sport: 'basketball',
        league: 'NBA',
      },
      ['cable']
    )
    expect(result.cableChannel).toBe('40')
    expect(result.resolvedVia).toBe('preset')
  })

  test('resolveChannelsForGame for a Brewers game routes to 308, not 40', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['Brewers.TV'],
        primaryNetwork: 'Brewers.TV',
        sport: 'baseball',
        league: 'MLB',
      },
      ['cable']
    )
    expect(result.cableChannel).toBe('308')
  })
})

// ============================================================================
// Sport-gating for streaming codes
// ============================================================================

describe('Sport-gated streaming app lookup', () => {
  test('MLBEI + baseball sport returns MLB.TV', () => {
    const result = getStreamingAppForStation('MLBEI', 'baseball')
    expect(result).not.toBeNull()
    expect(result!.app).toBe('MLB.TV')
  })

  test('MLBEI + hockey sport returns null (gated out)', () => {
    const result = getStreamingAppForStation('MLBEI', 'hockey')
    expect(result).toBeNull()
  })

  test('MLBEI with no sport returns null (cannot verify gate)', () => {
    const result = getStreamingAppForStation('MLBEI')
    expect(result).toBeNull()
  })

  test('NHLCI + hockey returns NHL Center Ice', () => {
    expect(getStreamingAppForStation('NHLCI', 'hockey')!.app).toBe('NHL Center Ice')
  })

  test('NBALP + basketball returns NBA League Pass', () => {
    expect(getStreamingAppForStation('NBALP', 'basketball')!.app).toBe('NBA League Pass')
  })

  test('MLSDK + soccer returns MLS Season Pass', () => {
    expect(getStreamingAppForStation('MLSDK', 'soccer')!.app).toBe('MLS Season Pass')
  })

  test('Sport-agnostic codes (Peacock) ignore sport arg', () => {
    expect(getStreamingAppForStation('PEACOCK')!.app).toBe('Peacock')
    expect(getStreamingAppForStation('PEACOCK', 'baseball')!.app).toBe('Peacock')
    expect(getStreamingAppForStation('PEACOCK', 'hockey')!.app).toBe('Peacock')
  })

  test('Unknown station code returns null', () => {
    expect(getStreamingAppForStation('NOT_A_REAL_CODE', 'baseball')).toBeNull()
  })

  test('League names like "NBA" or "MLB Baseball" normalize correctly', () => {
    // resolveChannelsForGame uses sport ?? league, and the helper normalizes both
    expect(getStreamingAppForStation('MLBEI', 'MLB')).not.toBeNull()
    expect(getStreamingAppForStation('MLBEI', 'MLB Baseball')).not.toBeNull()
    expect(getStreamingAppForStation('NBALP', 'NBA')).not.toBeNull()
  })

  test('resolveChannelsForGame: hockey game with MLBEI does NOT resolve as MLB.TV streaming', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['MLBEI'],
        primaryNetwork: 'MLBEI',
        sport: 'hockey',
        league: 'NHL',
      },
      ['cable', 'directv', 'streaming']
    )
    expect(result.streamingApp).toBeNull()
  })

  test('resolveChannelsForGame: baseball game with MLBEI resolves to MLB.TV streaming', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['MLBEI'],
        sport: 'baseball',
        league: 'MLB',
      },
      ['cable', 'directv', 'streaming']
    )
    expect(result.streamingApp).not.toBeNull()
    expect(result.streamingApp!.app).toBe('MLB.TV')
    expect(result.resolvedVia).toBe('streaming')
  })
})

// ============================================================================
// Multi-tier fallback (preset → override → streaming)
// ============================================================================

describe('Multi-tier fallback resolution', () => {
  test('ESPN game resolves via preset, not streaming', async () => {
    const result = await resolveChannelsForGame(
      { networks: ['ESPN'], sport: 'basketball' },
      ['cable', 'streaming']
    )
    expect(result.cableChannel).toBe('27')
    expect(result.resolvedVia).toBe('preset')
    expect(result.streamingApp).toBeNull() // streaming should NOT fire when preset matched
  })

  test('Unknown network with streaming code resolves via streaming', async () => {
    const result = await resolveChannelsForGame(
      { networks: ['PEACOCK'], sport: 'football' },
      ['cable', 'directv', 'streaming']
    )
    expect(result.cableChannel).toBeNull()
    expect(result.directvChannel).toBeNull()
    expect(result.streamingApp).not.toBeNull()
    expect(result.streamingApp!.app).toBe('Peacock')
    expect(result.resolvedVia).toBe('streaming')
  })

  test('Unknown network with no streaming code returns all nulls', async () => {
    const result = await resolveChannelsForGame(
      { networks: ['SOMETHING_RANDOM'], sport: 'baseball' },
      ['cable', 'directv', 'streaming']
    )
    expect(result.cableChannel).toBeNull()
    expect(result.directvChannel).toBeNull()
    expect(result.streamingApp).toBeNull()
    expect(result.resolvedVia).toBeNull()
  })

  test('Empty inputs return all nulls without throwing', async () => {
    const result = await resolveChannelsForGame(
      { networks: [], primaryNetwork: null, sport: null },
      ['cable', 'directv', 'streaming']
    )
    expect(result.cableChannel).toBeNull()
    expect(result.directvChannel).toBeNull()
    expect(result.streamingApp).toBeNull()
  })
})

// ============================================================================
// primaryNetwork priority
// ============================================================================

describe('primaryNetwork priority', () => {
  test('primaryNetwork beats array order — Brewers.TV first even when MLB.TV is array[0]', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['MLB.TV', 'Brewers.TV'],
        primaryNetwork: 'Brewers.TV',
        sport: 'baseball',
      },
      ['cable']
    )
    // Brewers.TV should win → cable 308 (BallyWIPlus)
    expect(result.cableChannel).toBe('308')
    expect(result.primaryMatch).toBe('Brewers.TV')
  })

  test('Without primaryNetwork, array order wins', async () => {
    const result = await resolveChannelsForGame(
      {
        networks: ['ESPN', 'Brewers.TV'],
        sport: 'baseball',
      },
      ['cable']
    )
    // ESPN (array[0]) should be picked first
    expect(result.cableChannel).toBe('27')
    expect(result.primaryMatch).toBe('ESPN')
  })
})

// ============================================================================
// local_channel_overrides
// ============================================================================

describe('Local channel overrides', () => {
  test('Override is found via team-name normalized substring match', async () => {
    fakeData.overrides = [
      {
        teamName: 'Brewers',
        channelNumber: 999,
        channelName: 'Local Brewers Feed',
        deviceType: 'cable',
        isActive: true,
      },
    ]
    invalidateChannelResolverCache()
    const result = await findLocalChannelOverride('Milwaukee Brewers')
    expect(result).not.toBeNull()
    expect(result!.cable).toBe('999')
  })

  test('No override returns null', async () => {
    fakeData.overrides = []
    invalidateChannelResolverCache()
    const result = await findLocalChannelOverride('Milwaukee Brewers')
    expect(result).toBeNull()
  })

  test('Override precedence: when preset has no match for the network, override fills cable', async () => {
    // Use a network that has NO preset/alias entry but DOES match an override
    fakeData.overrides = [
      {
        teamName: 'Random Team',
        channelNumber: 555,
        channelName: 'Local Random',
        deviceType: 'cable',
        isActive: true,
      },
    ]
    invalidateChannelResolverCache()
    const result = await resolveChannelsForGame(
      { networks: ['Random Team'], sport: 'baseball' },
      ['cable']
    )
    expect(result.cableChannel).toBe('555')
    expect(result.resolvedVia).toBe('override')
  })

  test('Preset match takes precedence over override for the same network', async () => {
    // ESPN has preset ch 27 AND we add an override for ESPN at ch 999.
    // Preset should win (resolveChannelsForGame tries preset first).
    fakeData.overrides = [
      {
        teamName: 'ESPN',
        channelNumber: 999,
        channelName: 'Should Not Win',
        deviceType: 'cable',
        isActive: true,
      },
    ]
    invalidateChannelResolverCache()
    const result = await resolveChannelsForGame(
      { networks: ['ESPN'], sport: 'basketball' },
      ['cable']
    )
    expect(result.cableChannel).toBe('27')
    expect(result.resolvedVia).toBe('preset')
  })
})

// ============================================================================
// Cache correctness
// ============================================================================

describe('Module cache TTL', () => {
  test('Two consecutive resolveChannelsForNetworks calls hit DB only once', async () => {
    invalidateChannelResolverCache()
    resetCallCounts()
    await resolveChannelsForNetworks(['ESPN'])
    const presetsAfter1 = dbCalls.presets
    const aliasesAfter1 = dbCalls.aliases
    expect(presetsAfter1).toBe(1)
    expect(aliasesAfter1).toBe(1)
    await resolveChannelsForNetworks(['Brewers.TV'])
    expect(dbCalls.presets).toBe(1) // still 1 — cache hit
    expect(dbCalls.aliases).toBe(1)
  })

  test('invalidateChannelResolverCache() forces a refetch', async () => {
    await resolveChannelsForNetworks(['ESPN'])
    expect(dbCalls.presets).toBe(1)
    invalidateChannelResolverCache()
    await resolveChannelsForNetworks(['ESPN'])
    expect(dbCalls.presets).toBe(2)
  })

  test('getStationToPresetMaps caches independently and returns expected shape', async () => {
    invalidateChannelResolverCache()
    const maps = await getStationToPresetMaps()
    expect(maps.stationToCable).toBeInstanceOf(Map)
    expect(maps.stationToDirectv).toBeInstanceOf(Map)
    // Must contain at least the ESPN entry under its normalized key
    const espnKey = normalizeStation('ESPN')
    expect(maps.stationToCable.get(espnKey)).toBe('27')
    expect(maps.stationToDirectv.get(espnKey)).toBe('206')
    // Wisconsin RSN split must be present in the maps
    expect(maps.stationToCable.get(normalizeStation('FANDUELWI'))).toBe('40')
    expect(maps.stationToCable.get(normalizeStation('BALLYWIPLUS'))).toBe('308')
    // Second call hits cache
    const presetsBefore = dbCalls.presets
    await getStationToPresetMaps()
    expect(dbCalls.presets).toBe(presetsBefore)
  })
})
