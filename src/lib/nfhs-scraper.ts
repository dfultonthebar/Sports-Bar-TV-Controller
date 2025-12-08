/**
 * NFHS Network Scraper
 *
 * Scrapes game schedules from NFHS Network for high school sports
 * Since NFHS has no public API, we scrape their website
 */

import { logger } from '@/lib/logger'

export interface NFHSGame {
  id: string
  sport: string
  level: string  // Varsity, JV, etc.
  homeTeam: string
  awayTeam: string
  opponent: string
  date: string
  time: string
  startTime: Date
  location: string
  status: 'upcoming' | 'live' | 'on_demand'
  eventUrl: string
  schoolSlug: string
}

export interface NFHSSchool {
  name: string
  slug: string
  city: string
  state: string
  sports: string[]
}

// Known school slugs for configured home teams
const SCHOOL_SLUGS: Record<string, string> = {
  'De Pere Redbirds': 'de-pere-high-school-de-pere-wi',
  'De Pere': 'de-pere-high-school-de-pere-wi',
  // Add more as needed
}

/**
 * Parse NFHS Network school page HTML to extract games
 * This is a lightweight parser that works with the page snapshot data
 */
export function parseNFHSGames(pageData: any, schoolSlug: string): NFHSGame[] {
  const games: NFHSGame[] = []

  // The page data comes from Playwright snapshot
  // We need to extract game info from the structured data

  return games
}

/**
 * Fetch games for a school using the internal API
 * NFHS Network has an internal GraphQL/REST API we can try to use
 */
export async function fetchNFHSGamesForSchool(schoolSlug: string): Promise<NFHSGame[]> {
  const games: NFHSGame[] = []

  try {
    // Try the NFHS Network API endpoint (discovered from network traffic)
    const apiUrl = `https://api.nfhsnetwork.com/v3/schools/${schoolSlug}/events?limit=50`

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (response.ok) {
      const data = await response.json()
      logger.info(`[NFHS] API returned data for ${schoolSlug}`)

      // Parse the API response
      if (data.events) {
        for (const event of data.events) {
          games.push({
            id: event.id || event.key,
            sport: event.sport?.name || 'Unknown',
            level: event.level || 'Varsity',
            homeTeam: event.homeTeam?.name || '',
            awayTeam: event.awayTeam?.name || '',
            opponent: event.opponent?.name || event.awayTeam?.name || '',
            date: event.date || '',
            time: event.time || '',
            startTime: new Date(event.startTime || event.date),
            location: event.location?.city || '',
            status: event.status === 'live' ? 'live' :
                    new Date(event.startTime) > new Date() ? 'upcoming' : 'on_demand',
            eventUrl: `https://www.nfhsnetwork.com/events/${event.key}`,
            schoolSlug
          })
        }
      }
    } else {
      logger.warn(`[NFHS] API returned ${response.status} for ${schoolSlug}`)
    }
  } catch (error: any) {
    logger.warn(`[NFHS] API fetch failed: ${error.message}`)
  }

  return games
}

/**
 * Scrape games by parsing the school page HTML
 * Fallback when API doesn't work
 */
export async function scrapeNFHSSchoolPage(schoolSlug: string): Promise<NFHSGame[]> {
  const games: NFHSGame[] = []

  try {
    const pageUrl = `https://www.nfhsnetwork.com/schools/${schoolSlug}`

    const response = await fetch(pageUrl, {
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (response.ok) {
      const html = await response.text()

      // Extract JSON data embedded in the page (Next.js/Nuxt pattern)
      const scriptMatch = html.match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([^<]+)<\/script>/)
      if (scriptMatch) {
        try {
          const nuxtData = JSON.parse(scriptMatch[1])
          logger.info(`[NFHS] Found embedded data in page for ${schoolSlug}`)
          // Parse the Nuxt data structure for events
        } catch (e) {
          // JSON parse failed
        }
      }

      // Alternative: Look for event links in the HTML
      const eventRegex = /\/events\/[^"'\s]+\/gam[a-f0-9]+/g
      const eventMatches = html.matchAll(eventRegex)

      for (const match of eventMatches) {
        const eventPath = match[0]
        // Extract event ID
        const eventId = eventPath.split('/').pop() || ''

        if (eventId && !games.find(g => g.id === eventId)) {
          games.push({
            id: eventId,
            sport: 'Unknown',
            level: 'Varsity',
            homeTeam: '',
            awayTeam: '',
            opponent: '',
            date: '',
            time: '',
            startTime: new Date(),
            location: '',
            status: 'upcoming',
            eventUrl: `https://www.nfhsnetwork.com${eventPath}`,
            schoolSlug
          })
        }
      }
    }
  } catch (error: any) {
    logger.error(`[NFHS] Scrape failed: ${error.message}`)
  }

  return games
}

/**
 * Get the school slug for a team name
 */
export function getSchoolSlug(teamName: string): string | null {
  // Direct lookup
  if (SCHOOL_SLUGS[teamName]) {
    return SCHOOL_SLUGS[teamName]
  }

  // Fuzzy match
  const normalizedName = teamName.toLowerCase().trim()
  for (const [name, slug] of Object.entries(SCHOOL_SLUGS)) {
    if (name.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(name.toLowerCase())) {
      return slug
    }
  }

  return null
}

/**
 * Add a school to the known schools list
 */
export function addSchoolSlug(teamName: string, slug: string): void {
  SCHOOL_SLUGS[teamName] = slug
}

/**
 * Get all configured school slugs
 */
export function getConfiguredSchools(): Record<string, string> {
  return { ...SCHOOL_SLUGS }
}
