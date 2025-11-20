import { chromium } from 'playwright';
import * as fs from 'fs';

const SCREENSHOT_DIR = '/tmp/ui-screenshots';
const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function captureDirectTVEditModal() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to device-config page...');
    await page.goto(DEVICE_CONFIG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Find and click DirecTV tab
    console.log('Clicking DirecTV tab...');
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    if (await directvTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await directvTab.click();
      await page.waitForTimeout(1500);
    }

    // Screenshot 1: DirecTV tab with devices
    console.log('Capturing DirecTV devices list...');
    await page.screenshot({
      path: `/tmp/directv-devices-list.png`,
      fullPage: true
    });
    console.log('Saved to /tmp/directv-devices-list.png');

    // The empty buttons (13, 14, 15, 17, 18, 19, etc.) are action buttons
    // Button indices: device button is at i, then icons follow
    // Pattern: device text at 12, 16, 20, 24, 28...
    // Icons at: 13, 14, 15 (for device 1), 17, 18, 19 (for device 2), etc.

    const allButtons = page.locator('button');

    // Let's click button 14 - should be an edit icon for the first device
    console.log('Clicking button 14 (likely edit icon for first device)...');
    const editButton = allButtons.nth(14);
    const editButtonText = await editButton.textContent();
    console.log(`Button 14 text: "${editButtonText}"`);

    await editButton.click();
    await page.waitForTimeout(1500);

    // Screenshot: After clicking what we think is edit button
    console.log('Capturing screen after clicking button 14...');
    await page.screenshot({
      path: `/tmp/directv-after-button14.png`,
      fullPage: false
    });

    // Check if a dialog/modal appeared
    const dialog = page.locator('[role="dialog"]');
    const modalVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Modal visible after button 14 click: ${modalVisible}`);

    if (modalVisible) {
      console.log('Dialog found! Capturing detailed modal...');

      // Get form fields
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} input fields`);

      // Get select dropdowns
      const selects = page.locator('select');
      const selectCount = await selects.count();
      console.log(`Found ${selectCount} select elements`);

      // List all form fields
      console.log('\nForm fields:');
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const id = await input.getAttribute('id');
        const label = await input.getAttribute('aria-label');
        const placeholder = await input.getAttribute('placeholder');
        console.log(`  Input ${i}: type="${type}", name="${name}", label="${label}", placeholder="${placeholder}"`);
      }

      for (let i = 0; i < selectCount; i++) {
        const select = selects.nth(i);
        const name = await select.getAttribute('name');
        const id = await select.getAttribute('id');
        const label = await select.getAttribute('aria-label');
        console.log(`  Select ${i}: name="${name}", id="${id}", label="${label}"`);
      }

      // Capture full dialog
      const dialogBox = await dialog.boundingBox();
      if (dialogBox) {
        console.log(`Dialog box: ${JSON.stringify(dialogBox)}`);

        // Full screenshot
        await page.screenshot({
          path: `/tmp/directv-edit-window.png`,
          fullPage: false
        });

        // Zoomed screenshot
        await page.screenshot({
          path: `/tmp/directv-edit-modal-zoomed.png`,
          clip: {
            x: Math.max(0, dialogBox.x - 10),
            y: Math.max(0, dialogBox.y - 10),
            width: Math.min(1920, dialogBox.width + 20),
            height: Math.min(1080, dialogBox.height + 20)
          }
        });
      }

      console.log('\nModal screenshots saved!');
      console.log('- /tmp/directv-edit-window.png');
      console.log('- /tmp/directv-edit-modal-zoomed.png');
    } else {
      console.log('No modal found after button 14 click');

      // Try other buttons
      console.log('\nTrying other action buttons...');
      for (let i = 13; i < 25; i++) {
        const btn = allButtons.nth(i);
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}"`);
      }
    }

  } catch (error) {
    console.error('Error during capture:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureDirectTVEditModal().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
