import { chromium } from 'playwright';

async function testCableBoxClicks() {
  console.log('Starting cable box click test...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Track console messages and errors
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });

  try {
    console.log('Step 1: Navigate to http://localhost:3001/remote');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    console.log('Step 2: Click on "Remote" tab');
    const remoteTab = page.locator('button').filter({ hasText: 'Remote' });
    await remoteTab.click();
    await page.waitForTimeout(1000);

    console.log('Step 3: Verify selector is visible');
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-selector-view.png',
      fullPage: true
    });
    console.log('✅ Screenshot: /tmp/ui-screenshots/01-selector-view.png\n');

    // Test Cable Box 1
    console.log('Step 4: Click on "Cable Box 1"');
    const cableBox1 = page.locator('text=Cable Box 1').first();
    await cableBox1.click();
    await page.waitForTimeout(2000);

    console.log('Step 5: Verify CableBoxRemote rendered for Cable Box 1');
    await page.screenshot({
      path: '/tmp/ui-screenshots/02-cable-box-1-remote.png',
      fullPage: true
    });
    console.log('✅ Screenshot: /tmp/ui-screenshots/02-cable-box-1-remote.png');

    // Check for remote control elements
    const hasChannelPresets = await page.locator('text=/Channel Presets/i').count() > 0;
    const hasDirectEntry = await page.locator('text=/Direct Entry/i').count() > 0;
    const hasNumberPad = await page.locator('button:has-text("1")').count() > 0;

    console.log(`  ${hasChannelPresets ? '✅' : '❌'} Channel Presets section visible`);
    console.log(`  ${hasDirectEntry ? '✅' : '❌'} Direct Entry section visible`);
    console.log(`  ${hasNumberPad ? '✅' : '❌'} Number pad visible\n`);

    // Go back to selector
    console.log('Step 6: Return to selector');
    const backButton = page.locator('button').filter({ hasText: /back/i }).first();
    if (await backButton.count() > 0) {
      await backButton.click();
    } else {
      // Click Remote tab again
      await remoteTab.click();
    }
    await page.waitForTimeout(1000);

    // Test Cable Box 2
    console.log('Step 7: Click on "Cable Box 2"');
    const cableBox2 = page.locator('text=Cable Box 2').first();
    await cableBox2.click();
    await page.waitForTimeout(2000);

    console.log('Step 8: Verify CableBoxRemote rendered for Cable Box 2');
    await page.screenshot({
      path: '/tmp/ui-screenshots/03-cable-box-2-remote.png',
      fullPage: true
    });
    console.log('✅ Screenshot: /tmp/ui-screenshots/03-cable-box-2-remote.png');

    // Check for remote control elements again
    const hasChannelPresets2 = await page.locator('text=/Channel Presets/i').count() > 0;
    const hasDirectEntry2 = await page.locator('text=/Direct Entry/i').count() > 0;
    const hasNumberPad2 = await page.locator('button:has-text("1")').count() > 0;

    console.log(`  ${hasChannelPresets2 ? '✅' : '❌'} Channel Presets section visible`);
    console.log(`  ${hasDirectEntry2 ? '✅' : '❌'} Direct Entry section visible`);
    console.log(`  ${hasNumberPad2 ? '✅' : '❌'} Number pad visible\n`);

    // Check for errors
    console.log('Step 9: Browser console check');
    if (consoleErrors.length > 0) {
      console.log(`❌ Console Errors (${consoleErrors.length}):`);
      consoleErrors.slice(0, 5).forEach(err => {
        console.log(`  - ${err}`);
      });
    } else {
      console.log('✅ No console errors\n');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('✅ Cable Box 1 visible and clickable');
    console.log('✅ Cable Box 2 visible and clickable');
    console.log(`${hasChannelPresets && hasDirectEntry ? '✅' : '❌'} Cable Box 1 remote rendered correctly`);
    console.log(`${hasChannelPresets2 && hasDirectEntry2 ? '✅' : '❌'} Cable Box 2 remote rendered correctly`);
    console.log(`${consoleErrors.length === 0 ? '✅' : '❌'} No console errors`);
    console.log(`\n📸 Screenshots: 3 captured`);
    console.log(`📁 Location: /tmp/ui-screenshots/`);
    console.log('='.repeat(60));

    const allPassed = hasChannelPresets && hasDirectEntry && hasChannelPresets2 && hasDirectEntry2 && consoleErrors.length === 0;
    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}\n`);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
    console.log('📸 Error screenshot: /tmp/ui-screenshots/error-state.png');
    throw error;
  } finally {
    await browser.close();
  }
}

testCableBoxClicks().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
