/**
 * Debug Layout Upload Issue
 *
 * Tests the layout upload functionality with detailed logging
 * Captures browser console, network activity, and UI state
 */

import { chromium } from 'playwright'
import { writeFile } from 'fs/promises'
import { mkdir } from 'fs/promises'
import { join } from 'path'

// Simple PNG image data for testing (1x1 transparent PNG)
async function createTestImage(): Promise<Buffer> {
  // PNG signature and headers for a simple test image
  // This is a valid 800x600 PNG with some content
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x03, 0x20, 0x00, 0x00, 0x02, 0x58,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x5D, 0x37, 0x3C, 0x61, 0x00, 0x00, 0x00,
    0x01, 0x73, 0x52, 0x47, 0x42, 0x00, 0xAE, 0xCE, 0x1C, 0xE9, 0x00, 0x00,
    0x00, 0x04, 0x67, 0x41, 0x4D, 0x41, 0x00, 0x00, 0xB1, 0x8F, 0x0B, 0xFC,
    0x61, 0x05, 0x00, 0x00, 0x00, 0x20, 0x63, 0x48, 0x52, 0x4D, 0x00, 0x00,
    0x7A, 0x26, 0x00, 0x00, 0x80, 0x84, 0x00, 0x00, 0xFA, 0x00, 0x00, 0x00,
    0x80, 0xE8, 0x00, 0x00, 0x75, 0x30, 0x00, 0x00, 0xEA, 0x60, 0x00, 0x00,
    0x3A, 0x98, 0x46, 0xA3, 0x0F, 0x6D, 0x00, 0x00, 0x39, 0xB7, 0x49, 0x44,
    0x41, 0x54, 0x78, 0x9C, 0xED, 0xDD, 0xB1, 0x0D, 0x80, 0x30, 0x0C, 0x00,
    0xB1, 0xBD, 0xA2, 0xA8, 0x23, 0x00, 0x82, 0x98, 0x0A, 0x23, 0xCC, 0xF1,
    0xFF, 0xFF, 0x13, 0xE2, 0x81, 0x88, 0xC0, 0x68, 0xC0, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF,
    0xFF, 0x96, 0x05, 0xBB, 0x69, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ])
  return pngData
}

