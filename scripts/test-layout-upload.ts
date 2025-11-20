import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/tmp/ui-screenshots/layout-upload-test';

async function testLayoutUpload() {
  // Create screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Collect detailed logs
  const consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];
  const networkLogs: Array<{ method: string; url: string; status?: number; timestamp: number }> = [];

  page.on('console', msg => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      timestamp: Date.now()
    };
    consoleLogs.push(log);
    console.log(`[CONSOLE-${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  page.on('request', request => {
    if (request.url().includes('layout') || request.url().includes('upload')) {
      console.log(`[NETWORK-REQUEST] ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    const request = response.request();
    if (request.url().includes('layout') || request.url().includes('upload')) {
      networkLogs.push({
        method: request.method(),
        url: request.url(),
        status: response.status(),
        timestamp: Date.now()
      });
      console.log(`[NETWORK-RESPONSE] ${request.method()} ${request.url()} -> ${response.status()}`);

      // Log response body for upload requests
      if (request.url().includes('upload')) {
        response.text().then(text => {
          console.log(`[RESPONSE-BODY] ${text.substring(0, 500)}`);
        }).catch(e => console.log(`[RESPONSE-BODY-ERROR] ${e.message}`));
      }
    }
  });

  try {
    console.log('\n=== LAYOUT UPLOAD TEST ===\n');

    // Navigate to layout editor
    console.log('[STEP 1] Navigating to layout editor...');
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Take initial screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-initial-page.png'),
      fullPage: false
    });

    console.log('[STEP 2] Checking initial state...');

    // Verify page loaded
    const heading = await page.locator('h1').textContent();
    console.log(`Page title: ${heading}`);

    // Check zones before upload
    const zonesBefore = await page.locator('h3:has-text("Zones")').textContent();
    console.log(`Initial zones display: ${zonesBefore}`);

    // Check for file input
    const fileInput = page.locator('input[type="file"]');
    const fileInputVisible = await fileInput.isVisible();
    console.log(`File input visible: ${fileInputVisible}`);

    // Create a test image file (small 1x1 PNG)
    console.log('\n[STEP 3] Creating test image...');
    const testImagePath = '/tmp/test-layout.png';
    // 1x1 PNG with transparency
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);
    fs.writeFileSync(testImagePath, pngBuffer);
    console.log(`Created test image at: ${testImagePath}`);

    // Upload the file
    console.log('\n[STEP 4] Uploading test image...');
    await fileInput.setInputFiles(testImagePath);

    // Wait a moment for file selection to register
    await page.waitForTimeout(500);

    // Check selected file
    const selectedFileText = await page.locator('text=/test-layout/').count();
    console.log(`File selected (visible in UI): ${selectedFileText > 0}`);

    // Take screenshot after file selection
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-file-selected.png'),
      fullPage: false
    });

    // Click upload button
    console.log('\n[STEP 5] Clicking "Upload & Auto-Detect" button...');
    const uploadButton = page.locator('button:has-text("Upload & Auto-Detect")');
    const uploadButtonEnabled = await uploadButton.isEnabled();
    console.log(`Upload button enabled: ${uploadButtonEnabled}`);

    await uploadButton.click();

    // Wait for upload to complete
    console.log('\n[STEP 6] Waiting for upload to complete...');
    await page.waitForTimeout(3000);

    // Take screenshot after upload
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-after-upload.png'),
      fullPage: false
    });

    // Check for success message
    const successMessage = page.locator('text=/success|uploaded|detected/i');
    const successMessageCount = await successMessage.count();
    console.log(`Success message found: ${successMessageCount > 0}`);

    if (successMessageCount > 0) {
      const messageText = await successMessage.first().textContent();
      console.log(`Message text: ${messageText}`);
    }

    // Check for error message
    const errorMessage = page.locator('text=/error|failed/i');
    const errorMessageCount = await errorMessage.count();
    console.log(`Error message found: ${errorMessageCount > 0}`);

    if (errorMessageCount > 0) {
      const messageText = await errorMessage.first().textContent();
      console.log(`Error text: ${messageText}`);
    }

    // Check zones after upload
    const zonesAfter = await page.locator('h3:has-text("Zones")').textContent();
    console.log(`Zones after upload: ${zonesAfter}`);

    // Check preview image
    const previewImage = page.locator('img[alt="Layout"]');
    const imageVisible = await previewImage.isVisible();
    console.log(`Preview image visible: ${imageVisible}`);

    if (imageVisible) {
      const imageSrc = await previewImage.getAttribute('src');
      console.log(`Image source: ${imageSrc}`);
    }

    // Check for zone elements on canvas
    const zoneElements = page.locator('div[style*="left: "], div[style*="position"]').count();
    console.log(`Zone elements found: ${await zoneElements}`);

    // Get network request details
    console.log('\n=== NETWORK REQUESTS ===');
    const uploadRequests = networkLogs.filter(r => r.url.includes('upload'));
    console.log(`Upload requests: ${uploadRequests.length}`);
    uploadRequests.forEach((req, idx) => {
      console.log(`  ${idx + 1}. ${req.method} ${req.url} -> ${req.status}`);
    });

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Console errors: ${consoleLogs.filter(l => l.type === 'error').length}`);
    console.log(`Network errors (5xx): ${networkLogs.filter(l => l.status && l.status >= 500).length}`);
    console.log(`Screenshot directory: ${SCREENSHOT_DIR}`);

    // Dump full logs to file for analysis
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'test-logs.json'),
      JSON.stringify({ consoleLogs, networkLogs }, null, 2)
    );

  } catch (error) {
    console.error('Test error:', error);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '00-error.png'),
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testLayoutUpload().catch(console.error);
