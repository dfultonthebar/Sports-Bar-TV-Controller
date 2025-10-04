// Next.js route segment config - prevent static generation during build
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface NFHSAuthResponse {
  success: boolean
  cookies?: string[]
  error?: string
}

interface NFHSGameData {
  eventId: string
  homeSchool: {
    id: string
    name: string
    city: string
    state: string
  }
  awaySchool: {
    id: string
    name: string
    city: string
    state: string
  }
  homeTeam: string
  awayTeam: string
  sport: string
  level: string
  gender: string
  date: string
  time: string
  venue: string
  streamUrl?: string
  isStreaming: boolean
}

/**
 * Helper function to delay execution (rate limiting)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Helper function to load cheerio dynamically
 */
async function loadCheerio() {
  const cheerioModule = await import('cheerio')
  return cheerioModule.default || cheerioModule
}

/**
 * Helper function to make authenticated requests with cookie management
 */
async function fetchWithCookies(
  url: string,
  cookies: string[],
  options: RequestInit = {}
): Promise<Response> {
  const cookieHeader = cookies.join('; ')
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    }
  })
}

/**
 * Authenticate with NFHS Network using web scraping
 * This implementation uses form-based authentication with CSRF token handling
 */
async function authenticateNFHS(): Promise<NFHSAuthResponse> {
  
  const username = process.env.NFHS_USERNAME
  const password = process.env.NFHS_PASSWORD

  if (!username || !password) {
    return {
      success: false,
      error: 'NFHS credentials not configured. Please add NFHS_USERNAME and NFHS_PASSWORD to your .env file.'
    }
  }

  try {
    console.log('Step 1: Fetching login page to get CSRF token...')
    
    // Step 1: Get the login page to extract CSRF token and initial cookies
    const loginPageUrl = 'https://www.nfhsnetwork.com/users/sign_in'
    const loginPageResponse = await fetch(loginPageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })

    if (!loginPageResponse.ok) {
      return {
        success: false,
        error: `Failed to fetch login page: ${loginPageResponse.status} ${loginPageResponse.statusText}`
      }
    }

    // Extract cookies from the initial request
    const initialCookies = loginPageResponse.headers.getSetCookie()
    console.log('Initial cookies received:', initialCookies.length)

    // Parse the HTML to get CSRF token
    const loginPageHtml = await loginPageResponse.text()
    const load = await loadCheerio()
    const $ = load(loginPageHtml)
    
    // Look for CSRF token in various common locations
    const csrfToken = 
      $('input[name="authenticity_token"]').val() ||
      $('input[name="_csrf"]').val() ||
      $('meta[name="csrf-token"]').attr('content') ||
      ''

    if (!csrfToken) {
      console.warn('Warning: CSRF token not found, attempting login without it')
    } else {
      console.log('CSRF token found:', csrfToken.toString().substring(0, 20) + '...')
    }

    // Rate limiting delay
    await delay(1000)

    console.log('Step 2: Submitting login credentials...')

    // Step 2: Submit login form
    // NFHS Network uses a standard Rails form submission
    const formData = new URLSearchParams()
    formData.append('user[email]', username)
    formData.append('user[password]', password)
    formData.append('user[remember_me]', '0')
    if (csrfToken) {
      formData.append('authenticity_token', csrfToken.toString())
    }

    const loginResponse = await fetch(loginPageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': loginPageUrl,
        'Origin': 'https://www.nfhsnetwork.com',
        'Cookie': initialCookies.join('; ')
      },
      body: formData.toString(),
      redirect: 'manual' // Don't follow redirects automatically
    })

    // Collect all cookies from login response
    const loginCookies = loginResponse.headers.getSetCookie()
    const allCookies = [...initialCookies, ...loginCookies]
    
    console.log('Login response status:', loginResponse.status)
    console.log('Login cookies received:', loginCookies.length)

    // Check if login was successful
    // Successful login typically results in a 302 redirect or 200 with session cookies
    if (loginResponse.status === 302 || loginResponse.status === 301) {
      const redirectLocation = loginResponse.headers.get('location')
      console.log('Redirect location:', redirectLocation)
      
      // Check if redirected to an error page
      if (redirectLocation?.includes('sign_in') || redirectLocation?.includes('error')) {
        return {
          success: false,
          error: 'Login failed - redirected to error page. Please check your credentials.'
        }
      }

      return {
        success: true,
        cookies: allCookies
      }
    } else if (loginResponse.status === 200) {
      // Check if we have session cookies
      const hasSessionCookie = allCookies.some(cookie => 
        cookie.toLowerCase().includes('session') || 
        cookie.toLowerCase().includes('_nfhs') ||
        cookie.toLowerCase().includes('remember')
      )

      if (hasSessionCookie) {
        return {
          success: true,
          cookies: allCookies
        }
      } else {
        // Parse response to check for error messages
        const responseHtml = await loginResponse.text()
        const load2 = await loadCheerio()
        const $response = load2(responseHtml)
        const errorMessage = $response('.alert-danger, .error, .alert-error').text().trim()
        
        return {
          success: false,
          error: errorMessage || 'Login failed - no session cookie received. Please check your credentials.'
        }
      }
    } else {
      return {
        success: false,
        error: `Login failed with status ${loginResponse.status}: ${loginResponse.statusText}`
      }
    }
  } catch (error) {
    console.error('NFHS authentication error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown authentication error'
    }
  }
}

