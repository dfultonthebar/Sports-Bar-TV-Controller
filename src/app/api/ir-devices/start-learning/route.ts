
import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

let learningSocket: any = null

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { iTachAddress = '192.168.1.100' } = await request.json().catch(() => ({}))
    
    const net = await import('net')

    // Close existing learning session if any
    if (learningSocket) {
      learningSocket.destroy()
      learningSocket = null
    }

    return new Promise<NextResponse>((resolve) => {
      learningSocket = new net.Socket()
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          if (learningSocket) learningSocket.destroy()
          resolve(NextResponse.json({ 
            success: false, 
            message: 'Connection timeout' 
          }, { status: 500 }))
        }
      }, 5000)

      learningSocket.connect(4998, iTachAddress, () => {
        console.log(`Connected to iTach for learning at ${iTachAddress}:4998`)
        learningSocket.write('get_IRL\r')
      })

      learningSocket.on('data', (data: Buffer) => {
        const response = data.toString().trim()
        console.log('Learning response:', response)
        
        if (response.includes('IR Learner Enabled') && !isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: true, 
            message: 'IR Learning mode enabled. Point remote at iTach and press a button.',
            learningActive: true
          }))
        } else if (response.includes('IR Learner Unavailable') && !isResolved) {
          isResolved = true
          clearTimeout(timeout)
          if (learningSocket) learningSocket.destroy()
          resolve(NextResponse.json({ 
            success: false, 
            message: 'IR Learner unavailable (may be in LED mode)' 
          }, { status: 400 }))
        } else if (response.startsWith('sendir,') && !isResolved) {
          // Captured IR code
          console.log('Learned IR code:', response)
          resolve(NextResponse.json({ 
            success: true, 
            message: 'IR code learned successfully!',
            learnedCode: response
          }))
        }
      })

      learningSocket.on('error', (err: Error) => {
        console.error('Learning connection error:', err)
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: false, 
            message: `Learning failed: ${err.message}` 
          }, { status: 500 }))
        }
      })

      learningSocket.on('close', () => {
        console.log('Learning connection closed')
        learningSocket = null
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            success: false, 
            message: 'Learning connection closed unexpectedly' 
          }, { status: 500 }))
        }
      })
    })

  } catch (error) {
    console.error('Error starting IR learning:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Learning start failed: ${error}` 
    }, { status: 500 })
  }
}
