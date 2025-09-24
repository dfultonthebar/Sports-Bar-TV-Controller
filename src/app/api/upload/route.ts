
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { saveFile, generateUniqueFilename } from '../../../../lib/file-utils'
import { extractTextFromFile } from '../../../../lib/text-extractor'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadedFiles = []

    for (const file of files) {
      if (file.size === 0) continue

      const buffer = Buffer.from(await file.arrayBuffer())
      const uniqueFilename = generateUniqueFilename(file.name)
      const filePath = await saveFile(buffer, uniqueFilename)
      
      // Extract text content for AI processing
      const textContent = await extractTextFromFile(filePath, file.type)

      // Save to database
      const document = await prisma.document.create({
        data: {
          filename: uniqueFilename,
          originalName: file.name,
          filePath: filePath,
          fileSize: file.size,
          mimeType: file.type,
          content: textContent,
        },
      })

      uploadedFiles.push({
        id: document.id,
        filename: document.filename,
        originalName: document.originalName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        uploadedAt: document.uploadedAt,
      })
    }

    return NextResponse.json({ 
      message: 'Files uploaded successfully', 
      files: uploadedFiles 
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        filename: true,
        originalName: true,
        fileSize: true,
        mimeType: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' }, 
      { status: 500 }
    )
  }
}
