
import { NextRequest, NextResponse } from 'next/server'
import { findUnique, deleteRecord, eq } from '@/lib/db-helpers'
import { deleteFile } from '@/lib/file-utils'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params

    // Find the document first
    const document = await findUnique('documents', eq(schema.documents.id, id))

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Delete the physical file
    try {
      await deleteFile(document.filePath)
    } catch (error) {
      console.error('Error deleting physical file:', error)
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await deleteRecord('documents', eq(schema.documents.id, id))

    return NextResponse.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' }, 
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { id } = await params

    const document = await findUnique('documents', eq(schema.documents.id, id))

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Get document error:', error)
    return NextResponse.json(
      { error: 'Failed to get document' }, 
      { status: 500 }
    )
  }
}
