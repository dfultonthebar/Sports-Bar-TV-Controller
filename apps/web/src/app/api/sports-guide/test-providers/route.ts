
import { NextRequest, NextResponse } from 'next/server'
import { espnAPI } from '@/lib/sports-apis/espn-api'
import { sportsDBAPI } from '@/lib/sports-apis/thesportsdb-api'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const testResults = {
      timestamp: new Date().toISOString(),
      testDate: today,
      providers: {} as any,
      summary: {
        totalProviders: 2,
        workingProviders: 0,
        failedProviders: 0,
        totalGamesFound: 0
      }
    }

    logger.info('🧪 Testing live sports API providers...')

    // Test ESPN API
    logger.info('🔄 Testing ESPN API...')
    try {
      const espnTestStart = Date.now()
      const nflGames = await espnAPI.getNFLGames(today)
      const nbaGames = await espnAPI.getNBAGames(today)
      const mlbGames = await espnAPI.getMLBGames(today)
      const espnTestEnd = Date.now()
      
      const espnTotalGames = nflGames.length + nbaGames.length + mlbGames.length
      
      testResults.providers.espn = {
        status: 'success',
        responseTime: espnTestEnd - espnTestStart,
        leagues: {
          nfl: { games: nflGames.length, status: 'ok' },
          nba: { games: nbaGames.length, status: 'ok' },
          mlb: { games: mlbGames.length, status: 'ok' }
        },
        totalGames: espnTotalGames,
        baseUrl: 'https://site.api.espn.com/apis/site/v2/sports',
        error: null
      }
      
      testResults.summary.workingProviders++
      testResults.summary.totalGamesFound += espnTotalGames
      
      logger.info(`✅ ESPN API: ${espnTotalGames} games found in ${espnTestEnd - espnTestStart}ms`)
      
    } catch (error) {
      logger.error('❌ ESPN API test failed:', error)
      testResults.providers.espn = {
        status: 'failed',
        responseTime: null,
        leagues: {},
        totalGames: 0,
        baseUrl: 'https://site.api.espn.com/apis/site/v2/sports',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      testResults.summary.failedProviders++
    }

    // Test TheSportsDB API
    logger.info('🔄 Testing TheSportsDB API...')
    try {
      const sportsDbTestStart = Date.now()
      const premierLeagueEvents = await sportsDBAPI.getPremierLeagueEvents(today)
      const championsLeagueEvents = await sportsDBAPI.getChampionsLeagueEvents(today)
      const laLigaEvents = await sportsDBAPI.getLaLigaEvents(today)
      const sportsDbTestEnd = Date.now()
      
      const sportsDbTotalEvents = premierLeagueEvents.length + championsLeagueEvents.length + laLigaEvents.length
      
      testResults.providers.thesportsdb = {
        status: 'success',
        responseTime: sportsDbTestEnd - sportsDbTestStart,
        leagues: {
          premier: { games: premierLeagueEvents.length, status: 'ok' },
          champions: { games: championsLeagueEvents.length, status: 'ok' },
          laliga: { games: laLigaEvents.length, status: 'ok' }
        },
        totalGames: sportsDbTotalEvents,
        baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
        error: null
      }
      
      testResults.summary.workingProviders++
      testResults.summary.totalGamesFound += sportsDbTotalEvents
      
      logger.info(`✅ TheSportsDB API: ${sportsDbTotalEvents} events found in ${sportsDbTestEnd - sportsDbTestStart}ms`)
      
    } catch (error) {
      logger.error('❌ TheSportsDB API test failed:', error)
      testResults.providers.thesportsdb = {
        status: 'failed',
        responseTime: null,
        leagues: {},
        totalGames: 0,
        baseUrl: 'https://www.thesportsdb.com/api/v1/json/3',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
      testResults.summary.failedProviders++
    }

    const overallStatus = testResults.summary.workingProviders > 0 ? 'operational' : 'degraded'
    
    logger.info(`🏁 API Test Complete: ${testResults.summary.workingProviders}/${testResults.summary.totalProviders} providers working`)
    
    return NextResponse.json({
      success: true,
      status: overallStatus,
      message: `API connectivity test completed. ${testResults.summary.workingProviders} of ${testResults.summary.totalProviders} providers operational.`,
      ...testResults
    })
    
  } catch (error) {
    logger.error('❌ Error testing sports API providers:', error)
    return NextResponse.json(
      { 
        success: false, 
        status: 'error',
        error: 'Failed to test API providers',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error
  try {
    const { leagues: leaguesRaw = ['nfl', 'nba', 'premier'], date } = bodyValidation.data
    const leagues = Array.isArray(leaguesRaw) ? leaguesRaw : ['nfl', 'nba', 'premier']

    const testDate = (date as string | undefined) || new Date().toISOString().split('T')[0]

    logger.info(`🧪 Testing specific leagues: ${leagues.join(', ')} for date: ${testDate}`)
    
    const results: any = {
      timestamp: new Date().toISOString(),
      testDate,
      requestedLeagues: leagues,
      results: {}
    }
    
    for (const league of leagues) {
      try {
        let games = 0
        let source = 'unknown'
        
        switch (league.toLowerCase()) {
          case 'nfl':
            const nflGames = await espnAPI.getNFLGames(testDate)
            games = nflGames.length
            source = 'ESPN API'
            break
          case 'nba':
            const nbaGames = await espnAPI.getNBAGames(testDate)
            games = nbaGames.length
            source = 'ESPN API'
            break
          case 'mlb':
            const mlbGames = await espnAPI.getMLBGames(testDate)
            games = mlbGames.length
            source = 'ESPN API'
            break
          case 'nhl':
            const nhlGames = await espnAPI.getNHLGames(testDate)
            games = nhlGames.length
            source = 'ESPN API'
            break
          case 'premier':
            const premierEvents = await sportsDBAPI.getPremierLeagueEvents(testDate)
            games = premierEvents.length
            source = 'TheSportsDB API'
            break
          case 'champions':
            const championsEvents = await sportsDBAPI.getChampionsLeagueEvents(testDate)
            games = championsEvents.length
            source = 'TheSportsDB API'
            break
          case 'la-liga':
            const laLigaEvents = await sportsDBAPI.getLaLigaEvents(testDate)
            games = laLigaEvents.length
            source = 'TheSportsDB API'
            break
          default:
            throw new Error(`Unsupported league: ${league}`)
        }
        
        results.results[league] = {
          status: 'success',
          games,
          source,
          error: null
        }
        
        logger.info(`✅ ${league.toUpperCase()}: ${games} games found via ${source}`)
        
      } catch (error) {
        results.results[league] = {
          status: 'failed',
          games: 0,
          source: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        
        logger.error(`❌ ${league.toUpperCase()}: Failed -`, error)
      }
    }
    
    const successCount = Object.values(results.results).filter((r: any) => r.status === 'success').length
    const totalGames = Object.values(results.results).reduce((sum: number, r: any) => sum + r.games, 0)
    
    return NextResponse.json({
      success: true,
      message: `Tested ${leagues.length} leagues, ${successCount} successful`,
      totalGames,
      ...results
    })
    
  } catch (error) {
    logger.error('❌ Error in targeted API test:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to test specified leagues',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
