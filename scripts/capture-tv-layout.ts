import { chromium } from 'playwright';
import * as path from 'path';

const SCREENSHOT_PATH = '/tmp/ui-screenshots/analysis/current-tv-layout.png';
const BASE_URL = 'http://localhost:3001';

async function captureLayout() {
  console.log('📸 Capturing TV Layout interface...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    // Navigate to remote page (default is Video tab with TV layout)
    await page.goto(`${BASE_URL}/remote`, {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Wait for layout to render
    await page.waitForTimeout(1000);

    // Capture screenshot
    await page.screenshot({
      path: SCREENSHOT_PATH,
      fullPage: true
    });

    console.log(`✅ Screenshot saved to: ${SCREENSHOT_PATH}`);

  } catch (error) {
    console.error('❌ Error capturing layout:', error);
  } finally {
    await browser.close();
  }
}

captureLayout().catch(console.error);
