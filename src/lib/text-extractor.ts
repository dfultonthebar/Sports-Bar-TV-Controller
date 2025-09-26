
import { promises as fs } from 'fs'
import path from 'path'

export interface TextExtractionResult {
  text: string
  metadata?: {
    pages: number
    info?: any
  }
}

export async function extractTextFromFile(filePath: string, mimeType?: string): Promise<TextExtractionResult> {
  const extension = path.extname(filePath).toLowerCase()
  
  switch (extension) {
    case '.pdf':
      return await extractTextFromPDF(filePath)
    case '.txt':
      return await extractTextFromTXT(filePath)
    case '.md':
      return await extractTextFromTXT(filePath) // Treat markdown as text
    default:
      throw new Error(`Unsupported file type: ${extension}`)
  }
}

async function extractTextFromPDF(filePath: string): Promise<TextExtractionResult> {
  try {
    // Dynamic import to avoid build-time issues
    const pdf = (await import('pdf-parse')).default
    const buffer = await fs.readFile(filePath)
    const data = await pdf(buffer)
    
    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info
      }
    }
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error(`Failed to extract text from PDF: ${error}`)
  }
}

async function extractTextFromTXT(filePath: string): Promise<TextExtractionResult> {
  try {
    const text = await fs.readFile(filePath, 'utf-8')
    
    return {
      text: text,
      metadata: {
        pages: 1
      }
    }
  } catch (error) {
    console.error('Error reading text file:', error)
    throw new Error(`Failed to read text file: ${error}`)
  }
}

export function cleanExtractedText(text: string): string {
  // Remove excessive whitespace and normalize line breaks
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function extractAndCleanText(filePath: string): Promise<string> {
  const result = await extractTextFromFile(filePath)
  return cleanExtractedText(result.text)
}
