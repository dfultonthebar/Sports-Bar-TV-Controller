/**
 * Team Name Matching Test API
 *
 * POST /api/scheduler/test-match
 * Tests fuzzy team name matching
 *
 * Body:
 * {
 *   teamName: string
 *   sport?: string
 *   league?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, z } from '@/lib/validation'
import { getTeamMatcher } from '@/lib/scheduler/team-name-matcher'
import { logger } from '@/lib/logger'

const testMatchSchema = z.object({
  teamName: z.string().min(1),
  sport: z.string().optional(),
  league: z.string().optional()
})

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  // Validation
  const bodyValidation = await validateRequestBody(request, testMatchSchema)
  if (!bodyValidation.success) return bodyValidation.error

  const { teamName, sport, league } = bodyValidation.data

  try {
    logger.info(`[API] Testing team match: "${teamName}" (sport: ${sport}, league: ${league})`)

    const matcher = getTeamMatcher()
    const match = await matcher.findMatch(teamName, sport, league)

    if (match) {
      return NextResponse.json({
        success: true,
        data: {
          found: true,
          match: {
            teamId: match.teamId,
            teamName: match.teamName,
            confidence: match.confidence,
            confidencePercent: `${(match.confidence * 100).toFixed(0)}%`,
            matchMethod: match.matchMethod,
            sport: match.sport,
            league: match.league,
            priority: match.priority,
            minTVsWhenActive: match.minTVsWhenActive,
            rivalTeams: match.rivalTeams,
            preferredZones: match.preferredZones
          },
          input: {
            teamName,
            sport,
            league
          }
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          input: {
            teamName,
            sport,
            league
          },
          message: 'No matching home team found'
        }
      })
    }
  } catch (error: any) {
    logger.error('[API] Error testing team match:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to test team match'
      },
      { status: 500 }
    )
  }
}
