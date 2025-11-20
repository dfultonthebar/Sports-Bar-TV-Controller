import { chromium } from 'playwright';

async function testSportsGuideConfigDetailed() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Collect all network requests
  const networkRequests: {
    method: string;
    url: string;
    status: number;
    resourceType: string;
  }[] = [];

  const consoleMessages: { type: string; message: string }[] = [];
  const pageErrors: { message: string; stack?: string }[] = [];

  page.on('response', (response) => {
    networkRequests.push({
      method: response.request().method(),
      url: response.url(),
      status: response.status(),
      resourceType: response.request().resourceType()
    });
  });

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      message: msg.text()
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });

  try {
    console.log('SPORTS GUIDE CONFIG - DETAILED TEST');
    console.log('====================================\n');

    // Initial navigation
    console.log('[STEP 1] Navigating to http://24.123.87.42:3001/sports-guide-config');
    const startTime = Date.now();
    await page.goto('http://24.123.87.42:3001/sports-guide-config', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    const navigationTime = Date.now() - startTime;
    console.log(`Navigation complete in ${navigationTime}ms\n`);

    // Clear service worker cache
    console.log('[STEP 2] Clearing all browser caches...');
    await page.evaluate(async () => {
      // Clear service worker registrations
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
        console.log(`Unregistered ${registrations.length} service workers`);
      }

      // Clear cache storage
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
        console.log(`Cleared ${cacheNames.length} cache storages`);
      }

      // Clear local/session storage
      const localStorageSize = localStorage.length;
      const sessionStorageSize = sessionStorage.length;
      localStorage.clear();
      sessionStorage.clear();
      console.log(`Cleared local storage (${localStorageSize} items) and session storage (${sessionStorageSize} items)`);
    });
    console.log('Cache clearing complete\n');

    // Hard refresh
    console.log('[STEP 3] Performing hard refresh...');
    networkRequests.length = 0; // Reset network tracking
    consoleMessages.length = 0;
    pageErrors.length = 0;

    await page.keyboard.press('F5'); // Regular refresh
    await page.waitForLoadState('networkidle', { timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for any late-loading scripts

    console.log('Page refresh complete\n');

    // Detailed results
    console.log('[STEP 4] ANALYZING RESULTS\n');

    // Console messages
    console.log('CONSOLE MESSAGES:');
    if (consoleMessages.length === 0) {
      console.log('  ✓ No console errors or warnings\n');
    } else {
      consoleMessages.forEach((msg) => {
        const prefix =
          msg.type === 'error' ? '✗ ERROR:' : msg.type === 'warning' ? '! WARNING:' : '✓ LOG:';
        console.log(`  ${prefix} ${msg.message}`);
      });
      console.log();
    }

    // Page errors
    console.log('PAGE ERRORS:');
    if (pageErrors.length === 0) {
      console.log('  ✓ No uncaught JavaScript errors\n');
    } else {
      pageErrors.forEach((err) => {
        console.log(`  ✗ ${err.message}`);
        if (err.stack) {
          console.log(`    Stack: ${err.stack.split('\n')[0]}`);
        }
      });
      console.log();
    }

    // Network analysis
    console.log('NETWORK ANALYSIS:');
    const jsFiles = networkRequests.filter((r) => r.resourceType === 'script');
    const nextJsFiles = jsFiles.filter((r) => r.url.includes('_next'));
    const apiRequests = networkRequests.filter((r) => r.url.includes('/api/'));
    const failedRequests = networkRequests.filter((r) => r.status >= 400);

    console.log(`  Total requests: ${networkRequests.length}`);
    console.log(`  JavaScript files: ${jsFiles.length}`);
    console.log(`  Next.js chunk files: ${nextJsFiles.length}`);
    console.log(`  API requests: ${apiRequests.length}`);
    console.log(`  Failed requests: ${failedRequests.length}`);

    if (nextJsFiles.length > 0) {
      console.log('\n  Next.js JavaScript files loaded:');
      nextJsFiles.slice(0, 10).forEach((file) => {
        const url = new URL(file.url);
        const filename = url.pathname.split('/').pop();
        console.log(`    ✓ ${filename}`);
      });
      if (nextJsFiles.length > 10) {
        console.log(`    ... and ${nextJsFiles.length - 10} more`);
      }
    }

    if (apiRequests.length > 0) {
      console.log('\n  API requests:');
      apiRequests.forEach((req) => {
        const status = req.status === 200 ? '✓' : '✗';
        const url = new URL(req.url);
        const path = url.pathname + url.search;
        console.log(`    ${status} ${req.status} ${path}`);
      });
    }

    if (failedRequests.length > 0) {
      console.log('\n  FAILED REQUESTS:');
      failedRequests.forEach((req) => {
        console.log(`    ✗ ${req.status} ${req.url}`);
      });
    } else {
      console.log('\n  ✓ No failed network requests');
    }

    // Check for specific errors
    console.log('\n[STEP 5] CHECKING FOR KNOWN ISSUES\n');
    const undefinedError = consoleMessages.some(
      (m) =>
        m.message.includes("Cannot read properties of undefined (reading 'enabled')") ||
        m.message.includes("Cannot read property 'enabled' of undefined")
    );
    const atlasZones404 = failedRequests.some((r) =>
      r.url.includes('/api/atlas/zones') && r.status === 404
    );

    console.log(`Issue 1: "Cannot read properties of undefined (reading 'enabled')"`);
    console.log(`  Status: ${undefinedError ? '✗ FOUND' : '✓ NOT FOUND'}\n`);

    console.log(`Issue 2: "GET /api/atlas/zones 404"`);
    console.log(`  Status: ${atlasZones404 ? '✗ FOUND' : '✓ NOT FOUND'}\n`);

    // Page content check
    console.log('[STEP 6] PAGE CONTENT VERIFICATION\n');
    const pageTitle = await page.title();
    const hasPageContent = await page.locator('body').isVisible();
    const h1 = await page.locator('h1').first().textContent();

    console.log(`  Page title: "${pageTitle}"`);
    console.log(`  Body visible: ${hasPageContent ? '✓ Yes' : '✗ No'}`);
    if (h1) {
      console.log(`  Main heading: "${h1}"`);
    }

    // Screenshot
    console.log('\n[STEP 7] CAPTURING SCREENSHOT\n');
    const screenshotPath = '/tmp/ui-screenshots/sports-guide-config-detailed.png';
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`  Screenshot saved: ${screenshotPath}`);

    // Final result
    console.log('\n====================================');
    console.log('TEST RESULT: ', {
      undefinedErrorFound: undefinedError,
      atlasZones404Found: atlasZones404,
      failedRequestsCount: failedRequests.length,
      pageErrorsCount: pageErrors.length,
      consoleErrorsCount: consoleMessages.filter((m) => m.type === 'error').length
    });

    const allPassed = !undefinedError && !atlasZones404 && failedRequests.length === 0;
    console.log(`OVERALL STATUS: ${allPassed ? '✓ PASSED' : '✗ FAILED'}`);
    console.log('====================================');

  } catch (error) {
    console.error('\nTEST EXCEPTION:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/test-error.png',
      fullPage: true
    });
  } finally {
    await browser.close();
  }
}

testSportsGuideConfigDetailed();
