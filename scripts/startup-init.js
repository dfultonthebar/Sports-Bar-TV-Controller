
#!/usr/bin/env node

/**
 * Startup Initialization Script
 * This script is called by PM2 after the application starts
 * It initializes the Wolf Pack connection
 */

const http = require('http')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
const MAX_RETRIES = 10
const RETRY_DELAY = 3000 // 3 seconds

async function waitForServer(retries = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(APP_URL)
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: '/api/startup',
      method: 'GET',
      timeout: 5000
    }

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log('✓ Server is ready')
        resolve(true)
      } else {
        if (retries < MAX_RETRIES) {
          console.log(`Server not ready (status ${res.statusCode}), retrying in ${RETRY_DELAY/1000}s... (${retries + 1}/${MAX_RETRIES})`)
          setTimeout(() => {
            waitForServer(retries + 1).then(resolve).catch(reject)
          }, RETRY_DELAY)
        } else {
          reject(new Error('Server did not become ready in time'))
        }
      }
    })

    req.on('error', (error) => {
      if (retries < MAX_RETRIES) {
        console.log(`Server not ready (${error.message}), retrying in ${RETRY_DELAY/1000}s... (${retries + 1}/${MAX_RETRIES})`)
        setTimeout(() => {
          waitForServer(retries + 1).then(resolve).catch(reject)
        }, RETRY_DELAY)
      } else {
        reject(error)
      }
    })

    req.on('timeout', () => {
      req.destroy()
      if (retries < MAX_RETRIES) {
        console.log(`Server timeout, retrying in ${RETRY_DELAY/1000}s... (${retries + 1}/${MAX_RETRIES})`)
        setTimeout(() => {
          waitForServer(retries + 1).then(resolve).catch(reject)
        }, RETRY_DELAY)
      } else {
        reject(new Error('Server timeout'))
      }
    })

    req.end()
  })
}

async function initializeConnection() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${APP_URL}/api/startup`)
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }

    console.log(`Calling startup endpoint: ${APP_URL}/api/startup`)

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.success) {
            console.log('✓ Startup initialization completed successfully')
            resolve(true)
          } else {
            console.error('✗ Startup initialization failed:', result.error)
            resolve(false)
          }
        } catch (error) {
          console.error('✗ Error parsing response:', error)
          resolve(false)
        }
      })
    })

    req.on('error', (error) => {
      console.error('✗ Error calling startup endpoint:', error.message)
      resolve(false)
    })

    req.on('timeout', () => {
      req.destroy()
      console.error('✗ Startup endpoint timeout')
      resolve(false)
    })

    req.end()
  })
}

async function main() {
  console.log('=== Sports Bar TV Controller - Startup Initialization ===')
  console.log(`Target URL: ${APP_URL}`)
  console.log('')

  try {
    // Wait for server to be ready
    console.log('Waiting for server to be ready...')
    await waitForServer()
    
    // Give it a moment to fully initialize
    console.log('Server ready, waiting 2 seconds before initialization...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Initialize connection
    console.log('Running startup initialization...')
    const success = await initializeConnection()
    
    if (success) {
      console.log('')
      console.log('=== Startup Complete ===')
      process.exit(0)
    } else {
      console.log('')
      console.log('=== Startup Completed with Warnings ===')
      process.exit(0) // Exit successfully even if connection failed
    }
  } catch (error) {
    console.error('Fatal error during startup:', error)
    process.exit(1)
  }
}

main()
