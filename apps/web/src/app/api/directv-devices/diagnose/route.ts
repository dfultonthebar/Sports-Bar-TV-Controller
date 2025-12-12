import { NextRequest, NextResponse } from 'next/server'
import { withRateLimit } from '@/lib/rate-limiting/middleware'
import { RateLimitConfigs } from '@/lib/rate-limiting/rate-limiter'

import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateRequestBody, validateQueryParams, validatePathParams, ValidationSchemas, isValidationError, isValidationSuccess} from '@/lib/validation'
interface DiagnosticResult {
  test: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
}

async function runDiagnostics(ip: string, port: number): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = []

  // Test 1: Basic network connectivity (ping-like test)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)

    const startTime = Date.now()
    const response = await fetch(`http://${ip}:${port}/`, {
      method: 'GET',
      headers: { 'User-Agent': 'Sports-Bar-Controller/1.0' },
      signal: controller.signal
    }).catch(err => ({ ok: false, status: 0, error: err }))

    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime

    if ('error' in response) {
      const err = response.error as any
      if (err.message?.includes('ECONNREFUSED')) {
        results.push({
          test: 'Network Connectivity',
          status: 'fail',
          message: `Connection refused - receiver may be offline or IP ${ip} is incorrect`,
          details: { error: 'ECONNREFUSED', ip, port }
        })
      } else if (err.message?.includes('ETIMEDOUT') || err.name === 'AbortError') {
        results.push({
          test: 'Network Connectivity',
          status: 'fail',
          message: `Connection timeout - receiver not responding at ${ip}:${port}`,
          details: { error: 'TIMEOUT', ip, port }
        })
      } else {
        results.push({
          test: 'Network Connectivity',
          status: 'fail',
          message: `Network error: ${err.message || 'Unknown error'}`,
          details: { error: err.message, ip, port }
        })
      }
    } else {
      results.push({
        test: 'Network Connectivity',
        status: 'pass',
        message: `Receiver reachable at ${ip}:${port} (${responseTime}ms)`,
        details: { responseTime, status: response.status }
      })
    }
  } catch (error: any) {
    results.push({
      test: 'Network Connectivity',
      status: 'fail',
      message: `Unable to reach ${ip}:${port}`,
      details: { error: error.message }
    })
  }

  // Test 2: SHEF API /info/getOptions endpoint
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`http://${ip}:${port}/info/getOptions`, {
      method: 'GET',
      headers: { 'User-Agent': 'Sports-Bar-Controller/1.0' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.text()
      results.push({
        test: 'SHEF API - Info Endpoint',
        status: 'pass',
        message: 'SHEF API responding correctly',
        details: { status: response.status, dataPreview: data.substring(0, 100) }
      })
    } else if (response.status === 403) {
      const body = await response.text().catch(() => '')
      results.push({
        test: 'SHEF API - Info Endpoint',
        status: 'fail',
        message: 'HTTP 403 Forbidden - External Access may be disabled or receiver needs restart',
        details: { status: 403, body: body.substring(0, 200) }
      })
    } else {
      results.push({
        test: 'SHEF API - Info Endpoint',
        status: 'warning',
        message: `HTTP ${response.status}: ${response.statusText}`,
        details: { status: response.status }
      })
    }
  } catch (error: any) {
    results.push({
      test: 'SHEF API - Info Endpoint',
      status: 'fail',
      message: `Failed to access SHEF API: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Test 3: SHEF API /remote/processKey endpoint (the one used for commands)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    // Use a harmless test command
    const response = await fetch(`http://${ip}:${port}/remote/processKey?key=KEY_INFO&hold=keyPress`, {
      method: 'GET',
      headers: { 'User-Agent': 'Sports-Bar-Controller/1.0' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      results.push({
        test: 'SHEF API - Remote Control Endpoint',
        status: 'pass',
        message: 'Remote control endpoint accessible - DirecTV control should work!',
        details: { status: response.status }
      })
    } else if (response.status === 403) {
      const body = await response.text().catch(() => '')
      results.push({
        test: 'SHEF API - Remote Control Endpoint',
        status: 'fail',
        message: 'HTTP 403 Forbidden - External Access disabled or receiver needs full restart',
        details: {
          status: 403,
          body: body.substring(0, 200),
          recommendation: 'Try: 1) Verify External Access is ON, 2) Power cycle receiver (unplug 30 seconds), 3) Check IP address is correct'
        }
      })
    } else {
      results.push({
        test: 'SHEF API - Remote Control Endpoint',
        status: 'warning',
        message: `HTTP ${response.status}: ${response.statusText}`,
        details: { status: response.status }
      })
    }
  } catch (error: any) {
    results.push({
      test: 'SHEF API - Remote Control Endpoint',
      status: 'fail',
      message: `Failed to access remote endpoint: ${error.message}`,
      details: { error: error.message }
    })
  }

  // Test 4: Check if we can get version info
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`http://${ip}:${port}/info/getVersion`, {
      method: 'GET',
      headers: { 'User-Agent': 'Sports-Bar-Controller/1.0' },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.text()
      results.push({
        test: 'SHEF API - Version Info',
        status: 'pass',
        message: 'Successfully retrieved version information',
        details: { versionData: data }
      })
    } else {
      results.push({
        test: 'SHEF API - Version Info',
        status: 'warning',
        message: `HTTP ${response.status}: Could not get version info`,
        details: { status: response.status }
      })
    }
  } catch (error: any) {
    results.push({
      test: 'SHEF API - Version Info',
      status: 'warning',
      message: 'Version endpoint not accessible (non-critical)',
      details: { error: error.message }
    })
  }

  return results
}

