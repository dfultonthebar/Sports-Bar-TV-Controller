/**
 * NFHS Network API
 *
 * Fetches high school sports schedules from NFHS Network
 * Supports configured home teams (like De Pere Redbirds)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { logger } from '@sports-bar/logger'
import { db } from '@/db'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface NFHSGame {
  id: string
  sport: string
  level: string
  homeTeam: string
  awayTeam: string
  date: string
  time: string
  dateTime: string
  location: string
  status: 'upcoming' | 'live' | 'on_demand'
  eventUrl: string
  streamingService: 'NFHS Network'
  packages: string[]
}

// School configurations
const NFHS_SCHOOLS: Record<string, { name: string; slug: string; city: string; state: string }> = {
  'de-pere': {
    name: 'De Pere Redbirds',
    slug: 'de-pere-high-school-de-pere-wi',
    city: 'De Pere',
    state: 'WI'
  }
}

// In-memory cache for NFHS data (refreshes every 15 minutes)
let nfhsCache: {
  games: NFHSGame[]
  lastUpdated: Date
  schools: string[]
} | null = null

const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Parse game data from NFHS school page using regex patterns
 */
function parseGameFromHTML(eventBlock: string, schoolSlug: string): NFHSGame | null {
  try {
    // Extract sport and level (e.g., "Junior Varsity Boys Basketball")
    const sportMatch = eventBlock.match(/((?:Junior Varsity|Varsity|JV|Freshman)\s+(?:Boys|Girls)?\s*\w+)/i)
    const sport = sportMatch ? sportMatch[1] : 'Unknown Sport'

    // Extract teams
    const teamsMatch = eventBlock.match(/(\w[\w\s]+)\s+vs\.?\s+(\w[\w\s]+)/i)
    const homeTeam = teamsMatch ? teamsMatch[1].trim() : ''
    const awayTeam = teamsMatch ? teamsMatch[2].trim() : ''

    // Extract date and time (e.g., "Jan 3, 2026 | 11:15 AM CST")
    const dateTimeMatch = eventBlock.match(/(\w{3}\s+\d{1,2},\s+\d{4})\s*\|\s*(\d{1,2}:\d{2}\s*(?:AM|PM)\s*\w+)/i)
    const date = dateTimeMatch ? dateTimeMatch[1] : ''
    const time = dateTimeMatch ? dateTimeMatch[2] : ''

    // Extract location
    const locationMatch = eventBlock.match(/(?:CDT|CST|EST|PST)\s+([\w\s,]+)$/i)
    const location = locationMatch ? locationMatch[1].trim() : ''

    // Extract status
    const isLive = eventBlock.toLowerCase().includes('live')
    const isOnDemand = eventBlock.toLowerCase().includes('on demand')
    const status = isLive ? 'live' : isOnDemand ? 'on_demand' : 'upcoming'

    // Extract event URL
    const urlMatch = eventBlock.match(/\/events\/[^"'\s]+\/gam[a-f0-9]+/i)
    const eventUrl = urlMatch ? `https://www.nfhsnetwork.com${urlMatch[0]}` : ''
    const id = urlMatch ? urlMatch[0].split('/').pop() || '' : `nfhs-${Date.now()}`

    if (!date || !homeTeam) return null

    // Parse the date string to create a proper datetime
    let dateTime = ''
    try {
      const dateStr = `${date} ${time.replace(/\s*\w{3}$/, '')}` // Remove timezone abbrev
      const parsed = new Date(dateStr)
      if (!isNaN(parsed.getTime())) {
        dateTime = parsed.toISOString()
      }
    } catch (e) {
      // Use date string as-is
      dateTime = date
    }

    return {
      id,
      sport,
      level: sport.includes('Varsity') ? 'Varsity' : sport.includes('JV') || sport.includes('Junior') ? 'JV' : 'Varsity',
      homeTeam,
      awayTeam,
      date,
      time,
      dateTime,
      location,
      status,
      eventUrl,
      streamingService: 'NFHS Network',
      packages: ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive']
    }
  } catch (error) {
    return null
  }
}

/**
 * Fetch games from NFHS Network for a school
 */
async function fetchNFHSGames(schoolSlug: string): Promise<NFHSGame[]> {
  const games: NFHSGame[] = []

  try {
    // Fetch the school page
    const pageUrl = `https://www.nfhsnetwork.com/schools/${schoolSlug}`
    logger.info(`[NFHS] Fetching games from ${pageUrl}`)

    const response = await fetch(pageUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      logger.warn(`[NFHS] Failed to fetch ${schoolSlug}: ${response.status}`)
      return games
    }

    const html = await response.text()

    // Look for embedded JSON data (Nuxt.js pattern)
    const nuxtDataMatch = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*type="application\/json"[^>]*>([^<]+)<\/script>/i)
    if (nuxtDataMatch) {
      try {
        // Nuxt 3 uses a specific JSON format - try to parse events from it
        const rawData = JSON.parse(nuxtDataMatch[1])
        logger.info(`[NFHS] Found Nuxt data with ${rawData.length} entries`)
        // The Nuxt data format is complex - we'd need to decode it
      } catch (e) {
        logger.debug('[NFHS] Could not parse Nuxt data')
      }
    }

    // Fallback: Extract game info from visible text patterns
    // Look for event blocks in the HTML

    // Pattern for upcoming games section
    const upcomingMatch = html.match(/Upcoming[\s\S]*?(?=Past Events|Latest Highlights|$)/i)
    if (upcomingMatch) {
      // Extract individual event blocks
      const eventBlocks = upcomingMatch[0].match(/(?:Junior Varsity|Varsity|JV)[\s\S]*?(?:\w{3}\s+\d{1,2},\s+\d{4})\s*\|\s*\d{1,2}:\d{2}\s*(?:AM|PM)\s*\w+[\s\S]*?(?=Junior Varsity|Varsity|JV|Past Events|$)/gi)

      if (eventBlocks) {
        for (const block of eventBlocks) {
          const game = parseGameFromHTML(block, schoolSlug)
          if (game) {
            game.status = 'upcoming'
            games.push(game)
          }
        }
      }
    }

    // Pattern for live games (would have "Live" badge)
    const liveMatch = html.match(/Live[\s\S]*?(?:Junior Varsity|Varsity|JV)[\s\S]*?(?:\w{3}\s+\d{1,2},\s+\d{4})/gi)
    if (liveMatch) {
      for (const block of liveMatch) {
        const game = parseGameFromHTML(block, schoolSlug)
        if (game) {
          game.status = 'live'
          // Add to beginning of list
          games.unshift(game)
        }
      }
    }

    logger.info(`[NFHS] Extracted ${games.length} games for ${schoolSlug}`)

  } catch (error: any) {
    logger.error(`[NFHS] Error fetching games: ${error.message}`)
  }

  return games
}

/**
 * GET - Fetch NFHS Network games from database
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const { searchParams } = new URL(request.url)
    const school = searchParams.get('school')
    const statusFilter = searchParams.get('status') // 'live', 'upcoming', 'on_demand'

    // Query games from database using Drizzle ORM
    let games: NFHSGame[] = []

    try {
      const dbGames = await db.select().from(schema.nfhsGames).orderBy(schema.nfhsGames.dateTime)

      games = dbGames.map(row => ({
        id: row.id,
        sport: row.sport,
        level: row.level || 'Varsity',
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam || row.opponent || '',
        date: row.date,
        time: row.time || '',
        dateTime: row.dateTime || '',
        location: row.location || '',
        status: row.status as 'upcoming' | 'live' | 'on_demand',
        eventUrl: row.eventUrl || '',
        streamingService: 'NFHS Network' as const,
        packages: ['com.nfhsnetwork.ui', 'com.nfhsnetwork.app', 'com.playon.nfhslive']
      }))

      logger.info(`[NFHS] Loaded ${games.length} games from database`)
    } catch (dbError: any) {
      logger.warn(`[NFHS] Database query failed: ${dbError.message}`)
    }

    // Filter by school if specified
    if (school) {
      const schoolConfig = NFHS_SCHOOLS[school]
      if (schoolConfig) {
        const searchTerm = schoolConfig.name.split(' ')[0].toLowerCase()
        games = games.filter(g =>
          g.homeTeam.toLowerCase().includes(searchTerm) ||
          (g.awayTeam && g.awayTeam.toLowerCase().includes(searchTerm))
        )
      }
    }

    // Filter by status if specified
    if (statusFilter) {
      games = games.filter(g => g.status === statusFilter)
    }

    // Separate by status
    const liveGames = games.filter(g => g.status === 'live')
    const upcomingGames = games.filter(g => g.status === 'upcoming')
    const onDemandGames = games.filter(g => g.status === 'on_demand')

    return NextResponse.json({
      success: true,
      games,
      summary: {
        total: games.length,
        live: liveGames.length,
        upcoming: upcomingGames.length,
        onDemand: onDemandGames.length
      },
      liveGames,
      upcomingGames,
      availableSchools: Object.entries(NFHS_SCHOOLS).map(([key, val]) => ({
        key,
        ...val
      })),
      lastUpdated: new Date().toISOString()
    })

  } catch (error: any) {
    logger.error('[NFHS] API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * POST - Add a new school to track
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  try {
    const body = await request.json()
    const { name, slug, city, state } = body

    if (!name || !slug) {
      return NextResponse.json({
        success: false,
        error: 'Name and slug are required'
      }, { status: 400 })
    }

    // Add to schools config
    const key = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    NFHS_SCHOOLS[key] = {
      name,
      slug,
      city: city || '',
      state: state || ''
    }

    // Clear cache to force refresh
    nfhsCache = null

    logger.info(`[NFHS] Added school: ${name} (${slug})`)

    return NextResponse.json({
      success: true,
      school: NFHS_SCHOOLS[key],
      key
    })

  } catch (error: any) {
    logger.error('[NFHS] POST error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
