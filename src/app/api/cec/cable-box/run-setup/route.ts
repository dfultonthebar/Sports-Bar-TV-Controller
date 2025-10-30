/**
 * CEC Setup Script Runner API
 *
 * POST /api/cec/cable-box/run-setup
 * Runs the CEC device setup script to generate udev rules
 */

import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    console.log('[API] Running CEC setup script...')

    // Path to the setup script
    const scriptPath = path.join(process.cwd(), 'scripts', 'setup-cec-devices.sh')

    // Run the script with auto-confirmation (echo 'y' to simulate user input)
    const { stdout, stderr } = await execAsync(`echo 'y' | bash ${scriptPath}`, {
      timeout: 60000, // 60 second timeout
      cwd: process.cwd(),
    })

    const output = stdout + (stderr ? '\nErrors:\n' + stderr : '')

    console.log('[API] Setup script completed')
    console.log(output)

    return NextResponse.json({
      success: true,
      output,
      message: 'Setup script completed successfully',
    })
  } catch (error: any) {
    console.error('[API] Error running setup script:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run setup script',
        output: error.stdout || '',
      },
      { status: 500 }
    )
  }
}