/**
 * Search for schools in a specific location
 */
async function searchSchools(
  cookies: string[],
  city: string,
  state: string
): Promise<Array<{ id: string; name: string; city: string; state: string }>> {
  
  try {
    console.log(`Searching for schools in ${city}, ${state}...`)
    
    // NFHS Network uses a search page for finding schools
    const searchUrl = `https://www.nfhsnetwork.com/find-school`
    
    const response = await fetchWithCookies(searchUrl, cookies)
    
    if (!response.ok) {
      console.error(`Failed to fetch schools: ${response.status}`)
      return []
    }

    const html = await response.text()
    const load = await loadCheerio()
    const $ = load(html)
    
    const schools: Array<{ id: string; name: string; city: string; state: string }> = []
    
    // Parse school listings from the page
    // NFHS Network typically lists schools with links like /schools/{school-slug}
    $('a[href*="/schools/"]').each((_, element) => {
      const href = $(element).attr('href')
      const schoolName = $(element).text().trim()
      
      if (href && schoolName) {
        // Extract school ID from URL
        const schoolId = href.split('/schools/')[1]?.split('/')[0] || ''
        
        if (schoolId && !schools.find(s => s.id === schoolId)) {
          schools.push({
            id: schoolId,
            name: schoolName,
            city: city,
            state: state
          })
        }
      }
    })

    console.log(`Found ${schools.length} schools`)
    return schools.slice(0, 10) // Limit to 10 schools to avoid overwhelming the system
  } catch (error) {
    console.error('Error searching schools:', error)
    return []
  }
}

/**
 * Fetch games from the main events page
 * This scrapes the public events listing which shows upcoming games
 */
async function fetchGamesFromEventsPage(
  cookies: string[],
  location: string
): Promise<NFHSGameData[]> {
  
  try {
    console.log('Fetching games from events page...')
    
    const eventsUrl = 'https://www.nfhsnetwork.com/watch-events'
    const response = await fetchWithCookies(eventsUrl, cookies)
    
    if (!response.ok) {
      console.error(`Failed to fetch events page: ${response.status}`)
      return []
    }

    const html = await response.text()
    const load = await loadCheerio()
    const $ = load(html)
    
    const games: NFHSGameData[] = []
    
    // Parse event cards from the page
    // NFHS Network displays events in a card format with links
    $('a[href*="/events/"]').each((_, element) => {
      try {
        const $card = $(element)
        const href = $card.attr('href') || ''
        const eventId = href.split('/events/')[1]?.split('/')[1] || ''
        
        if (!eventId) return
        
        // Extract game information from the card
        const fullText = $card.text().trim()
        
        // Parse sport and level (e.g., "Varsity Boys Football")
        const sportMatch = fullText.match(/(Varsity|JV|Freshman|Junior Varsity)\s+(Boys|Girls|Coed)?\s*(\w+)/i)
        const level = sportMatch?.[1] || 'Varsity'
        const gender = sportMatch?.[2] || 'Boys'
        const sport = sportMatch?.[3] || 'Football'
        
        // Parse teams (e.g., "Team A vs. Team B")
        const teamsMatch = fullText.match(/([^vs]+)\s+vs\.?\s+([^0-9]+)/i)
        const homeTeam = teamsMatch?.[1]?.trim() || 'Home Team'
        const awayTeam = teamsMatch?.[2]?.trim() || 'Away Team'
        
        // Parse date and time
        const dateMatch = fullText.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)
        const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s+[AP]M\s+UTC)/i)
        const date = dateMatch?.[1] || new Date().toLocaleDateString()
        const time = timeMatch?.[1] || '12:00 PM UTC'
        
        // Parse location
        const locationMatch = fullText.match(/([^,]+),\s+([A-Z]{2})\s*$/i)
        const venue = locationMatch?.[1]?.trim() || 'TBA'
        const state = locationMatch?.[2]?.trim() || 'WI'
        
        // Determine if streaming
        const isStreaming = fullText.toLowerCase().includes('live') || 
                          fullText.toLowerCase().includes('upcoming')
        
        // Create school IDs from team names (simplified)
        const homeSchoolId = homeTeam.toLowerCase().replace(/\s+/g, '-')
        const awaySchoolId = awayTeam.toLowerCase().replace(/\s+/g, '-')
        
        games.push({
          eventId,
          homeSchool: {
            id: homeSchoolId,
            name: homeTeam,
            city: venue,
            state: state
          },
          awaySchool: {
            id: awaySchoolId,
            name: awayTeam,
            city: venue,
            state: state
          },
          homeTeam,
          awayTeam,
          sport,
          level,
          gender,
          date,
          time,
          venue,
          streamUrl: `https://www.nfhsnetwork.com${href}`,
          isStreaming
        })
      } catch (error) {
        console.error('Error parsing event card:', error)
      }
    })

    console.log(`Parsed ${games.length} games from events page`)
    return games
  } catch (error) {
    console.error('Error fetching games from events page:', error)
    return []
  }
}