export async function POST(request: NextRequest) {
  const rateLimit = await withRateLimit(request, RateLimitConfigs.HARDWARE)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }


  // Input validation
  const bodyValidation = await validateRequestBody(request, z.record(z.unknown()))
  if (isValidationError(bodyValidation)) return bodyValidation.error


  try {
    const { ipAddress, port } = bodyValidation.data

    if (!ipAddress) {
      return NextResponse.json(
        { error: 'IP address is required' },
        { status: 400 }
      )
    }

    const targetPort = port || 8080

    logger.info(`Running DirecTV diagnostics for ${ipAddress}:${targetPort}`)

    const results = await runDiagnostics(ipAddress, targetPort)

    // Determine overall status
    const hasFailures = results.some(r => r.status === 'fail')
    const hasWarnings = results.some(r => r.status === 'warning')
    const allPass = results.every(r => r.status === 'pass')

    let summary = ''
    let recommendations: string[] = []

    if (allPass) {
      summary = '✅ All diagnostics passed! DirecTV control should be working.'
    } else if (hasFailures) {
      summary = '❌ Issues detected with DirecTV connection'

      // Provide specific recommendations based on failures
      const networkFail = results.find(r => r.test === 'Network Connectivity' && r.status === 'fail')
      const shefFail = results.find(r => r.test.includes('Remote Control') && r.status === 'fail')

      if (networkFail) {
        recommendations.push('Check that the DirecTV receiver IP address is correct')
        recommendations.push('Verify the receiver is powered on and connected to network')
        recommendations.push('Ensure receiver and server are on the same network/VLAN')
      }

      if (shefFail?.details?.status === 403) {
        recommendations.push('Verify External Access is enabled: MENU → Settings & Help → Settings → Whole-Home → External Device → Enable')
        recommendations.push('IMPORTANT: Power cycle the DirecTV receiver completely (unplug for 30 seconds)')
        recommendations.push('After power cycle, wait 2-3 minutes for receiver to fully boot')
        recommendations.push('Check if receiver firewall or parental controls are blocking access')
      }
    } else if (hasWarnings) {
      summary = '⚠️ Partial connectivity - some features may not work'
    }

    return NextResponse.json({
      success: !hasFailures,
      summary,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      ipAddress,
      port: targetPort,
      diagnostics: results,
      testedAt: new Date().toISOString()
    })

  } catch (error) {
    logger.error('DirecTV Diagnostics Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to run diagnostics',
        success: false
      },
      { status: 500 }
    )
  }
}
