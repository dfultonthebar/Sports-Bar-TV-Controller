import { chromium } from 'playwright';

async function testSportsGuideConfig() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Collect console messages and network data
  const consoleMessages: { type: string; message: string; location?: string }[] = [];
  const networkErrors: { url: string; status: number }[] = [];

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      message: msg.text(),
      location: msg.location()?.url
    });
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status()
      });
    }
  });

  try {
    console.log('Starting test of sports-guide-config...');

    // Navigate to the page
    console.log('Navigating to http://24.123.87.42:3001/sports-guide-config');
    await page.goto('http://24.123.87.42:3001/sports-guide-config', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Clear all caches
    console.log('Clearing service workers and cache storage...');
    await page.evaluate(() => {
      // Clear service worker registrations
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
      }

      // Clear cache storage
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => {
            caches.delete(name);
          });
        });
      }

      // Clear local storage
      localStorage.clear();

      // Clear session storage
      sessionStorage.clear();
    });

    console.log('Waiting for service worker cleanup...');
    await page.waitForTimeout(1000);

    // Hard refresh
    console.log('Performing hard refresh (Ctrl+Shift+R equivalent)...');
    await page.evaluate(() => {
      // Clear service worker cache by reloading with cache disabled
      window.location.reload();
    });

    // Wait for page to fully load
    console.log('Waiting for page to load...');
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000);

    // Get all console messages before navigation
    console.log('\n=== CONSOLE MESSAGES ===');
    consoleMessages.forEach((msg) => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.message}`);
      if (msg.location) {
        console.log(`  Location: ${msg.location}`);
      }
    });

    // Check for specific errors
    console.log('\n=== ERROR CHECK ===');
    const hasUndefinedError = consoleMessages.some((msg) =>
      msg.message.includes("Cannot read properties of undefined (reading 'enabled')")
    );
    const has404Error = consoleMessages.some((msg) =>
      msg.message.includes('GET /api/atlas/zones 404')
    );

    console.log(`Has "Cannot read properties of undefined" error: ${hasUndefinedError}`);
    console.log(`Has "GET /api/atlas/zones 404" error: ${has404Error}`);

    // Log network errors
    console.log('\n=== NETWORK ERRORS ===');
    if (networkErrors.length > 0) {
      networkErrors.forEach((err) => {
        console.log(`${err.status} ${err.url}`);
      });
    } else {
      console.log('No network errors found');
    }

    // Get page title and check if loaded
    const title = await page.title();
    console.log(`\nPage title: ${title}`);

    // Check if page has content
    const bodyContent = await page.locator('body').isVisible();
    console.log(`Page body visible: ${bodyContent}`);

    // Take screenshot
    const screenshotPath = '/tmp/ui-screenshots/sports-guide-config-test.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`\nScreenshot saved: ${screenshotPath}`);

    // Get JavaScript file hashes from network tab
    console.log('\n=== LOADED JS FILES ===');
    await page.evaluate(() => {
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach((script) => {
        const src = (script as HTMLScriptElement).src;
        if (src.includes('_next')) {
          console.log(`JS File: ${src}`);
        }
      });
    });

    // Final status
    console.log('\n=== TEST RESULT ===');
    if (!hasUndefinedError && !has404Error && networkErrors.length === 0) {
      console.log('PASSED: Page loaded successfully without reported errors');
    } else {
      console.log('FAILED: Page loaded but with errors');
    }

  } catch (error) {
    console.error('Test failed with exception:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testSportsGuideConfig();
