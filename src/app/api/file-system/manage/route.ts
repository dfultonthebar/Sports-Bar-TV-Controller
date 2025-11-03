
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas } from '@/lib/validation'

const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)
const mkdir = promisify(fs.mkdir)
const unlink = promisify(fs.unlink)
const rmdir = promisify(fs.rmdir)
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)

export async function GET(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { searchParams } = new URL(request.url)
    const directory = searchParams.get('directory') || process.cwd()
    const action = searchParams.get('action') || 'list'

    switch (action) {
      case 'list':
        return await listDirectory(directory)
      case 'tree':
        return await getDirectoryTree(directory, 3) // Max 3 levels deep
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({
      error: `Failed to ${request.url.includes('action=tree') ? 'get directory tree' : 'list directory'}: ${error.message}`
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (!bodyValidation.success) return bodyValidation.error

  // Query parameter validation
  const queryValidation = validateQueryParams(request, z.record(z.string()).optional())
  if (!queryValidation.success) return queryValidation.error


  try {
    const { action, path: targetPath, content, name } = await request.json()

    switch (action) {
      case 'create-file':
        return await createFile(targetPath, content || '')
      case 'create-directory':
        return await createDirectory(targetPath)
      case 'delete':
        return await deletePath(targetPath)
      case 'read-file':
        return await readFileContent(targetPath)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({
      error: `File system operation failed: ${error.message}`
    }, { status: 500 })
  }
}

async function listDirectory(directory: string) {
  const items = await readdir(directory)
  const details = await Promise.all(
    items.map(async (item) => {
      const itemPath = path.join(directory, item)
      const stats = await stat(itemPath)
      return {
        name: item,
        path: itemPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode.toString(8)
      }
    })
  )

  return NextResponse.json({
    directory,
    items: details.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  })
}

async function getDirectoryTree(directory: string, maxDepth: number = 3, currentDepth: number = 0): Promise<any> {
  if (currentDepth >= maxDepth) {
    return { name: path.basename(directory), type: 'directory', path: directory, children: [] as any[] }
  }

  try {
    const items = await readdir(directory)
    const children: any[] = []

    for (const item of items.slice(0, 50)) { // Limit to 50 items per directory
      const itemPath = path.join(directory, item)
      const stats = await stat(itemPath)

      if (stats.isDirectory()) {
        const subtree = await getDirectoryTree(itemPath, maxDepth, currentDepth + 1)
        children.push(subtree)
      } else {
        children.push({
          name: item,
          type: 'file',
          path: itemPath,
          size: stats.size
        })
      }
    }

    return {
      name: path.basename(directory) || directory,
      type: 'directory',
      path: directory,
      children: children.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    }
  } catch (error) {
    return {
      name: path.basename(directory),
      type: 'directory',
      path: directory,
      error: 'Access denied or not found'
    }
  }
}

async function createFile(filePath: string, content: string) {
  await writeFile(filePath, content, 'utf8')
  return NextResponse.json({
    success: true,
    message: `File created: ${filePath}`,
    path: filePath
  })
}

async function createDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true })
  return NextResponse.json({
    success: true,
    message: `Directory created: ${dirPath}`,
    path: dirPath
  })
}

async function deletePath(targetPath: string) {
  const stats = await stat(targetPath)
  
  if (stats.isDirectory()) {
    await rmdir(targetPath, { recursive: true })
  } else {
    await unlink(targetPath)
  }

  return NextResponse.json({
    success: true,
    message: `${stats.isDirectory() ? 'Directory' : 'File'} deleted: ${targetPath}`
  })
}

async function readFileContent(filePath: string) {
  const content = await readFile(filePath, 'utf8')
  const stats = await stat(filePath)
  
  return NextResponse.json({
    content,
    path: filePath,
    size: stats.size,
    modified: stats.mtime
  })
}
