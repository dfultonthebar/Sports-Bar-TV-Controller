
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * Validates and cleans IP address format
 * Removes any invalid suffixes like /F90 or other non-standard formats
 */
function cleanIpAddress(ipAddress: string): string {
  // Remove any trailing slash and content after it
  const cleaned = ipAddress.split('/')[0].trim()
  
  // Validate IP address format (basic validation)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
  if (!ipRegex.test(cleaned)) {
    throw new Error(`Invalid IP address format: ${ipAddress}`)
  }
  
  // Validate each octet is 0-255
  const octets = cleaned.split('.')
  for (const octet of octets) {
    const num = parseInt(octet, 10)
    if (num < 0 || num > 255) {
      throw new Error(`Invalid IP address octet: ${octet}`)
    }
  }
  
  return cleaned
}

/**
 * Tests connection to Atlas processor using multiple protocols
 * Atlas processors typically use:
 * - Port 80 for HTTP web interface
 * - Port 443 for HTTPS/SSL (cloud communications)
 */
async function testProcessorConnection(ipAddress: string, port: number, timeout: number = 10000) {
  const protocols = [
    { protocol: 'http', port: port || 80 },
    { protocol: 'https', port: 443 }
  ]
  
  const results = []
  
  for (const { protocol, port: testPort } of protocols) {
    const testUrl = `${protocol}://${ipAddress}:${testPort}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    try {
      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Sports-Bar-AI-Assistant/1.0'
        },
        // Disable SSL verification for self-signed certificates
        // @ts-ignore - Node.js specific option
        rejectUnauthorized: false
      })
      
      clearTimeout(timeoutId)
      
      const isConnected = response.status >= 200 && response.status < 500
      
      results.push({
        protocol,
        port: testPort,
        connected: isConnected,
        status: response.status,
        url: testUrl
      })
      
      // If we get a successful connection, we can stop testing
      if (isConnected) {
        return { success: true, result: results[results.length - 1], allResults: results }
      }
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      results.push({
        protocol,
        port: testPort,
        connected: false,
        error: fetchError.name === 'AbortError' ? 'timeout' : fetchError.message,
        url: testUrl
      })
    }
  }
  
  return { success: false, allResults: results }
}

export async function POST(request: NextRequest) {
  try {
    const { processorId, ipAddress, port } = await request.json()

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }

    // Clean and validate IP address
    let cleanedIp: string
    try {
      cleanedIp = cleanIpAddress(ipAddress)
      if (cleanedIp !== ipAddress) {
        console.log(`Cleaned IP address from "${ipAddress}" to "${cleanedIp}"`)
      }
    } catch (error: any) {
      return NextResponse.json({
        connected: false,
        error: 'invalid_ip',
        message: error.message,
        suggestion: 'Please check the IP address format. It should be in the format: 192.168.1.100'
      }, { status: 400 })
    }

    console.log(`Testing connection to AtlasIED Atmosphere at ${cleanedIp}:${port || 80}`)

    // Test connection with multiple protocols
    const testResult = await testProcessorConnection(cleanedIp, port || 80, 10000)
    
    if (testResult.success && testResult.result) {
      // Update processor status in database if processorId provided
      if (processorId) {
        await prisma.audioProcessor.update({
          where: { id: processorId },
          data: { 
            status: 'online',
            lastSeen: new Date(),
            // Update IP address if it was cleaned
            ...(cleanedIp !== ipAddress ? { ipAddress: cleanedIp } : {})
          }
        })
      }

      return NextResponse.json({
        connected: true,
        status: testResult.result.status,
        protocol: testResult.result.protocol,
        port: testResult.result.port,
        message: `Successfully connected to AtlasIED Atmosphere processor via ${testResult.result.protocol.toUpperCase()}`,
        webInterface: testResult.result.url,
        ipCleaned: cleanedIp !== ipAddress,
        originalIp: ipAddress,
        cleanedIp: cleanedIp,
        allResults: testResult.allResults
      })
    } else {
      // Update processor status to offline if processorId provided
      if (processorId) {
        await prisma.audioProcessor.update({
          where: { id: processorId },
          data: { 
            status: 'offline',
            // Update IP address if it was cleaned
            ...(cleanedIp !== ipAddress ? { ipAddress: cleanedIp } : {})
          }
        })
      }
      
      return NextResponse.json({
        connected: false,
        message: 'Unable to connect to processor on any protocol',
        error: 'connection_failed',
        ipCleaned: cleanedIp !== ipAddress,
        originalIp: ipAddress,
        cleanedIp: cleanedIp,
        allResults: testResult.allResults,
        troubleshooting: {
          steps: [
            '1. Verify the processor is powered on and connected to the network',
            '2. Check that the IP address is correct (cleaned to: ' + cleanedIp + ')',
            '3. Ensure the processor is on the same network or accessible via routing',
            '4. Try accessing the web interface directly in a browser: http://' + cleanedIp,
            '5. Check firewall settings - Atlas uses ports 80 (HTTP) and 443 (HTTPS)',
            '6. Verify network connectivity with: ping ' + cleanedIp
          ]
        }
      })
    }
    
  } catch (error) {
    console.error('Error testing audio processor connection:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
