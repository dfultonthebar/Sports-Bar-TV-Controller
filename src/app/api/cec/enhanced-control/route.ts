

import { NextRequest, NextResponse } from 'next/server'
import prisma from "@/lib/prisma"
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  try {
    const { command, target = '0' } = await request.json()
    
    if (!command) {
      return NextResponse.json({ 
        success: false, 
        error: 'Command is required' 
      }, { status: 400 })
    }

    // Get CEC configuration
    const cecConfig = await prisma.cECConfiguration.findFirst()
    if (!cecConfig || !cecConfig.isEnabled) {
      return NextResponse.json({ 
        success: false, 
        error: 'CEC is not properly configured or enabled' 
      }, { status: 400 })
    }

    const devicePath = cecConfig.usbDevicePath || '/dev/ttyACM0'
    
    console.log(`Sending enhanced CEC command: ${command} to target ${target} via ${devicePath}`)
    
    try {
      // Check if cec-client is available
      try {
        await execAsync('which cec-client')
      } catch (error) {
        console.error('cec-client not found. Please install libcec-utils package.')
        return NextResponse.json({ 
          success: false, 
          error: 'cec-client not installed. Please install libcec-utils package.' 
        }, { status: 500 })
      }

      // Build the cec-client command
      const cecCommand = `echo "${command} ${target}" | cec-client -s -d 1 ${devicePath}`
      
      console.log(`Executing CEC command: ${cecCommand}`)
      
      const { stdout, stderr } = await execAsync(cecCommand, { timeout: 10000 })
      
      console.log('CEC command stdout:', stdout)
      if (stderr) {
        console.error('CEC command stderr:', stderr)
      }
      
      // Check if command was successful
      const success = stdout.includes('TRAFFIC') || stdout.includes('power status changed')
      
      return NextResponse.json({
        success,
        command,
        target,
        output: stdout,
        error: stderr || undefined,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('CEC USB command failed:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'CEC command execution failed: ' + error 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in enhanced CEC control:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Enhanced CEC control failed: ' + error 
    }, { status: 500 })
  }
}

