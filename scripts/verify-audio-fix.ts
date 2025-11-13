import { chromium, Browser, Page, BrowserContext } from 'playwright';

interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

interface NetworkRequest {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseBody?: any;
}

async function verifyAudioFix() {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const consoleMessages: ConsoleMessage[] = [];
  const networkRequests: NetworkRequest[] = [];

  try {
    console.log('='.repeat(80));
    console.log('AUDIO PROCESSOR INTEGRATION FIX VERIFICATION');
    console.log('='.repeat(80));
    console.log('');

    // Launch browser with DevTools enabled
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1
    });

    page = await context.newPage();

    // Capture console messages
    page.on('console', msg => {
      const timestamp = Date.now();
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp
      });
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture network requests
    page.on('response', async response => {
      const request = response.request();
      const url = request.url();

      // Only track API requests
      if (url.includes('/api/')) {
        let responseBody = null;
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('application/json')) {
            responseBody = await response.json();
          }
        } catch (e) {
          // Ignore parsing errors
        }

        const networkEntry: NetworkRequest = {
          url,
          method: request.method(),
          status: response.status(),
          statusText: response.statusText(),
          responseBody
        };

        networkRequests.push(networkEntry);

        console.log(`[NETWORK] ${networkEntry.method} ${url} → ${networkEntry.status} ${networkEntry.statusText}`);
      }
    });

    // STEP 1: Navigate to Bartender Remote
    console.log('\n--- STEP 1: Navigate to Bartender Remote ---');
    console.log('URL: http://localhost:3001/remote');

    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('✓ Page loaded successfully');

    // Wait a moment for initial render
    await page.waitForTimeout(1000);

    // Take screenshot of initial page
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-remote-initial-load.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: 01-remote-initial-load.png');

    // STEP 2: Click Audio Tab
    console.log('\n--- STEP 2: Click Audio Tab ---');

    // Find the Audio tab button
    const audioTabButton = page.locator('button').filter({ hasText: 'Audio' });

    // Check if tab exists
    const audioTabExists = await audioTabButton.count() > 0;
    console.log(`Audio tab found: ${audioTabExists}`);

    if (!audioTabExists) {
      console.error('❌ ERROR: Audio tab not found!');
      await page.screenshot({
        path: '/tmp/ui-screenshots/ERROR-no-audio-tab.png',
        fullPage: true
      });
      throw new Error('Audio tab not found');
    }

    // Click the Audio tab
    await audioTabButton.click();
    console.log('✓ Clicked Audio tab');

    // Wait for tab transition and data loading (3 seconds as specified)
    console.log('Waiting 3 seconds for data to load...');
    await page.waitForTimeout(3000);

    // Take screenshot after clicking Audio tab
    await page.screenshot({
      path: '/tmp/ui-screenshots/02-audio-fix-verification.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: 02-audio-fix-verification.png');

    // STEP 3: Check for Audio Groups
    console.log('\n--- STEP 3: Check for Audio Groups ---');

    // Look for various audio control elements
    const audioGroupHeaders = page.locator('[data-testid*="audio-group"], .audio-group, h3:has-text("Zone"), h3:has-text("Group")');
    const volumeSliders = page.locator('input[type="range"], [role="slider"]');
    const muteButtons = page.locator('button:has-text("Mute"), button[aria-label*="mute" i]');
    const sourceDropdowns = page.locator('select, [role="combobox"]');

    const audioGroupsCount = await audioGroupHeaders.count();
    const volumeSlidersCount = await volumeSliders.count();
    const muteButtonsCount = await muteButtons.count();
    const sourceDropdownsCount = await sourceDropdowns.count();

    console.log(`Audio groups found: ${audioGroupsCount}`);
    console.log(`Volume sliders found: ${volumeSlidersCount}`);
    console.log(`Mute buttons found: ${muteButtonsCount}`);
    console.log(`Source dropdowns found: ${sourceDropdownsCount}`);

    // Look for error messages
    const errorMessages = page.locator('[role="alert"], .error, .text-red-500, .text-destructive');
    const errorCount = await errorMessages.count();

    if (errorCount > 0) {
      console.log(`⚠️  Found ${errorCount} error message(s) on page`);
      for (let i = 0; i < errorCount; i++) {
        const errorText = await errorMessages.nth(i).textContent();
        console.log(`   Error ${i + 1}: ${errorText}`);
      }
    } else {
      console.log('✓ No error messages found on page');
    }

    // Take screenshot showing audio groups
    await page.screenshot({
      path: '/tmp/ui-screenshots/03-audio-groups-loaded.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: 03-audio-groups-loaded.png');

    // STEP 4: Analyze Console Errors
    console.log('\n--- STEP 4: Analyze Console Messages ---');

    const errorLogs = consoleMessages.filter(msg => msg.type === 'error');
    const warningLogs = consoleMessages.filter(msg => msg.type === 'warning');

    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errorLogs.length}`);
    console.log(`Warnings: ${warningLogs.length}`);

    if (errorLogs.length > 0) {
      console.log('\n⚠️  Console Errors Found:');
      errorLogs.forEach((log, index) => {
        console.log(`  ${index + 1}. ${log.text}`);
      });
    } else {
      console.log('✓ No console errors detected');
    }

    // Check specifically for "Failed to fetch groups" error
    const fetchGroupsError = consoleMessages.find(msg =>
      msg.text.includes('Failed to fetch groups') ||
      msg.text.includes('Failed to fetch audio groups')
    );

    if (fetchGroupsError) {
      console.log('❌ CRITICAL: "Failed to fetch groups" error still present!');
    } else {
      console.log('✓ No "Failed to fetch groups" error found');
    }

    // STEP 5: Analyze Network Requests
    console.log('\n--- STEP 5: Analyze Network Requests ---');

    // Find the Atlas groups API request
    const atlasGroupsRequests = networkRequests.filter(req =>
      req.url.includes('/api/atlas/groups')
    );

    console.log(`Atlas groups API requests: ${atlasGroupsRequests.length}`);

    if (atlasGroupsRequests.length === 0) {
      console.log('⚠️  WARNING: No API request to /api/atlas/groups detected');
    } else {
      atlasGroupsRequests.forEach((req, index) => {
        console.log(`\nRequest ${index + 1}:`);
        console.log(`  URL: ${req.url}`);
        console.log(`  Method: ${req.method}`);
        console.log(`  Status: ${req.status} ${req.statusText}`);

        if (req.responseBody) {
          console.log(`  Response: ${JSON.stringify(req.responseBody, null, 2)}`);
        }

        if (req.status === 200) {
          console.log('  ✓ Request successful (HTTP 200)');
        } else if (req.status === 400) {
          console.log('  ❌ Request failed (HTTP 400 - Bad Request)');
        } else {
          console.log(`  ⚠️  Unexpected status: ${req.status}`);
        }
      });
    }

    // Take screenshot for network tab reference
    await page.screenshot({
      path: '/tmp/ui-screenshots/04-network-success.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: 04-network-success.png');

    // STEP 6: Verify UI Elements
    console.log('\n--- STEP 6: Verify UI Elements ---');

    // Try to get group names if visible
    try {
      const groupNameElements = page.locator('h3, h4, [data-testid*="group-name"], .group-name');
      const groupNamesCount = await groupNameElements.count();

      if (groupNamesCount > 0) {
        console.log(`\nGroup Names (${groupNamesCount} found):`);
        for (let i = 0; i < Math.min(groupNamesCount, 10); i++) {
          const name = await groupNameElements.nth(i).textContent();
          if (name && name.trim()) {
            console.log(`  ${i + 1}. ${name.trim()}`);
          }
        }
      }
    } catch (e) {
      console.log('Could not extract group names');
    }

    // Check if controls appear interactive
    const buttons = page.locator('button');
    const buttonsCount = await buttons.count();
    console.log(`\nInteractive elements:`);
    console.log(`  Buttons: ${buttonsCount}`);
    console.log(`  Volume sliders: ${volumeSlidersCount}`);
    console.log(`  Source dropdowns: ${sourceDropdownsCount}`);

    // Final screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/05-audio-controls-working.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: 05-audio-controls-working.png');

    // FINAL REPORT
    console.log('\n' + '='.repeat(80));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(80));

    const hasAudioGroups = audioGroupsCount > 0 || volumeSlidersCount > 0;
    const noConsoleErrors = errorLogs.length === 0;
    const noFetchError = !fetchGroupsError;
    const atlasApiSuccess = atlasGroupsRequests.some(req => req.status === 200);
    const atlasApiFailed = atlasGroupsRequests.some(req => req.status === 400);

    console.log('\nTest Results:');
    console.log(`  1. Audio tab accessible: ${audioTabExists ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`  2. Audio groups displayed: ${hasAudioGroups ? '✓ PASS' : '❌ FAIL'} (${audioGroupsCount} groups)`);
    console.log(`  3. No console errors: ${noConsoleErrors ? '✓ PASS' : '❌ FAIL'} (${errorLogs.length} errors)`);
    console.log(`  4. No "fetch groups" error: ${noFetchError ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`  5. Atlas API returns 200: ${atlasApiSuccess ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`  6. Atlas API no longer 400: ${!atlasApiFailed ? '✓ PASS' : '❌ FAIL'}`);

    const allTestsPassed = audioTabExists && hasAudioGroups && noConsoleErrors && noFetchError && atlasApiSuccess && !atlasApiFailed;

    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('✓✓✓ ALL TESTS PASSED - BUG IS FIXED ✓✓✓');
    } else {
      console.log('❌❌❌ SOME TESTS FAILED - BUG MAY STILL EXIST ❌❌❌');
    }
    console.log('='.repeat(80));

    console.log('\nScreenshots saved to: /tmp/ui-screenshots/');
    console.log('  - 01-remote-initial-load.png');
    console.log('  - 02-audio-fix-verification.png');
    console.log('  - 03-audio-groups-loaded.png');
    console.log('  - 04-network-success.png');
    console.log('  - 05-audio-controls-working.png');

    return allTestsPassed;

  } catch (error: any) {
    console.error('\n❌ VERIFICATION FAILED WITH ERROR:');
    console.error(error.message);
    console.error(error.stack);

    // Capture error screenshot
    if (page) {
      try {
        await page.screenshot({
          path: '/tmp/ui-screenshots/ERROR-verification-failed.png',
          fullPage: true
        });
        console.log('\nError screenshot saved: ERROR-verification-failed.png');
      } catch (screenshotError) {
        console.error('Could not capture error screenshot:', screenshotError);
      }
    }

    return false;
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
      console.log('\n✓ Browser closed');
    }
  }
}

// Run the verification
verifyAudioFix()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
