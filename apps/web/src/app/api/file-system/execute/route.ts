
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'

interface ExecuteRequest {
  command?: string
  scriptPath?: string
  args?: string[]
  workingDirectory?: string
  timeout?: number
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.FILE_OPS)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, ValidationSchemas.scriptExecution)
  if (isValidationError(bodyValidation)) return bodyValidation.error

  try {
    const { command, scriptPath, args = [] as any[], workingDirectory, timeout = 30000 } = bodyValidation.data as ExecuteRequest

    if (!command && !scriptPath) {
      return NextResponse.json({
        error: 'Either command or scriptPath is required'
      }, { status: 400 })
    }

    const cwd = workingDirectory || process.cwd()
    let interpreter: string
    let execArgs: string[]

    if (scriptPath) {
      // Execute a script file
      const fullScriptPath = path.resolve(cwd, scriptPath)

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

    logger.info(`Executing: ${interpreter} ${execArgs.join(' ')} in ${cwd}`)

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
    logger.error('Execution error:', error)

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
