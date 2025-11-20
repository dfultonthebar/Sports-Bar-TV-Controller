/**
 * Remote Page Layout Capture
 * Shows how layout is displayed on the remote control page
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const screenshotDir = '/tmp/ui-screenshots'
const layoutDir = path.join(screenshotDir, 'layout-debug')

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function captureRemoteLayout() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  try {
    console.log('='.repeat(60))
    console.log('REMOTE PAGE LAYOUT CAPTURE')
    console.log('='.repeat(60))

    await ensureDir(layoutDir)

    // 1. Navigate to remote page
    console.log('\n1. Navigating to Remote Control page...')
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    await page.waitForTimeout(1000)

    // Capture initial remote state
    await page.screenshot({
      path: path.join(layoutDir, '03-remote-initial.png'),
      fullPage: true
    })
    console.log('   Captured: 03-remote-initial.png')

    // 2. Find and click Video tab (use first() to avoid strict mode issues)
    console.log('\n2. Looking for Video/Layout tab...')

    const videoTabButton = page.locator('button:has-text("Video")')
    const videoTabCount = await videoTabButton.count()
    console.log(`   Found ${videoTabCount} "Video" buttons`)

    if (videoTabCount > 0) {
      const firstVideoTab = videoTabButton.first()
      await firstVideoTab.click()
      await page.waitForTimeout(800)
      console.log('   Clicked Video tab')

      // Capture video tab view
      await page.screenshot({
        path: path.join(layoutDir, '04-remote-video-tab.png'),
        fullPage: true
      })
      console.log('   Captured: 04-remote-video-tab.png')
    }

    // 3. Analyze what's displayed
    console.log('\n3. Analyzing layout display on remote...')

    const layoutDisplay = await page.evaluate(() => {
      // Look for zone icons/buttons
      const zoneElements = document.querySelectorAll('[class*="zone"], [class*="icon"], button[class*="rounded"], div[class*="bg-"]')

      const zones: any[] = []
      zoneElements.forEach((elem) => {
        const text = elem.textContent?.trim()
        const style = window.getComputedStyle(elem)

        // Only collect elements with TV labels
        if (text && /^TV\s*\d{1,2}$/i.test(text)) {
          const borderRadius = style.borderRadius
          let shape = 'rectangle'
          if (borderRadius === '50%' || borderRadius.includes('50%')) {
            shape = 'circle'
          } else if (borderRadius !== '0px' && borderRadius !== 'none') {
            shape = 'rounded-rectangle'
          }

          zones.push({
            label: text.trim(),
            shape: shape,
            backgroundColor: style.backgroundColor,
            borderRadius: borderRadius,
            className: elem.className,
            tag: elem.tagName
          })
        }
      })

      return {
        totalZones: zones.length,
        zones: zones.slice(0, 10), // First 10 for analysis
        pageTitle: document.title,
        visibleTabs: Array.from(document.querySelectorAll('button[class*="tab"], button[class*="button"]'))
          .map(btn => btn.textContent?.trim())
          .filter(text => text && text.length < 50)
          .slice(0, 10)
      }
    })

    console.log('   Layout Display Info:')
    console.log('     Total zones found:', layoutDisplay.totalZones)
    console.log('     Sample zones:')
    layoutDisplay.zones.forEach((zone: any) => {
      console.log(`       - ${zone.label} (${zone.shape})`)
    })
    console.log('     Icon shapes used:')
    const shapes = layoutDisplay.zones.map(z => z.shape)
    const uniqueShapes = [...new Set(shapes)]
    uniqueShapes.forEach(shape => {
      console.log(`       - ${shape}`)
    })

    // 4. Scroll down to see more zones if applicable
    console.log('\n4. Scrolling to see full layout...')
    await page.evaluate(() => {
      window.scrollBy(0, 500)
    })
    await page.waitForTimeout(500)

    await page.screenshot({
      path: path.join(layoutDir, '05-remote-video-scrolled.png'),
      fullPage: true
    })
    console.log('   Captured: 05-remote-video-scrolled.png')

    // 5. Get API data one more time
    console.log('\n5. Fetching latest API layout data...')
    const apiData = await page.evaluate(async () => {
      const response = await fetch('/api/bartender/layout')
      return response.json()
    })

    console.log('   Zones in API:')
    apiData.layout.zones.slice(0, 5).forEach((zone: any) => {
      console.log(`     - ${zone.label} (Output: ${zone.outputNumber}, Confidence: ${zone.confidence})`)
    })
    console.log(`     ... and ${apiData.layout.zones.length - 5} more zones`)

    // Save comprehensive debug report
    const debugReport = {
      timestamp: new Date().toISOString(),
      layoutImage: apiData.layout.imageUrl,
      totalZones: apiData.layout.zones.length,
      zoneLabels: apiData.layout.zones.map((z: any) => z.label),
      labelFormat: 'TV # (single digit) or TV ## (double digit)',
      iconShapesDetected: uniqueShapes,
      firstZoneExample: apiData.layout.zones[0],
      allZones: apiData.layout.zones
    }

    fs.writeFileSync(
      path.join(layoutDir, 'layout-report.json'),
      JSON.stringify(debugReport, null, 2)
    )
    console.log('   Saved: layout-report.json')

    console.log('\n' + '='.repeat(60))
    console.log('CAPTURE COMPLETE')
    console.log('='.repeat(60))
    console.log('\nSummary:')
    console.log(`  Layout Image: ${apiData.layout.imageUrl}`)
    console.log(`  Total Zones Detected: ${apiData.layout.zones.length}`)
    console.log(`  Zone Labels: ${apiData.layout.zones.map((z: any) => z.label).join(', ')}`)
    console.log(`  Icon Shapes: ${uniqueShapes.join(', ')}`)
    console.log('\nScreenshots saved to:', layoutDir)
    console.log('  - 03-remote-initial.png')
    console.log('  - 04-remote-video-tab.png')
    console.log('  - 05-remote-video-scrolled.png')
    console.log('  - layout-report.json')

  } catch (error) {
    console.error('Error during capture:', error)
    try {
      await page.screenshot({
        path: path.join(layoutDir, 'error-remote-capture.png'),
        fullPage: true
      })
    } catch (e) {
      console.error('Could not capture error screenshot')
    }
  } finally {
    await browser.close()
  }
}

captureRemoteLayout().catch(console.error)
