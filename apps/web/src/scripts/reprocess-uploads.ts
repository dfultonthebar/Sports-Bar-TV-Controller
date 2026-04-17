
import { promises as fs } from 'fs'
import path from 'path'
import { db, schema } from '../db'
import { or, eq, count } from 'drizzle-orm'
import { extractTextFromFile } from '../lib/text-extractor'

import { logger } from '@sports-bar/logger'
async function reprocessUploads() {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  
  try {
    const files = await fs.readdir(uploadsDir)
    logger.info(`Found ${files.length} files in uploads directory`)

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
        logger.info(`⏭️  Skipping ${filename} - already in database`)
        continue
      }

      logger.info(`🔄 Processing ${filename}`)

      try {
        // Extract text content
        let textContent = ''
        try {
          const textExtractionResult = await extractTextFromFile(filePath)
          textContent = textExtractionResult.text
          logger.info(`✅ Text extracted: ${textContent.length} characters`)
        } catch (textError) {
          logger.error(`⚠️ Text extraction failed for ${filename}:`, textError)
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

        logger.info(`✅ Saved ${filename} to database with ID: ${document.id}`)
      } catch (error) {
        logger.error(`❌ Error processing ${filename}:`, error)
      }
    }

    // Show final counts
    const result = await db
      .select({ count: count() })
      .from(schema.documents)
      .get()
    const totalDocs = result?.count ?? 0
    logger.info(`🎉 Processing complete! Total documents in database: ${totalDocs}`)

  } catch (error) {
    logger.error('Error reprocessing uploads:', error)
  }
}

reprocessUploads()
  .then(() => {
    logger.info('Reprocessing complete')
    process.exit(0)
  })
  .catch(error => {
    logger.error('Reprocessing failed:', error)
    process.exit(1)
  })
