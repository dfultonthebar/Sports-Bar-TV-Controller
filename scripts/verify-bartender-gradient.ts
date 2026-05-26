import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '/tmp/bartender-gradient-verify';

async function captureScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.error(`[Page Error]: ${error}`));

  try {
    console.log('Starting bartender remote verification...\n');

    // Try port 3002 (Nginx proxy) first, fall back to 3001
    let baseUrl = 'http://localhost:3002';
    console.log('Attempting port 3002 (Nginx proxy)...');

    try {
      await page.goto(`${baseUrl}/remote`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('✓ Port 3002 reachable');
    } catch (e) {
      console.log('✗ Port 3002 not reachable, trying port 3001...');
      baseUrl = 'http://localhost:3001';
      await page.goto(`${baseUrl}/remote`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('✓ Port 3001 reachable');
    }

    // Wait for page to fully load
    await page.waitForTimeout(2000);

    // Check if we need to authenticate
    const pinInput = page.locator('input[type="password"], input[type="text"][placeholder*="PIN"], input[placeholder*="pin"]');
    if (await pinInput.isVisible()) {
      console.log('PIN prompt detected, entering Holmgren admin PIN...');
      await pinInput.fill('7819');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Screenshot 1: Hub screen
    console.log('\n[1] Capturing Hub screen...');
    await page.waitForSelector('h1, h2', { timeout: 5000 }).catch(() => console.log('  ⚠ No h1/h2 found'));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01-hub-screen.png'),
      fullPage: false
    });
    console.log('  ✓ Saved: 01-hub-screen.png');

    // Look for input selection or app tiles to click
    const inputOptions = page.locator('[class*="input"], [class*="app"], button:has-text("Select"), a:has-text("Select")');
    const firstInput = inputOptions.first();

    if (await firstInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('\n[2] Clicking into first input/app...');
      await firstInput.click();
      await page.waitForTimeout(2000);

      // Screenshot 2: Channel guide view
      console.log('  Capturing Channel Guide view...');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '02-channel-guide-view.png'),
        fullPage: false
      });
      console.log('  ✓ Saved: 02-channel-guide-view.png');
    }

    // Try to find and click Audio tab
    const audioTabBtn = page.locator('button:has-text("Audio"), a:has-text("Audio"), [role="tab"]:has-text("Audio")');
    if (await audioTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('\n[3] Switching to Audio tab...');
      await audioTabBtn.first().click();
      await page.waitForTimeout(1000);

      console.log('  Capturing Audio tab...');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '03-audio-tab.png'),
        fullPage: false
      });
      console.log('  ✓ Saved: 03-audio-tab.png');
    }

    // Try to find and click Music tab
    const musicTabBtn = page.locator('button:has-text("Music"), a:has-text("Music"), [role="tab"]:has-text("Music")');
    if (await musicTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('\n[4] Switching to Music tab...');
      await musicTabBtn.first().click();
      await page.waitForTimeout(1000);

      console.log('  Capturing Music tab...');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '04-music-tab.png'),
        fullPage: false
      });
      console.log('  ✓ Saved: 04-music-tab.png');
    }

    // Try to find and click Video tab
    const videoTabBtn = page.locator('button:has-text("Video"), a:has-text("Video"), [role="tab"]:has-text("Video")');
    if (await videoTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('\n[5] Switching to Video tab...');
      await videoTabBtn.first().click();
      await page.waitForTimeout(1000);

      console.log('  Capturing Video tab...');
      await page.screenshot({
        path: path.join(OUTPUT_DIR, '05-video-tab.png'),
        fullPage: false
      });
      console.log('  ✓ Saved: 05-video-tab.png');
    }

    console.log('\n✓ All screenshots captured successfully');
    console.log(`\nScreenshots saved to: ${OUTPUT_DIR}`);
    console.log('Verification files:');
    fs.readdirSync(OUTPUT_DIR).forEach(f => {
      const fullPath = path.join(OUTPUT_DIR, f);
      const size = fs.statSync(fullPath).size;
      console.log(`  - ${f} (${(size / 1024).toFixed(1)} KB)`);
    });

  } catch (error) {
    console.error('\n✗ Verification failed:', error);
    // Capture error state
    try {
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'error-state.png'),
        fullPage: true
      });
      console.log('  Saved error state to: error-state.png');
    } catch (e) {
      console.error('  Failed to capture error state:', e);
    }
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
