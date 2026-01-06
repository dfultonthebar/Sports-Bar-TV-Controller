
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
const writeFile = promisify(fs.writeFile)
const chmod = promisify(fs.chmod)
const mkdir = promisify(fs.mkdir)

interface WriteScriptRequest {
  scriptName: string
  content: string
  scriptType: 'bash' | 'python' | 'javascript' | 'powershell' | 'config'
  directory?: string
  makeExecutable?: boolean
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  try {
    const { scriptName, content, scriptType, directory = 'scripts', makeExecutable = true }: WriteScriptRequest = await request.json()

    if (!scriptName || !content || !scriptType) {
      return NextResponse.json({ 
        error: 'Script name, content, and type are required' 
      }, { status: 400 })
    }

    // Determine file extension based on script type
    const extensions = {
      bash: '.sh',
      python: '.py',
      javascript: '.js',
      powershell: '.ps1',
      config: '.conf'
    }

    const extension = extensions[scriptType] || '.txt'
    const fileName = scriptName.endsWith(extension) ? scriptName : `${scriptName}${extension}`

    // Create scripts directory in project root
    const scriptsDir = path.join(process.cwd(), directory)
    await mkdir(scriptsDir, { recursive: true })

    // Full file path
    const filePath = path.join(scriptsDir, fileName)

    // Add appropriate shebang for script types
    let scriptContent = content
    if (scriptType === 'bash' && !content.startsWith('#!')) {
      scriptContent = '#!/bin/bash\n\n' + content
    } else if (scriptType === 'python' && !content.startsWith('#!')) {
      scriptContent = '#!/usr/bin/env python3\n\n' + content
    }

    // Write the script file
    await writeFile(filePath, scriptContent, 'utf8')

    // Make executable if requested (for bash/python scripts)
    if (makeExecutable && (scriptType === 'bash' || scriptType === 'python')) {
      await chmod(filePath, '755')
    }

    return NextResponse.json({
      success: true,
      filePath,
      fileName,
      directory: scriptsDir,
      message: `Script '${fileName}' successfully written to ${filePath}`
    })

  } catch (error) {
    logger.error('Script write error:', error)
    return NextResponse.json({
      error: 'Failed to write script to file system'
    }, { status: 500 })
  }
}
