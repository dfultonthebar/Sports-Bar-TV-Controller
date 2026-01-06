
import { NextRequest, NextResponse } from 'next/server'
import { create, findMany, desc } from '@/lib/db-helpers'
import { saveFile, generateUniqueFilename } from '@/lib/file-utils'
import { extractTextFromFile } from '@/lib/text-extractor'
import { schema } from '@/db'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  logger.info('📁 Upload request received')
  
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    logger.info(`📄 Processing ${files.length} files`)

    if (!files || files.length === 0) {
      logger.info('❌ No files provided')
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadedFiles: any[] = []

    for (const file of files) {
      logger.info(`🔄 Processing file: ${file.name} (${file.size} bytes)`)
      
      if (file.size === 0) {
        logger.info(`⚠️ Skipping empty file: ${file.name}`)
        continue
      }

      try {
        // Convert file to buffer
        logger.info(`📥 Converting ${file.name} to buffer`)
        const buffer = Buffer.from(await file.arrayBuffer())
        
        // Generate unique filename and save
        logger.info(`💾 Saving ${file.name}`)
        const uniqueFilename = generateUniqueFilename(file.name)
        const filePath = await saveFile(buffer, uniqueFilename)
        logger.info(`✅ File saved to: ${filePath}`)
        
        // Extract text content for AI processing
        logger.info(`🔍 Extracting text from ${file.name}`)
        let textContent = ''
        try {
          const textExtractionResult = await extractTextFromFile(filePath, file.type)
          textContent = textExtractionResult.text
          logger.info(`✅ Text extracted: ${textContent.length} characters`)
        } catch (textError) {
          logger.error(`⚠️ Text extraction failed for ${file.name}:`, textError)
          // Continue with empty content rather than failing the upload
        }

        // Save to database
        logger.info(`💿 Saving ${file.name} to database`)
        const document = await create('documents', {
          filename: uniqueFilename,
          originalName: file.name,
          filePath: filePath,
          fileSize: file.size,
          mimeType: file.type,
          content: textContent,
        })
        logger.info(`✅ Document saved with ID: ${document.id}`)

        uploadedFiles.push({
          id: document.id,
          filename: document.filename,
          originalName: document.originalName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          uploadedAt: document.uploadedAt,
        })
      } catch (fileError) {
        logger.error(`❌ Error processing file ${file.name}:`, fileError)
        // Continue with other files rather than failing the entire upload
      }
    }

    logger.info(`✅ Upload completed: ${uploadedFiles.length} files processed`)
    return NextResponse.json({ 
      message: 'Files uploaded successfully', 
      files: uploadedFiles 
    })
  } catch (error) {
    logger.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files: ' + (error instanceof Error ? error.message : 'Unknown error') }, 
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
    const documentsList = await findMany('documents', {
      orderBy: desc(schema.documents.uploadedAt)
    })

    // Select only needed fields
    const documents = documentsList.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      originalName: doc.originalName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt,
    }))

    return NextResponse.json({ documents })
  } catch (error) {
    logger.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' }, 
      { status: 500 }
    )
  }
}
