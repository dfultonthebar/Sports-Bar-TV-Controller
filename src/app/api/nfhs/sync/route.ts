
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import * as cheerio from 'cheerio'

const prisma = new PrismaClient()

interface NFHSAuthResponse {
  success: boolean
  sessionToken?: string
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
 * Authenticate with NFHS Network
 */
async function authenticateNFHS(): Promise<NFHSAuthResponse> {
  const username = process.env.NFHS_USERNAME
  const password = process.env.NFHS_PASSWORD

  if (!username || !password) {
    return {
      success: false,
      error: 'NFHS credentials not configured in environment variables'
    }
  }

  try {
    // NFHS Network login endpoint
    const loginUrl = 'https://www.nfhsnetwork.com/login'
    
    // First, get the login page to extract CSRF token
    const pageResponse = await fetch(loginUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const pageHtml = await pageResponse.text()
    const $ = cheerio.load(pageHtml)
    
    // Extract CSRF token if present
    const csrfToken = $('input[name="_csrf"]').val() || 
                     $('meta[name="csrf-token"]').attr('content') || ''

    // Perform login
    const formData = new URLSearchParams({
      email: username,
      password: password,
      _csrf: csrfToken as string
    })

    const loginResponse = await fetch('https://www.nfhsnetwork.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': loginUrl
      },
      body: formData.toString(),
      redirect: 'manual'
    })

    // Extract session cookies
    const cookies = loginResponse.headers.getSetCookie()
    
    if (loginResponse.ok || loginResponse.status === 302) {
      return {
        success: true,
        cookies: cookies,
        sessionToken: cookies.find(c => c.includes('session'))?.split(';')[0] || ''
      }
    }

    return {
      success: false,
      error: `Login failed with status ${loginResponse.status}`
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
 * Fetch games from NFHS Network for a specific location
 */
async function fetchNFHSGames(sessionToken: string, location: string): Promise<NFHSGameData[]> {
  try {
    const [city, state] = location.split(',').map(s => s.trim())
    
    // Search for schools in the area
    const searchUrl = `https://www.nfhsnetwork.com/api/schools/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}`
    
    const schoolsResponse = await fetch(searchUrl, {
      headers: {
        'Cookie': sessionToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!schoolsResponse.ok) {
      throw new Error(`Failed to fetch schools: ${schoolsResponse.status}`)
    }

    const schools = await schoolsResponse.json()
    const games: NFHSGameData[] = []

    // For each school, fetch their upcoming games
    for (const school of schools.slice(0, 10)) { // Limit to first 10 schools
      const eventsUrl = `https://www.nfhsnetwork.com/api/schools/${school.id}/events?upcoming=true`
      
      const eventsResponse = await fetch(eventsUrl, {
        headers: {
          'Cookie': sessionToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (eventsResponse.ok) {
        const events = await eventsResponse.json()
        
        for (const event of events) {
          games.push({
            eventId: event.id,
            homeSchool: {
              id: event.homeSchool.id,
              name: event.homeSchool.name,
              city: event.homeSchool.city,
              state: event.homeSchool.state
            },
            awaySchool: {
              id: event.awaySchool.id,
              name: event.awaySchool.name,
              city: event.awaySchool.city,
              state: event.awaySchool.state
            },
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            sport: event.sport,
            level: event.level || 'Varsity',
            gender: event.gender || 'Boys',
            date: event.date,
            time: event.time,
            venue: event.venue,
            streamUrl: event.streamUrl,
            isStreaming: event.isStreaming || false
          })
        }
      }
    }

    return games
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
      const gameDateTime = new Date(`${game.date} ${game.time}`)

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
 * Main sync handler
 */
export async function POST(request: NextRequest) {
  try {
    const location = process.env.NFHS_LOCATION || 'Green Bay, Wisconsin'

    // Step 1: Authenticate
    console.log('Authenticating with NFHS Network...')
    const authResult = await authenticateNFHS()
    
    if (!authResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: authResult.error,
          message: 'Failed to authenticate with NFHS Network'
        },
        { status: 401 }
      )
    }

    // Step 2: Fetch games
    console.log(`Fetching games for ${location}...`)
    const games = await fetchNFHSGames(authResult.sessionToken!, location)
    
    if (games.length === 0) {
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

    // Step 3: Store in database
    console.log(`Storing ${games.length} games in database...`)
    const results = await storeNFHSData(games)

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

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST method to trigger NFHS Network data sync',
    endpoint: '/api/nfhs/sync',
    method: 'POST'
  })
}

