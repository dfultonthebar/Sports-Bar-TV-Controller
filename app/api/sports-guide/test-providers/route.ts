
import { NextRequest, NextResponse } from 'next/server'
import { espnAPI } from '../../../../lib/sports-apis/espn-api'
import { sportsDBAPI } from '../../../../lib/sports-apis/thesportsdb-api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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

    console.log('🧪 Testing live sports API providers...')

    // Test ESPN API
    console.log('🔄 Testing ESPN API...')
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
      
      console.log(`✅ ESPN API: ${espnTotalGames} games found in ${espnTestEnd - espnTestStart}ms`)
      
    } catch (error) {
      console.error('❌ ESPN API test failed:', error)
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
    console.log('🔄 Testing TheSportsDB API...')
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
      
      console.log(`✅ TheSportsDB API: ${sportsDbTotalEvents} events found in ${sportsDbTestEnd - sportsDbTestStart}ms`)
      
    } catch (error) {
      console.error('❌ TheSportsDB API test failed:', error)
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
    
    console.log(`🏁 API Test Complete: ${testResults.summary.workingProviders}/${testResults.summary.totalProviders} providers working`)
    
    return NextResponse.json({
      success: true,
      status: overallStatus,
      message: `API connectivity test completed. ${testResults.summary.workingProviders} of ${testResults.summary.totalProviders} providers operational.`,
      ...testResults
    })
    
  } catch (error) {
    console.error('❌ Error testing sports API providers:', error)
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
  try {
    const body = await request.json()
    const { leagues = ['nfl', 'nba', 'premier'], date } = body
    
    const testDate = date || new Date().toISOString().split('T')[0]
    
    console.log(`🧪 Testing specific leagues: ${leagues.join(', ')} for date: ${testDate}`)
    
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
        
        console.log(`✅ ${league.toUpperCase()}: ${games} games found via ${source}`)
        
      } catch (error) {
        results.results[league] = {
          status: 'failed',
          games: 0,
          source: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        
        console.error(`❌ ${league.toUpperCase()}: Failed -`, error)
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
    console.error('❌ Error in targeted API test:', error)
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
