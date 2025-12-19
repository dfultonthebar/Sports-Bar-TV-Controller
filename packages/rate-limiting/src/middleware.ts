/**
 * Rate Limiting Middleware for Next.js API Routes
 *
 * Usage:
 * ```typescript
 * import { withRateLimit } from '@sports-bar/rate-limiting'
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await withRateLimit(request, 'ai')
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.response
 *   }
 *
 *   // Your endpoint logic here...
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, RateLimitConfig, RateLimitConfigs, RateLimitResult } from './rate-limiter'

/**
 * Extract client IP from Next.js request
 */
export function getClientIp(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to a placeholder
  return 'unknown'
}

/**
 * Create rate limit headers for the response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetTime.toString(),
  }
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)

  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      limit: result.limit,
      current: result.current,
      resetTime: result.resetTime,
      resetIn: `${retryAfter} seconds`,
    },
    {
      status: 429,
      headers: {
        ...createRateLimitHeaders(result),
        'Retry-After': retryAfter.toString(),
      },
    }
  )
}

export interface RateLimitCheckResult {
  allowed: boolean
  response?: NextResponse
  result: RateLimitResult
  headers: Record<string, string>
}

/**
 * Check rate limit for a request
 * Returns a result object that can be used to either continue or return a 429 response
 */
export async function checkRateLimit(
  request: NextRequest,
  configOrType: RateLimitConfig | keyof typeof RateLimitConfigs
): Promise<RateLimitCheckResult> {
  const ip = getClientIp(request)

  // Get config
  const config: RateLimitConfig = typeof configOrType === 'string'
    ? RateLimitConfigs[configOrType]
    : configOrType

  // Check rate limit
  const result = rateLimiter.checkLimit(ip, config)
  const headers = createRateLimitHeaders(result)

  if (!result.allowed) {
    return {
      allowed: false,
      response: createRateLimitResponse(result),
      result,
      headers,
    }
  }

  return {
    allowed: true,
    result,
    headers,
  }
}

/**
 * Middleware-style rate limiter
 * Use this at the beginning of your API route
 *
 * @param request - Next.js request object
 * @param configOrType - Either a config object or one of the predefined types ('DEFAULT', 'AI', 'SPORTS', 'EXPENSIVE')
 * @returns Result object with allowed status and optional response
 */
export async function withRateLimit(
  request: NextRequest,
  configOrType: RateLimitConfig | keyof typeof RateLimitConfigs = 'DEFAULT'
): Promise<RateLimitCheckResult> {
  return checkRateLimit(request, configOrType)
}

/**
 * Add rate limit headers to an existing response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = createRateLimitHeaders(result)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}
