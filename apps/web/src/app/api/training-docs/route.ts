/**
 * Training Documents — DB-backed knowledge the local AI is trained on.
 *
 * GET    list active docs (metadata only, no full content)
 * POST   add a doc → store row → index into the RAG vector store (so the chatbot answers from it)
 * DELETE remove a doc (?id=) → delete row + drop its chunks from the vector store
 *
 * v2.82.x — operator: "the local AI should have all the knowledge it can." Filesystem docs are
 * already RAG-indexed by scan-system-docs; this is the operator-managed knowledge source.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { eq, desc } from 'drizzle-orm'
import { logger } from '@sports-bar/logger'
import { indexTrainingDocs, removeDocument, trainingDocFilepath } from '@sports-bar/rag-server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { validateRequestBody, isValidationError } from '@/lib/validation'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),       // stored as JSON
  description: z.string().max(1000).optional(),
  fileType: z.string().max(20).optional(),
})

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response
  try {
    const rows = await db
      .select({
        id: schema.trainingDocuments.id,
        title: schema.trainingDocuments.title,
        category: schema.trainingDocuments.category,
        tags: schema.trainingDocuments.tags,
        description: schema.trainingDocuments.description,
        fileType: schema.trainingDocuments.fileType,
        fileSize: schema.trainingDocuments.fileSize,
        viewCount: schema.trainingDocuments.viewCount,
        processedAt: schema.trainingDocuments.processedAt,
        isActive: schema.trainingDocuments.isActive,
        createdAt: schema.trainingDocuments.createdAt,
        updatedAt: schema.trainingDocuments.updatedAt,
      })
      .from(schema.trainingDocuments)
      .orderBy(desc(schema.trainingDocuments.updatedAt))
    return NextResponse.json({ success: true, data: rows, count: rows.length })
  } catch (error) {
    logger.error('[TRAINING-DOCS] list failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to list training documents' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response

  const bodyValidation = await validateRequestBody(request, createSchema)
  if (isValidationError(bodyValidation)) return bodyValidation.error
  const body = bodyValidation.data

  try {
    const now = new Date().toISOString()
    const id = crypto.randomUUID()
    const fileType = body.fileType || 'md'
    const tagsJson = body.tags && body.tags.length ? JSON.stringify(body.tags) : null
    // prod TrainingDocument has fileName/filePath/fileSize NOT NULL — provide all three.
    const slug = body.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || id
    const doc = {
      id,
      title: body.title,
      content: body.content,
      fileType,
      fileName: `${slug}.${fileType}`,
      category: body.category ?? null,
      tags: tagsJson,
      description: body.description ?? null,
      filePath: trainingDocFilepath({ id, category: body.category, fileType }),
      fileSize: body.content.length,
      viewCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    await db.insert(schema.trainingDocuments).values(doc)

    // Index into the RAG vector store so the chatbot can answer from it. Best-effort —
    // the row is saved regardless; a full rescan re-indexes if this fails (Ollama down etc.).
    let chunks = 0
    try {
      chunks = await indexTrainingDocs([{ id, title: body.title, content: body.content, category: body.category, tags: tagsJson, fileType: doc.fileType }])
      await db.update(schema.trainingDocuments)
        .set({ processedAt: new Date().toISOString() })
        .where(eq(schema.trainingDocuments.id, id))
    } catch (idxErr) {
      logger.warn('[TRAINING-DOCS] saved but RAG indexing failed (will index on next rescan):', idxErr)
    }
    logger.info(`[TRAINING-DOCS] added "${body.title}" (${chunks} chunks indexed)`)
    return NextResponse.json({ success: true, data: { id, title: body.title, chunksIndexed: chunks } })
  } catch (error) {
    logger.error('[TRAINING-DOCS] create failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to create training document' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.DEFAULT)
  if (!rateLimit.allowed) return rateLimit.response
  try {
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    const existing = await db.select().from(schema.trainingDocuments).where(eq(schema.trainingDocuments.id, id)).limit(1)
    if (!existing.length) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    await db.delete(schema.trainingDocuments).where(eq(schema.trainingDocuments.id, id))
    // Drop its chunks from the vector store (best-effort)
    try { await removeDocument(trainingDocFilepath(existing[0] as any)) } catch (e) { logger.warn('[TRAINING-DOCS] vector cleanup failed:', e) }
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[TRAINING-DOCS] delete failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete training document' }, { status: 500 })
  }
}
