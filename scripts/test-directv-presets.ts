import { chromium, Browser, Page, BrowserContext } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import sqlite3 from 'sqlite3'

interface ChannelPreset {
  id: string
  name: string
  channelNumber: string
  deviceType: string
}

interface DirecTVDevice {
  id: string
  name: string
  ipAddress?: string
  ip?: string
  status?: string
}

interface TestResult {
  presetId: string
  presetName: string
  channelNumber: string
  status: 'success' | 'failure' | 'skipped'
  reason?: string
  duration: number
  timestamp: string
}

const SCREENSHOT_DIR = '/tmp/directv-preset-tests'
const REPORT_FILE = '/tmp/directv-preset-tests/report.json'
const BASE_URL = 'http://localhost:3001'

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function getDirectTVPresets(): Promise<ChannelPreset[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database('/home/ubuntu/sports-bar-data/production.db')
    db.all(
      'SELECT id, name, channelNumber, deviceType FROM ChannelPreset WHERE deviceType = "directv" ORDER BY "order" ASC',
      (err: any, rows: any[]) => {
        if (err) reject(err)
        else resolve(rows || [])
        db.close()
      }
    )
  })
}

async function getDirectTVDevices(): Promise<DirecTVDevice[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/directv-devices`)
    const devices = await response.json()
    return Array.isArray(devices) ? devices : devices.data || []
  } catch (error) {
    console.error('Failed to fetch DirecTV devices:', error)
    return []
  }
}

async function getCurrentChannelFromDevice(ipAddress: string): Promise<string | null> {
  try {
    const response = await fetch(`http://${ipAddress}:8080/tv/getTuned`, { timeout: 5000 })
    const data = await response.json()
    return data?.tuned?.[0]?.major?.toString() || null
  } catch (error) {
    return null
  }
}

