/**
 * DirecTV Channel Finder Script
 *
 * Scans DirecTV channels to discover:
 * 1. Channels from sports guide that we subscribe to but don't have presets for
 * 2. Channels showing sports content based on program titles
 * 3. Subscription status by checking if channels actually tune
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
  channelNumber: string
  name: string
}

interface ChannelInfo {
  major: number
  minor?: number
  channelDisplay: string
  callsign: string | null
  title: string | null
  isSubscribed: boolean
  hasPreset: boolean
  presetName: string | null
  isSportsChannel: boolean
  sportsKeywords: string[]
}

// Sports-related keywords to identify sports channels
const SPORTS_KEYWORDS = [
  'nfl', 'nba', 'mlb', 'nhl', 'ncaa', 'college', 'football', 'basketball',
  'baseball', 'hockey', 'soccer', 'golf', 'tennis', 'racing', 'motorsports',
  'sportscenter', 'sports', 'espn', 'fox sports', 'fs1', 'fs2', 'cbs sports',
  'big ten', 'sec', 'acc', 'pac-12', 'ufc', 'boxing', 'wrestling',
  'premier league', 'champions league', 'la liga', 'bundesliga',
  'game', 'match', 'vs', 'championship', 'playoff', 'final', 'live',
  'redzone', 'sunday ticket', 'mlb network', 'nfl network', 'nhl network',
  'nba tv', 'tennis channel', 'golf channel', 'olympic'
]

async function getDirectTVDevices(): Promise<DirecTVDevice[]> {
  const response = await fetch('http://localhost:3001/api/directv-devices')
  const data = await response.json()
  return data.devices || []
}

async function getDirectvPresets(): Promise<Map<string, string>> {
  const presets = await db.select()
    .from(schema.channelPresets)
    .where(eq(schema.channelPresets.deviceType, 'directv'))

  const presetMap = new Map<string, string>()
  for (const preset of presets.filter(p => p.isActive)) {
    presetMap.set(preset.channelNumber.toLowerCase(), preset.name)
  }
  return presetMap
}

async function getProgInfo(deviceIp: string, major: number, minor?: number): Promise<{
  success: boolean
  title: string | null
  callsign: string | null
  isOffAir: boolean
}> {
  try {
    const url = minor !== undefined
      ? `http://${deviceIp}:8080/tv/getProgInfo?major=${major}&minor=${minor}`
      : `http://${deviceIp}:8080/tv/getProgInfo?major=${major}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status?.code === 200) {
      return {
        success: true,
        title: data.title,
        callsign: data.callsign,
        isOffAir: data.isOffAir || false
      }
    }
    return { success: false, title: null, callsign: null, isOffAir: true }
  } catch (error) {
    return { success: false, title: null, callsign: null, isOffAir: true }
  }
}

async function canTuneChannel(deviceIp: string, major: number, minor?: number): Promise<boolean> {
  try {
    const url = minor !== undefined
      ? `http://${deviceIp}:8080/tv/tune?major=${major}&minor=${minor}`
      : `http://${deviceIp}:8080/tv/tune?major=${major}`

    const response = await fetch(url)
    const data = await response.json()

    // Check if tune was successful
    if (data.status?.code !== 200) {
      return false
    }

    // Wait longer for the channel to actually change
    await new Promise(resolve => setTimeout(resolve, 2000))

    const tunedResponse = await fetch(`http://${deviceIp}:8080/tv/getTuned`)
    const tunedData = await tunedResponse.json()

    if (tunedData.status?.code !== 200) {
      return false
    }

    // Check if we actually tuned to the channel
    const majorMatches = tunedData.major === major
    // Handle the case where minor is 65535 (no minor channel)
    const actualMinor = tunedData.minor === 65535 ? undefined : tunedData.minor
    const minorMatches = minor === undefined || actualMinor === minor
    const hasContent = !tunedData.isOffAir && tunedData.title

    return majorMatches && minorMatches && hasContent
  } catch (error) {
    return false
  }
}

function isSportsContent(title: string | null, callsign: string | null): { isSports: boolean; keywords: string[] } {
  if (!title && !callsign) return { isSports: false, keywords: [] }

  const combined = `${title || ''} ${callsign || ''}`.toLowerCase()
  const matchedKeywords: string[] = []

  for (const keyword of SPORTS_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      matchedKeywords.push(keyword)
    }
  }

  return {
    isSports: matchedKeywords.length > 0,
    keywords: matchedKeywords
  }
}

async function getSportsGuideChannels(): Promise<Set<string>> {
  try {
    const response = await fetch('http://localhost:3001/api/sports-guide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeRange: 'today' })
    })
    const data = await response.json()

    const channels = new Set<string>()

    if (data.success && data.data?.listing_groups) {
      for (const group of data.data.listing_groups) {
        for (const listing of group.listings || []) {
          const satChannels = listing.channel_numbers?.SAT || {}
          for (const stationChannels of Object.values(satChannels)) {
            for (const ch of (stationChannels as any[])) {
              if (ch) {
                // Handle "470.1" format and convert to "470-1"
                const normalized = String(ch).replace('.', '-')
                channels.add(normalized)
              }
            }
          }
        }
      }
    }

    return channels
  } catch (error) {
    console.error('Failed to fetch sports guide:', error)
    return new Set()
  }
}

async function scanChannelRange(
  deviceIp: string,
  startChannel: number,
  endChannel: number,
  presets: Map<string, string>,
  options: { checkSubscription?: boolean; onlyUnpreset?: boolean } = {}
): Promise<ChannelInfo[]> {
  const results: ChannelInfo[] = []

  for (let major = startChannel; major <= endChannel; major++) {
    const channelDisplay = String(major)
    process.stdout.write(`\rScanning channel ${major}...`)

    const progInfo = await getProgInfo(deviceIp, major)

    if (!progInfo.success || progInfo.isOffAir) continue

    const hasPreset = presets.has(channelDisplay)
    const presetName = presets.get(channelDisplay) || null

    if (options.onlyUnpreset && hasPreset) continue

    // Channels with presets are assumed to be subscribed (we already verified them)
    // Only check subscription for channels without presets
    let isSubscribed = true
    if (options.checkSubscription && !hasPreset) {
      isSubscribed = await canTuneChannel(deviceIp, major)
      // Extra delay after tune check
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const { isSports, keywords } = isSportsContent(progInfo.title, progInfo.callsign)

    results.push({
      major,
      channelDisplay,
      callsign: progInfo.callsign,
      title: progInfo.title,
      isSubscribed,
      hasPreset,
      presetName,
      isSportsChannel: isSports,
      sportsKeywords: keywords
    })

    // Small delay to not overwhelm the device
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  process.stdout.write('\r' + ' '.repeat(30) + '\r')
  return results
}

async function scanSportsGuideChannels(
  deviceIp: string,
  presets: Map<string, string>,
  options: { checkSubscription?: boolean } = {}
): Promise<ChannelInfo[]> {
  console.log('Fetching sports guide channel list...')
  const sportsGuideChannels = await getSportsGuideChannels()
  console.log(`Found ${sportsGuideChannels.size} unique channels in sports guide`)

  const results: ChannelInfo[] = []
  const processed = new Set<string>()

  for (const channelStr of sportsGuideChannels) {
    if (processed.has(channelStr)) continue
    processed.add(channelStr)

    process.stdout.write(`\rChecking channel ${channelStr}...`)

    let major: number
    let minor: number | undefined

    if (channelStr.includes('-')) {
      const parts = channelStr.split('-')
      major = parseInt(parts[0], 10)
      minor = parseInt(parts[1], 10)
    } else {
      major = parseInt(channelStr, 10)
    }

    if (isNaN(major)) continue

    const channelDisplay = minor !== undefined ? `${major}-${minor}` : String(major)
    const progInfo = await getProgInfo(deviceIp, major, minor)

    if (!progInfo.success) continue

    const hasPreset = presets.has(channelDisplay.toLowerCase())
    const presetName = presets.get(channelDisplay.toLowerCase()) || null

    let isSubscribed = true
    if (options.checkSubscription && !hasPreset) {
      isSubscribed = await canTuneChannel(deviceIp, major, minor)
      // Small delay after tune attempt
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    const { isSports, keywords } = isSportsContent(progInfo.title, progInfo.callsign)

    results.push({
      major,
      minor,
      channelDisplay,
      callsign: progInfo.callsign,
      title: progInfo.title,
      isSubscribed,
      hasPreset,
      presetName,
      isSportsChannel: isSports,
      sportsKeywords: keywords
    })

    await new Promise(resolve => setTimeout(resolve, 50))
  }

  process.stdout.write('\r' + ' '.repeat(40) + '\r')
  return results
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] || 'sports-guide'

  console.log('='.repeat(80))
  console.log('DirecTV Channel Finder')
  console.log('='.repeat(80))
  console.log('')

  // Get a DirecTV device to test with
  const devices = await getDirectTVDevices()
  if (devices.length === 0) {
    console.error('No DirecTV devices found!')
    process.exit(1)
  }

  const testDevice = devices[0]
  console.log(`Using device: ${testDevice.name} (${testDevice.ipAddress})`)

  // Get existing presets
  const presets = await getDirectvPresets()
  console.log(`Found ${presets.size} existing DirecTV presets`)
  console.log('')

  let results: ChannelInfo[]

  if (mode === 'sports-guide') {
    console.log('Mode: Scanning channels from sports guide')
    console.log('')
    results = await scanSportsGuideChannels(testDevice.ipAddress, presets, { checkSubscription: true })
  } else if (mode === 'range') {
    const start = parseInt(args[1] || '1', 10)
    const end = parseInt(args[2] || '999', 10)
    console.log(`Mode: Scanning channel range ${start}-${end}`)
    console.log('')
    results = await scanChannelRange(testDevice.ipAddress, start, end, presets, {
      checkSubscription: true,
      onlyUnpreset: true
    })
  } else if (mode === 'sports-scan') {
    // Scan common sports channel ranges
    console.log('Mode: Scanning common sports channel ranges')
    console.log('')
    results = []

    const sportsRanges = [
      [205, 230],   // ESPN family, NFL Network, etc.
      [240, 250],   // USA, TNT, TBS
      [600, 620],   // Regional sports
      [9500, 9600], // Premium sports packages
    ]

    for (const [start, end] of sportsRanges) {
      console.log(`\nScanning range ${start}-${end}...`)
      const rangeResults = await scanChannelRange(testDevice.ipAddress, start, end, presets, {
        checkSubscription: true
      })
      results.push(...rangeResults)
    }
  } else {
    console.log('Usage: npx tsx scripts/directv-channel-finder.ts [mode] [args]')
    console.log('')
    console.log('Modes:')
    console.log('  sports-guide     - Scan channels listed in the sports guide (default)')
    console.log('  range START END  - Scan a specific channel range')
    console.log('  sports-scan      - Scan common sports channel ranges')
    process.exit(0)
  }

  // Filter and report
  const unpresetSports = results.filter(r => !r.hasPreset && r.isSubscribed && r.isSportsChannel)
  const unpresetAll = results.filter(r => !r.hasPreset && r.isSubscribed)
  const notSubscribed = results.filter(r => !r.isSubscribed)

  console.log('')
  console.log('='.repeat(80))
  console.log('RESULTS')
  console.log('='.repeat(80))
  console.log('')

  if (unpresetSports.length > 0) {
    console.log(`SPORTS CHANNELS WITHOUT PRESETS (${unpresetSports.length}):`)
    console.log('-'.repeat(60))
    for (const ch of unpresetSports.sort((a, b) => a.major - b.major)) {
      console.log(`  Ch ${ch.channelDisplay.padEnd(8)} ${(ch.callsign || '').padEnd(12)} "${ch.title}"`)
      console.log(`           Keywords: ${ch.sportsKeywords.join(', ')}`)
    }
    console.log('')
  }

  if (unpresetAll.length > unpresetSports.length) {
    const otherChannels = unpresetAll.filter(r => !r.isSportsChannel)
    if (otherChannels.length > 0) {
      console.log(`OTHER SUBSCRIBED CHANNELS WITHOUT PRESETS (${otherChannels.length}):`)
      console.log('-'.repeat(60))
      for (const ch of otherChannels.sort((a, b) => a.major - b.major).slice(0, 20)) {
        console.log(`  Ch ${ch.channelDisplay.padEnd(8)} ${(ch.callsign || '').padEnd(12)} "${ch.title}"`)
      }
      if (otherChannels.length > 20) {
        console.log(`  ... and ${otherChannels.length - 20} more`)
      }
      console.log('')
    }
  }

  if (notSubscribed.length > 0) {
    console.log(`CHANNELS NOT SUBSCRIBED (${notSubscribed.length}):`)
    console.log('-'.repeat(60))
    for (const ch of notSubscribed.slice(0, 10)) {
      console.log(`  Ch ${ch.channelDisplay.padEnd(8)} ${(ch.callsign || '').padEnd(12)} "${ch.title}"`)
    }
    if (notSubscribed.length > 10) {
      console.log(`  ... and ${notSubscribed.length - 10} more`)
    }
    console.log('')
  }

  // Summary
  console.log('SUMMARY:')
  console.log('-'.repeat(40))
  console.log(`  Total channels scanned: ${results.length}`)
  console.log(`  Channels with presets: ${results.filter(r => r.hasPreset).length}`)
  console.log(`  Subscribed without presets: ${unpresetAll.length}`)
  console.log(`  Sports channels without presets: ${unpresetSports.length}`)
  console.log(`  Not subscribed: ${notSubscribed.length}`)

  // Write results to JSON
  const reportPath = '/tmp/directv-channel-finder.json'
  const fs = await import('fs/promises')
  await fs.writeFile(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    device: testDevice.name,
    mode,
    totalScanned: results.length,
    unpresetSports: unpresetSports.map(r => ({
      channel: r.channelDisplay,
      callsign: r.callsign,
      title: r.title,
      keywords: r.sportsKeywords
    })),
    unpresetOther: unpresetAll.filter(r => !r.isSportsChannel).map(r => ({
      channel: r.channelDisplay,
      callsign: r.callsign,
      title: r.title
    })),
    notSubscribed: notSubscribed.map(r => ({
      channel: r.channelDisplay,
      callsign: r.callsign
    }))
  }, null, 2))

  console.log('')
  console.log(`Detailed results written to: ${reportPath}`)
}

main().catch(console.error)
