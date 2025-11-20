#!/usr/bin/env tsx

/**
 * DirecTV Box Investigation Script
 * Tests all 8 DirecTV receivers to determine connectivity status
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface DirecTVDevice {
  id: string
  name: string
  ipAddress: string
  port: number
  receiverType: string
  inputChannel: number
  isOnline: boolean
}

interface DeviceTestResult {
  device: DirecTVDevice
  ping: {
    success: boolean
    time?: number
    error?: string
  }
  port: {
    open: boolean
    error?: string
  }
  api: {
    responding: boolean
    version?: string
    model?: string
    error?: string
    responseTime?: number
  }
  diagnosis: string
}

const devices: DirecTVDevice[] = [
  {
    id: "directv_1759187217790",
    name: "Direct TV 1",
    ipAddress: "192.168.5.121",
    port: 8080,
    receiverType: "h24/100",
    inputChannel: 5,
    isOnline: true
  },
  {
    id: "directv_1759187265011",
    name: "Direct TV 2",
    ipAddress: "192.168.5.122",
    port: 8080,
    receiverType: "h24/100",
    inputChannel: 6,
    isOnline: false
  },
  {
    id: "directv_1759187398411",
    name: "Direct TV 3",
    ipAddress: "192.168.5.123",
    port: 8080,
    receiverType: "h24/100",
    inputChannel: 7,
    isOnline: false
  },
  {
    id: "directv_1759187444390",
    name: "Direct TV 4",
    ipAddress: "192.168.1.124",
    port: 8080,
    receiverType: "Genie HD DVR",
    inputChannel: 8,
    isOnline: false
  },
  {
    id: "directv_1759187476373",
    name: "Direct TV 5",
    ipAddress: "192.168.1.125",
    port: 8080,
    receiverType: "Genie HD DVR",
    inputChannel: 9,
    isOnline: false
  },
  {
    id: "directv_1759187508606",
    name: "Direct TV 6",
    ipAddress: "192.168.1.126",
    port: 8080,
    receiverType: "Genie HD DVR",
    inputChannel: 10,
    isOnline: false
  },
  {
    id: "directv_1759187540487",
    name: "Direct TV 7",
    ipAddress: "192.168.1.127",
    port: 8080,
    receiverType: "Genie HD DVR",
    inputChannel: 11,
    isOnline: false
  },
  {
    id: "directv_1759187570875",
    name: "Direct TV 8",
    ipAddress: "192.168.1.128",
    port: 8080,
    receiverType: "Genie HD DVR",
    inputChannel: 12,
    isOnline: false
  }
]

async function testPing(ip: string): Promise<{ success: boolean; time?: number; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(`ping -c 1 -W 2 ${ip}`)

    if (stderr && !stdout) {
      return { success: false, error: stderr.trim() }
    }

    // Parse ping time
    const timeMatch = stdout.match(/time[=\s]+([0-9.]+)\s*ms/i)
    const time = timeMatch ? parseFloat(timeMatch[1]) : undefined

    return { success: true, time }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Ping failed'
    }
  }
}

async function testPort(ip: string, port: number): Promise<{ open: boolean; error?: string }> {
  try {
    // Use nc (netcat) to test if port is open
    const { stdout, stderr } = await execAsync(`nc -zv -w 2 ${ip} ${port} 2>&1`)

    const output = stdout + stderr

    // Check for success indicators
    if (output.includes('succeeded') || output.includes('open')) {
      return { open: true }
    } else {
      return { open: false, error: output.trim() }
    }
  } catch (error: any) {
    // nc returns non-zero exit code when connection fails
    const output = error.stdout + error.stderr
    if (output.includes('Connection refused')) {
      return { open: false, error: 'Connection refused (port closed)' }
    } else if (output.includes('Connection timed out')) {
      return { open: false, error: 'Connection timed out (host may be offline)' }
    } else if (output.includes('No route to host')) {
      return { open: false, error: 'No route to host (network unreachable)' }
    }
    return { open: false, error: error.message || 'Port test failed' }
  }
}

async function testDirecTVAPI(ip: string, port: number): Promise<{
  responding: boolean
  version?: string
  model?: string
  error?: string
  responseTime?: number
}> {
  const startTime = Date.now()

  try {
    // Try multiple endpoints
    const endpoints = [
      `/info/getVersion`,
      `/info/getOptions`,
      `/info/getLocations`,
      `/remote/processKey?key=KEY_INFO&hold=keyPress`
    ]

    for (const endpoint of endpoints) {
      try {
        const url = `http://${ip}:${port}${endpoint}`
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': 'Sports-Bar-Investigation/1.0' },
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        const responseTime = Date.now() - startTime

        if (response.ok) {
          const text = await response.text()

          // Try to parse version and model info
          const versionMatch = text.match(/version["\s]*[:=]\s*["']?([^"',\s}]+)/i)
          const modelMatch = text.match(/model["\s]*[:=]\s*["']?([^"',\s}]+)/i)

          return {
            responding: true,
            version: versionMatch ? versionMatch[1] : undefined,
            model: modelMatch ? modelMatch[1] : undefined,
            responseTime
          }
        }
      } catch (err) {
        // Try next endpoint
        continue
      }
    }

    return {
      responding: false,
      error: 'All API endpoints failed to respond',
      responseTime: Date.now() - startTime
    }

  } catch (error: any) {
    const responseTime = Date.now() - startTime

    if (error.name === 'AbortError') {
      return { responding: false, error: 'Request timed out', responseTime }
    } else if (error.message?.includes('ECONNREFUSED')) {
      return { responding: false, error: 'Connection refused', responseTime }
    } else if (error.message?.includes('ETIMEDOUT')) {
      return { responding: false, error: 'Connection timed out', responseTime }
    } else {
      return { responding: false, error: error.message || 'Unknown error', responseTime }
    }
  }
}

function diagnoseIssue(result: DeviceTestResult): string {
  const { ping, port, api } = result

  if (!ping.success) {
    if (ping.error?.includes('Network is unreachable')) {
      return 'Network unreachable - server may not have route to this subnet'
    }
    return 'Device not responding to ping - likely offline or wrong IP'
  }

  if (!port.open) {
    if (port.error?.includes('Connection refused')) {
      return 'Device is online but port 8080 is closed - SHEF API may be disabled'
    } else if (port.error?.includes('Connection timed out')) {
      return 'Port connection timed out - firewall may be blocking traffic'
    } else if (port.error?.includes('No route to host')) {
      return 'No route to host - network configuration issue'
    }
    return 'Port 8080 is not accessible'
  }

  if (!api.responding) {
    return `Port is open but DirecTV SHEF API not responding - ${api.error || 'unknown reason'}`
  }

  return 'Device is fully operational'
}

async function testDevice(device: DirecTVDevice): Promise<DeviceTestResult> {
  console.log(`\nTesting ${device.name} (${device.ipAddress})...`)

  // Test 1: Ping
  process.stdout.write('  [1/3] Ping test... ')
  const ping = await testPing(device.ipAddress)
  console.log(ping.success ? `✓ (${ping.time}ms)` : `✗ ${ping.error}`)

  // Test 2: Port check
  process.stdout.write('  [2/3] Port 8080 test... ')
  const port = await testPort(device.ipAddress, device.port)
  console.log(port.open ? '✓ Open' : `✗ ${port.error}`)

  // Test 3: API test (only if port is open)
  process.stdout.write('  [3/3] DirecTV API test... ')
  const api = port.open
    ? await testDirecTVAPI(device.ipAddress, device.port)
    : { responding: false, error: 'Port not open, skipping API test' }

  if (api.responding) {
    console.log(`✓ Responding (${api.responseTime}ms)`)
    if (api.version) console.log(`      Version: ${api.version}`)
    if (api.model) console.log(`      Model: ${api.model}`)
  } else {
    console.log(`✗ ${api.error}`)
  }

  const result: DeviceTestResult = {
    device,
    ping,
    port,
    api,
    diagnosis: ''
  }

  result.diagnosis = diagnoseIssue(result)

  return result
}

async function main() {
  console.log('=' .repeat(80))
  console.log('DirecTV Box Investigation Report')
  console.log('=' .repeat(80))
  console.log(`Testing ${devices.length} DirecTV receivers...`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  const results: DeviceTestResult[] = []

  for (const device of devices) {
    const result = await testDevice(device)
    results.push(result)
  }

  // Summary Report
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY REPORT')
  console.log('='.repeat(80))

  const onlineCount = results.filter(r => r.api.responding).length
  const offlineCount = results.length - onlineCount

  console.log(`\n📊 Overall Status:`)
  console.log(`   Online:  ${onlineCount}/${results.length} devices`)
  console.log(`   Offline: ${offlineCount}/${results.length} devices`)

  // Group by subnet
  const subnet5 = results.filter(r => r.device.ipAddress.startsWith('192.168.5.'))
  const subnet1 = results.filter(r => r.device.ipAddress.startsWith('192.168.1.'))

  console.log(`\n🌐 Network Distribution:`)
  console.log(`   Subnet 192.168.5.x: ${subnet5.length} devices (${subnet5.filter(r => r.api.responding).length} online)`)
  console.log(`   Subnet 192.168.1.x: ${subnet1.length} devices (${subnet1.filter(r => r.api.responding).length} online)`)

  // Detailed results
  console.log('\n' + '='.repeat(80))
  console.log('DETAILED RESULTS')
  console.log('='.repeat(80))

  for (const result of results) {
    const status = result.api.responding ? '✅ ONLINE' : '❌ OFFLINE'
    console.log(`\n### ${result.device.name} (${result.device.ipAddress}:${result.device.port}) ${status}`)
    console.log(`Receiver Type: ${result.device.receiverType}`)
    console.log(`Input Channel: ${result.device.inputChannel}`)
    console.log(`\nTest Results:`)
    console.log(`  • Ping: ${result.ping.success ? `✓ Success (${result.ping.time}ms)` : `✗ Failed - ${result.ping.error}`}`)
    console.log(`  • Port 8080: ${result.port.open ? '✓ Open' : `✗ Closed - ${result.port.error}`}`)
    console.log(`  • SHEF API: ${result.api.responding ? `✓ Responding (${result.api.responseTime}ms)` : `✗ Not responding - ${result.api.error}`}`)

    if (result.api.responding) {
      if (result.api.version) console.log(`  • Version: ${result.api.version}`)
      if (result.api.model) console.log(`  • Model: ${result.api.model}`)
    }

    console.log(`\n📋 Diagnosis: ${result.diagnosis}`)
  }

  // Root cause analysis
  console.log('\n' + '='.repeat(80))
  console.log('ROOT CAUSE ANALYSIS')
  console.log('='.repeat(80))

  console.log('\n🔍 Why Are Devices Offline?')

  const pingFailures = results.filter(r => !r.ping.success)
  const portClosed = results.filter(r => r.ping.success && !r.port.open)
  const apiFailures = results.filter(r => r.port.open && !r.api.responding)

  if (pingFailures.length > 0) {
    console.log(`\n1. Network Unreachable (${pingFailures.length} devices):`)
    pingFailures.forEach(r => {
      console.log(`   • ${r.device.name} (${r.device.ipAddress})`)
      console.log(`     Issue: ${r.ping.error}`)
    })
  }

  if (portClosed.length > 0) {
    console.log(`\n2. Port 8080 Closed (${portClosed.length} devices):`)
    portClosed.forEach(r => {
      console.log(`   • ${r.device.name} (${r.device.ipAddress})`)
      console.log(`     Issue: ${r.port.error}`)
    })
  }

  if (apiFailures.length > 0) {
    console.log(`\n3. API Not Responding (${apiFailures.length} devices):`)
    apiFailures.forEach(r => {
      console.log(`   • ${r.device.name} (${r.device.ipAddress})`)
      console.log(`     Issue: ${r.api.error}`)
    })
  }

  // Recommendations
  console.log('\n' + '='.repeat(80))
  console.log('RECOMMENDATIONS')
  console.log('='.repeat(80))

  console.log('\n💡 Action Items:')

  if (subnet1.filter(r => !r.ping.success).length > 0) {
    console.log('\n1. Network Route Issue (192.168.1.x subnet):')
    console.log('   • The server (192.168.5.x) may not have routing to 192.168.1.x')
    console.log('   • Check: ip route | grep 192.168.1')
    console.log('   • Fix: Add route or ensure both subnets are accessible')
  }

  if (portClosed.length > 0) {
    console.log('\n2. Enable DirecTV SHEF API:')
    console.log('   • On each receiver: Menu > Settings > Whole-Home > External Device > SHEF')
    console.log('   • Or: Settings > Network > Network Remote Control > Enable')
    console.log('   • Verify port 8080 is open on the receiver')
  }

  if (results.filter(r => r.device.ipAddress.startsWith('192.168.1.')).length > 0) {
    console.log('\n3. Verify IP Addresses:')
    console.log('   • Devices on 192.168.1.x may have changed IPs')
    console.log('   • Check actual IPs: Menu > Settings > Info & Test > Network')
    console.log('   • Update device-subscriptions.json with correct IPs')
  }

  console.log('\n' + '='.repeat(80))
  console.log('End of Report')
  console.log('='.repeat(80))
}

main().catch(console.error)
