import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/tmp/ui-screenshots/layout-editor-debug';

async function debugLayoutEditor() {
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

  // Collect console messages
  const consoleLogs: Array<{ type: string; text: string }> = [];
  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    });
    console.log(`[CONSOLE-${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Collect network activity
  const networkRequests: Array<{ method: string; url: string; status?: number }> = [];
  page.on('request', request => {
    networkRequests.push({
      method: request.method(),
      url: request.url()
    });
  });

  page.on('response', response => {
    const request = response.request();
    if (request.url().includes('upload') || request.url().includes('layout')) {
      console.log(`[NETWORK] ${request.method()} ${request.url()} -> ${response.status()}`);
    }
  });

  try {
    console.log('\n=== Navigating to Layout Editor ===');
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    console.log('\n=== Waiting for page to load ===');
    await page.waitForTimeout(2000);

    // Take full page screenshot
    console.log('\n=== Capturing full page screenshot ===');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-layout-editor-full.png'),
      fullPage: true
    });

    // Check for upload input
    console.log('\n=== Checking for upload input ===');
    const uploadInput = page.locator('input[type="file"]');
    const uploadInputCount = await uploadInput.count();
    console.log(`Found ${uploadInputCount} file input(s)`);

    if (uploadInputCount > 0) {
      const uploadBox = await uploadInput.boundingBox();
      console.log(`Upload input location: ${JSON.stringify(uploadBox)}`);
    }

    // Look for upload button
    console.log('\n=== Checking for upload button ===');
    const uploadButtons = await page.locator('button').filter({ hasText: /upload|import|load/i });
    const uploadButtonCount = await uploadButtons.count();
    console.log(`Found ${uploadButtonCount} upload-related button(s)`);

    // Check for preview image
    console.log('\n=== Checking for preview image ===');
    const previewImages = page.locator('img');
    const previewCount = await previewImages.count();
    console.log(`Found ${previewCount} image(s) on page`);

    for (let i = 0; i < Math.min(5, previewCount); i++) {
      const src = await previewImages.nth(i).getAttribute('src');
      const alt = await previewImages.nth(i).getAttribute('alt');
      console.log(`  Image ${i}: src="${src}" alt="${alt}"`);
    }

    // Check zones
    console.log('\n=== Checking zones ===');
    const zoneElements = page.locator('[data-testid*="zone"], [class*="zone"]');
    const zoneCount = await zoneElements.count();
    console.log(`Found ${zoneCount} zone-related elements`);

    // Check for sidebar
    console.log('\n=== Checking sidebar ===');
    const sidebar = page.locator('aside, [class*="sidebar"]');
    const sidebarCount = await sidebar.count();
    console.log(`Found ${sidebarCount} sidebar element(s)`);

    // Look for zones count text
    const zoneCountText = await page.locator('text=/zones?/i');
    const zoneCountMatches = await zoneCountText.count();
    console.log(`Found ${zoneCountMatches} "zones" text matches`);

    // Check for success/error messages
    console.log('\n=== Checking for messages ===');
    const alerts = page.locator('[role="alert"], [class*="alert"], [class*="message"], [class*="toast"]');
    const alertCount = await alerts.count();
    console.log(`Found ${alertCount} alert/message elements`);

    if (alertCount > 0) {
      for (let i = 0; i < alertCount; i++) {
        const text = await alerts.nth(i).textContent();
        console.log(`  Alert ${i}: ${text}`);
      }
    }

    // Take viewport screenshot
    console.log('\n=== Capturing viewport screenshot ===');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-layout-editor-viewport.png'),
      fullPage: false
    });

    // Get page content for analysis
    console.log('\n=== Analyzing page structure ===');
    const pageContent = await page.content();
    const hasLayoutForm = pageContent.includes('layout') || pageContent.includes('upload');
    console.log(`Page contains layout/upload references: ${hasLayoutForm}`);

    // Check for loading state
    console.log('\n=== Checking for loading states ===');
    const loadingElements = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]');
    const loadingCount = await loadingElements.count();
    console.log(`Found ${loadingCount} loading state elements`);

    // Capture console logs
    console.log('\n=== Console Logs ===');
    console.log(JSON.stringify(consoleLogs, null, 2));

    // Capture relevant network requests
    console.log('\n=== Network Requests (Upload/Layout related) ===');
    const relevantRequests = networkRequests.filter(
      r => r.url.includes('upload') || r.url.includes('layout') || r.url.includes('api')
    );
    console.log(JSON.stringify(relevantRequests, null, 2));

    // Check page title and main heading
    console.log('\n=== Page Title ===');
    const title = await page.title();
    console.log(`Title: ${title}`);

    const h1 = page.locator('h1');
    if (await h1.count() > 0) {
      const h1Text = await h1.first().textContent();
      console.log(`Main heading: ${h1Text}`);
    }

    // Summary report
    console.log('\n=== SUMMARY REPORT ===');
    console.log(`Upload input visible: ${uploadInputCount > 0}`);
    console.log(`Upload buttons visible: ${uploadButtonCount > 0}`);
    console.log(`Preview images: ${previewCount}`);
    console.log(`Zone elements: ${zoneCount}`);
    console.log(`Sidebar visible: ${sidebarCount > 0}`);
    console.log(`Messages/alerts: ${alertCount}`);
    console.log(`Loading states: ${loadingCount}`);
    console.log(`Console errors: ${consoleLogs.filter(l => l.type === 'error').length}`);
    console.log(`Screenshot saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('Error during debug:', error);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '00-error-state.png'),
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

debugLayoutEditor().catch(console.error);
