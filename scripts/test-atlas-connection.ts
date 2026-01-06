#!/usr/bin/env ts-node

/**
 * Atlas Connection Test Script
 * 
 * Tests TCP connection to Atlas processor and verifies:
 * 1. Connection establishment on port 5321
 * 2. JSON-RPC 2.0 command/response protocol
 * 3. Parameter read (get) operations
 * 4. Parameter write (set) operations
 * 5. Subscription functionality
 * 
 * Usage:
 *   ts-node scripts/test-atlas-connection.ts <ip-address> [username] [password]
 * 
 * Example:
 *   ts-node scripts/test-atlas-connection.ts 192.168.5.101
 */

import * as net from 'net'

// Configuration
const args = process.argv.slice(2)
const ATLAS_IP = args[0] || '192.168.5.101'
const ATLAS_PORT = 5321
const ATLAS_USERNAME = args[1] || 'admin'
const ATLAS_PASSWORD = args[2] || 'admin'

// Test parameters
const TEST_ZONE_INDEX = 0  // Test Zone 1 (0-based)
const TEST_SOURCE_INDEX = 0  // Test Source 1 (0-based)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60))
  log(`  ${title}`, colors.bright + colors.cyan)
  console.log('='.repeat(60) + '\n')
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green)
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red)
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue)
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow)
}

/**
 * Test TCP connection to Atlas processor
 */
async function testConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    logSection('Testing TCP Connection')
    logInfo(`Connecting to ${ATLAS_IP}:${ATLAS_PORT}...`)
    
    const client = new net.Socket()
    let connected = false
    
    const timeout = setTimeout(() => {
      if (!connected) {
        logError(`Connection timeout after 5 seconds`)
        client.destroy()
        resolve(false)
      }
    }, 5000)
    
    client.connect(ATLAS_PORT, ATLAS_IP, () => {
      connected = true
      clearTimeout(timeout)
      logSuccess(`Connected to Atlas processor at ${ATLAS_IP}:${ATLAS_PORT}`)
      client.end()
      resolve(true)
    })
    
    client.on('error', (error) => {
      clearTimeout(timeout)
      logError(`Connection failed: ${error.message}`)
      resolve(false)
    })
  })
}

/**
 * Test JSON-RPC command/response
 */
async function testCommand(
  param: string,
  method: 'get' | 'set' | 'sub',
  value?: number
): Promise<any> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    let responseBuffer = ''
    
    const timeout = setTimeout(() => {
      logWarning(`Command timeout for ${param}`)
      client.destroy()
      reject(new Error('Command timeout'))
    }, 3000)
    
    client.connect(ATLAS_PORT, ATLAS_IP, () => {
      const command: any = {
        jsonrpc: '2.0',
        method,
        id: 1
      }
      
      if (method === 'get' || method === 'sub') {
        command.params = {
          param,
          fmt: 'val'
        }
      } else if (method === 'set') {
        command.params = {
          param,
          val: value
        }
      }
      
      const commandStr = JSON.stringify(command) + '\r\n'
      logInfo(`Sending: ${commandStr.trim()}`)
      client.write(commandStr)
    })
    
    client.on('data', (data) => {
      responseBuffer += data.toString()
      
      // Check for complete message (terminated with \r\n)
      if (responseBuffer.includes('\r\n')) {
        clearTimeout(timeout)
        const messages = responseBuffer.split('\r\n').filter(m => m.trim())
        
        for (const msg of messages) {
          try {
            const response = JSON.parse(msg)
            logSuccess(`Received: ${JSON.stringify(response, null, 2)}`)
            client.end()
            resolve(response)
            return
          } catch (err) {
            logWarning(`Invalid JSON response: ${msg}`)
          }
        }
        
        client.end()
        reject(new Error('No valid JSON response'))
      }
    })
    
    client.on('error', (error) => {
      clearTimeout(timeout)
      logError(`Error: ${error.message}`)
      reject(error)
    })
  })
}

/**
 * Test reading zone source
 */
