import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { trainingDocuments } from '@/db/schema'
import { eq, desc, and, or, like } from 'drizzle-orm'
import { unlink } from 'fs/promises'
import path from 'path'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export const dynamic = 'force-dynamic'

/**
 * GET - List all training documents
 */
export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('active') !== 'false'
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = db.select().from(trainingDocuments)

    const conditions = []

    if (activeOnly) {
      conditions.push(eq(trainingDocuments.isActive, true))
    }

    if (category) {
      conditions.push(eq(trainingDocuments.category, category))
    }

    if (search) {
      conditions.push(
        or(
          like(trainingDocuments.title, `%${search}%`),
          like(trainingDocuments.fileName, `%${search}%`),
          like(trainingDocuments.description, `%${search}%`)
        )
      )
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any
    }

    const documents = await query
      .orderBy(desc(trainingDocuments.createdAt))
      .limit(limit)
      .offset(offset)

    // Parse JSON fields
    const parsedDocuments = documents.map(doc => ({
      ...doc,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      metadata: doc.metadata ? JSON.parse(doc.metadata) : {},
    }))

    return NextResponse.json({
      success: true,
      documents: parsedDocuments,
      total: parsedDocuments.length,
      limit,
      offset,
    })
  } catch (error: any) {
    logger.error('Error fetching training documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch training documents', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update a training document
 */
export async function PUT(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { id, title, description, category, tags, isActive } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Prepare updates
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = JSON.stringify(tags)
    if (isActive !== undefined) updateData.isActive = isActive

    const [updatedDoc] = await db
      .update(trainingDocuments)
      .set(updateData)
      .where(eq(trainingDocuments.id, id))
      .returning()

    if (!updatedDoc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      document: {
        ...updatedDoc,
        tags: updatedDoc.tags ? JSON.parse(updatedDoc.tags) : [],
        metadata: updatedDoc.metadata ? JSON.parse(updatedDoc.metadata) : {},
      },
      message: 'Document updated successfully',
    })
  } catch (error: any) {
    logger.error('Error updating document:', error)
    return NextResponse.json(
      { error: 'Failed to update document', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete a training document
 */
export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const permanent = searchParams.get('permanent') === 'true'

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    // Get document to find file path
    const [document] = await db
      .select()
      .from(trainingDocuments)
      .where(eq(trainingDocuments.id, id))

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    if (permanent) {
      // Delete file from filesystem
      try {
        if (document.filePath) {
          await unlink(document.filePath)
        }
      } catch (fileError) {
        logger.error('Error deleting file:', fileError)
        // Continue with database deletion even if file deletion fails
      }

      // Delete from database
      await db.delete(trainingDocuments).where(eq(trainingDocuments.id, id))

      return NextResponse.json({
        success: true,
        message: 'Document permanently deleted',
      })
    } else {
      // Soft delete - mark as inactive
      await db
        .update(trainingDocuments)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(trainingDocuments.id, id))

      return NextResponse.json({
        success: true,
        message: 'Document marked as inactive',
      })
    }
  } catch (error: any) {
    logger.error('Error deleting document:', error)
    return NextResponse.json(
      { error: 'Failed to delete document', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST - View/track document access
 */
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.AI)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const body = await request.json()
    const { id, action } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    if (action === 'view') {
      // Increment view count and update last viewed
      const [document] = await db
        .select()
        .from(trainingDocuments)
        .where(eq(trainingDocuments.id, id))

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }

      await db
        .update(trainingDocuments)
        .set({
          viewCount: (document.viewCount || 0) + 1,
          lastViewed: new Date().toISOString(),
        })
        .where(eq(trainingDocuments.id, id))

      return NextResponse.json({
        success: true,
        message: 'View tracked',
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    logger.error('Error in document action:', error)
    return NextResponse.json(
      { error: 'Failed to process document action', details: error.message },
      { status: 500 }
    )
  }
}
