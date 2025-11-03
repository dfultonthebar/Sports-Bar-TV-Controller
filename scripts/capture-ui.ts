import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = 'http://localhost:3001';
const SCREENSHOT_DIR = '/tmp/ui-screenshots';

async function captureUI() {
  console.log('🎨 Launching browser to capture UI screenshots...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    // 1. Main page / Matrix view
    console.log('📸 Capturing main page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for dynamic content
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-main-page.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: 01-main-page.png\n');

    // 2. Remote Control tab
    console.log('📸 Capturing Remote tab...');
    await page.goto(`${BASE_URL}/remote`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-remote-tab.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: 02-remote-tab.png\n');

    // 3. Try to open Fire TV remote popup (if available)
    try {
      console.log('📸 Attempting to capture Fire TV remote popup...');
      const fireTVButton = page.locator('text=Amazon').first();
      if (await fireTVButton.isVisible()) {
        await fireTVButton.click();
        await page.waitForTimeout(1000);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '03-firetv-remote.png'),
          fullPage: true
        });
        console.log('   ✓ Saved: 03-firetv-remote.png\n');
      }
    } catch (e) {
      console.log('   ⏭️  Skipped: Fire TV remote not accessible\n');
    }

    // 4. Audio Center tab
    console.log('📸 Capturing Audio Center...');
    await page.goto(`${BASE_URL}/audio-center`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-audio-center.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: 04-audio-center.png\n');

    // 5. Sports Guide
    console.log('📸 Capturing Sports Guide...');
    await page.goto(`${BASE_URL}/sports-guide`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-sports-guide.png'),
      fullPage: true
    });
    console.log('   ✓ Saved: 05-sports-guide.png\n');

    console.log('✅ All screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}`);

  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run the capture
captureUI().catch(console.error);
