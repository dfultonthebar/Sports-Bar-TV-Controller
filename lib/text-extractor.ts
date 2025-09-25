
import fs from 'fs/promises'
import path from 'path'

export async function extractTextFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    // For text files, read directly
    if (mimeType.startsWith('text/') || mimeType === 'application/json') {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    }
    
    // For PDFs and other documents, return basic info for now
    // This is a simplified implementation - you could add proper PDF parsing later
    const stats = await fs.stat(filePath)
    const filename = path.basename(filePath)
    
    return `Document: ${filename}\nFile Size: ${stats.size} bytes\nType: ${mimeType}\nUploaded: ${stats.mtime.toISOString()}`
    
  } catch (error) {
    console.error('Error extracting text from file:', error)
    return `Unable to extract text content from ${path.basename(filePath)}`
  }
}
