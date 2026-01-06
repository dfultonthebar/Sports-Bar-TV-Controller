/**
 * Test Smart Override Duration Calculator
 *
 * This test validates:
 * 1. Game detection from ESPN API
 * 2. Smart duration calculation based on game clock
 * 3. Fallback to default duration when no game found
 */

import { calculateSmartOverrideDuration } from '../src/lib/scheduler/smart-override'

async function testSmartOverride() {
  console.log('='.repeat(80))
  console.log('SMART OVERRIDE DURATION CALCULATOR - TEST')
  console.log('='.repeat(80))
  console.log('')

  // Test cases with different channel numbers
  const testChannels = [
    { channel: '206', description: 'ESPN (NFL games)' },
    { channel: '209', description: 'ESPN2 (NBA games)' },
    { channel: '212', description: 'FS1 (MLB/NHL games)' },
    { channel: '100', description: 'Non-sports channel (should use default)' }
  ]

  for (const test of testChannels) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Testing Channel ${test.channel}: ${test.description}`)
    console.log('='.repeat(80))

    try {
      const result = await calculateSmartOverrideDuration(test.channel)

      console.log(`\nResult:`)
      console.log(`  Game Detected: ${result.gameDetected ? 'YES' : 'NO'}`)
      console.log(`  Duration: ${result.durationMinutes} minutes (${(result.durationMinutes / 60).toFixed(1)} hours)`)
      console.log(`  Reason: ${result.reason}`)

      if (result.gameDetected && result.gameInfo) {
        console.log(`\nGame Details:`)
        console.log(`  League: ${result.gameInfo.league}`)
        console.log(`  Matchup: ${result.gameInfo.homeTeam} vs ${result.gameInfo.awayTeam}`)
        console.log(`  Status: ${result.gameInfo.status}`)
        console.log(`  Period: ${result.gameInfo.period}`)
        console.log(`  Clock: ${result.gameInfo.clock}`)
        console.log(`  Estimated End: ${new Date(result.gameInfo.estimatedEndTime).toLocaleString()}`)
        console.log(`  Override Until: ${new Date(Date.now() + result.durationMs).toLocaleString()}`)
      }

      console.log(`\n✅ Test passed for channel ${test.channel}`)
    } catch (error) {
      console.error(`\n❌ Test failed for channel ${test.channel}:`, error)
    }
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('TESTS COMPLETED')
  console.log('='.repeat(80))
}

// Run tests
testSmartOverride().catch(error => {
  console.error('Test script error:', error)
  process.exit(1)
})
