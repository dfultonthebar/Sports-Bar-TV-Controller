#!/usr/bin/env tsx

/**
 * Query Online DirecTV Boxes for Detailed Information
 * Tests multiple SHEF API endpoints to get comprehensive device data
 */

const onlineDevices = [
  { name: 'Direct TV 1', ip: '192.168.5.121', port: 8080 },
  { name: 'Direct TV 2', ip: '192.168.5.122', port: 8080 }
]

// DirecTV SHEF API endpoints
const endpoints = [
  { path: '/info/getVersion', description: 'Software version' },
  { path: '/info/getOptions', description: 'Device options and capabilities' },
  { path: '/info/getLocations', description: 'Location/room information' },
  { path: '/info/mode', description: 'Current mode/state' },
  { path: '/tv/getTuned', description: 'Currently tuned channel' },
  { path: '/tv/getProgInfo', description: 'Current program information' }
]

async function queryEndpoint(ip: string, port: number, endpoint: string): Promise<{ success: boolean; data?: any; error?: string }> {
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

    if (response.ok) {
      const contentType = response.headers.get('content-type')
      let data

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      return { success: true, data }
    } else {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' }
    }
    return { success: false, error: error.message || 'Unknown error' }
  }
}

async function queryDevice(device: { name: string; ip: string; port: number }) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`${device.name} (${device.ip}:${device.port})`)
  console.log('='.repeat(80))

  for (const endpoint of endpoints) {
    console.log(`\n📡 ${endpoint.description}`)
    console.log(`   Endpoint: ${endpoint.path}`)
    process.stdout.write('   Status: ')

    const result = await queryEndpoint(device.ip, device.port, endpoint.path)

    if (result.success) {
      console.log('✓ Success')
      console.log('   Response:')

      if (typeof result.data === 'object') {
        console.log(JSON.stringify(result.data, null, 2).split('\n').map(line => '      ' + line).join('\n'))
      } else {
        // Format text response
        const dataStr = String(result.data)
        if (dataStr.length > 500) {
          console.log('      ' + dataStr.substring(0, 500) + '...')
          console.log(`      (truncated - ${dataStr.length} total characters)`)
        } else {
          dataStr.split('\n').forEach(line => {
            console.log('      ' + line)
          })
        }
      }
    } else {
      console.log(`✗ Failed`)
      console.log(`   Error: ${result.error}`)
    }
  }
}

async function main() {
  console.log('=' .repeat(80))
  console.log('DirecTV SHEF API Detailed Query')
  console.log('=' .repeat(80))
  console.log(`Querying ${onlineDevices.length} online DirecTV receivers`)
  console.log(`Timestamp: ${new Date().toISOString()}`)

  for (const device of onlineDevices) {
    await queryDevice(device)
  }

  console.log('\n' + '='.repeat(80))
  console.log('Query Complete')
  console.log('='.repeat(80))
}

main().catch(console.error)
