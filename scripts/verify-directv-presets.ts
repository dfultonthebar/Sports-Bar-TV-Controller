/**
 * DirecTV Preset Verification Script
 *
 * Tests each DirecTV preset by:
 * 1. Tuning to the channel
 * 2. Polling the device to verify it changed
 * 3. Checking if content is available (not just tuned but showing content)
 */

import { db } from '../src/db'
import { schema } from '../src/db'
import { eq } from 'drizzle-orm'

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
}

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: string
}

interface TuneResult {
  preset: ChannelPreset
  success: boolean
  actualChannel: string | null
  expectedChannel: string
  hasContent: boolean
  title: string | null
  callsign: string | null
  error: string | null
  responseTime: number
}

// Parse channel string to get major and optional minor
function parseChannel(channelStr: string): { major: number; minor?: number } {
  if (channelStr.includes('-')) {
    const parts = channelStr.split('-')
    return { major: parseInt(parts[0], 10), minor: parseInt(parts[1], 10) }
  }
  return { major: parseInt(channelStr, 10) }
}

async function getDirectTVDevices(): Promise<DirecTVDevice[]> {
  const response = await fetch('http://localhost:3001/api/directv-devices')
  const data = await response.json()
  return data.devices || []
}

async function getDirectvPresets(): Promise<ChannelPreset[]> {
  const presets = await db.select()
    .from(schema.channelPresets)
    .where(eq(schema.channelPresets.deviceType, 'directv'))

  return presets.filter(p => p.isActive).sort((a, b) => {
    const aNum = parseInt(a.channelNumber)
    const bNum = parseInt(b.channelNumber)
    return aNum - bNum
  })
}

async function tuneChannel(deviceIp: string, channelStr: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { major, minor } = parseChannel(channelStr)
    const url = minor !== undefined
      ? `http://${deviceIp}:8080/tv/tune?major=${major}&minor=${minor}`
      : `http://${deviceIp}:8080/tv/tune?major=${major}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status?.code === 200) {
      return { success: true }
    } else if (data.status?.code === 501) {
      return { success: false, error: 'Channel does not exist' }
    } else {
      return { success: false, error: data.status?.msg || 'Unknown error' }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

async function getTunedChannel(deviceIp: string): Promise<{
  major: number | null
  minor: number | null
  channelDisplay: string | null
  title: string | null
  callsign: string | null
  isOffAir: boolean
  error?: string
}> {
  try {
    const response = await fetch(`http://${deviceIp}:8080/tv/getTuned`)
    const data = await response.json()

    if (data.status?.code === 200) {
      const channelDisplay = data.minor && data.minor !== 65535
        ? `${data.major}-${data.minor}`
        : String(data.major)
      return {
        major: data.major,
        minor: data.minor && data.minor !== 65535 ? data.minor : null,
        channelDisplay,
        title: data.title,
        callsign: data.callsign,
        isOffAir: data.isOffAir || false
      }
    }
    return { major: null, minor: null, channelDisplay: null, title: null, callsign: null, isOffAir: false, error: data.status?.msg }
  } catch (error: any) {
    return { major: null, minor: null, channelDisplay: null, title: null, callsign: null, isOffAir: false, error: error.message }
  }
}

async function verifyPreset(deviceIp: string, preset: ChannelPreset): Promise<TuneResult> {
  const expectedChannel = preset.channelNumber
  const { major: expectedMajor, minor: expectedMinor } = parseChannel(expectedChannel)
  const startTime = Date.now()

  // Step 1: Tune to the channel
  const tuneResult = await tuneChannel(deviceIp, expectedChannel)

  if (!tuneResult.success) {
    return {
      preset,
      success: false,
      actualChannel: null,
      expectedChannel,
      hasContent: false,
      title: null,
      callsign: null,
      error: tuneResult.error || 'Tune failed',
      responseTime: Date.now() - startTime
    }
  }

  // Step 2: Wait for channel to change
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Step 3: Verify the channel actually changed
  const tuned = await getTunedChannel(deviceIp)

  const responseTime = Date.now() - startTime

  // Check if both major and minor match (if minor was expected)
  const majorMatches = tuned.major === expectedMajor
  const minorMatches = expectedMinor === undefined || tuned.minor === expectedMinor
  const channelMatches = majorMatches && minorMatches

  const hasContent = !!tuned.title && tuned.title !== 'To Be Announced' && !tuned.isOffAir

  return {
    preset,
    success: channelMatches,
    actualChannel: tuned.channelDisplay,
    expectedChannel,
    hasContent,
    title: tuned.title,
    callsign: tuned.callsign,
    error: channelMatches ? null : `Channel didn't change. Expected ${expectedChannel}, got ${tuned.channelDisplay}`,
    responseTime
  }
}

