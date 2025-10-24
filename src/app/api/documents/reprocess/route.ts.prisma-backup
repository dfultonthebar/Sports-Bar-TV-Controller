
import { NextRequest, NextResponse } from 'next/server'
import { documentSearch } from '@/lib/enhanced-document-search'
import { operationLogger } from '@/lib/operation-logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
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

    console.error('Document reprocessing error:', error)
    return NextResponse.json(
      { error: 'Failed to reprocess documents' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Check current document status
    const { prisma } = await import('@/lib/db')
    
    const totalDocs = await prisma.document.count()
    const docsWithContent = await prisma.document.count({
      where: {
        content: {
          not: null
        }
      }
    })
    const docsWithoutContent = totalDocs - docsWithContent

    return NextResponse.json({
      totalDocuments: totalDocs,
      documentsWithContent: docsWithContent,
      documentsNeedingReprocess: docsWithoutContent,
      reprocessNeeded: docsWithoutContent > 0
    })
  } catch (error) {
    console.error('Error checking document status:', error)
    return NextResponse.json(
      { error: 'Failed to check document status' },
      { status: 500 }
    )
  }
}
