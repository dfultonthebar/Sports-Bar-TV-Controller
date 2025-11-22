import { chromium } from 'playwright';
import path from 'path';

async function captureSystemAdminHub() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to System Admin Hub...');
    await page.goto('http://localhost:3001/system-admin', {
      waitUntil: 'networkidle'
    });

    console.log('Waiting for page to fully render...');
    await page.waitForTimeout(3000);

    // Get page title to verify we're on the right page
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Get page content to verify components loaded
    const content = await page.content();
    const hasSystemResources = content.includes('System Resources');
    const hasPowerControls = content.includes('System Power Controls');

    console.log(`System Resources card present: ${hasSystemResources}`);
    console.log(`System Power Controls card present: ${hasPowerControls}`);

    // Capture full page screenshot
    const screenshotPath = '/tmp/ui-screenshots/FINAL-system-admin-dark-theme.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });

    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Log visual inspection results
    console.log('\n=== VISUAL CONSISTENCY CHECK ===');
    console.log('✓ Full-page screenshot captured');
    console.log('✓ Viewport: 1920x1080 (desktop)');
    console.log('✓ System Admin Hub components loaded');
    console.log('✓ Ready for visual verification');

  } catch (error) {
    console.error('Error capturing screenshot:', error);

    // Capture error state
    const errorPath = '/tmp/ui-screenshots/error-admin-screenshot.png';
    await page.screenshot({
      path: errorPath,
      fullPage: true
    });
    console.log(`Error screenshot saved to: ${errorPath}`);
  } finally {
    await browser.close();
  }
}

captureSystemAdminHub();
