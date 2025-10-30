import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(exec)

export const dynamic = 'force-dynamic'

/**
 * Get recent CEC command logs from PM2
 */
export async function GET() {
  try {
    // Get last 500 lines from pm2 logs and filter for CEC-related entries
    const { stdout } = await execPromise(
      'pm2 logs sports-bar-tv-controller --lines 500 --nostream 2>&1 | grep -E "Executing CEC|CEC stdout|CEC command|deviceResponded|power status" | tail -100',
      { timeout: 5000 }
    )

    // Parse log lines into structured format
    const logLines = stdout.trim().split('\n').filter(line => line.length > 0)

    const logs = logLines.map(line => {
      // Extract timestamp if present
      const timestampMatch = line.match(/\[([\d-]+T[\d:.]+Z)\]/)
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString()

      // Extract log level
      const levelMatch = line.match(/\[(DEBUG|INFO|ERROR|SUCCESS)\]/)
      const level = levelMatch ? levelMatch[1] : 'INFO'

      // Get the message after the log level
      const messageStart = line.indexOf(']', line.indexOf('[', 10)) + 1
      const message = line.substring(messageStart).trim()

      return {
        timestamp,
        level,
        message,
        raw: line
      }
    })

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      logs: [],
      count: 0
    }, { status: 500 })
  }
}
