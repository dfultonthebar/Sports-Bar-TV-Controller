import { chromium } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const BARTENDER_URL = 'http://24.123.87.42:3001/remote';

async function captureScreenshots() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Capture console messages and errors
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    console.log(text);
  });

  // Capture network requests
  const networkErrors: string[] = [];
  page.on('requestfailed', request => {
    networkErrors.push(`Failed: ${request.url()}`);
  });

  try {
    console.log('Navigating to bartender remote page...');
    await page.goto(BARTENDER_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for page to fully render

    // Screenshot 1: Main remote control page with tab navigation
    console.log('Capturing main remote page...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-bartender-remote-main.png`,
      fullPage: true
    });

    // Screenshot 2: Close-up of the bottom tab navigation
    const tabBar = page.locator('[role="tablist"]');
    if (await tabBar.isVisible()) {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/02-tab-navigation-closeup.png`,
        fullPage: false
      });
    }

    // Wait for any animations
    await page.waitForTimeout(500);

    // Screenshot 3: Click on the Remote tab (Gamepad2 icon)
    console.log('Looking for Remote tab with Gamepad2 icon...');
    const remoteTab = page.locator('button[aria-label*="Remote"], button:has-text("Remote"), [role="tab"]:has-text("Remote")').first();

    if (await remoteTab.isVisible({ timeout: 5000 })) {
      console.log('Found Remote tab, clicking...');
      await remoteTab.click();
      await page.waitForTimeout(1500); // Wait for tab content to load

      // Screenshot showing Remote tab is active
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-remote-tab-selected.png`,
        fullPage: true
      });
    } else {
      console.log('Remote tab not found or not visible');
    }

    // Screenshot 4: Look for input/device selector (Cable Box options)
    console.log('Looking for device/input selector...');

    // Try to find and click on Cable Box 2
    const cableBoxOptions = page.locator('text=Cable Box').all();
    const cableBoxButtons = page.locator('button:has-text("Cable Box")').all();

    console.log(`Found ${await cableBoxOptions.length} Cable Box references`);

    // Try clicking on any Cable Box 2 option
    const cableBox2 = page.locator('text=Cable Box 2, button:has-text("Cable Box 2")').first();
    const cableBoxAny = page.locator('button').filter({ hasText: /Cable Box/ }).first();

    if (await cableBoxAny.isVisible({ timeout: 5000 })) {
      console.log('Found Cable Box button, clicking...');
      await cableBoxAny.click();
      await page.waitForTimeout(1500);

      // Screenshot showing Cable Box 2 selection
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/04-cable-box-2-selection.png`,
        fullPage: true
      });
    } else {
      console.log('Cable Box option not immediately visible, scrolling to find it...');

      // Scroll down to find the cable box option
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000);

      // Try again
      const cableBoxButton = page.locator('button').filter({ hasText: /Cable/ }).first();
      if (await cableBoxButton.isVisible({ timeout: 5000 })) {
        console.log('Found Cable Box after scrolling, clicking...');
        await cableBoxButton.click();
        await page.waitForTimeout(1500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/04-cable-box-2-selection.png`,
          fullPage: true
        });
      }
    }

    // Wait a moment for interface to respond
    await page.waitForTimeout(1000);

    // Screenshot 5: Remote control interface after selection
    console.log('Capturing remote control interface...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-remote-control-interface.png`,
      fullPage: true
    });

    // Screenshot 6: Look for any error messages or status indicators
    const errorElements = page.locator('[class*="error"], [class*="Error"], [class*="warning"], [class*="Warning"], [role="alert"]').all();
    console.log(`Found ${await errorElements.length} potential error/warning elements`);

    const errors = page.locator('[class*="error"], [class*="Error"]');
    if (await errors.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found error elements, capturing...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/06-error-messages.png`,
        fullPage: true
      });
    }

    // Scroll to top and capture full view
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Screenshot 7: Full page view for reference
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-full-page-view.png`,
      fullPage: true
    });

    // Check page source for any hidden data
    const pageContent = await page.content();
    const hasCableBox2 = pageContent.includes('Cable Box 2');
    const hasCEC = pageContent.includes('CEC');
    const hasIR = pageContent.includes('IR');

    console.log('\nPage Analysis:');
    console.log(`- Contains "Cable Box 2": ${hasCableBox2}`);
    console.log(`- Contains "CEC": ${hasCEC}`);
    console.log(`- Contains "IR": ${hasIR}`);

    // Get detailed element information
    console.log('\nAvailable buttons:');
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    for (let i = 0; i < Math.min(buttonCount, 15); i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}"`);
    }

    // Console logs
    if (consoleLogs.length > 0) {
      console.log('\nBrowser Console Output:');
      consoleLogs.forEach(log => console.log(log));

      // Save console logs to file
      fs.writeFileSync(
        `${SCREENSHOT_DIR}/console-logs.txt`,
        consoleLogs.join('\n')
      );
    }

    // Network errors
    if (networkErrors.length > 0) {
      console.log('\nNetwork Errors:');
      networkErrors.forEach(err => console.log(err));

      fs.writeFileSync(
        `${SCREENSHOT_DIR}/network-errors.txt`,
        networkErrors.join('\n')
      );
    }

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);

  } catch (error) {
    console.error('Error during capture:', error);

    // Capture error state
    try {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/error-state.png`,
        fullPage: true
      });
    } catch (screenshotError) {
      console.error('Could not capture error state:', screenshotError);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
