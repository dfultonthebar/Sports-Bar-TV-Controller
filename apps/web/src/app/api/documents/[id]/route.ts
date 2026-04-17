
import { NextRequest, NextResponse } from 'next/server'
import { findUnique, deleteRecord, eq } from '@/lib/db-helpers'
import { deleteFile } from '@/lib/file-utils'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@sports-bar/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
export async function DELETE(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params

    // Find the document first
    const document = await findUnique('documents', eq(schema.documents.id, id))

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete the physical file
    try {
      await deleteFile(document.filePath)
    } catch (error) {
      logger.error('Error deleting physical file:', error)
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await deleteRecord('documents', eq(schema.documents.id, id))

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    logger.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' }, 
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  {  params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Path parameter validation
  const params = await paramsPromise
  const paramsValidation = validatePathParams(params, z.object({ id: z.string().min(1) }))
  if (isValidationError(paramsValidation)) return paramsValidation.error


  try {
    const { id } = params

    const document = await findUnique('documents', eq(schema.documents.id, id))

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    logger.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Failed to get document' }, 
      { status: 500 }
    )
  }
}
