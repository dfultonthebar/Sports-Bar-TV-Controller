import { chromium } from 'playwright';

async function captureAdminHubAfter() {
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

    // Wait for the page to fully load
    console.log('Waiting for page content to load...');
    await page.waitForSelector('[class*="Real-time"]', { timeout: 5000 }).catch(() => {
      console.log('Real-time section selector not found, continuing...');
    });

    // Wait for dynamic content
    await page.waitForTimeout(2000);

    // Take full-page screenshot
    console.log('Capturing full-page screenshot...');
    const fullPagePath = '/tmp/ui-screenshots/AFTER-system-admin-hub-full.png';
    await page.screenshot({
      path: fullPagePath,
      fullPage: true
    });
    console.log(`Full page screenshot saved: ${fullPagePath}`);

    // Try to find and screenshot the Real-time System Resource Monitoring section
    console.log('Capturing resource monitoring section...');
    const resourceSection = page.locator('text=/Real-time.*Monitoring/i').first();
    const sectionExists = await resourceSection.isVisible().catch(() => false);

    if (sectionExists) {
      const resourcePath = '/tmp/ui-screenshots/AFTER-system-admin-resource-section.png';
      await resourceSection.screenshot({ path: resourcePath });
      console.log(`Resource section screenshot saved: ${resourcePath}`);
    } else {
      console.log('Resource section not found via text selector, capturing viewport...');
      const resourcePath = '/tmp/ui-screenshots/AFTER-system-admin-resource-section.png';
      await page.screenshot({
        path: resourcePath,
        clip: { x: 0, y: 200, width: 1920, height: 600 }
      });
      console.log(`Resource section screenshot (viewport) saved: ${resourcePath}`);
    }

    // Take a screenshot of the top section with heading
    console.log('Capturing header section...');
    const headerPath = '/tmp/ui-screenshots/AFTER-system-admin-header.png';
    await page.screenshot({
      path: headerPath,
      clip: { x: 0, y: 0, width: 1920, height: 300 }
    });
    console.log(`Header section screenshot saved: ${headerPath}`);

    console.log('\nCapture complete!');
    console.log('Screenshots saved to /tmp/ui-screenshots/');

  } catch (error) {
    console.error('Error capturing screenshots:', error);

    // Capture error state
    const errorPath = '/tmp/ui-screenshots/AFTER-error-debug.png';
    await page.screenshot({
      path: errorPath,
      fullPage: true
    });
    console.log(`Error state screenshot saved: ${errorPath}`);

    process.exit(1);
  } finally {
    await browser.close();
  }
}

captureAdminHubAfter().catch(console.error);
