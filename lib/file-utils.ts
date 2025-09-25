
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const mkdir = promisify(fs.mkdir)

export async function ensureUploadDir() {
  const uploadDir = path.join(process.cwd(), 'uploads')
  try {
    await mkdir(uploadDir, { recursive: true })
  } catch (error) {
    // Directory already exists
  }
  return uploadDir
}

export async function saveFile(buffer: Buffer, filename: string): Promise<string> {
  const uploadDir = await ensureUploadDir()
  const filePath = path.join(uploadDir, filename)
  await writeFile(filePath, buffer)
  return filePath
}

export async function readFileContent(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('Error reading file:', error)
    return ''
  }
}

export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const ext = path.extname(originalName)
  const name = path.basename(originalName, ext)
  return `${name}_${timestamp}_${random}${ext}`
}
