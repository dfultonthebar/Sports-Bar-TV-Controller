/**
 * Layout Editor Debug Capture Script
 *
 * Captures layout editor page and analyzes:
 * - Uploaded layout image with TV labels
 * - Zone detection status
 * - Icon shapes (circles vs rectangles)
 * - Label format (TV 01, TV 02, etc.)
 * - Browser console errors
 * - Image source URLs
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

async function captureLayoutDebug() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  // Capture console messages and errors
  const consoleLogs: string[] = []
  const errors: string[] = []

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type().toUpperCase()}] ${msg.text()}`)
  })

  page.on('pageerror', (error) => {
    errors.push(`Page Error: ${error.message}`)
  })

  page.on('requestfailed', (request) => {
    errors.push(`Request Failed: ${request.url()}`)
  })

  try {
    console.log('='.repeat(60))
    console.log('LAYOUT EDITOR DEBUG CAPTURE')
    console.log('='.repeat(60))

    await ensureDir(layoutDir)

    // 1. Navigate to layout editor
    console.log('\n1. Navigating to Layout Editor...')
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    await page.waitForTimeout(500)

    // Capture initial state
    await page.screenshot({
      path: path.join(layoutDir, '01-layout-editor-initial.png'),
      fullPage: true
    })
    console.log('   Captured: 01-layout-editor-initial.png')

    // 2. Check if there's already a layout loaded
    console.log('\n2. Checking for loaded layout...')

    const layoutInfo = await page.evaluate(() => {
      const zones = document.querySelectorAll('[data-zone-id]')
      const images = document.querySelectorAll('img')

      return {
        zonesCount: zones.length,
        zoneIds: Array.from(zones).map(z => z.getAttribute('data-zone-id')),
        zoneLabels: Array.from(zones).map(z => {
          const label = z.querySelector('.zone-label')
          return label ? label.textContent : 'N/A'
        }),
        imageUrls: Array.from(images).map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.width,
          height: img.height
        })),
        detectedText: Array.from(document.querySelectorAll('*')).find(el =>
          el.textContent?.includes('Detected:')
        )?.textContent || 'Not found'
      }
    })

    console.log('   Zone Count:', layoutInfo.zonesCount)
    console.log('   Images Found:', layoutInfo.imageUrls.length)
    console.log('   Detected Status:', layoutInfo.detectedText)

    // 3. Look for zone elements on the canvas
    console.log('\n3. Analyzing zone elements...')

    const zoneDetails = await page.evaluate(() => {
      const zones: any[] = []

      // Look for zone divs with styling
      const zoneElements = document.querySelectorAll('[style*="position"]')

      zoneElements.forEach((zone, idx) => {
        const style = window.getComputedStyle(zone)
        const label = zone.textContent?.trim().split('\n')[0]

        // Only collect elements that look like zones (with positioning)
        if (style.position === 'absolute' && label) {
          zones.push({
            index: idx,
            label: label,
            left: zone.getAttribute('style')?.match(/left:\s*([^;]+)/)?.[1],
            top: zone.getAttribute('style')?.match(/top:\s*([^;]+)/)?.[1],
            width: zone.getAttribute('style')?.match(/width:\s*([^;]+)/)?.[1],
            height: zone.getAttribute('style')?.match(/height:\s*([^;]+)/)?.[1],
            borderStyle: style.borderStyle,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor
          })
        }
      })

      return zones
    })

    console.log('   Found', zoneDetails.length, 'zone elements')
    zoneDetails.forEach((zone, idx) => {
      console.log(`   Zone ${idx + 1}:`, {
        label: zone.label,
        position: `(${zone.left}, ${zone.top})`,
        size: `${zone.width} x ${zone.height}`,
        border: zone.borderStyle,
        bgColor: zone.backgroundColor,
        borderColor: zone.borderColor
      })
    })

    // 4. Look at the layout canvas specifically
    console.log('\n4. Examining layout canvas...')

    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('[style*="minHeight"]')
      const layoutImage = document.querySelector('img[alt="Layout"]')

      return {
        canvasFound: !!canvas,
        canvasClass: canvas?.className,
        imageFound: !!layoutImage,
        imageSrc: layoutImage?.getAttribute('src'),
        imageAlt: layoutImage?.getAttribute('alt'),
        childrenCount: canvas?.children.length || 0,
        childrenInfo: Array.from(canvas?.children || []).map((child, idx) => ({
          tag: child.tagName,
          className: child.className,
          textContent: child.textContent?.substring(0, 50)
        }))
      }
    })

    console.log('   Canvas Info:', canvasInfo)

    // 5. Get all text content that looks like TV labels
    console.log('\n5. Searching for TV labels...')

    const tvLabels = await page.evaluate(() => {
      const allText: string[] = []
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      )

      let currentNode
      while (currentNode = walker.nextNode()) {
        const text = currentNode.textContent?.trim()
        if (text && /^TV\s*\d{2}|^tv\s*\d{2}/i.test(text)) {
          allText.push(text)
        }
      }

      return allText
    })

    console.log('   TV Labels Found:', tvLabels.length)
    tvLabels.forEach((label, idx) => {
      console.log(`     ${idx + 1}. "${label}"`)
    })

    // 6. Take a closer look at the zones panel on the right
    console.log('\n6. Capturing zones panel...')

    const zonesPanel = await page.locator('text=Zones').first()
    if (await zonesPanel.isVisible()) {
      await zonesPanel.screenshot({
        path: path.join(layoutDir, '02-zones-panel.png')
      })
      console.log('   Captured: 02-zones-panel.png')
    }

    // 7. Check API response for layout data
    console.log('\n7. Checking API layout data...')

    try {
      const apiResponse = await page.evaluate(async () => {
        const response = await fetch('/api/bartender/layout')
        return response.json()
      })

      console.log('   API Response:', JSON.stringify(apiResponse, null, 2))
    } catch (error) {
      console.log('   API Error:', error)
    }

    // 8. Now check the remote page to see how layout is displayed
    console.log('\n8. Navigating to Remote Control page...')

    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    await page.waitForTimeout(1000)

    // Look for Video/Layout tab
    const videoTab = page.locator('text=/Video|Layout/i')
    if (await videoTab.isVisible()) {
      await videoTab.click()
      await page.waitForTimeout(500)
    }

    // Capture remote page layout view
    await page.screenshot({
      path: path.join(layoutDir, '03-remote-layout-view.png'),
      fullPage: true
    })
    console.log('   Captured: 03-remote-layout-view.png')

    // 9. Analyze the icon shapes used in remote
    console.log('\n9. Analyzing icon shapes in remote view...')

    const iconShapes = await page.evaluate(() => {
      const icons: any[] = []

      // Look for zone indicators (circles, rectangles, or other shapes)
      const zoneElements = document.querySelectorAll('[class*="zone"], [class*="icon"], [data-zone-id]')

      zoneElements.forEach((elem, idx) => {
        const style = window.getComputedStyle(elem)
        const borderRadius = style.borderRadius

        let shape = 'rectangle'
        if (borderRadius === '50%' || borderRadius.includes('50%')) {
          shape = 'circle'
        } else if (borderRadius !== '0px' && borderRadius !== 'none') {
          shape = 'rounded-rectangle'
        }

        icons.push({
          index: idx,
          tag: elem.tagName,
          className: elem.className,
          shape: shape,
          borderRadius: borderRadius,
          textContent: elem.textContent?.trim().substring(0, 50)
        })
      })

      return icons.slice(0, 10) // First 10
    })

    console.log('   Icon shapes found:', iconShapes.length)
    iconShapes.forEach((icon, idx) => {
      console.log(`     ${idx + 1}. ${icon.shape} - ${icon.className}`)
    })

    // 10. Save console output and errors
    console.log('\n10. Saving debug logs...')

    const debugLog = {
      timestamp: new Date().toISOString(),
      layoutInfo: layoutInfo,
      zoneDetails: zoneDetails,
      canvasInfo: canvasInfo,
      tvLabels: tvLabels,
      iconShapes: iconShapes,
      consoleLogs: consoleLogs,
      pageErrors: errors
    }

    fs.writeFileSync(
      path.join(layoutDir, 'debug-log.json'),
      JSON.stringify(debugLog, null, 2)
    )
    console.log('   Saved: debug-log.json')

    // 11. Capture one more full page screenshot of the layout editor with zones visible
    console.log('\n11. Final capture with full context...')

    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle'
    })
    await page.waitForTimeout(500)

    await page.screenshot({
      path: path.join(layoutDir, '04-layout-editor-final.png'),
      fullPage: true
    })
    console.log('   Captured: 04-layout-editor-final.png')

    console.log('\n' + '='.repeat(60))
    console.log('CAPTURE COMPLETE')
    console.log('='.repeat(60))
    console.log('\nScreenshots saved to:', layoutDir)
    console.log('\nFiles captured:')
    console.log('  - 01-layout-editor-initial.png')
    console.log('  - 02-zones-panel.png')
    console.log('  - 03-remote-layout-view.png')
    console.log('  - 04-layout-editor-final.png')
    console.log('  - debug-log.json')

  } catch (error) {
    console.error('Error during capture:', error)

    // Try to capture an error screenshot
    try {
      await page.screenshot({
        path: path.join(layoutDir, 'error-capture.png'),
        fullPage: true
      })
    } catch (e) {
      console.error('Could not capture error screenshot')
    }
  } finally {
    await browser.close()
  }
}

// Run the capture
captureLayoutDebug().catch(console.error)
