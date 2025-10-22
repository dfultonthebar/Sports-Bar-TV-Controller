/**
 * API Response Helpers
 * Provides safe JSON response wrappers to prevent circular reference errors
 */

import { NextResponse } from 'next/server'
import { logger } from './logger'

/**
 * Safe JSON serialization that removes circular references
 */
export function safeJsonStringify(data: any): string {
  const seen = new WeakSet()
  
  return JSON.stringify(data, (key, value) => {
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular Reference]'
      }
      seen.add(value)
    }
    
    // Handle functions (should not be serialized)
    if (typeof value === 'function') {
      return '[Function]'
    }
    
    // Handle symbols (should not be serialized)
    if (typeof value === 'symbol') {
      return '[Symbol]'
    }
    
    return value
  })
}

/**
 * Safe NextResponse.json wrapper that handles circular references
 * Use this instead of NextResponse.json to prevent serialization errors
 */
export function safeJsonResponse(
  data: any,
  options?: {
    status?: number
    statusText?: string
    headers?: HeadersInit
  }
): NextResponse {
  try {
    // Try standard JSON.stringify first (fastest)
    JSON.stringify(data)
    return NextResponse.json(data, options)
  } catch (error: any) {
    // If standard stringify fails, log the error and use safe serialization
    logger.error('JSON serialization error detected, using safe serialization', error)
    
    try {
      // Use safe serialization
      const safeJson = safeJsonStringify(data)
      const parsedData = JSON.parse(safeJson)
      
      return NextResponse.json(parsedData, options)
    } catch (safeError: any) {
      // If even safe serialization fails, return a generic error
      logger.error('Safe JSON serialization also failed', safeError)
      
      return NextResponse.json(
        {
          error: 'Internal server error: Unable to serialize response data',
          details: 'Response data contains non-serializable content'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Error response helper with automatic error serialization
 */
export function errorResponse(
  message: string,
  details?: any,
  status: number = 500
): NextResponse {
  const errorData = {
    error: message,
    details: details instanceof Error ? details.message : details
  }
  
  return safeJsonResponse(errorData, { status })
}

/**
 * Success response helper with automatic data serialization
 */
export function successResponse(
  data: any,
  status: number = 200
): NextResponse {
  return safeJsonResponse(data, { status })
}
