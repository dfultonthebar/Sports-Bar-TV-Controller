
import { promises as fs } from 'fs'
import path from 'path'

import { logger } from '@sports-bar/logger'

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
    const buffer = await fs.readFile(filePath)

    // pdf-parse v2 (Sep 2025) replaced the v1 default-callable with
    // the PDFParse class. Migration:
    //   v1:  const data = await pdfParse(buffer);  data.text / data.numpages
    //   v2:  const p = new PDFParse({ data: buffer });
    //        const r = await p.getText();         r.text / r.pages.length
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()

    return {
      text: result.text,
      metadata: {
        pages: result.total ?? result.pages?.length ?? 0,
        // v2 TextResult no longer exposes .info — only { pages, text, total }.
        // If we need PDF metadata in the future, call parser.getMetadata() / getInfo().
        info: undefined,
      },
    }
  } catch (error) {
    logger.error('Error extracting text from PDF:', error)

    // Fallback: try to read basic PDF info without full parsing
    try {
      const buffer = await fs.readFile(filePath)
      const text = buffer.toString('utf8', 0, Math.min(buffer.length, 10000))

      // Extract some basic text from PDF if possible
      const basicText = text.replace(/[^\x20-\x7E]/g, ' ').trim()

      return {
        text: `[PDF content could not be fully extracted. File: ${path.basename(filePath)}]\n\n${basicText.substring(0, 1000)}`,
        metadata: {
          pages: 1
        }
      }
    } catch (fallbackError) {
      logger.error('Fallback extraction also failed:', fallbackError)
      return {
        text: `[PDF file could not be processed: ${path.basename(filePath)}]`,
        metadata: {
          pages: 1
        }
      }
    }
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
    logger.error('Error reading text file:', error)
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