async function debugLayoutUpload() {
  console.log('Starting layout upload debug...')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })

  const page = await context.newPage()

  // Set up console logging
  const consoleLogs: any[] = []
  page.on('console', (msg) => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      args: msg.args().length
    }
    consoleLogs.push(log)
    console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`)
  })

  // Set up network logging
  const networkActivity: any[] = []
  page.on('request', (request) => {
    if (request.url().includes('layout')) {
      const activity = {
        method: request.method(),
        url: request.url(),
        postData: request.postData()?.substring(0, 200) || null
      }
      networkActivity.push({ type: 'request', ...activity })
      console.log(`[Network Request] ${request.method()} ${request.url()}`)
    }
  })

  page.on('response', (response) => {
    if (response.url().includes('layout')) {
      const activity = {
        status: response.status(),
        statusText: response.statusText(),
        url: response.url()
      }
      networkActivity.push({ type: 'response', ...activity })
      console.log(`[Network Response] ${response.status()} ${response.url()}`)
    }
  })

  try {
    // Navigate to layout editor
    console.log('\n1. Navigating to layout editor...')
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle'
    })
    console.log('Page loaded')

    // Capture initial state
    console.log('\n2. Capturing initial state...')
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-layout-editor-initial.png',
      fullPage: true
    })

    // Create test image
    console.log('\n3. Creating test image...')
    const testImageBuffer = await createTestImage()
    const tempImagePath = '/tmp/test-layout-image.png'
    await writeFile(tempImagePath, testImageBuffer)
    console.log(`Test image created at ${tempImagePath}`)

    // Set file input
    console.log('\n4. Setting file input...')
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles(tempImagePath)
    console.log('File selected')

    // Wait for preview to appear
    console.log('\n5. Waiting for preview...')
    await page.waitForTimeout(1000)

    // Capture before upload
    console.log('\n6. Capturing before upload state...')
    await page.screenshot({
      path: '/tmp/ui-screenshots/02-layout-before-upload.png',
      fullPage: true
    })

    // Check if upload button is enabled
    const uploadButton = await page.locator('button:has-text("Upload & Auto-Detect")')
    const isEnabled = await uploadButton.isEnabled()
    console.log(`Upload button enabled: ${isEnabled}`)

    // Click upload button
    console.log('\n7. Clicking upload button...')
    await uploadButton.click()
    console.log('Upload button clicked')

    // Wait for loading state
    console.log('\n8. Waiting for upload response (timeout: 10s)...')
    const startTime = Date.now()

    // Check for loading spinner
    const spinner = await page.locator('[class*="animate-spin"]')
    const isLoading = await spinner.isVisible({ timeout: 2000 }).catch(() => false)
    console.log(`Loading state visible: ${isLoading}`)

    if (isLoading) {
      console.log('Upload in progress...')
      // Wait for spinner to disappear
      await spinner.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
        console.warn('Spinner did not disappear within timeout')
      })
    }

    const uploadDuration = Date.now() - startTime
    console.log(`Upload completed in ${uploadDuration}ms`)

    // Capture after upload
    console.log('\n9. Capturing after upload state...')
    await page.screenshot({
      path: '/tmp/ui-screenshots/03-layout-after-upload.png',
      fullPage: true
    })

    // Check for success message
    console.log('\n10. Checking for success message...')
    const successMessage = await page.locator('div:has-text("Uploaded successfully")')
    const hasSuccess = await successMessage.isVisible({ timeout: 2000 }).catch(() => false)
    console.log(`Success message visible: ${hasSuccess}`)

    // Check for error message
    const errorMessage = await page.locator('div[class*="bg-red"]')
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)
    console.log(`Error message visible: ${hasError}`)

    if (hasError) {
      const errorText = await errorMessage.textContent()
      console.log(`Error text: ${errorText}`)
    }

    // Check if preview image was loaded
    console.log('\n11. Checking preview image...')
    const preview = await page.locator('img[alt="Layout"]')
    const previewVisible = await preview.isVisible().catch(() => false)
    console.log(`Preview image visible: ${previewVisible}`)

    if (previewVisible) {
      const src = await preview.getAttribute('src')
      console.log(`Preview image src: ${src}`)
    }

    // Check if zones were detected
    console.log('\n12. Checking for detected zones...')
    const zones = await page.locator('div[class*="border-green"]')
    const zoneCount = await zones.count()
    console.log(`Detected zones: ${zoneCount}`)

    // Check console for JavaScript errors
    console.log('\n13. JavaScript errors detected:')
    const errors = consoleLogs.filter(l => l.type === 'error')
    if (errors.length === 0) {
      console.log('No errors')
    } else {
      errors.forEach(e => console.log(`  - ${e.text}`))
    }

    // Summary
    console.log('\n=== SUMMARY ===')
    console.log(`Network requests: ${networkActivity.filter(a => a.type === 'request').length}`)
    console.log(`Network responses: ${networkActivity.filter(a => a.type === 'response').length}`)
    console.log(`Console messages: ${consoleLogs.length}`)
    console.log(`Console errors: ${errors.length}`)

    // Save debug info
    const debugInfo = {
      timestamp: new Date().toISOString(),
      consoleLogs,
      networkActivity,
      summary: {
        uploadButtonEnabled: isEnabled,
        uploadDurationMs: uploadDuration,
        successMessageVisible: hasSuccess,
        errorMessageVisible: hasError,
        previewImageVisible: previewVisible,
        detectedZones: zoneCount,
        javascriptErrors: errors.length
      }
    }

    await mkdir('/tmp/ui-screenshots', { recursive: true })
    await writeFile(
      '/tmp/ui-screenshots/layout-upload-debug.json',
      JSON.stringify(debugInfo, null, 2)
    )

    console.log('\nDebug info saved to /tmp/ui-screenshots/layout-upload-debug.json')

  } catch (error) {
    console.error('Test failed:', error)
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    })
  } finally {
    await browser.close()
  }
}

debugLayoutUpload().catch(console.error)
