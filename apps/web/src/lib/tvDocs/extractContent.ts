
/**
 * TV Manual Content Extraction Service
 * 
 * Extracts text content from PDF and text manuals for Q&A generation
 */

import { promises as fs } from 'fs'
import path from 'path'

import { logger } from '@/lib/logger'
/**
 * Extract text content from a PDF file
 */
async function extractPDFContent(filePath: string): Promise<string> {
  try {
    logger.info(`[TV Docs] Extracting content from PDF: ${filePath}`)
    
    // Dynamic import to avoid build-time issues
    const pdf = (await import('pdf-parse')).default
    
    const dataBuffer = await fs.readFile(filePath)
    const data = await pdf(dataBuffer)
    
    logger.info(`[TV Docs] Extracted ${data.numpages} pages, ${data.text.length} characters`)
    
    return data.text
  } catch (error: any) {
    logger.error('[TV Docs] Error extracting PDF content:', error)
    throw new Error(`Failed to extract PDF content: ${error.message}`)
  }
}

/**
 * Extract text content from a text file
 */
async function extractTextContent(filePath: string): Promise<string> {
  try {
    logger.info(`[TV Docs] Reading text file: ${filePath}`)
    
    const content = await fs.readFile(filePath, 'utf-8')
    
    logger.info(`[TV Docs] Read ${content.length} characters`)
    
    return content
  } catch (error: any) {
    logger.error('[TV Docs] Error reading text file:', error)
    throw new Error(`Failed to read text file: ${error.message}`)
  }
}

/**
 * Extract content from a manual file (PDF or text)
 */
export async function extractManualContent(filePath: string): Promise<string> {
  try {
    const ext = path.extname(filePath).toLowerCase()
    
    if (ext === '.pdf') {
      return await extractPDFContent(filePath)
    } else if (ext === '.txt' || ext === '.md') {
      return await extractTextContent(filePath)
    } else {
      throw new Error(`Unsupported file type: ${ext}`)
    }
  } catch (error: any) {
    logger.error('[TV Docs] Error extracting manual content:', error)
    throw error
  }
}

/**
 * Split content into chunks for Q&A generation
 */
export function splitContentIntoChunks(content: string, chunkSize: number = 2000): string[] {
  const chunks: string[] = []
  
  // Split by paragraphs first
  const paragraphs = content.split(/\n\n+/)
  
  let currentChunk = ''
  
  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  logger.info(`[TV Docs] Split content into ${chunks.length} chunks`)
  
  return chunks
}

/**
 * Extract key sections from manual content
 */
export function extractKeySections(content: string): Record<string, string> {
  const sections: Record<string, string> = {}
  
  // Common section headers in TV manuals
  const sectionPatterns = [
    { key: 'specifications', pattern: /specifications?|technical data/i },
    { key: 'setup', pattern: /setup|installation|getting started/i },
    { key: 'connections', pattern: /connections?|connecting|ports/i },
    { key: 'remote', pattern: /remote control|using the remote/i },
    { key: 'settings', pattern: /settings?|menu|configuration/i },
    { key: 'troubleshooting', pattern: /troubleshooting|problems|issues/i },
    { key: 'features', pattern: /features?|functions?/i },
  ]
  
  // Split content into sections based on headers
  const lines = content.split('\n')
  let currentSection = 'general'
  let currentContent = ''
  
  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Check if this line is a section header
    let foundSection = false
    for (const { key, pattern } of sectionPatterns) {
      if (pattern.test(trimmedLine) && trimmedLine.length < 100) {
        // Save previous section
        if (currentContent.trim()) {
          sections[currentSection] = (sections[currentSection] || '') + currentContent
        }
        
        currentSection = key
        currentContent = ''
        foundSection = true
        break
      }
    }
    
    if (!foundSection) {
      currentContent += line + '\n'
    }
  }
  
  // Save last section
  if (currentContent.trim()) {
    sections[currentSection] = (sections[currentSection] || '') + currentContent
  }
  
  logger.info(`[TV Docs] Extracted ${Object.keys(sections).length} sections`)
  
  return sections
}
