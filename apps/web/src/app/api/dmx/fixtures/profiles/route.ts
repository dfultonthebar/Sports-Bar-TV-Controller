import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@sports-bar/logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

/**
 * Open Fixture Library API Integration
 * https://open-fixture-library.org/api/v1/
 *
 * Provides access to thousands of DMX fixture profiles
 */

const OFL_API_BASE = 'https://open-fixture-library.org/api/v1'

interface OFLManufacturer {
  key: string
  name: string
  website?: string
  fixtureCount: number
}

interface OFLFixture {
  key: string
  name: string
  manufacturer: string
  categories: string[]
  modes: {
    name: string
    channelCount: number
  }[]
}

interface OFLFixtureDetail {
  name: string
  shortName?: string
  categories: string[]
  meta: {
    authors: string[]
    createDate: string
    lastModifyDate: string
  }
  physical?: {
    dimensions?: [number, number, number]
    weight?: number
    power?: number
    DMXconnector?: string
    bulb?: {
      type?: string
      colorTemperature?: number
      lumens?: number
    }
  }
  modes: {
    name: string
    shortName?: string
    channels: string[]
  }[]
  availableChannels: Record<string, {
    type: string
    fineChannelAliases?: string[]
    defaultValue?: number | string
    capability?: {
      type: string
      brightnessStart?: string
      brightnessEnd?: string
    }
    capabilities?: {
      dmxRange: [number, number]
      type: string
      comment?: string
    }[]
  }>
}

/**
 * GET /api/dmx/fixtures/profiles
 * Search for fixture profiles in Open Fixture Library
 *
 * Query params:
 * - q: Search query (fixture name or manufacturer)
 * - manufacturer: Filter by manufacturer key
 * - category: Filter by category (Color Changer, Moving Head, etc.)
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const manufacturer = searchParams.get('manufacturer')
  const category = searchParams.get('category')
  const fixtureKey = searchParams.get('fixture') // Full fixture key like "chauvet-dj/slimpar-pro-h-usb"

  try {
    // If a specific fixture is requested, fetch its details
    if (fixtureKey) {
      const detail = await fetchFixtureDetail(fixtureKey)
      if (!detail) {
        return NextResponse.json({ error: 'Fixture not found' }, { status: 404 })
      }
      return NextResponse.json({
        success: true,
        fixture: detail,
        channelMap: generateChannelMap(detail),
      })
    }

    // Otherwise, search/list fixtures
    let fixtures: OFLFixture[] = []
    let manufacturers: OFLManufacturer[] = []

    // If searching by query
    if (query) {
      fixtures = await searchFixtures(query)
    }
    // If listing by manufacturer
    else if (manufacturer) {
      fixtures = await getManufacturerFixtures(manufacturer)
    }
    // If no filters, return list of manufacturers
    else {
      manufacturers = await getManufacturers()
    }

    // Filter by category if specified
    if (category && fixtures.length > 0) {
      fixtures = fixtures.filter(f =>
        f.categories.some(c => c.toLowerCase() === category.toLowerCase())
      )
    }

    return NextResponse.json({
      success: true,
      fixtures,
      manufacturers,
      categories: FIXTURE_CATEGORIES,
    })
  } catch (error) {
    logger.error('[DMX] Error fetching fixture profiles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch fixture profiles' },
      { status: 500 }
    )
  }
}

// Fixture categories from Open Fixture Library
const FIXTURE_CATEGORIES = [
  'Barrel Scanner',
  'Blinder',
  'Color Changer',
  'Dimmer',
  'Effect',
  'Fan',
  'Flower',
  'Hazer',
  'Laser',
  'Matrix',
  'Moving Head',
  'Pixel Bar',
  'Scanner',
  'Smoke',
  'Stand',
  'Strobe',
  'Other',
]

async function searchFixtures(query: string): Promise<OFLFixture[]> {
  const response = await fetch(
    `${OFL_API_BASE}/fixtures/search?q=${encodeURIComponent(query)}`,
    { next: { revalidate: 3600 } } // Cache for 1 hour
  )

  if (!response.ok) {
    logger.error('[DMX] OFL search failed:', response.status)
    return []
  }

  const data = await response.json()
  return data.fixtures || []
}

async function getManufacturers(): Promise<OFLManufacturer[]> {
  const response = await fetch(`${OFL_API_BASE}/manufacturers`, {
    next: { revalidate: 86400 }, // Cache for 24 hours
  })

  if (!response.ok) {
    logger.error('[DMX] OFL manufacturers failed:', response.status)
    return []
  }

  const data = await response.json()

  // Transform to array with fixture counts
  return Object.entries(data).map(([key, value]: [string, any]) => ({
    key,
    name: value.name,
    website: value.website,
    fixtureCount: value.fixtures?.length || 0,
  })).sort((a, b) => a.name.localeCompare(b.name))
}

async function getManufacturerFixtures(manufacturerKey: string): Promise<OFLFixture[]> {
  const response = await fetch(
    `${OFL_API_BASE}/manufacturers/${encodeURIComponent(manufacturerKey)}`,
    { next: { revalidate: 3600 } }
  )

  if (!response.ok) {
    logger.error('[DMX] OFL manufacturer fixtures failed:', response.status)
    return []
  }

  const data = await response.json()
  return data.fixtures || []
}

async function fetchFixtureDetail(fixtureKey: string): Promise<OFLFixtureDetail | null> {
  const response = await fetch(
    `${OFL_API_BASE}/fixtures/${encodeURIComponent(fixtureKey)}`,
    { next: { revalidate: 3600 } }
  )

  if (!response.ok) {
    return null
  }

  return response.json()
}

/**
 * Generate a channel map from fixture detail for use in our system
 */
function generateChannelMap(fixture: OFLFixtureDetail): Record<string, number> {
  const channelMap: Record<string, number> = {}

  // Use the first mode as default
  const firstMode = fixture.modes[0]
  if (!firstMode) return channelMap

  // Map channels to their offsets
  firstMode.channels.forEach((channelName, index) => {
    const channelDef = fixture.availableChannels[channelName]
    if (!channelDef) return

    const offset = index + 1 // 1-indexed

    // Map common channel types to our standard names
    switch (channelDef.type?.toLowerCase()) {
      case 'intensity':
      case 'dimmer':
        channelMap.dimmer = offset
        break
      case 'colorintensity':
        // Check if it's a specific color
        if (channelName.toLowerCase().includes('red')) channelMap.red = offset
        else if (channelName.toLowerCase().includes('green')) channelMap.green = offset
        else if (channelName.toLowerCase().includes('blue')) channelMap.blue = offset
        else if (channelName.toLowerCase().includes('white')) channelMap.white = offset
        else if (channelName.toLowerCase().includes('amber')) channelMap.amber = offset
        else if (channelName.toLowerCase().includes('uv')) channelMap.uv = offset
        break
      case 'pan':
        channelMap.pan = offset
        break
      case 'panfine':
        channelMap.panFine = offset
        break
      case 'tilt':
        channelMap.tilt = offset
        break
      case 'tiltfine':
        channelMap.tiltFine = offset
        break
      case 'strobe':
      case 'shutter':
        channelMap.strobe = offset
        break
      case 'gobo':
      case 'gobowheel':
        channelMap.gobo = offset
        break
      case 'colorwheel':
        channelMap.colorWheel = offset
        break
      case 'focus':
        channelMap.focus = offset
        break
      case 'zoom':
        channelMap.zoom = offset
        break
      case 'prism':
        channelMap.prism = offset
        break
    }
  })

  return channelMap
}
