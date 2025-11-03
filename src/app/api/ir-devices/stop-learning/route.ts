
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { iTachAddress = '192.168.1.100' } = await request.json().catch(() => ({}))
    
    const net = await import('net')

    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket()
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          socket.destroy()
          resolve(NextResponse.json({ 
            success: false, 
            message: 'Connection timeout' 
          }, { status: 500 }))
        }
      }, 3000)

      socket.connect(4998, iTachAddress, () => {
        console.log(`Connected to iTach to stop learning at ${iTachAddress}:4998`)
        socket.write('stop_IRL\r')
      })

      socket.on('data', (data: Buffer) => {
        const response = data.toString().trim()
        console.log('Stop learning response:', response)
        
        if (response.includes('IR Learner Disabled') && !isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.end()
          resolve(NextResponse.json({ 
            success: true, 
            message: 'IR Learning mode disabled',
            learningActive: false
          }))
        }
      })

      socket.on('error', (err: Error) => {
        console.error('Stop learning connection error:', err)
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: false, 
            message: `Stop learning failed: ${err.message}` 
          }, { status: 500 }))
        }
      })

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: true, 
            message: 'Learning stopped (connection closed)'
          }))
        }
      })
    })

  } catch (error) {
    console.error('Error stopping IR learning:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Stop learning failed: ${error}` 
    }, { status: 500 })
  }
}
