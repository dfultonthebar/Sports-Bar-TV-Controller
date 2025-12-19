
import { promises as fs } from 'fs'
import path from 'path'

import { logger } from '@sports-bar/logger'
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const ext = path.extname(originalName)
  const name = path.basename(originalName, ext)
  return `${timestamp}-${name}${ext}`
}

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  await fs.mkdir(uploadsDir, { recursive: true })
  
  const filepath = path.join(uploadsDir, filename)
  await fs.writeFile(filepath, buffer)
  
  return filepath
}

export async function saveUploadedFile(file: File, uploadDir: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${Date.now()}-${file.name}`
  const filepath = path.join(uploadDir, filename)
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  
  // Save file
  await fs.writeFile(filepath, buffer)
  
  return filepath
}

export async function deleteFile(filepath: string): Promise<void> {
  try {
    await fs.unlink(filepath)
  } catch (error) {
    logger.error('Error deleting file:', error)
    // Don't throw error if file doesn't exist
  }
}

export function getFileExtension(filename: string): string {
  return path.extname(filename).toLowerCase()
}

export function isValidFileType(filename: string, allowedTypes: string[]): boolean {
  const ext = getFileExtension(filename)
  return allowedTypes.includes(ext)
}

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true })
}
