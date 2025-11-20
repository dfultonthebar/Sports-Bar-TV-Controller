import { chromium } from 'playwright';
import * as fs from 'fs';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function finalDirectTVCapture() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  // Log any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[Browser Error]', msg.text());
    }
  });

  try {
    console.log('Navigating to device-config page...');
    await page.goto(DEVICE_CONFIG_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click DirecTV tab
    console.log('Clicking DirecTV tab...');
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    await directvTab.click();
    await page.waitForTimeout(2000);

    // Find first edit device button
    console.log('Finding first edit device button...');
    const editButtons = page.locator('button[title="Edit device"]');
    const editCount = await editButtons.count();
    console.log(`Found ${editCount} edit device buttons`);

    if (editCount > 0) {
      console.log('Clicking edit button with force: true...');

      // Try multiple approaches
      const editBtn = editButtons.first();

      // Approach 1: Direct click with force
      await editBtn.click({ force: true });
      await page.waitForTimeout(2500);

      // Check for modal - try multiple selectors
      let modalFound = false;
      const dialog = page.locator('[role="dialog"]');
      let visible = await dialog.isVisible({ timeout: 1000 }).catch(() => false);

      if (visible) {
        console.log('Found modal with role="dialog"');
        modalFound = true;
      }

      if (!modalFound) {
        const fixedDiv = page.locator('div.fixed.inset-0');
        visible = await fixedDiv.isVisible({ timeout: 1000 }).catch(() => false);
        if (visible) {
          console.log('Found modal with fixed positioning');
          modalFound = true;
        }
      }

      if (!modalFound) {
        // Check if showEditDevice state was set
        const modalText = await page.locator('text=Edit DirecTV Receiver').isVisible({ timeout: 1000 }).catch(() => false);
        if (modalText) {
          console.log('Found "Edit DirecTV Receiver" text - modal is visible!');
          modalFound = true;
        }
      }

      console.log(`Modal found: ${modalFound}`);

      // Take screenshot regardless
      console.log('Capturing screenshot...');
      await page.screenshot({
        path: `/tmp/directv-edit-window.png`,
        fullPage: false
      });

      if (modalFound) {
        // Get form details
        const inputs = page.locator('input');
        const inputCount = await inputs.count();
        const selects = page.locator('select');
        const selectCount = await selects.count();

        console.log(`\nForm elements found:`);
        console.log(`- Inputs: ${inputCount}`);
        console.log(`- Selects: ${selectCount}`);

        // List inputs with their classes
        console.log('\nInput fields:');
        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          const type = await input.getAttribute('type');
          const placeholder = await input.getAttribute('placeholder');
          const className = await input.getAttribute('class');
          const value = await input.getAttribute('value');
          console.log(`  Input ${i}:`);
          console.log(`    type: ${type}`);
          console.log(`    placeholder: ${placeholder}`);
          console.log(`    class: ${className}`);
          console.log(`    value: ${value}`);
        }

        // List selects
        if (selectCount > 0) {
          console.log('\nSelect fields:');
          for (let i = 0; i < selectCount; i++) {
            const select = selects.nth(i);
            const className = await select.getAttribute('class');
            console.log(`  Select ${i}: class="${className}"`);
          }
        }

        // Get styling of input-dark class
        const inputDarkStyling = await page.evaluate(() => {
          const elem = document.querySelector('.input-dark');
          if (!elem) return null;
          const styles = window.getComputedStyle(elem);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor,
            borderWidth: styles.borderWidth,
            borderStyle: styles.borderStyle,
            padding: styles.padding,
            fontSize: styles.fontSize,
            fontFamily: styles.fontFamily
          };
        });

        console.log('\nInput-dark styling:');
        console.log(JSON.stringify(inputDarkStyling, null, 2));

        // Get the card styling
        const cardStyling = await page.evaluate(() => {
          const cards = document.querySelectorAll('.card');
          if (cards.length === 0) return null;
          const card = cards[cards.length - 1]; // Last card (the modal)
          const styles = window.getComputedStyle(card);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor
          };
        });

        console.log('\nCard/Modal styling:');
        console.log(JSON.stringify(cardStyling, null, 2));

        // Take zoomed screenshot of just the modal
        const modalOverlay = page.locator('div.fixed.inset-0');
        if (await modalOverlay.isVisible().catch(() => false)) {
          const box = await modalOverlay.boundingBox();
          if (box) {
            await page.screenshot({
              path: `/tmp/directv-edit-modal-zoomed.png`,
              clip: {
                x: Math.max(0, box.x),
                y: Math.max(0, box.y),
                width: Math.min(1920, box.width),
                height: Math.min(1080, box.height)
              }
            });
          }
        }
      }

      console.log('\nScreenshots saved:');
      console.log('- /tmp/directv-edit-window.png');
      console.log('- /tmp/directv-edit-modal-zoomed.png');

    } else {
      console.log('No edit buttons found');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

finalDirectTVCapture().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
