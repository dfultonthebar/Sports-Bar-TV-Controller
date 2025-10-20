import { NextRequest, NextResponse } from 'next/server'
import { schema } from '@/db'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { update } from '@/lib/db-helpers'
import { createAuthHeaders, testCredentials, ATLAS_DEFAULT_CREDENTIALS, encryptPassword } from '@/lib/atlas-auth'

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
 * Tests connection to Atlas processor using multiple protocols and authentication
 * Atlas processors typically use:
 * - Port 80 for HTTP web interface
 * - Port 443 for HTTPS/SSL (cloud communications)
 * - HTTP Basic Authentication (username/password)
 */
async function testProcessorConnection(
  ipAddress: string, 
  port: number, 
  username?: string,
  password?: string,
  timeout: number = 10000
) {
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
        headers: createAuthHeaders(username, password),
        // Disable SSL verification for self-signed certificates
        // @ts-ignore - Node.js specific option
        rejectUnauthorized: false
      })
      
      clearTimeout(timeoutId)
      
      // Check if authentication is required
      const requiresAuth = response.status === 401 || response.status === 403
      const isConnected = response.status >= 200 && response.status < 500
      
      results.push({
        protocol,
        port: testPort,
        connected: isConnected,
        status: response.status,
        requiresAuth,
        authenticated: !requiresAuth && isConnected,
        url: testUrl
      })
      
      // If we get a successful connection (authenticated or no auth required), we can stop testing
      if (isConnected && !requiresAuth) {
        return { success: true, result: results[results.length - 1], allResults: results }
      }
      
      // If auth is required but we haven't provided credentials, note it
      if (requiresAuth && (!username || !password)) {
        return { 
          success: false, 
          requiresAuth: true,
          result: results[results.length - 1],
          allResults: results 
        }
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
  logger.api.request('POST', '/api/audio-processor/test-connection')
  
  try {
    const { processorId, ipAddress, port, username, password, autoDetectCredentials } = await request.json()

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

    // If auto-detect credentials is enabled, try common credential combinations
    if (autoDetectCredentials && (!username || !password)) {
      console.log('Auto-detecting credentials...')
      
      const credentialsList = [
        { username: ATLAS_DEFAULT_CREDENTIALS.username, password: ATLAS_DEFAULT_CREDENTIALS.password },
        ...ATLAS_DEFAULT_CREDENTIALS.alternativePasswords.map(pwd => ({
          username: ATLAS_DEFAULT_CREDENTIALS.username,
          password: pwd
        }))
      ]

      const credentialTest = await testCredentials(cleanedIp, port || 80, credentialsList)
      
      if (credentialTest.success && credentialTest.credentials) {
        // Found working credentials
        const workingCreds = credentialTest.credentials
        
        // Update processor with working credentials if processorId provided
        if (processorId && typeof processorId === 'string' && processorId.length > 0) {
          try {
            await update('audioProcessors',
              eq(schema.audioProcessors.id, processorId),
              { 
                status: 'online',
                lastSeen: new Date().toISOString(),
                ipAddress: cleanedIp,
                username: workingCreds.username,
                password: encryptPassword(workingCreds.password)
              }
            )
          } catch (dbError) {
            console.error('Failed to update processor in database:', dbError)
            // Continue with response even if DB update fails
          }
        }

        return NextResponse.json({
          connected: true,
          authenticated: true,
          credentialsFound: true,
          username: workingCreds.username,
          message: `Successfully connected with credentials: ${workingCreds.username}`,
          webInterface: `http://${cleanedIp}:${port || 80}`,
          ipCleaned: cleanedIp !== ipAddress,
          originalIp: ipAddress,
          cleanedIp: cleanedIp
        })
      }
    }

    // Test connection with provided or no credentials
    const testResult = await testProcessorConnection(cleanedIp, port || 80, username, password, 10000)
    
    if (testResult.success && testResult.result) {
      // Update processor status in database if processorId provided
      if (processorId && typeof processorId === 'string' && processorId.length > 0) {
        try {
          const updateData: any = { 
            status: 'online',
            lastSeen: new Date().toISOString(),
            ipAddress: cleanedIp
          }
          
          // Store credentials if provided
          if (username && password) {
            updateData.username = username
            updateData.password = encryptPassword(password)
          }
          
          await update('audioProcessors',
            eq(schema.audioProcessors.id, processorId),
            updateData
          )
        } catch (dbError) {
          console.error('Failed to update processor in database:', dbError)
          // Continue with response even if DB update fails
        }
      }

      return NextResponse.json({
        connected: true,
        authenticated: testResult.result.authenticated,
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
    } else if (testResult.requiresAuth) {
      // Processor requires authentication
      return NextResponse.json({
        connected: true,
        authenticated: false,
        requiresAuth: true,
        message: 'Processor requires authentication. Please provide username and password.',
        defaultCredentials: {
          username: ATLAS_DEFAULT_CREDENTIALS.username,
          password: ATLAS_DEFAULT_CREDENTIALS.password,
          note: 'Try these common default credentials. Default is usually admin/admin.'
        },
        webInterface: `http://${cleanedIp}:${port || 80}`,
        ipCleaned: cleanedIp !== ipAddress,
        originalIp: ipAddress,
        cleanedIp: cleanedIp,
        allResults: testResult.allResults
      })
    } else {
      // Update processor status to offline if processorId provided
      if (processorId && typeof processorId === 'string' && processorId.length > 0) {
        try {
          await update('audioProcessors',
            eq(schema.audioProcessors.id, processorId),
            { 
              status: 'offline',
              ipAddress: cleanedIp
            }
          )
        } catch (dbError) {
          console.error('Failed to update processor status in database:', dbError)
          // Continue with response even if DB update fails
        }
      }
      
      return NextResponse.json({
        connected: false,
        message: 'Unable to connect to processor',
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
            '6. Verify network connectivity with: ping ' + cleanedIp,
            '7. If authentication is required, provide username and password (default: admin/admin)'
          ]
        }
      })
    }
    
  } catch (error: any) {
    logger.api.error('POST', '/api/audio-processor/test-connection', error)
    return NextResponse.json(
      { 
        error: 'Failed to test connection',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
