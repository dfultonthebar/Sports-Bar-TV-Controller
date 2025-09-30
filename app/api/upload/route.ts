
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/db'
import { saveFile, generateUniqueFilename } from '../../../../lib/file-utils'
import { extractTextFromFile } from '../../../../lib/text-extractor'

export async function POST(request: NextRequest) {
  console.log('📁 Upload request received')
  
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    console.log(`📄 Processing ${files.length} files`)

    if (!files || files.length === 0) {
      console.log('❌ No files provided')
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const uploadedFiles = []

    for (const file of files) {
      console.log(`🔄 Processing file: ${file.name} (${file.size} bytes)`)
      
      if (file.size === 0) {
        console.log(`⚠️ Skipping empty file: ${file.name}`)
        continue
      }

      try {
        // Convert file to buffer
        console.log(`📥 Converting ${file.name} to buffer`)
        const buffer = Buffer.from(await file.arrayBuffer())
        
        // Generate unique filename and save
        console.log(`💾 Saving ${file.name}`)
        const uniqueFilename = generateUniqueFilename(file.name)
        const filePath = await saveFile(buffer, uniqueFilename)
        console.log(`✅ File saved to: ${filePath}`)
        
        // Extract text content for AI processing
        console.log(`🔍 Extracting text from ${file.name}`)
        let textContent = ''
        try {
          const textExtractionResult = await extractTextFromFile(filePath, file.type)
          textContent = textExtractionResult
          console.log(`✅ Text extracted: ${textContent.length} characters`)
        } catch (textError) {
          console.error(`⚠️ Text extraction failed for ${file.name}:`, textError)
          // Continue with empty content rather than failing the upload
        }

        // Save to database
        console.log(`💿 Saving ${file.name} to database`)
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
        console.log(`✅ Document saved with ID: ${document.id}`)

        uploadedFiles.push({
          id: document.id,
          filename: document.filename,
          originalName: document.originalName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          uploadedAt: document.uploadedAt,
        })
      } catch (fileError) {
        console.error(`❌ Error processing file ${file.name}:`, fileError)
        // Continue with other files rather than failing the entire upload
      }
    }

    console.log(`✅ Upload completed: ${uploadedFiles.length} files processed`)
    return NextResponse.json({ 
      message: 'Files uploaded successfully', 
      files: uploadedFiles 
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload files: ' + (error instanceof Error ? error.message : 'Unknown error') }, 
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
