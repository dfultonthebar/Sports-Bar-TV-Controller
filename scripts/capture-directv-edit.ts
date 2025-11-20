import { chromium } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function captureDirectTVEditWindow() {
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

  try {
    console.log('Navigating to device-config page...');
    await page.goto(DEVICE_CONFIG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // Wait for page to fully render

    // Screenshot 1: Main device-config page
    console.log('Capturing main device-config page...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-device-config-main.png`,
      fullPage: true
    });

    // Look for DirecTV tab - try multiple selectors
    console.log('Looking for DirecTV tab...');

    let directvTabFound = false;

    // Try different selectors for the DirecTV tab
    const tabSelectors = [
      'button:has-text("DirecTV")',
      'button:has-text("DIRECTV")',
      'button:has-text("DirectTV")',
      '[role="tab"]:has-text("DirecTV")',
      '[role="tab"]:has-text("DIRECTV")',
      'button[aria-label*="DirecTV"]',
      'button[aria-label*="DIRECTV"]'
    ];

    for (const selector of tabSelectors) {
      try {
        const tab = page.locator(selector).first();
        if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`Found DirecTV tab with selector: ${selector}`);
          await tab.click();
          await page.waitForTimeout(1500);
          directvTabFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!directvTabFound) {
      console.log('DirecTV tab not found, analyzing page structure...');

      // List all tabs to help debug
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`Found ${buttonCount} buttons total`);

      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        console.log(`Button ${i}: text="${text?.trim()}", aria-label="${ariaLabel}"`);
      }
    }

    // Screenshot 2: After tab selection
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-directv-tab-selected.png`,
      fullPage: true
    });

    // Wait for devices to load
    await page.waitForTimeout(1000);

    // Look for device buttons - they should be clickable cards/buttons
    console.log('Searching for DirecTV device cards...');
    const allButtons = page.locator('button');
    const allButtonCount = await allButtons.count();

    // Find a device button (looks like "Direct TV 1h24/100192.168.5.121:8080Input: 5")
    let clickedDevice = false;
    for (let i = 0; i < allButtonCount; i++) {
      const button = allButtons.nth(i);
      const text = await button.textContent();
      if (text && text.includes('Direct TV') && text.includes('192.168')) {
        console.log(`Found device button: "${text?.substring(0, 50)}..."`);
        console.log('Clicking device button to open edit modal...');
        await button.click();
        await page.waitForTimeout(1500);
        clickedDevice = true;
        break;
      }
    }

    if (!clickedDevice) {
      console.log('Device button not found, trying alternative approach...');
      // Try clicking on the first non-empty button after "Add DirecTV"
      const deviceButtons = page.locator('button').filter({ hasText: /Direct TV/ });
      const deviceCount = await deviceButtons.count();
      console.log(`Found ${deviceCount} buttons with "Direct TV" text`);

      if (deviceCount > 0) {
        console.log('Clicking first Direct TV button...');
        await deviceButtons.first().click();
        await page.waitForTimeout(1500);
        clickedDevice = true;
      }
    }

    if (clickedDevice) {
      console.log('Device button clicked, looking for modal...');

      // Screenshot 3: After clicking Edit button
      console.log('Capturing modal/dialog after Edit click...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/03-directv-edit-modal.png`,
        fullPage: false
      });

      // Check for form elements (inputs, selects, textareas)
      const inputs = page.locator('input');
      const selects = page.locator('select');
      const inputCount = await inputs.count();
      const selectCount = await selects.count();

      console.log(`Found ${inputCount} input elements`);
      console.log(`Found ${selectCount} select elements`);

      // List form fields for debugging
      console.log('\nForm fields found:');
      for (let i = 0; i < Math.min(inputCount, 15); i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`  Input ${i}: type="${type}", name="${name}", id="${id}", placeholder="${placeholder}"`);
      }

      // Take a zoomed screenshot of just the modal area if it exists
      const modal = page.locator('[role="dialog"], .modal, [class*="Modal"], [class*="modal"]').first();
      if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Found dialog/modal element');

        // Get bounding box for modal
        const box = await modal.boundingBox();
        if (box) {
          console.log(`Modal bounding box: ${JSON.stringify(box)}`);

          // Take a zoomed screenshot
          const viewport = await page.viewportSize();
          if (viewport) {
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/04-directv-edit-modal-zoomed.png`,
              clip: {
                x: Math.max(0, box.x - 20),
                y: Math.max(0, box.y - 20),
                width: Math.min(viewport.width, box.width + 40),
                height: Math.min(viewport.height, box.height + 40)
              }
            });
          }
        }
      }

      // Scroll inside modal to see all fields
      await page.waitForTimeout(500);
      const scrollable = modal.isVisible().catch(() => false) ? modal : page;
      await page.evaluate(() => {
        const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="Modal"]');
        if (modals.length > 0) {
          const el = modals[0] as HTMLElement;
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop = el.scrollHeight;
          }
        }
      });

      await page.waitForTimeout(800);

      // Screenshot 5: Modal scrolled down
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/05-directv-edit-modal-scrolled.png`,
        fullPage: false
      });

    } else {
      console.log('Device button was not clicked');
    }

    // Screenshot 6: Full page view for reference
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-device-config-full.png`,
      fullPage: true
    });

    // Check page content
    const pageContent = await page.content();
    const hasDirectTV = pageContent.includes('DirecTV') || pageContent.includes('DIRECTV');
    const hasEditButton = pageContent.includes('Edit');

    console.log('\nPage Analysis:');
    console.log(`- Contains "DirecTV": ${hasDirectTV}`);
    console.log(`- Contains "Edit": ${hasEditButton}`);

    // Save console logs
    if (consoleLogs.length > 0) {
      console.log('\nBrowser Console Output:');
      consoleLogs.forEach(log => console.log(log));

      fs.writeFileSync(
        `${SCREENSHOT_DIR}/directv-edit-console-logs.txt`,
        consoleLogs.join('\n')
      );
    }

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);

  } catch (error) {
    console.error('Error during capture:', error);

    // Capture error state
    try {
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/directv-edit-error-state.png`,
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

captureDirectTVEditWindow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