async function testDirectTVPresets() {
  console.log('Starting DirecTV Preset Test Suite')
  console.log('==================================\n')

  const presets = await getDirectTVPresets()
  const devices = await getDirectTVDevices()

  console.log(`Found ${presets.length} DirecTV presets`)
  console.log(`Found ${devices.length} DirecTV devices\n`)

  if (presets.length === 0) {
    console.log('No DirecTV presets found. Exiting.')
    return
  }

  const testResults: TestResult[] = []
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  try {
    console.log('Navigating to bartender remote interface...')
    await page.goto(`${BASE_URL}/remote`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '00-initial-state.png'),
      fullPage: true
    })

    // First, click on the Remote tab at the bottom
    const allButtons = await page.locator('button').all()
    let remoteTabButton = null

    for (let i = 0; i < allButtons.length; i++) {
      const text = await allButtons[i].textContent()
      if (text && text.includes('Remote')) {
        remoteTabButton = allButtons[i]
        break
      }
    }

    if (!remoteTabButton) {
      console.log('No Remote tab found on the page.')
      return
    }

    console.log('Clicking Remote tab...')
    await remoteTabButton.click()
    await page.waitForTimeout(1000)

    // Take screenshot after clicking Remote tab
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01a-remote-tab-selected.png'),
      fullPage: true
    })

    // Now look for DirecTV input selector buttons
    const remoteButtons = await page.locator('button').all()
    let directTVButton = null

    for (let i = 0; i < remoteButtons.length; i++) {
      const text = await remoteButtons[i].textContent()
      if (text && text.includes('Direct TV')) {
        directTVButton = remoteButtons[i]
        break
      }
    }

    if (!directTVButton) {
      console.log('No DirecTV input selector found in Remote tab.')
      return
    }

    console.log('Clicking DirecTV input selector...')
    await directTVButton.click()
    await page.waitForTimeout(500)

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-directv-tab-selected.png'),
      fullPage: true
    })

    // Look for and click "Show All" button to expand the preset grid
    console.log('Looking for "Show All" button to expand presets...')
    await page.waitForTimeout(500)
    const expandButtons = await page.locator('button').all()
    let showAllButton = null
    for (let i = 0; i < expandButtons.length; i++) {
      const text = await expandButtons[i].textContent()
      if (text && text.includes('Show All')) {
        showAllButton = expandButtons[i]
        break
      }
    }

    if (showAllButton) {
      console.log('Clicking "Show All" button...')
      await showAllButton.click()
      await page.waitForTimeout(1000)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '01b-show-all-clicked.png'),
        fullPage: true
      })
      console.log('Preset grid expanded\n')
    } else {
      console.log('"Show All" button not found, continuing with visible presets\n')
    }

    const presetsToTest = presets

    for (let i = 0; i < presetsToTest.length; i++) {
      const preset = presetsToTest[i]
      const startTime = Date.now()
      const timestamp = new Date().toISOString()

      console.log(`\n[${i + 1}/${presetsToTest.length}] Testing: ${preset.name} (Channel ${preset.channelNumber})`)

      try {
        // Try multiple selector strategies to find the preset button
        let presetButton = null
        let found = false

        // Strategy 1: Try exact text match with has-text
        presetButton = page.locator(`button:has-text("${preset.name}")`).first()
        found = await presetButton.isVisible().catch(() => false)

        // Strategy 2: Try data-testid
        if (!found) {
          presetButton = page.locator(`[data-testid="preset-${preset.id}"]`)
          found = await presetButton.isVisible().catch(() => false)
        }

        // Strategy 3: Search through all buttons for text match
        if (!found) {
          const allButtons = await page.locator('button').all()
          for (const btn of allButtons) {
            const text = await btn.textContent().catch(() => '')
            if (text && text.includes(preset.name)) {
              presetButton = btn
              found = true
              break
            }
          }
        }

        // Strategy 4: Try with partial text match (useful for "NFL Network" vs "NFL Network 2", etc.)
        if (!found && preset.name.length > 5) {
          const allButtons = await page.locator('button').all()
          const searchTerm = preset.name.split(' ')[0]
          for (const btn of allButtons) {
            const text = await btn.textContent().catch(() => '')
            if (text && text.includes(searchTerm) && text.includes(preset.channelNumber)) {
              presetButton = btn
              found = true
              break
            }
          }
        }

        if (!found) {
          const duration = Date.now() - startTime
          testResults.push({
            presetId: preset.id,
            presetName: preset.name,
            channelNumber: preset.channelNumber,
            status: 'skipped',
            reason: 'Preset button not found on UI',
            duration,
            timestamp
          })
          console.log('  SKIPPED - Button not found on UI')
          continue
        }

        await presetButton!.click()
        console.log('  Clicked preset button')

        await page.waitForTimeout(1500)

        let status: 'success' | 'failure' = 'success'
        let reason: string | undefined

        if (devices.length > 0) {
          const device = devices[0]
          const deviceIp = device.ipAddress || device.ip
          if (deviceIp) {
            const currentChannel = await getCurrentChannelFromDevice(deviceIp)
            if (currentChannel && currentChannel === preset.channelNumber) {
              console.log(`  SUCCESS - Channel verified: ${currentChannel}`)
            } else {
              status = 'failure'
              reason = `Expected channel ${preset.channelNumber}, got ${currentChannel || 'unknown'}`
              console.log(`  FAILURE - ${reason}`)
            }
          } else {
            console.log('  SUCCESS - Command sent (no device IP)')
          }
        } else {
          console.log('  SUCCESS - Command sent (device verification skipped)')
        }

        const screenshotName = `${String(i + 2).padStart(3, '0')}-${preset.name.replace(/[^a-z0-9]/gi, '_')}.png`
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, screenshotName),
          fullPage: true
        }).catch(() => null)

        const duration = Date.now() - startTime
        testResults.push({
          presetId: preset.id,
          presetName: preset.name,
          channelNumber: preset.channelNumber,
          status,
          reason,
          duration,
          timestamp
        })

      } catch (error: any) {
        const duration = Date.now() - startTime
        testResults.push({
          presetId: preset.id,
          presetName: preset.name,
          channelNumber: preset.channelNumber,
          status: 'failure',
          reason: error.message,
          duration,
          timestamp
        })
        console.log(`  ERROR - ${error.message}`)
      }
    }

  } finally {
    await page.close()
    await context.close()
    await browser.close()
  }

  const successCount = testResults.filter(r => r.status === 'success').length
  const failureCount = testResults.filter(r => r.status === 'failure').length
  const skippedCount = testResults.filter(r => r.status === 'skipped').length
  const totalDuration = testResults.reduce((sum, r) => sum + r.duration, 0)

  const report = {
    summary: {
      totalPresets: presets.length,
      testCount: testResults.length,
      successCount,
      failureCount,
      skippedCount,
      successRate: testResults.length > 0 ? ((successCount / testResults.length) * 100).toFixed(2) + '%' : 'N/A',
      totalDuration: totalDuration + 'ms',
      averageDuration: testResults.length > 0 ? (totalDuration / testResults.length).toFixed(0) + 'ms' : 'N/A'
    },
    devices: devices.map(d => ({
      id: d.id,
      name: d.name,
      ipAddress: d.ipAddress || d.ip,
      status: d.status
    })),
    results: testResults,
    timestamp: new Date().toISOString()
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))

  console.log('\n==================================')
  console.log('TEST RESULTS SUMMARY')
  console.log('==================================')
  console.log(`Total Presets: ${presets.length}`)
  console.log(`Tests Run: ${testResults.length}`)
  console.log(`Successful: ${successCount} (${report.summary.successRate})`)
  console.log(`Failed: ${failureCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Total Duration: ${report.summary.totalDuration}`)
  console.log(`Average Duration: ${report.summary.averageDuration}`)
  console.log(`\nReport saved to: ${REPORT_FILE}`)
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}\n`)

  if (failureCount > 0) {
    console.log('Failed presets:')
    testResults
      .filter(r => r.status === 'failure')
      .forEach(r => {
        console.log(`  - ${r.presetName} (Channel ${r.channelNumber}): ${r.reason}`)
      })
  }
}

testDirectTVPresets().catch(error => {
  console.error('Test suite failed:', error)
  process.exit(1)
})