/**
 * Fetch games for a specific school
 */
async function fetchSchoolGames(
  cookies: string[],
  schoolId: string,
  schoolName: string,
  city: string,
  state: string
): Promise<NFHSGameData[]> {
  
  try {
    console.log(`Fetching games for school: ${schoolName}`)
    
    // Rate limiting
    await delay(1500)
    
    const schoolUrl = `https://www.nfhsnetwork.com/schools/${schoolId}`
    const response = await fetchWithCookies(schoolUrl, cookies)
    
    if (!response.ok) {
      console.error(`Failed to fetch school page: ${response.status}`)
      return []
    }

    const html = await response.text()
    const load = await loadCheerio()
    const $ = load(html)
    
    const games: NFHSGameData[] = []
    
    // Parse upcoming events for this school
    $('a[href*="/events/"]').each((_, element) => {
      try {
        const $card = $(element)
        const href = $card.attr('href') || ''
        const eventId = href.split('/events/')[1]?.split('/')[1] || ''
        
        if (!eventId) return
        
        const fullText = $card.text().trim()
        
        // Parse game details similar to events page
        const sportMatch = fullText.match(/(Varsity|JV|Freshman)\s+(Boys|Girls)?\s*(\w+)/i)
        const level = sportMatch?.[1] || 'Varsity'
        const gender = sportMatch?.[2] || 'Boys'
        const sport = sportMatch?.[3] || 'Football'
        
        const teamsMatch = fullText.match(/([^vs]+)\s+vs\.?\s+([^0-9]+)/i)
        const homeTeam = teamsMatch?.[1]?.trim() || schoolName
        const awayTeam = teamsMatch?.[2]?.trim() || 'Opponent'
        
        const dateMatch = fullText.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/i)
        const timeMatch = fullText.match(/(\d{1,2}:\d{2}\s+[AP]M)/i)
        const date = dateMatch?.[1] || new Date().toLocaleDateString()
        const time = timeMatch?.[1] || '12:00 PM'
        
        const isStreaming = fullText.toLowerCase().includes('live') || 
                          fullText.toLowerCase().includes('upcoming')
        
        games.push({
          eventId,
          homeSchool: {
            id: schoolId,
            name: schoolName,
            city,
            state
          },
          awaySchool: {
            id: awayTeam.toLowerCase().replace(/\s+/g, '-'),
            name: awayTeam,
            city: 'Unknown',
            state: state
          },
          homeTeam,
          awayTeam,
          sport,
          level,
          gender,
          date,
          time,
          venue: city,
          streamUrl: `https://www.nfhsnetwork.com${href}`,
          isStreaming
        })
      } catch (error) {
        console.error('Error parsing school event:', error)
      }
    })

    console.log(`Found ${games.length} games for ${schoolName}`)
    return games
  } catch (error) {
    console.error(`Error fetching games for school ${schoolName}:`, error)
    return []
  }
}

