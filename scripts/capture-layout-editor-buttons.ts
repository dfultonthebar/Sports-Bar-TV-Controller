import { chromium } from 'playwright';
import * as fs from 'fs';

async function captureLayoutEditorButtons() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to layout editor...');
    await page.goto('http://localhost:3001/layout-editor', {
      waitUntil: 'networkidle'
    });

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Extra wait for any animations

    console.log('Taking full-page screenshot...');
    const screenshotPath = '/tmp/ui-screenshots/layout-editor-button-styling-issue.png';

    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log(`Screenshot saved to ${screenshotPath}`);

    // Also capture viewport height info for context
    const viewportHeight = await page.evaluate(() => {
      return Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
    });

    console.log(`Full page height: ${viewportHeight}px`);

  } catch (error) {
    console.error('Error capturing layout editor:', error);

    // Capture debug screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/layout-editor-error.png',
      fullPage: true
    });

    throw error;
  } finally {
    await browser.close();
  }
}

captureLayoutEditorButtons().catch(console.error);
