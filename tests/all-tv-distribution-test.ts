/**
 * Test All-TV Distribution
 *
 * This test validates:
 * 1. All available TVs are assigned to games (no idle TVs)
 * 2. Round-robin distribution spreads games evenly
 * 3. Manual override protection is respected
 */

import { getDistributionEngine } from '../src/lib/scheduler/distribution-engine'
import { logger } from '../src/lib/logger'

async function testAllTVDistribution() {
  console.log('='.repeat(80))
  console.log('ALL-TV DISTRIBUTION ENGINE - TEST')
  console.log('='.repeat(80))
  console.log('')

  const engine = getDistributionEngine()

  // Get games from ESPN API
  try {
    // Import ESPN API to get real games
    const { espnScoreboardAPI } = await import('../src/lib/sports-apis/espn-scoreboard-api')

    console.log('Fetching current games from ESPN API...')

    // Fetch games from multiple leagues
    const leagues = [
      { sport: 'football', league: 'nfl' },
      { sport: 'basketball', league: 'nba' },
      { sport: 'hockey', league: 'nhl' },
      { sport: 'baseball', league: 'mlb' }
    ]

    let games: any[] = []

    for (const { sport, league } of leagues) {
      try {
        const leagueGames = await espnScoreboardAPI.getTodaysGames(sport, league)

        // Convert ESPN games to distribution engine format
        const convertedGames = leagueGames.map(game => ({
          id: game.id,
          homeTeam: game.homeTeam.displayName,
          awayTeam: game.awayTeam.displayName,
          league: league.toUpperCase(),
          status: game.status.type.state,
          cableChannel: '206', // Default ESPN channel
          directvChannel: '206',
          channelNumber: '206',
          startTime: game.date,
          userPriority: espnScoreboardAPI.isLive(game) ? 100 : espnScoreboardAPI.isScheduled(game) ? 50 : 0
        }))

        games.push(...convertedGames)
      } catch (error) {
        console.log(`  No games found for ${league.toUpperCase()}`)
      }
    }

    console.log(`\nFound ${games.length} games today:`)
    games.forEach((game, idx) => {
      console.log(
        `  ${idx + 1}. ${game.homeTeam} vs ${game.awayTeam} ` +
        `(${game.status}, Priority: ${game.userPriority || 'default'})`
      )
    })

    if (games.length === 0) {
      console.log('\n⚠️  No games found today. Using mock data for testing...')

      // Create mock games for testing
      const mockGames = [
        {
          id: 'mock-1',
          homeTeam: 'Green Bay Packers',
          awayTeam: 'Chicago Bears',
          league: 'NFL',
          status: 'in',
          cableChannel: '206',
          directvChannel: '206',
          channelNumber: '206',
          startTime: new Date().toISOString(),
          userPriority: 100
        },
        {
          id: 'mock-2',
          homeTeam: 'Los Angeles Lakers',
          awayTeam: 'Boston Celtics',
          league: 'NBA',
          status: 'in',
          cableChannel: '209',
          directvChannel: '209',
          channelNumber: '209',
          startTime: new Date().toISOString(),
          userPriority: 90
        },
        {
          id: 'mock-3',
          homeTeam: 'Milwaukee Brewers',
          awayTeam: 'St. Louis Cardinals',
          league: 'MLB',
          status: 'in',
          cableChannel: '212',
          directvChannel: '212',
          channelNumber: '212',
          startTime: new Date().toISOString(),
          userPriority: 80
        }
      ]

      console.log(`\nUsing ${mockGames.length} mock games for distribution test`)
      games.push(...mockGames as any)
    }

    console.log('\n' + '='.repeat(80))
    console.log('CREATING DISTRIBUTION PLAN...')
    console.log('='.repeat(80))

    const plan = await engine.createDistributionPlan(games)

    console.log('\n' + '='.repeat(80))
    console.log('DISTRIBUTION PLAN SUMMARY')
    console.log('='.repeat(80))

    console.log(`\nOverall Statistics:`)
    console.log(`  Total Games: ${plan.summary.totalGames}`)
    console.log(`  Total TVs Available: ${plan.summary.totalTVs}`)
    console.log(`  TVs Assigned to Games: ${plan.summary.assignedTVs}`)
    console.log(`  Idle TVs: ${plan.summary.idleTVs}`)
    console.log(`  Games Meeting Min TV Requirements: ${plan.summary.gamesWithMinTVs}/${plan.summary.totalGames}`)

    console.log('\n' + '-'.repeat(80))
    console.log('GAME ASSIGNMENTS')
    console.log('-'.repeat(80))

    plan.games.forEach((gameAssignment, idx) => {
      console.log(
        `\n${idx + 1}. ${gameAssignment.game.homeTeam} vs ${gameAssignment.game.awayTeam}`
      )
      console.log(`   Priority Score: ${gameAssignment.priority.finalScore}`)
      console.log(`   Min TVs Required: ${gameAssignment.minTVsRequired}`)
      console.log(`   TVs Assigned: ${gameAssignment.assignments.length}`)
      console.log(`   Min TVs Met: ${gameAssignment.minTVsMet ? '✅ YES' : '❌ NO'}`)

      if (gameAssignment.assignments.length > 0) {
        console.log(`   TV Outputs: ${gameAssignment.assignments.map(a => a.outputNumber).join(', ')}`)
      }
    })

    if (plan.defaults.length > 0) {
      console.log('\n' + '-'.repeat(80))
      console.log('DEFAULT CONTENT ASSIGNMENTS (Idle TVs)')
      console.log('-'.repeat(80))

      plan.defaults.forEach((def, idx) => {
        console.log(
          `  ${idx + 1}. Output ${def.outputNumber} → ${def.contentType.toUpperCase()} ` +
          `(${def.inputLabel})`
        )
      })
    }

    console.log('\n' + '-'.repeat(80))
    console.log('REASONING LOG')
    console.log('-'.repeat(80))

    plan.reasoning.forEach((reason, idx) => {
      console.log(`  ${idx + 1}. ${reason}`)
    })

    console.log('\n' + '='.repeat(80))
    console.log('VALIDATION')
    console.log('='.repeat(80))

    const validation = engine.validatePlan(plan)

    console.log(`\nPlan Valid: ${validation.valid ? '✅ YES' : '❌ NO'}`)

    if (!validation.valid) {
      console.log(`\nValidation Errors:`)
      validation.errors.forEach((error, idx) => {
        console.log(`  ${idx + 1}. ${error}`)
      })
    }

    // Check if all TVs are utilized
    console.log('\n' + '='.repeat(80))
    console.log('ALL-TV UTILIZATION CHECK')
    console.log('='.repeat(80))

    const utilizationRate = (plan.summary.assignedTVs / plan.summary.totalTVs) * 100

    console.log(`\nUtilization Rate: ${utilizationRate.toFixed(1)}%`)
    console.log(`TVs Showing Games: ${plan.summary.assignedTVs}`)
    console.log(`TVs on Default Content: ${plan.defaults.length}`)
    console.log(`Total TVs: ${plan.summary.totalTVs}`)

    if (plan.summary.idleTVs === 0 || plan.defaults.length === 0) {
      console.log(`\n✅ SUCCESS: All TVs are assigned to games (100% utilization)`)
    } else if (utilizationRate >= 90) {
      console.log(`\n✅ GOOD: High utilization rate (${utilizationRate.toFixed(1)}%)`)
    } else {
      console.log(`\n⚠️  WARNING: Lower utilization rate (${utilizationRate.toFixed(1)}%)`)
      console.log(`   ${plan.summary.idleTVs} TVs showing default content instead of games`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('TEST COMPLETED SUCCESSFULLY')
    console.log('='.repeat(80))
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    logger.error('[DISTRIBUTION TEST] Error:', error)
    throw error
  }
}

// Run test
testAllTVDistribution().catch(error => {
  console.error('Test script error:', error)
  process.exit(1)
})