/**
 * Main function to fetch all NFHS games for a location
 */
async function fetchNFHSGames(cookies: string[], location: string): Promise<NFHSGameData[]> {
  try {
    const [city, state] = location.split(',').map(s => s.trim())
    
    // Strategy 1: Get games from main events page (faster, broader coverage)
    const eventsPageGames = await fetchGamesFromEventsPage(cookies, location)
    
    // Rate limiting
    await delay(2000)
    
    // Strategy 2: Search for local schools and get their games (more targeted)
    const schools = await searchSchools(cookies, city, state)
    
    const schoolGames: NFHSGameData[] = []
    for (const school of schools.slice(0, 5)) { // Limit to 5 schools to avoid rate limiting
      const games = await fetchSchoolGames(
        cookies,
        school.id,
        school.name,
        school.city,
        school.state
      )
      schoolGames.push(...games)
    }
    
    // Combine and deduplicate games
    const allGames = [...eventsPageGames, ...schoolGames]
    const uniqueGames = allGames.filter((game, index, self) =>
      index === self.findIndex(g => g.eventId === game.eventId)
    )
    
    console.log(`Total unique games found: ${uniqueGames.length}`)
    return uniqueGames
  } catch (error) {
    console.error('Error fetching NFHS games:', error)
    throw error
  }
}

/**
 * Store games and schools in database
 */
