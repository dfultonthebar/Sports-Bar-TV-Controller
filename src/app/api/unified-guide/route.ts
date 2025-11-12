

import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

const UNIFIED_GUIDE_FILE = join(process.cwd(), 'data', 'unified-guide.json')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true })
  }
}

// Load cached unified guide data
async function loadUnifiedGuideCache() {
  try {
    await ensureDataDir()
    const data = await readFile(UNIFIED_GUIDE_FILE, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return { 
      lastUpdated: null, 
      devices: {},
      programs: [] as any[],
      summary: {}
    }
  }
}

// Save unified guide data to cache
async function saveUnifiedGuideCache(data: any) {
  await ensureDataDir()
  await writeFile(UNIFIED_GUIDE_FILE, JSON.stringify(data, null, 2))
}

// Unified Guide Data Collection API
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { deviceList, timeRange, includeCache } = bodyValidation.data

    if (!deviceList || !Array.isArray(deviceList) || deviceList.length === 0) {
      return NextResponse.json({ error: 'Device list is required' }, { status: 400 })
    }

    logger.info(`📺 Fetching unified guide data from ${deviceList.length} devices`)

    const startTime = timeRange?.start || new Date().toISOString()
    const endTime = timeRange?.end || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const unifiedData = {
      lastUpdated: new Date().toISOString(),
      timeRange: { start: startTime, end: endTime },
      devices: {},
      programs: [] as any[],
      summary: {
        totalDevices: deviceList.length,
        totalPrograms: 0,
        directvDevices: 0,
        firetvDevices: 0,
        successfulFetches: 0,
        failedFetches: 0,
        programsByCategory: {},
        programsBySource: {}
      }
    }

    // Fetch guide data from each device
    for (const device of deviceList) {
      logger.info(`🔍 Fetching guide data for ${device.type} device: ${device.name}`)
      
      try {
        let deviceGuideData: any = null

        if (device.type === 'directv') {
          unifiedData.summary.directvDevices++
          
          const directvResponse = await fetch('/api/directv-devices/guide-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: device.id,
              ipAddress: device.ipAddress,
              port: device.port,
              startTime,
              endTime
            })
          })

          if (directvResponse.ok) {
            deviceGuideData = await directvResponse.json()
            unifiedData.summary.successfulFetches++
          } else {
            throw new Error(`DirecTV API error: ${directvResponse.status}`)
          }

        } else if (device.type === 'firetv') {
          unifiedData.summary.firetvDevices++
          
          const firetvResponse = await fetch('/api/firetv-devices/guide-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId: device.id,
              ipAddress: device.ipAddress,
              port: device.port,
              startTime,
              endTime
            })
          })

          if (firetvResponse.ok) {
            deviceGuideData = await firetvResponse.json()
            unifiedData.summary.successfulFetches++
          } else {
            throw new Error(`Fire TV API error: ${firetvResponse.status}`)
          }
        }

        if (deviceGuideData && deviceGuideData.success) {
          // Store device-specific data
          unifiedData.devices[device.id] = {
            deviceInfo: device,
            lastFetch: new Date().toISOString(),
            programCount: deviceGuideData.programCount || 0,
            status: 'success'
          }

          // Add programs to unified list
          if (deviceGuideData.programs) {
            deviceGuideData.programs.forEach((program: any) => {
              // Enrich program with device info
              const enrichedProgram = {
                ...program,
                deviceName: device.name,
                deviceType: device.type,
                matrixInput: device.inputChannel,
                priority: calculateProgramPriority(program),
                isLiveNow: isCurrentlyAiring(program),
                timeUntilStart: getTimeUntilStart(program)
              }

              unifiedData.programs.push(enrichedProgram)

              // Update summary counts
              const category = program.category || 'Unknown'
              const source = program.source || device.type

              unifiedData.summary.programsByCategory[category] = 
                (unifiedData.summary.programsByCategory[category] || 0) + 1
              
              unifiedData.summary.programsBySource[source] = 
                (unifiedData.summary.programsBySource[source] || 0) + 1
            })
          }

        } else {
          throw new Error('Failed to get valid guide data')
        }

      } catch (deviceError) {
        logger.error(`❌ Error fetching from ${device.name}:`, deviceError.message)
        unifiedData.summary.failedFetches++
        
        unifiedData.devices[device.id] = {
          deviceInfo: device,
          lastFetch: new Date().toISOString(),
          programCount: 0,
          status: 'error',
          error: deviceError.message
        }
      }
    }

    // Final summary calculations
    unifiedData.summary.totalPrograms = unifiedData.programs.length

    // Sort programs by start time
    unifiedData.programs.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    )

    // Save to cache
    await saveUnifiedGuideCache(unifiedData)

    return NextResponse.json({
      success: true,
      data: unifiedData,
      fetchedAt: new Date().toISOString(),
      message: `Successfully fetched guide data from ${unifiedData.summary.successfulFetches}/${deviceList.length} devices`
    })

  } catch (error) {
    logger.error('❌ Error in unified guide API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unified guide data', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (isValidationError(queryValidation)) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const format = searchParams.get('format')

    if (action === 'cache') {
      // Return cached unified guide data
      const cachedData = await loadUnifiedGuideCache()
      
      if (format === 'summary') {
        return NextResponse.json({
          success: true,
          summary: cachedData.summary || {},
          lastUpdated: cachedData.lastUpdated,
          deviceCount: Object.keys(cachedData.devices || {}).length
        })
      }

      return NextResponse.json({
        success: true,
        data: cachedData,
        cached: true
      })
    }

    if (action === 'live-programs') {
      const cachedData = await loadUnifiedGuideCache()
      const livePrograms = (cachedData.programs || []).filter((program: any) => 
        isCurrentlyAiring(program)
      )

      return NextResponse.json({
        success: true,
        livePrograms,
        count: livePrograms.length,
        fetchedAt: cachedData.lastUpdated
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Unified TV Guide API',
      version: '1.0.0',
      endpoints: {
        'POST /api/unified-guide': 'Fetch guide data from multiple devices',
        'GET /api/unified-guide?action=cache': 'Get cached guide data',
        'GET /api/unified-guide?action=cache&format=summary': 'Get guide summary',
        'GET /api/unified-guide?action=live-programs': 'Get currently airing programs',
        'GET /api/unified-guide': 'Get API information'
      },
      features: [
        'Multi-device guide aggregation',
        'DirecTV and Fire TV support',
        'Real-time program status',
        'Smart program prioritization',
        'Category and source analytics',
        'Cached data support',
        'Live program filtering'
      ],
      deviceSupport: {
        'directv': 'DirecTV IP receivers (guide data via HTTP API)',
        'firetv': 'Amazon Fire TV devices (app schedules via ADB)'
      }
    })

  } catch (error) {
    logger.error('❌ Error in unified guide GET:', error)
    return NextResponse.json(
      { error: 'API error' },
      { status: 500 }
    )
  }
}

// Helper function to calculate program priority
function calculateProgramPriority(program: any) {
  let priority = 1 // Default priority

  // Higher priority for sports
  if (program.category?.toLowerCase().includes('sport') || 
      program.title?.toLowerCase().includes('nfl') ||
      program.title?.toLowerCase().includes('nba') ||
      program.title?.toLowerCase().includes('mlb') ||
      program.title?.toLowerCase().includes('game')) {
    priority += 3
  }

  // Higher priority for live content
  if (program.isLive || isCurrentlyAiring(program)) {
    priority += 2
  }

  // Higher priority for new episodes
  if (program.isNew) {
    priority += 1
  }

  // Higher priority for premium channels
  if (program.channelName?.includes('HBO') || 
      program.channelName?.includes('Showtime') ||
      program.channelName?.includes('NFL')) {
    priority += 1
  }

  return Math.min(priority, 10) // Cap at 10
}

// Helper function to check if program is currently airing
function isCurrentlyAiring(program: any) {
  if (!program.startTime || !program.endTime) return false
  
  const now = new Date()
  const start = new Date(program.startTime)
  const end = new Date(program.endTime)
  
  return now >= start && now <= end
}

// Helper function to get time until program starts
function getTimeUntilStart(program: any) {
  if (!program.startTime) return null
  
  const now = new Date()
  const start = new Date(program.startTime)
  const diff = start.getTime() - now.getTime()
  
  if (diff <= 0) return 0 // Already started
  
  return Math.round(diff / 60000) // Minutes until start
}

