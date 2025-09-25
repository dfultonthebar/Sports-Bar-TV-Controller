
import fs from 'fs/promises'
import path from 'path'

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  
  // Create uploads directory if it doesn't exist
  try {
    await fs.access(uploadsDir)
  } catch {
    await fs.mkdir(uploadsDir, { recursive: true })
  }
  
  const filePath = path.join(uploadsDir, filename)
  await fs.writeFile(filePath, buffer)
  
  return filePath
}

export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  const extension = path.extname(originalName)
  const basename = path.basename(originalName, extension)
  
  return `${basename}-${timestamp}-${random}${extension}`
}
