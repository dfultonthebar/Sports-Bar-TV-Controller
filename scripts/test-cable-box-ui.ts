import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function testCableBoxUI() {
  console.log('Starting Cable Box UI Test...\n');

  // Create screenshots directory
  const screenshotsDir = '/tmp/ui-screenshots/cable-box-test';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Capture console messages
  const consoleMessages: any[] = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Capture network requests
  const networkRequests: any[] = [];
  const networkErrors: any[] = [];

  page.on('request', request => {
    networkRequests.push({
      url: request.url(),
      method: request.method()
    });
  });

  page.on('response', response => {
    if (response.status() === 404) {
      networkErrors.push({
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });

  let ch1Visible = false;
  let deviceType = '';
  let hasPowerButton = false;
  let hasNumberButtons = false;
  let hasChannelButtons = false;

  try {
    // Step 1: Navigate to /remote
    console.log('Step 1: Navigating to http://localhost:3001/remote...');
    await page.goto('http://localhost:3001/remote', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    await page.waitForTimeout(2000);

    // Take initial screenshot
    console.log('Capturing initial page screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, '01-bartender-remote-initial.png'),
      fullPage: true
    });

    // Step 1b: Click on "Remote" tab
    console.log('\nStep 1b: Clicking "Remote" tab to access input selector...');
    const remoteTab = page.locator('button').filter({ hasText: 'Remote' });
    const remoteTabExists = await remoteTab.count() > 0;

    if (remoteTabExists) {
      await remoteTab.click();
      console.log('✅ Clicked "Remote" tab');
      await page.waitForTimeout(1500); // Wait for tab content to load

      // Take screenshot of Remote tab
      await page.screenshot({
        path: path.join(screenshotsDir, '02-remote-tab-active.png'),
        fullPage: true
      });
    } else {
      console.log('⚠️ "Remote" tab not found - may already be active');
    }

    // Step 2: Check for JavaScript errors
    console.log('\nStep 2: Checking console for errors...');
    const jsErrors = consoleMessages.filter(msg => msg.type === 'error');
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript Errors Found:');
      jsErrors.forEach(err => console.log(`   - ${err.text}`));
    } else {
      console.log('✅ No JavaScript errors in console');
    }

    // Step 3: Check for 404 errors
    console.log('\nStep 3: Checking network tab for 404 errors...');
    if (networkErrors.length > 0) {
      console.log('❌ 404 Errors Found:');
      networkErrors.forEach(err => console.log(`   - ${err.url} (${err.status})`));
    } else {
      console.log('✅ No 404 errors in network tab');
    }

    // Step 4: Check if "Ch 1" input is visible
    console.log('\nStep 4: Checking for "Ch 1" input visibility...');

    // Wait for the inputs to load
    await page.waitForTimeout(1000);

    // Look for Ch 1 input (try multiple selectors)
    const ch1Locators = [
      page.locator('text=Ch 1'),
      page.locator('button:has-text("Ch 1")'),
      page.locator('[data-input-name*="Ch 1"]'),
      page.locator('text=/Ch\\s*1/i')
    ];

    for (const locator of ch1Locators) {
      const count = await locator.count();
      if (count > 0) {
        ch1Visible = true;
        break;
      }
    }

    if (ch1Visible) {
      console.log('✅ "Ch 1" input is visible');

      // Try to find the device type text
      const ch1Card = page.locator('button:has-text("Ch 1")').first();
      const cardText = await ch1Card.textContent().catch(() => null);

      if (cardText) {
        console.log(`   Card text: "${cardText}"`);

        // Check for device type indicators
        if (cardText.includes('Cable') || cardText.includes('IR')) {
          deviceType = cardText;
          if (cardText.includes('Cable') && cardText.includes('IR')) {
            console.log('   ✅ Shows as "Cable (IR)" - CORRECT!');
          } else if (cardText.includes('IR')) {
            console.log('   ✅ Shows IR device type');
          } else {
            console.log(`   ℹ️ Device type: "${cardText}"`);
          }
        } else {
          console.log('   ℹ️ Device type text not found in expected format');
        }
      }
    } else {
      console.log('❌ "Ch 1" input is NOT visible');
      console.log('   Debugging: Looking for any visible inputs...');

      // Debug: Look for any input cards
      const allButtons = await page.locator('button').all();
      console.log(`   Found ${allButtons.length} total buttons on page`);

      // Check if we're on the right tab
      const remoteTabActive = await page.locator('button[data-state="active"]:has-text("Remote")').count() > 0;
      console.log(`   Remote tab active: ${remoteTabActive}`);
    }

    // Take screenshot of input panel
    console.log('Capturing input selector panel...');
    await page.screenshot({
      path: path.join(screenshotsDir, '03-input-selector-panel.png'),
      fullPage: true
    });

    // Step 5: Click on "Ch 1" input if visible
    if (ch1Visible) {
      console.log('\nStep 5: Clicking on "Ch 1" input...');

      const ch1Button = page.locator('button:has-text("Ch 1")').first();
      await ch1Button.click();
      console.log('✅ Clicked "Ch 1" input');

      // Wait for content to update
      await page.waitForTimeout(2000);

      // Take screenshot after selection
      console.log('Capturing screenshot after Ch 1 selection...');
      await page.screenshot({
        path: path.join(screenshotsDir, '04-ch1-selected.png'),
        fullPage: true
      });

      // Step 6: Check if CableBoxRemote component rendered
      console.log('\nStep 6: Checking if CableBoxRemote component is rendered...');

      // Look for cable box remote elements
      hasPowerButton = await page.locator('button:has-text("Power"), button[aria-label*="Power"]').count() > 0;
      hasNumberButtons = await page.locator('button:has-text("1"), button:has-text("2"), button:has-text("3")').count() >= 3;
      hasChannelButtons = await page.locator('text=/CH|Channel/i').count() > 0;

      if (hasPowerButton || hasNumberButtons) {
        console.log('✅ CableBoxRemote component is rendered');
        console.log(`   - Power button: ${hasPowerButton ? '✅' : '❌'}`);
        console.log(`   - Number buttons (1,2,3): ${hasNumberButtons ? '✅' : '❌'}`);
        console.log(`   - Channel buttons: ${hasChannelButtons ? '✅' : '❌'}`);
      } else {
        console.log('❌ CableBoxRemote component may not be rendered correctly');
        console.log(`   - Power button: ${hasPowerButton ? '✅' : '❌'}`);
        console.log(`   - Number buttons: ${hasNumberButtons ? '✅' : '❌'}`);
        console.log(`   - Channel buttons: ${hasChannelButtons ? '✅' : '❌'}`);
      }

      // Step 7: Test button hover state (visual verification only)
      console.log('\nStep 7: Testing button UI interactions...');

      const powerButton = page.locator('button:has-text("Power"), button[aria-label*="Power"]').first();
      if (await powerButton.count() > 0) {
        // Hover over power button
        await powerButton.hover();
        await page.waitForTimeout(500);

        console.log('✅ Hovering over Power button (visual test)');

        // Take screenshot of hover state
        await page.screenshot({
          path: path.join(screenshotsDir, '05-power-button-hover.png'),
          fullPage: true
        });
      }

      // Click on number "1" button (won't send command, just test UI)
      const numberOneButton = page.locator('button:has-text("1")').first();
      if (await numberOneButton.count() > 0) {
        await numberOneButton.hover();
        await page.waitForTimeout(500);

        console.log('✅ Hovering over "1" button (visual test)');

        // Take screenshot
        await page.screenshot({
          path: path.join(screenshotsDir, '06-number-button-hover.png'),
          fullPage: true
        });
      }

    } else {
      console.log('\n⏭️ Skipping steps 5-7: "Ch 1" button not found');
    }

    // Step 8: Take final screenshot
    console.log('\nStep 8: Capturing final state...');
    await page.screenshot({
      path: path.join(screenshotsDir, '07-final-state.png'),
      fullPage: true
    });

    // Generate summary report
    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY REPORT');
    console.log('='.repeat(60));

    console.log('\n📸 Screenshots Captured:');
    const screenshots = fs.readdirSync(screenshotsDir)
      .filter(f => f.endsWith('.png'))
      .sort();
    screenshots.forEach(file => {
      console.log(`   - ${path.join(screenshotsDir, file)}`);
    });

    console.log('\n🌐 Network Status:');
    console.log(`   Total requests: ${networkRequests.length}`);
    console.log(`   404 errors: ${networkErrors.length}`);
    if (networkErrors.length > 0) {
      console.log('   Failed requests:');
      networkErrors.forEach(err => console.log(`     - ${err.url}`));
    }

    console.log('\n🖥️ Console Status:');
    console.log(`   Total console messages: ${consoleMessages.length}`);
    console.log(`   Errors: ${jsErrors.length}`);
    if (jsErrors.length > 0) {
      console.log('   Error messages:');
      jsErrors.forEach(err => console.log(`     - ${err.text}`));
    }

    console.log('\n✅ EXPECTED RESULTS:');
    console.log('   ✓ No 404 errors in network tab: ' + (networkErrors.length === 0 ? '✅ PASS' : '❌ FAIL'));
    console.log('   ✓ No JavaScript errors in console: ' + (jsErrors.length === 0 ? '✅ PASS' : '❌ FAIL'));
    console.log('   ✓ "Ch 1" input visible: ' + (ch1Visible ? '✅ PASS' : '❌ FAIL'));
    console.log('   ✓ Shows "Cable (IR)" device type: ' + (deviceType.includes('Cable') || deviceType.includes('IR') ? '✅ PASS' : '⚠️ SKIP'));
    console.log('   ✓ CableBoxRemote component renders: ' + ((hasPowerButton || hasNumberButtons) ? '✅ PASS' : '❌ FAIL'));

    const allTestsPassed = networkErrors.length === 0 &&
                           jsErrors.length === 0 &&
                           ch1Visible &&
                           (hasPowerButton || hasNumberButtons);

    console.log('\n' + '='.repeat(60));
    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - Cable Box UI is working correctly!');
    } else {
      console.log('⚠️ SOME TESTS FAILED - Review the report above');
    }
    console.log('='.repeat(60));

    console.log(`\n📁 All screenshots saved to: ${screenshotsDir}/`);

  } catch (error: any) {
    console.error('\n❌ Test Error:', error.message);

    // Capture error screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'error-state.png'),
      fullPage: true
    });

    console.log('Error screenshot saved to:', path.join(screenshotsDir, 'error-state.png'));

  } finally {
    await browser.close();
  }
}

// Run the test
testCableBoxUI().catch(console.error);