async function main() {
  console.log('='.repeat(80))
  console.log('DirecTV Preset Verification Test')
  console.log('='.repeat(80))
  console.log('')

  // Get a DirecTV device to test with
  const devices = await getDirectTVDevices()
  if (devices.length === 0) {
    console.error('No DirecTV devices found!')
    process.exit(1)
  }

  const testDevice = devices[0]
  console.log(`Testing with device: ${testDevice.name} (${testDevice.ipAddress})`)
  console.log('')

  // Get all DirecTV presets
  const presets = await getDirectvPresets()
  console.log(`Found ${presets.length} DirecTV presets to test`)
  console.log('')

  const results: TuneResult[] = []
  const failures: TuneResult[] = []
  const noContent: TuneResult[] = []

  // Test each preset
  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i]
    process.stdout.write(`[${i + 1}/${presets.length}] Testing ${preset.name} (Ch ${preset.channelNumber})... `)

    const result = await verifyPreset(testDevice.ipAddress, preset)
    results.push(result)

    if (!result.success) {
      failures.push(result)
      console.log(`❌ FAILED - ${result.error}`)
    } else if (!result.hasContent) {
      noContent.push(result)
      console.log(`⚠️  OK but no content - ${result.title || 'No title'}`)
    } else {
      console.log(`✅ OK - "${result.title}" (${result.callsign})`)
    }

    // Small delay between tests to not overwhelm the device
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  // Summary Report
  console.log('')
  console.log('='.repeat(80))
  console.log('SUMMARY REPORT')
  console.log('='.repeat(80))
  console.log('')
  console.log(`Total Presets Tested: ${results.length}`)
  console.log(`✅ Successful (with content): ${results.length - failures.length - noContent.length}`)
  console.log(`⚠️  Successful (no content): ${noContent.length}`)
  console.log(`❌ Failed: ${failures.length}`)
  console.log('')

  if (failures.length > 0) {
    console.log('FAILED PRESETS:')
    console.log('-'.repeat(40))
    for (const f of failures) {
      console.log(`  - ${f.preset.name} (Ch ${f.expectedChannel}): ${f.error}`)
    }
    console.log('')
  }

  if (noContent.length > 0) {
    console.log('PRESETS WITH NO CURRENT CONTENT:')
    console.log('-'.repeat(40))
    for (const n of noContent) {
      console.log(`  - ${n.preset.name} (Ch ${n.expectedChannel}): ${n.title || 'No title'}`)
    }
    console.log('')
  }

  // Write detailed results to JSON
  const reportPath = '/tmp/directv-preset-verification.json'
  const fs = await import('fs/promises')
  await fs.writeFile(reportPath, JSON.stringify({
    testDevice: testDevice.name,
    deviceIp: testDevice.ipAddress,
    timestamp: new Date().toISOString(),
    totalPresets: results.length,
    successful: results.length - failures.length,
    withContent: results.length - failures.length - noContent.length,
    noContent: noContent.length,
    failed: failures.length,
    results: results.map(r => ({
      name: r.preset.name,
      expectedChannel: r.expectedChannel,
      actualChannel: r.actualChannel,
      success: r.success,
      hasContent: r.hasContent,
      title: r.title,
      callsign: r.callsign,
      error: r.error,
      responseTime: r.responseTime
    }))
  }, null, 2))

  console.log(`Detailed results written to: ${reportPath}`)

  // Return exit code based on failures
  process.exit(failures.length > 0 ? 1 : 0)
}

main().catch(console.error)
