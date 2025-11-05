
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findFirst, create, createMany, deleteMany, upsert, eq, desc } from "@/lib/db-helpers"
import { schema } from "@/db"
import { logger } from "@/lib/logger"
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

// Configure route segment to be dynamic
export const dynamic = 'force-dynamic'


export interface SportsGuideConfigRequest {
  zipCode?: string
  city?: string
  state?: string
  timezone: string
  updateSchedule?: {
    enabled: boolean
    time: string // "HH:MM" format
    frequency: 'daily' | 'weekly'
  }
  providers: {
    id?: string
    name: string
    type: string
    channels: string[]
    packages: string[]
    inputIds?: string[]  // Changed to support multiple inputs
  }[]
  homeTeams: {
    id?: string
    teamName: string
    league: string
    category: string
    sport: string
    location?: string
    conference?: string
    isPrimary: boolean
  }[]
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.SPORTS_DATA)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.api.request('GET', '/api/sports-guide-config')
  
  try {
    // Get current configuration
    const config = await findFirst('sportsGuideConfigurations', {
      where: eq(schema.sportsGuideConfigurations.isActive, true)
    })

    const providers = await findMany('tvProviders', {
      where: eq(schema.tvProviders.isActive, true)
    })

    // Get provider inputs for each provider
    const providersWithInputs = await Promise.all(
      providers.map(async (p) => {
        const providerInputs = await findMany('providerInputs', {
          where: eq(schema.providerInputs.providerId, p.id)
        })
        
        return {
          ...p,
          channels: JSON.parse(p.channels as string || '[]'),
          packages: JSON.parse(p.packages as string || '[]'),
          inputIds: providerInputs.map(pi => pi.inputId),
          providerInputs
        }
      })
    )

    const homeTeams = await findMany('homeTeams', {
      where: eq(schema.homeTeams.isActive, true)
    })

    // Sort home teams manually since Drizzle orderBy needs specific implementation
    homeTeams.sort((a, b) => {
      // First sort by isPrimary (desc)
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      // Then by category (asc)
      if (a.category !== b.category) return a.category.localeCompare(b.category)
      // Finally by teamName (asc)
      return a.teamName.localeCompare(b.teamName)
    })

    // Get matrix inputs for assignment
    const matrixConfig = await findFirst('matrixConfigurations', {
      where: eq(schema.matrixConfigurations.isActive, true)
    })

    let matrixInputs: any[] = []
    if (matrixConfig) {
      matrixInputs = await findMany('matrixInputs', {
        where: eq(schema.matrixInputs.configId, matrixConfig.id)
      })
      matrixInputs.sort((a, b) => a.channelNumber - b.channelNumber)
    }

    logger.api.response('GET', '/api/sports-guide-config', 200, {
      providersCount: providersWithInputs.length,
      homeTeamsCount: homeTeams.length,
      matrixInputsCount: matrixInputs.length
    })

    return NextResponse.json({
      success: true,
      data: {
        configuration: config,
        providers: providersWithInputs,
        homeTeams,
        matrixInputs
      }
    })
  } catch (error: any) {
    logger.api.error('GET', '/api/sports-guide-config', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load configuration' },
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
  if (!bodyValidation.success) return bodyValidation.error


  logger.api.request('POST', '/api/sports-guide-config')

  try {
    const { zipCode, city, state, timezone, updateSchedule, providers, homeTeams } = bodyValidation.data as SportsGuideConfigRequest

    // Validate timezone - ENHANCED TIMEZONE HANDLING
    const validTimezones = [
      'America/New_York', 'America/Chicago', 'America/Denver', 
      'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'
    ]
    const finalTimezone = validTimezones.includes(timezone) ? timezone : 'America/New_York'

    // Update or create sports guide configuration with proper timezone
    const config = await upsert(
      'sportsGuideConfigurations',
      eq(schema.sportsGuideConfigurations.id, '1'),
      {
        id: '1',
        zipCode,
        city,
        state,
        timezone: finalTimezone,
        isActive: true
      },
      {
        zipCode,
        city,
        state,
        timezone: finalTimezone,
        isActive: true
      }
    )

    // Clear existing providers and their input relationships
    // Delete all provider inputs first
    const allProviderInputs = await findMany('providerInputs', {})
    for (const pi of allProviderInputs) {
      await deleteMany('providerInputs', eq(schema.providerInputs.id, pi.id))
    }
    
    // Delete all active providers
    const activeProviders = await findMany('tvProviders', {
      where: eq(schema.tvProviders.isActive, true)
    })
    for (const p of activeProviders) {
      await deleteMany('tvProviders', eq(schema.tvProviders.id, p.id))
    }
    
    if (providers.length > 0) {
      for (const provider of providers) {
        // Create the provider
        const createdProvider = await create('tvProviders', {
          name: provider.name,
          type: provider.type,
          channels: JSON.stringify(provider.channels),
          packages: JSON.stringify(provider.packages),
          isActive: true
        })

        // Create provider-input relationships
        if (provider.inputIds && provider.inputIds.length > 0) {
          for (const inputId of provider.inputIds) {
            await create('providerInputs', {
              providerId: createdProvider.id,
              inputId: inputId
            })
          }
        }
      }
    }

    // Clear existing home teams and create new ones
    const activeHomeTeams = await findMany('homeTeams', {
      where: eq(schema.homeTeams.isActive, true)
    })
    for (const team of activeHomeTeams) {
      await deleteMany('homeTeams', eq(schema.homeTeams.id, team.id))
    }
    
    if (homeTeams.length > 0) {
      for (const team of homeTeams) {
        await create('homeTeams', {
          teamName: team.teamName,
          league: team.league,
          category: team.category,
          sport: team.sport,
          location: team.location,
          conference: team.conference,
          isPrimary: team.isPrimary,
          isActive: true
        })
      }
    }

    logger.api.response('POST', '/api/sports-guide-config', 200, {
      providersCount: providers.length,
      homeTeamsCount: homeTeams.length
    })

    return NextResponse.json({
      success: true,
      data: { configuration: config }
    })
  } catch (error: any) {
    logger.api.error('POST', '/api/sports-guide-config', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save configuration' },
      { status: 500 }
    )
  }
}
