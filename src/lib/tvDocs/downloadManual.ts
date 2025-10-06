
/**
 * TV Manual Download Service
 * 
 * Downloads and saves TV manuals to local storage
 */

import { promises as fs } from 'fs'
import path from 'path'
import { TVManualSearchResult } from './types'

const MANUALS_DIR = path.join(process.cwd(), 'docs', 'tv-manuals')

/**
 * Ensure the manuals directory exists
 */
async function ensureManualsDirectory(): Promise<void> {
  try {
    await fs.access(MANUALS_DIR)
  } catch {
    await fs.mkdir(MANUALS_DIR, { recursive: true })
    console.log(`[TV Docs] Created manuals directory: ${MANUALS_DIR}`)
  }
}

/**
 * Generate a safe filename for the manual
 */
function generateManualFilename(manufacturer: string, model: string, isPDF: boolean): string {
  const sanitized = `${manufacturer}_${model}`
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
  
  const extension = isPDF ? 'pdf' : 'txt'
  return `${sanitized}_Manual.${extension}`
}

/**
 * Download a PDF manual
 */
async function downloadPDF(url: string, outputPath: string): Promise<void> {
  try {
    console.log(`[TV Docs] Downloading PDF from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const buffer = await response.arrayBuffer()
    await fs.writeFile(outputPath, Buffer.from(buffer))
    
    console.log(`[TV Docs] PDF saved to: ${outputPath}`)
  } catch (error: any) {
    console.error('[TV Docs] Error downloading PDF:', error)
    throw new Error(`Failed to download PDF: ${error.message}`)
  }
}

/**
 * Download HTML documentation and convert to text
 */
async function downloadHTML(url: string, outputPath: string): Promise<void> {
  try {
    console.log(`[TV Docs] Fetching HTML from: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const html = await response.text()
    
    // Basic HTML to text conversion (remove tags)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    await fs.writeFile(outputPath, text, 'utf-8')
    
    console.log(`[TV Docs] HTML content saved to: ${outputPath}`)
  } catch (error: any) {
    console.error('[TV Docs] Error downloading HTML:', error)
    throw new Error(`Failed to download HTML: ${error.message}`)
  }
}

/**
 * Download TV manual from the best available source
 */
export async function downloadTVManual(
  manufacturer: string,
  model: string,
  searchResults: TVManualSearchResult[]
): Promise<{ path: string; url: string } | null> {
  try {
    await ensureManualsDirectory()
    
    // Try each result in order of relevance
    for (const result of searchResults) {
      try {
        const filename = generateManualFilename(manufacturer, model, result.isPDF)
        const outputPath = path.join(MANUALS_DIR, filename)
        
        // Check if file already exists
        try {
          await fs.access(outputPath)
          console.log(`[TV Docs] Manual already exists: ${outputPath}`)
          return { path: outputPath, url: result.url }
        } catch {
          // File doesn't exist, proceed with download
        }
        
        // Download based on type
        if (result.isPDF) {
          await downloadPDF(result.url, outputPath)
        } else {
          await downloadHTML(result.url, outputPath)
        }
        
        // Verify the file was created and has content
        const stats = await fs.stat(outputPath)
        if (stats.size > 1000) { // At least 1KB
          console.log(`[TV Docs] Successfully downloaded manual (${stats.size} bytes)`)
          return { path: outputPath, url: result.url }
        } else {
          console.warn(`[TV Docs] Downloaded file too small, trying next source`)
          await fs.unlink(outputPath).catch(() => {})
        }
      } catch (error) {
        console.error(`[TV Docs] Failed to download from ${result.url}:`, error)
        // Continue to next result
      }
    }
    
    console.warn(`[TV Docs] Could not download manual from any source`)
    return null
  } catch (error: any) {
    console.error('[TV Docs] Error in downloadTVManual:', error)
    throw new Error(`Failed to download manual: ${error.message}`)
  }
}

/**
 * Get the path to a manual if it exists
 */
export async function getManualPath(manufacturer: string, model: string): Promise<string | null> {
  try {
    const pdfFilename = generateManualFilename(manufacturer, model, true)
    const txtFilename = generateManualFilename(manufacturer, model, false)
    
    const pdfPath = path.join(MANUALS_DIR, pdfFilename)
    const txtPath = path.join(MANUALS_DIR, txtFilename)
    
    // Check PDF first
    try {
      await fs.access(pdfPath)
      return pdfPath
    } catch {}
    
    // Check TXT
    try {
      await fs.access(txtPath)
      return txtPath
    } catch {}
    
    return null
  } catch (error) {
    console.error('[TV Docs] Error checking manual path:', error)
    return null
  }
}

/**
 * List all downloaded manuals
 */
export async function listDownloadedManuals(): Promise<Array<{ filename: string; size: number; path: string }>> {
  try {
    await ensureManualsDirectory()
    
    const files = await fs.readdir(MANUALS_DIR)
    const manuals = []
    
    for (const file of files) {
      const filePath = path.join(MANUALS_DIR, file)
      const stats = await fs.stat(filePath)
      
      if (stats.isFile()) {
        manuals.push({
          filename: file,
          size: stats.size,
          path: filePath
        })
      }
    }
    
    return manuals
  } catch (error) {
    console.error('[TV Docs] Error listing manuals:', error)
    return []
  }
}
