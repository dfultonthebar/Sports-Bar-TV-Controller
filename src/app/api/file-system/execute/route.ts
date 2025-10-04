
import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs'

const execAsync = promisify(exec)

interface ExecuteRequest {
  command?: string
  scriptPath?: string
  args?: string[]
  workingDirectory?: string
  timeout?: number
}

export async function POST(request: NextRequest) {
  try {
    const { command, scriptPath, args = [] as any[], workingDirectory, timeout = 30000 }: ExecuteRequest = await request.json()

    if (!command && !scriptPath) {
      return NextResponse.json({ 
        error: 'Either command or scriptPath is required' 
      }, { status: 400 })
    }

    let execCommand: string
    let cwd = workingDirectory || process.cwd()

    if (scriptPath) {
      // Execute a script file
      const fullScriptPath = path.resolve(cwd, scriptPath)
      
      // Check if script exists
      if (!fs.existsSync(fullScriptPath)) {
        return NextResponse.json({
          error: `Script not found: ${fullScriptPath}`
        }, { status: 404 })
      }

      // Determine how to execute based on file extension
      const ext = path.extname(scriptPath)
      if (ext === '.sh') {
        execCommand = `bash "${fullScriptPath}" ${args.join(' ')}`
      } else if (ext === '.py') {
        execCommand = `python3 "${fullScriptPath}" ${args.join(' ')}`
      } else if (ext === '.js') {
        execCommand = `node "${fullScriptPath}" ${args.join(' ')}`
      } else {
        execCommand = `"${fullScriptPath}" ${args.join(' ')}`
      }
    } else {
      // Execute raw command
      execCommand = command!
    }

    console.log(`Executing: ${execCommand} in ${cwd}`)

    const { stdout, stderr } = await execAsync(execCommand, { 
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 // 1MB buffer
    })

    return NextResponse.json({
      success: true,
      stdout: stdout || '',
      stderr: stderr || '',
      command: execCommand,
      workingDirectory: cwd
    })

  } catch (error: any) {
    console.error('Execution error:', error)
    
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
