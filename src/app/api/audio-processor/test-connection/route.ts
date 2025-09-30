
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { processorId, ipAddress, port } = await request.json()

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }

    console.log(`Testing connection to AtlasIED Atmosphere at ${ipAddress}:${port || 80}`)

    // Test basic HTTP connectivity to the web interface
    const testUrl = `http://${ipAddress}:${port || 80}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Sports-Bar-AI-Assistant/1.0'
        }
      })
      
      clearTimeout(timeoutId)
      
      const isConnected = response.status >= 200 && response.status < 400
      
      // Update processor status in database if processorId provided
      if (processorId && isConnected) {
        await prisma.audioProcessor.update({
          where: { id: processorId },
          data: { 
            status: 'online',
            lastSeen: new Date()
          }
        })
      }

      return NextResponse.json({
        connected: isConnected,
        status: response.status,
        message: isConnected 
          ? 'Successfully connected to AtlasIED Atmosphere processor' 
          : `Connection failed with status ${response.status}`,
        webInterface: isConnected ? testUrl : null
      })
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        return NextResponse.json({
          connected: false,
          message: 'Connection timeout - device may be offline or unreachable',
          error: 'timeout'
        })
      }
      
      return NextResponse.json({
        connected: false,
        message: `Connection failed: ${fetchError.message}`,
        error: fetchError.code || 'connection_failed'
      })
    }
    
  } catch (error) {
    console.error('Error testing audio processor connection:', error)
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    )
  }
}
