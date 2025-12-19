
import { NextRequest, NextResponse } from 'next/server'
import { documentSearch } from '@/lib/enhanced-document-search'
import { operationLogger } from '@/lib/operation-logger'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    await operationLogger.logOperation({
      type: 'error', // Using existing type system
      action: 'Document reprocessing started',
      details: { trigger: 'manual_request' },
      success: true
    })

    const result = await documentSearch.reprocessAllDocuments()

    await operationLogger.logOperation({
      type: 'error', // Using existing type system  
      action: 'Document reprocessing completed',
      details: result,
      success: result.errors === 0
    })

    return NextResponse.json({
      message: 'Documents reprocessed successfully',
      ...result
    })
  } catch (error) {
    await operationLogger.logError({
      level: 'error',
      source: 'document-reprocess',
      message: 'Document reprocessing failed',
      stack: error instanceof Error ? error.stack : undefined,
      details: { error: error instanceof Error ? error.message : error }
    })

    logger.error('Document reprocessing error:', error)
    return NextResponse.json(
      { error: 'Failed to reprocess documents' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    // Check current document status
    const { db, schema, count, isNotNull } = await import('@/lib/db-helpers')

    // Note: document table doesn't exist in current Drizzle schema
    // This endpoint may need to be updated or removed
    const totalDocs = 0
    const docsWithContent = 0
    const docsWithoutContent = 0

    return NextResponse.json({
      totalDocuments: totalDocs,
      documentsWithContent: docsWithContent,
      documentsNeedingReprocess: docsWithoutContent,
      reprocessNeeded: docsWithoutContent > 0
    })
  } catch (error) {
    logger.error('Error checking document status:', error)
    return NextResponse.json(
      { error: 'Failed to check document status' },
      { status: 500 }
    )
  }
}