async function storeNFHSData(games: NFHSGameData[]) {
  const results = {
    schoolsCreated: 0,
    schoolsUpdated: 0,
    gamesCreated: 0,
    gamesUpdated: 0,
    errors: [] as string[]
  }

  for (const game of games) {
    try {
      // Upsert home school
      const homeSchool = await prisma.nFHSSchool.upsert({
        where: { nfhsId: game.homeSchool.id },
        update: {
          name: game.homeSchool.name,
          city: game.homeSchool.city,
          state: game.homeSchool.state,
          updatedAt: new Date()
        },
        create: {
          nfhsId: game.homeSchool.id,
          name: game.homeSchool.name,
          city: game.homeSchool.city,
          state: game.homeSchool.state,
          isActive: true
        }
      })

      // Upsert away school
      const awaySchool = await prisma.nFHSSchool.upsert({
        where: { nfhsId: game.awaySchool.id },
        update: {
          name: game.awaySchool.name,
          city: game.awaySchool.city,
          state: game.awaySchool.state,
          updatedAt: new Date()
        },
        create: {
          nfhsId: game.awaySchool.id,
          name: game.awaySchool.name,
          city: game.awaySchool.city,
          state: game.awaySchool.state,
          isActive: true
        }
      })

      // Parse game date and time
      let gameDateTime: Date
      try {
        gameDateTime = new Date(`${game.date} ${game.time}`)
        if (isNaN(gameDateTime.getTime())) {
          gameDateTime = new Date()
        }
      } catch {
        gameDateTime = new Date()
      }

      // Upsert game
      const existingGame = await prisma.nFHSGame.findUnique({
        where: { nfhsEventId: game.eventId }
      })

      if (existingGame) {
        await prisma.nFHSGame.update({
          where: { nfhsEventId: game.eventId },
          data: {
            homeTeamName: game.homeTeam,
            awayTeamName: game.awayTeam,
            sport: game.sport,
            level: game.level,
            gender: game.gender,
            gameDate: gameDateTime,
            gameTime: game.time,
            venue: game.venue,
            isNFHSNetwork: game.isStreaming,
            streamUrl: game.streamUrl,
            lastSynced: new Date(),
            updatedAt: new Date()
          }
        })
        results.gamesUpdated++
      } else {
        await prisma.nFHSGame.create({
          data: {
            nfhsEventId: game.eventId,
            homeSchoolId: homeSchool.id,
            awaySchoolId: awaySchool.id,
            homeTeamName: game.homeTeam,
            awayTeamName: game.awayTeam,
            sport: game.sport,
            level: game.level,
            gender: game.gender,
            gameDate: gameDateTime,
            gameTime: game.time,
            venue: game.venue,
            status: 'scheduled',
            isNFHSNetwork: game.isStreaming,
            streamUrl: game.streamUrl,
            lastSynced: new Date()
          }
        })
        results.gamesCreated++
      }
    } catch (error) {
      const errorMsg = `Error processing game ${game.eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      results.errors.push(errorMsg)
    }
  }

  return results
}

/**
 * Main sync handler - POST method
 * Syncs data from NFHS Network to the database
 */
export async function POST(request: NextRequest) {
  try {
    const username = process.env.NFHS_USERNAME
    const password = process.env.NFHS_PASSWORD
    
    if (!username || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'NFHS credentials not configured',
          message: 'Please add NFHS_USERNAME and NFHS_PASSWORD to your .env file to enable live data syncing.'
        },
        { status: 400 }
      )
    }

    const location = process.env.NFHS_LOCATION || 'Green Bay, Wisconsin'

    console.log('=== NFHS Network Sync Started ===')
    console.log(`Location: ${location}`)
    console.log(`Timestamp: ${new Date().toISOString()}`)

    // Step 1: Authenticate
    console.log('\n--- Step 1: Authentication ---')
    const authResult = await authenticateNFHS()
    
    if (!authResult.success) {
      console.error('Authentication failed:', authResult.error)
      return NextResponse.json(
        { 
          success: false, 
          error: authResult.error,
          message: 'Failed to authenticate with NFHS Network. Please check your credentials.'
        },
        { status: 401 }
      )
    }

    console.log('✓ Authentication successful')

    // Step 2: Fetch games
    console.log('\n--- Step 2: Fetching Games ---')
    const games = await fetchNFHSGames(authResult.cookies!, location)
    
    if (games.length === 0) {
      console.log('No games found')
      return NextResponse.json({
        success: true,
        message: 'No games found for the specified location',
        data: {
          gamesFound: 0,
          schoolsCreated: 0,
          gamesCreated: 0
        }
      })
    }

    console.log(`✓ Found ${games.length} games`)

    // Step 3: Store in database
    console.log('\n--- Step 3: Storing Data ---')
    const results = await storeNFHSData(games)

    console.log('✓ Data stored successfully')
    console.log(`  - Schools created: ${results.schoolsCreated}`)
    console.log(`  - Schools updated: ${results.schoolsUpdated}`)
    console.log(`  - Games created: ${results.gamesCreated}`)
    console.log(`  - Games updated: ${results.gamesUpdated}`)
    if (results.errors.length > 0) {
      console.log(`  - Errors: ${results.errors.length}`)
    }

    console.log('\n=== NFHS Network Sync Completed ===\n')

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${games.length} games from NFHS Network`,
      data: {
        gamesFound: games.length,
        schoolsCreated: results.schoolsCreated,
        schoolsUpdated: results.schoolsUpdated,
        gamesCreated: results.gamesCreated,
        gamesUpdated: results.gamesUpdated,
        errors: results.errors
      }
    })
  } catch (error) {
    console.error('NFHS sync error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        message: 'Failed to sync NFHS Network data'
      },
      { status: 500 }
    )
  }
}

/**
 * GET method - Returns information about the sync endpoint
 */
export async function GET(request: NextRequest) {
  const username = process.env.NFHS_USERNAME
  const password = process.env.NFHS_PASSWORD
  const credentialsConfigured = !!(username && password)

  return NextResponse.json({
    message: 'NFHS Network Sync Endpoint',
    description: 'Use POST method to trigger NFHS Network data sync',
    endpoint: '/api/nfhs/sync',
    method: 'POST',
    credentialsConfigured,
    implementation: 'Web scraping with authentication',
    features: [
      'Form-based authentication with CSRF token handling',
      'Cookie-based session management',
      'Rate limiting to avoid being blocked',
      'Scrapes events page for broad game coverage',
      'Searches local schools for targeted game data',
      'Parses game details including teams, date, time, venue',
      'Stores data in NFHSGame and NFHSSchool models',
      'Handles errors gracefully with detailed logging'
    ],
    limitations: [
      'Depends on NFHS Network HTML structure (may break if site changes)',
      'Rate limited to avoid overwhelming the server',
      'Limited to 10 schools per sync to prevent timeouts',
      'Requires valid NFHS Network subscription credentials',
      'May not capture all games if they are not publicly listed'
    ],
    note: credentialsConfigured 
      ? 'NFHS credentials are configured. You can sync live data.' 
      : 'NFHS credentials not configured. Add NFHS_USERNAME and NFHS_PASSWORD to .env to enable live data syncing.'
  })
}
