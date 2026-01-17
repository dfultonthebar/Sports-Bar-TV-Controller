
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'
import { requireAuth, logAuditAction } from '@/lib/auth'

import { logger } from '@sports-bar/logger'
import { validateRequestBody, ValidationSchemas, isValidationError } from '@/lib/validation'

// Allowed base directories for script execution (security)
const ALLOWED_BASE_DIRS = [
  '/home/ubuntu/Sports-Bar-TV-Controller',
  process.cwd()
]

export async function POST(request: NextRequest) {
  // Authentication required - ADMIN only
  const authResult = await requireAuth(request, 'ADMIN', {
    auditAction: 'file_system_execute',
    requirePin: false
  })
  if (!authResult.allowed) {
    return authResult.response || NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  // Input validation (schema includes refine check for command OR scriptPath)
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.scriptExecution)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { command, scriptPath, args = [], workingDirectory, timeout = 30000 } = bodyValidation.data

    const cwd = workingDirectory || process.cwd()
    let interpreter: string
    let execArgs: string[]

    // Security: Validate working directory is within allowed paths
    const resolvedCwd = path.resolve(cwd)
    const isAllowedCwd = ALLOWED_BASE_DIRS.some(baseDir =>
      resolvedCwd.startsWith(path.resolve(baseDir))
    )
    if (!isAllowedCwd) {
      logger.warn('[FILE-SYSTEM] Blocked path traversal attempt', { cwd: resolvedCwd })
      return NextResponse.json({
        error: 'Working directory is outside allowed paths'
      }, { status: 403 })
    }

    if (scriptPath) {
      // Execute a script file
      const fullScriptPath = path.resolve(cwd, scriptPath)

      // Security: Validate script path is within allowed directories
      const isAllowedPath = ALLOWED_BASE_DIRS.some(baseDir =>
        fullScriptPath.startsWith(path.resolve(baseDir))
      )
      if (!isAllowedPath) {
        logger.warn('[FILE-SYSTEM] Blocked path traversal in scriptPath', { path: fullScriptPath })
        return NextResponse.json({
          error: 'Script path is outside allowed directories'
        }, { status: 403 })
      }

      // Check if script exists
      if (!fs.existsSync(fullScriptPath)) {
        return NextResponse.json({
          error: `Script not found: ${fullScriptPath}`
        }, { status: 404 })
      }

      // Determine interpreter based on file extension
      const ext = path.extname(scriptPath)
      if (ext === '.sh') {
        interpreter = 'bash'
      } else if (ext === '.py') {
        interpreter = 'python3'
      } else if (ext === '.js') {
        interpreter = 'node'
      } else {
        // For unknown extensions, try executing directly
        interpreter = fullScriptPath
        execArgs = args
      }

      if (ext === '.sh' || ext === '.py' || ext === '.js') {
        execArgs = [fullScriptPath, ...args]
      }
    } else {
      // For raw commands, use sh -c to maintain compatibility
      interpreter = 'sh'
      execArgs = ['-c', command!]
    }

    logger.info('[FILE-SYSTEM] Executing command', { interpreter, args: execArgs.join(' '), cwd })

    // Use spawn for safe execution with timeout
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
      const proc = spawn(interpreter, execArgs, {
        cwd,
        timeout
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('error', (error) => {
        reject(error)
      })

      proc.on('close', (code) => {
        resolve({ stdout, stderr, code })
      })

      // Handle timeout
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGTERM')
          reject(new Error(`Command timed out after ${timeout}ms`))
        }
      }, timeout)
    })

    return NextResponse.json({
      success: true,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      code: result.code,
      command: scriptPath ? `${interpreter} ${scriptPath}` : command,
      workingDirectory: cwd
    })

  } catch (error: any) {
    logger.error('[FILE-SYSTEM] Execution error', { error: error.message })

    return NextResponse.json({
      success: false,
      error: error.message || 'Command execution failed',
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      code: error.code,
      signal: error.signal
    }, { status: 500 })
  }
}
