
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const iTachAddress = searchParams.get('address') || '192.168.1.100'

  try {
    const net = await import('net')
    
    return new Promise<NextResponse>((resolve) => {
      const socket = new net.Socket()
      let isResolved = false

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true
          socket.destroy()
          resolve(NextResponse.json({ connected: false, message: 'Connection timeout' }))
        }
      }, 3000)

      socket.connect(4998, iTachAddress, () => {
        console.log(`Connected to iTach at ${iTachAddress}:4998`)
        socket.write('getversion\r')
      })

      socket.on('data', (data) => {
        const response = data.toString().trim()
        console.log('iTach version response:', response)
        
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          socket.end()
          resolve(NextResponse.json({ 
            connected: true, 
            message: 'iTach connected successfully',
            version: response
          }))
        }
      })

      socket.on('error', (err) => {
        console.error('iTach connection error:', err)
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            connected: false, 
            message: `Connection failed: ${err.message}` 
          }))
        }
      })

      socket.on('close', () => {
        if (!isResolved) {
          isResolved = true
          clearTimeout(timeout)
          resolve(NextResponse.json({ 
            connected: false, 
            message: 'Connection closed unexpectedly' 
          }))
        }
      })
    })

  } catch (error) {
    console.error('Error testing iTach connection:', error)
    return NextResponse.json({ 
      connected: false, 
      message: `Test failed: ${error}` 
    }, { status: 500 })
  }
}