async function testReadZoneSource(): Promise<void> {
  logSection('Test: Read Zone Source')
  try {
    const param = `ZoneSource_${TEST_ZONE_INDEX}`
    const response = await testCommand(param, 'get')
    
    if (response.result !== undefined) {
      logSuccess(`Zone ${TEST_ZONE_INDEX + 1} current source: ${response.result}`)
    } else if (response.error) {
      logError(`Error reading zone source: ${response.error.message || JSON.stringify(response.error)}`)
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Test reading zone volume
 */
async function testReadZoneVolume(): Promise<void> {
  logSection('Test: Read Zone Volume')
  try {
    const param = `ZoneGain_${TEST_ZONE_INDEX}`
    const response = await testCommand(param, 'get')
    
    if (response.result !== undefined) {
      logSuccess(`Zone ${TEST_ZONE_INDEX + 1} current volume: ${response.result} dB`)
    } else if (response.error) {
      logError(`Error reading zone volume: ${response.error.message || JSON.stringify(response.error)}`)
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Test reading source gain
 */
async function testReadSourceGain(): Promise<void> {
  logSection('Test: Read Source Gain')
  try {
    const param = `SourceGain_${TEST_SOURCE_INDEX}`
    const response = await testCommand(param, 'get')
    
    if (response.result !== undefined) {
      logSuccess(`Source ${TEST_SOURCE_INDEX + 1} current gain: ${response.result} dB`)
    } else if (response.error) {
      logError(`Error reading source gain: ${response.error.message || JSON.stringify(response.error)}`)
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Test setting zone volume
 */
async function testSetZoneVolume(volumeDb: number): Promise<void> {
  logSection(`Test: Set Zone Volume to ${volumeDb} dB`)
  try {
    const param = `ZoneGain_${TEST_ZONE_INDEX}`
    const response = await testCommand(param, 'set', volumeDb)
    
    if (response.result === 'OK' || !response.error) {
      logSuccess(`Successfully set Zone ${TEST_ZONE_INDEX + 1} volume to ${volumeDb} dB`)
    } else if (response.error) {
      logError(`Error setting zone volume: ${response.error.message || JSON.stringify(response.error)}`)
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Test subscription
 */
async function testSubscription(): Promise<void> {
  logSection('Test: Parameter Subscription')
  logWarning('Note: Subscription test requires monitoring for update messages')
  logWarning('This test will subscribe but may not receive immediate updates')
  
  try {
    const param = `ZoneGain_${TEST_ZONE_INDEX}`
    const response = await testCommand(param, 'sub')
    
    if (response.result === 'OK' || !response.error) {
      logSuccess(`Successfully subscribed to ${param}`)
      logInfo('Update messages will be received when the parameter changes')
    } else if (response.error) {
      logError(`Error subscribing: ${response.error.message || JSON.stringify(response.error)}`)
    }
  } catch (error) {
    logError(`Test failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('\n')
  log('╔════════════════════════════════════════════════════════════╗', colors.bright + colors.cyan)
  log('║          Atlas Atmosphere TCP Connection Test Tool         ║', colors.bright + colors.cyan)
  log('╚════════════════════════════════════════════════════════════╝', colors.bright + colors.cyan)
  console.log('\n')
  
  logInfo(`Target: ${ATLAS_IP}:${ATLAS_PORT}`)
  logInfo(`Protocol: JSON-RPC 2.0 over TCP`)
  logInfo(`Message Terminator: \\r\\n`)
  console.log('\n')
  
  // Test 1: Basic connection
  const connected = await testConnection()
  if (!connected) {
    logError('\nConnection test failed. Cannot proceed with further tests.')
    logInfo('\nTroubleshooting:')
    logInfo('1. Verify the Atlas processor is powered on')
    logInfo('2. Check the IP address is correct')
    logInfo('3. Ensure the processor is on the same network')
    logInfo('4. Verify port 5321 is not blocked by firewall')
    logInfo('5. Try accessing the web interface: http://' + ATLAS_IP)
    process.exit(1)
  }
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 2: Read zone source
  await testReadZoneSource()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 3: Read zone volume
  await testReadZoneVolume()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 4: Read source gain
  await testReadSourceGain()
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 5: Set zone volume (careful - this will actually change the volume!)
  logWarning('\nSkipping volume change test to avoid unexpected audio changes')
  logInfo('To test volume changes, uncomment the testSetZoneVolume call in the script')
  // await testSetZoneVolume(-40)
  // await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Test 6: Subscription
  await testSubscription()
  
  // Summary
  logSection('Test Summary')
  logSuccess('All connection tests completed!')
  logInfo('\nNext Steps:')
  logInfo('1. Review the responses above to verify communication')
  logInfo('2. Check that parameter names match your Atlas configuration')
  logInfo('3. Test with the web UI to confirm end-to-end functionality')
  logInfo('4. Check logs/atlas-communication.log for detailed logging')
  console.log('\n')
}

// Run tests
runTests().catch((error) => {
  logError(`\nFatal error: ${error.message}`)
  process.exit(1)
})
