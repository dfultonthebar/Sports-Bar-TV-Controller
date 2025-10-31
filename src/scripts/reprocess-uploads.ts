
import { promises as fs } from 'fs'
import path from 'path'
import { db, schema } from '../db'
import { or, eq, count } from 'drizzle-orm'
import { extractTextFromFile } from '../lib/text-extractor'

async function reprocessUploads() {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  
  try {
    const files = await fs.readdir(uploadsDir)
    console.log(`Found ${files.length} files in uploads directory`)

    for (const filename of files) {
      const filePath = path.join(uploadsDir, filename)
      const stat = await fs.stat(filePath)
      
      if (!stat.isFile()) continue

      // Check if file is already in database
      const existingDoc = await db
        .select()
        .from(schema.documents)
        .where(
          or(
            eq(schema.documents.filename, filename),
            eq(schema.documents.filePath, filePath)
          )
        )
        .limit(1)
        .get()

      if (existingDoc) {
        console.log(`⏭️  Skipping ${filename} - already in database`)
        continue
      }

      console.log(`🔄 Processing ${filename}`)

      try {
        // Extract text content
        let textContent = ''
        try {
          const textExtractionResult = await extractTextFromFile(filePath)
          textContent = textExtractionResult.text
          console.log(`✅ Text extracted: ${textContent.length} characters`)
        } catch (textError) {
          console.error(`⚠️ Text extraction failed for ${filename}:`, textError)
        }

        // Determine MIME type based on extension
        const ext = path.extname(filename).toLowerCase()
        let mimeType = 'application/octet-stream'
        switch (ext) {
          case '.pdf': mimeType = 'application/pdf'; break
          case '.txt': mimeType = 'text/plain'; break
          case '.md': mimeType = 'text/markdown'; break
          case '.doc': mimeType = 'application/msword'; break
          case '.docx': mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break
        }

        // Save to database
        const document = await db
          .insert(schema.documents)
          .values({
            filename,
            originalName: filename, // We don't have the original name, use filename
            filePath,
            fileSize: stat.size,
            mimeType,
            content: textContent,
          })
          .returning()
          .get()

        console.log(`✅ Saved ${filename} to database with ID: ${document.id}`)
      } catch (error) {
        console.error(`❌ Error processing ${filename}:`, error)
      }
    }

    // Show final counts
    const result = await db
      .select({ count: count() })
      .from(schema.documents)
      .get()
    const totalDocs = result?.count ?? 0
    console.log(`🎉 Processing complete! Total documents in database: ${totalDocs}`)

  } catch (error) {
    console.error('Error reprocessing uploads:', error)
  }
}

reprocessUploads()
  .then(() => {
    console.log('Reprocessing complete')
    process.exit(0)
  })
  .catch(error => {
    console.error('Reprocessing failed:', error)
    process.exit(1)
  })
