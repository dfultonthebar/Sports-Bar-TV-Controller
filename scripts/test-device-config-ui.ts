import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

interface NetworkLog {
  timestamp: string
  method: string
  url: string
  status?: number
  resourceType: string
  requestBody?: string
  responseBody?: string
  error?: string
}

interface TestResults {
  pageLoaded: boolean
  consoleErrors: string[]
  networkErrors: NetworkLog[]
  successfulRequests: NetworkLog[]
  visibleErrorMessages: string[]
  screenshots: string[]
  tabs: {
    name: string
    found: boolean
  }[]
}

const TIMEOUT = 30000
const BASE_URL = 'http://localhost:3001'
const SCREENSHOT_DIR = '/tmp/ui-screenshots'

async function captureScreenshot(
  page: Page,
  filename: string,
  description?: string
): Promise<string> {
  const filepath = path.join(SCREENSHOT_DIR, filename)
  try {
    await page.screenshot({
      path: filepath,
      fullPage: true
    })
    console.log(`[SCREENSHOT] ${filename}`)
    return filepath
  } catch (error) {
    console.error(`[ERROR] Failed to capture ${filename}:`, error)
    return ''
  }
}

async function testDeviceConfigPage(): Promise<TestResults> {
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  let page: Page | null = null
  const networkLog: NetworkLog[] = []

  const results: TestResults = {
    pageLoaded: false,
    consoleErrors: [],
    networkErrors: [],
    successfulRequests: [],
    visibleErrorMessages: [],
    screenshots: [],
    tabs: []
  }

  try {
    console.log('[TEST] Starting Device Config Page Tests...')
    console.log(`[CONFIG] Base URL: ${BASE_URL}`)
    console.log(`[CONFIG] Screenshot Directory: ${SCREENSHOT_DIR}`)

    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })

    page = await context.newPage()

    // Setup console listener
    page.on('console', (msg) => {
      const logType = msg.type()
      const text = msg.text()

      if (logType === 'error') {
        console.error(`[BROWSER ERROR] ${text}`)
        results.consoleErrors.push(text)
      } else if (logType === 'warn') {
        console.warn(`[BROWSER WARN] ${text}`)
      } else if (logType === 'log') {
        console.log(`[BROWSER LOG] ${text}`)
      }
    })

    // Setup request/response logging

    page.on('response', async (response) => {
      const request = response.request()
      const url = response.url()
      const status = response.status()
      const resourceType = request.resourceType()

      const logEntry: NetworkLog = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url,
        status,
        resourceType
      }

      // Log failed requests
      if (status >= 400) {
        try {
          logEntry.responseBody = await response.text()
        } catch (e) {
          logEntry.responseBody = '[Unable to read response body]'
        }
        console.error(`[NETWORK ERROR] ${status} ${request.method()} ${url}`)
        results.networkErrors.push(logEntry)
      } else {
        results.successfulRequests.push(logEntry)
      }

      networkLog.push(logEntry)
    })

    // Test 1: Navigate to device-config page
    console.log('\n[TEST 1] Navigating to device-config page...')
    try {
      await page.goto(`${BASE_URL}/device-config`, {
        waitUntil: 'networkidle',
        timeout: TIMEOUT
      })
      results.pageLoaded = true
      console.log('[SUCCESS] Page loaded successfully')
      results.screenshots.push(
        await captureScreenshot(page, '01-device-config-initial.png', 'Initial page load')
      )
    } catch (error: any) {
      console.error('[ERROR] Failed to navigate to page:', error.message)
      results.screenshots.push(
        await captureScreenshot(page, '01-device-config-error.png', 'Navigation error state')
      )
    }

    // Test 2: Wait for page to fully load and capture console state
    console.log('\n[TEST 2] Capturing console state...')
    await page.waitForTimeout(2000)
    results.screenshots.push(
      await captureScreenshot(page, '02-device-config-console-state.png', 'After full load')
    )

    // Test 3: Check for visible error messages on page
    console.log('\n[TEST 3] Checking for visible error messages...')
    const errorElements = await page.locator('[class*="error"], [role="alert"], .text-red-500, .bg-red-900').all()
    for (const elem of errorElements) {
      try {
        const text = await elem.textContent()
        if (text) {
          console.log(`[ERROR MESSAGE] ${text}`)
          results.visibleErrorMessages.push(text)
        }
      } catch (e) {
        // Element may have been removed
      }
    }

    // Test 4: Check all tabs exist
    console.log('\n[TEST 4] Checking for tabs...')
    const expectedTabs = [
      'Channel Presets',
      'DirecTV',
      'Fire TV',
      'Global Cache',
      'IR Devices',
      'Soundtrack',
      'CEC Discovery',
      'IR Learning',
      'Subscriptions'
    ]

    for (const tabName of expectedTabs) {
      const tabButton = page.locator(`button:has-text("${tabName}")`)
      const isVisible = await tabButton.isVisible().catch(() => false)
      results.tabs.push({
        name: tabName,
        found: isVisible
      })
      console.log(`[TAB] ${tabName}: ${isVisible ? 'FOUND' : 'NOT FOUND'}`)
    }

    // Test 5: Click each tab and check for errors
    console.log('\n[TEST 5] Testing tab interactions...')
    for (const tabName of expectedTabs) {
      console.log(`[TAB TEST] Clicking "${tabName}"...`)
      try {
        const tabButton = page.locator(`button:has-text("${tabName}")`)
        if (await tabButton.isVisible()) {
          await tabButton.click()
          await page.waitForTimeout(1000) // Wait for tab animation
          results.screenshots.push(
            await captureScreenshot(page, `03-tab-${tabName.toLowerCase().replace(/\s+/g, '-')}.png`, `Tab: ${tabName}`)
          )
        }
      } catch (error: any) {
        console.error(`[ERROR] Failed to test tab "${tabName}":`, error.message)
      }
    }

    // Test 6: Look for JSON parse errors in network responses
    console.log('\n[TEST 6] Analyzing network responses...')
    for (const log of networkLog) {
      if (log.status && log.status >= 400) {
        console.log(`[FAILED REQUEST] ${log.status} - ${log.url}`)
        if (log.responseBody) {
          // Check for JSON parse errors
          if (log.responseBody.includes('JSON.parse') || log.responseBody.includes('SyntaxError')) {
            console.error(`[JSON ERROR] ${log.url}`)
            console.error(`Body: ${log.responseBody.substring(0, 500)}`)
          }
        }
      }
    }

    // Test 7: Check localStorage and sessionStorage
    console.log('\n[TEST 7] Checking storage...')
    const storageData = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage).reduce((acc, key) => {
          acc[key] = localStorage.getItem(key)
          return acc
        }, {} as Record<string, any>),
        sessionStorage: Object.keys(sessionStorage).reduce((acc, key) => {
          acc[key] = sessionStorage.getItem(key)
          return acc
        }, {} as Record<string, any>)
      }
    })
    console.log('[STORAGE] localStorage:', Object.keys(storageData.localStorage))
    console.log('[STORAGE] sessionStorage:', Object.keys(storageData.sessionStorage))

    // Test 8: Test AI Enhancement toggle
    console.log('\n[TEST 8] Testing AI Enhancement toggle...')
    try {
      const aiButton = page.locator('button:has-text("Enable AI"), button:has-text("Enabled")')
      if (await aiButton.isVisible()) {
        console.log('[AI TOGGLE] Found AI toggle button')
        await aiButton.click()
        await page.waitForTimeout(1000)
        results.screenshots.push(
          await captureScreenshot(page, '04-ai-enhancements-enabled.png', 'AI Enhancements toggled on')
        )
      } else {
        console.log('[INFO] AI toggle button not visible')
      }
    } catch (error: any) {
      console.error('[ERROR] Failed to test AI toggle:', error.message)
    }

    // Test 9: Get page performance metrics
    console.log('\n[TEST 9] Capturing performance metrics...')
    const metrics = await page.evaluate(() => {
      const nav = window.performance.getEntriesByType('navigation')[0] as any
      return {
        domContentLoaded: nav?.domContentLoadedEventEnd - nav?.domContentLoadedEventStart,
        loadComplete: nav?.loadEventEnd - nav?.loadEventStart,
        totalTime: nav?.loadEventEnd - nav?.fetchStart
      }
    })
    console.log('[PERFORMANCE]', metrics)

    // Final screenshot
    console.log('\n[TEST 10] Capturing final state...')
    results.screenshots.push(
      await captureScreenshot(page, '05-device-config-final.png', 'Final page state')
    )

  } catch (error: any) {
    console.error('[FATAL ERROR]', error)
  } finally {
    // Save detailed report
    if (page) {
      console.log('\n[REPORT] Saving detailed test report...')
      const report = {
        timestamp: new Date().toISOString(),
        baseUrl: BASE_URL,
        results,
        networkLog: networkLog.map(log => ({
          ...log,
          responseBody: log.responseBody ? log.responseBody.substring(0, 1000) : undefined
        }))
      }

      const reportPath = path.join(SCREENSHOT_DIR, 'device-config-test-report.json')
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(`[REPORT] Saved to ${reportPath}`)

      // Print summary
      console.log('\n========== TEST SUMMARY ==========')
      console.log(`Page Loaded: ${results.pageLoaded ? 'YES' : 'NO'}`)
      console.log(`Console Errors: ${results.consoleErrors.length}`)
      console.log(`Network Errors: ${results.networkErrors.length}`)
      console.log(`Visible Error Messages: ${results.visibleErrorMessages.length}`)
      console.log(`Screenshots Captured: ${results.screenshots.length}`)
      console.log(`Tabs Found: ${results.tabs.filter(t => t.found).length}/${results.tabs.length}`)
      console.log('==================================\n')

      if (results.consoleErrors.length > 0) {
        console.log('CONSOLE ERRORS:')
        results.consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`))
      }

      if (results.networkErrors.length > 0) {
        console.log('\nNETWORK ERRORS:')
        results.networkErrors.forEach((err, i) =>
          console.log(`  ${i + 1}. [${err.status}] ${err.method} ${err.url}`)
        )
      }

      if (results.visibleErrorMessages.length > 0) {
        console.log('\nVISIBLE ERROR MESSAGES:')
        results.visibleErrorMessages.forEach((msg, i) => console.log(`  ${i + 1}. ${msg}`))
      }
    }

    // Cleanup
    if (page) await page.close()
    if (context) await context.close()
    if (browser) await browser.close()

    console.log('\n[COMPLETE] Device Config UI Tests finished')
  }
}

// Run tests
testDeviceConfigPage().catch((error) => {
  console.error('[FATAL]', error)
  process.exit(1)
})
