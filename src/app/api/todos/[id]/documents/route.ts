
import { NextRequest, NextResponse } from 'next/server'
import { findMany, findUnique, findFirst, create, update, updateMany, deleteRecord, upsert, count, eq, desc, asc, and, or, ne } from '@/lib/db-helpers'
import { schema } from '@/db'
import { db } from '@/db'
// Converted to Drizzle ORM
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { todoDocuments, todos } from '@/db/schema'

export const dynamic = 'force-dynamic'

// GET /api/todos/:id/documents - Get documents for TODO
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documents = await prisma.todoDocument.findMany({
      where: { todoId: params.id },
      orderBy: { uploadedAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: documents
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST /api/todos/:id/documents - Upload document to TODO
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Verify todo exists
    const todo = await db.select().from(todos).where(eq(todos.id, params.id)).limit(1).get()

    if (!todo) {
      return NextResponse.json(
        { success: false, error: 'Todo not found' },
        { status: 404 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'todos')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const filename = `${timestamp}-${file.name}`
    const filepath = join(uploadsDir, filename)
    const publicPath = `/uploads/todos/${filename}`

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Save document record to database
    const document = await db.insert(todoDocuments).values({
        todoId: params.id,
        filename: file.name,
        filepath: publicPath,
        filesize: file.size,
        mimetype: file.type
      }).returning().get()

    return NextResponse.json({
      success: true,
      data: document
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

// DELETE /api/todos/:id/documents - Delete document
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: 'Document ID required' },
        { status: 400 }
      )
    }

    await db.delete(todoDocuments).where(eq(todoDocuments.id, documentId)).returning().get()

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
