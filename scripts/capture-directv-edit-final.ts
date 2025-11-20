import { chromium } from 'playwright';

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

    // Click DirecTV tab
    console.log('Clicking DirecTV tab...');
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    await directvTab.click();
    await page.waitForTimeout(1500);

    console.log('Capturing DirecTV devices list...');
    await page.screenshot({
      path: `/tmp/directv-devices-list.png`,
      fullPage: true
    });

    // Button 14 is the edit button for the first device (square-pen icon)
    console.log('Clicking edit button for first DirecTV device...');
    const allButtons = page.locator('button');
    const editButton = allButtons.nth(14);
    await editButton.click();
    await page.waitForTimeout(1500);

    // Wait for modal to appear
    const dialog = page.locator('[role="dialog"]');
    const modalVisible = await dialog.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Modal visible: ${modalVisible}`);

    if (modalVisible) {
      console.log('Modal found! Capturing screenshots...');

      // Screenshot 1: Full modal
      console.log('Capturing full modal...');
      await page.screenshot({
        path: `/tmp/directv-edit-window.png`,
        fullPage: false
      });

      // Get form field information
      const inputs = page.locator('input');
      const inputCount = await inputs.count();
      const selects = page.locator('select');
      const selectCount = await selects.count();

      console.log(`\nForm fields found:`);
      console.log(`- Input fields: ${inputCount}`);
      console.log(`- Select fields: ${selectCount}`);

      // List input fields
      console.log('\nInput fields:');
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const type = await input.getAttribute('type');
        const name = await input.getAttribute('name');
        const placeholder = await input.getAttribute('placeholder');
        const value = await input.getAttribute('value');
        const id = await input.getAttribute('id');
        const label = await input.evaluate(el => {
          const formGroup = el.closest('div[class*="space-y"]');
          if (!formGroup) return null;
          const labelEl = formGroup.querySelector('label');
          return labelEl ? labelEl.textContent : null;
        });

        console.log(`  Input ${i}:`);
        console.log(`    type: ${type}`);
        console.log(`    name: ${name}`);
        console.log(`    id: ${id}`);
        console.log(`    label: ${label}`);
        console.log(`    placeholder: ${placeholder}`);
        console.log(`    value: ${value}`);
      }

      // List select fields
      if (selectCount > 0) {
        console.log('\nSelect fields:');
        for (let i = 0; i < selectCount; i++) {
          const select = selects.nth(i);
          const name = await select.getAttribute('name');
          const id = await select.getAttribute('id');
          const label = await select.evaluate(el => {
            const formGroup = el.closest('div[class*="space-y"]');
            if (!formGroup) return null;
            const labelEl = formGroup.querySelector('label');
            return labelEl ? labelEl.textContent : null;
          });

          console.log(`  Select ${i}:`);
          console.log(`    name: ${name}`);
          console.log(`    id: ${id}`);
          console.log(`    label: ${label}`);
        }
      }

      // Get modal bounding box for zoomed screenshot
      const dialogBox = await dialog.boundingBox();
      if (dialogBox) {
        console.log(`\nModal bounding box: ${JSON.stringify(dialogBox)}`);

        // Capture zoomed modal with padding
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

      // Try to get the actual background color and styling info
      const stylingInfo = await dialog.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          borderColor: styles.borderColor,
          borderRadius: styles.borderRadius
        };
      });

      console.log(`\nModal styling:`);
      console.log(JSON.stringify(stylingInfo, null, 2));

      // Check input styling
      if (inputCount > 0) {
        const inputStyling = await inputs.nth(0).evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderColor: styles.borderColor,
            borderWidth: styles.borderWidth,
            padding: styles.padding,
            fontSize: styles.fontSize
          };
        });

        console.log(`\nFirst input field styling:`);
        console.log(JSON.stringify(inputStyling, null, 2));
      }

      console.log('\nScreenshots saved:');
      console.log('- /tmp/directv-edit-window.png');
      console.log('- /tmp/directv-edit-modal-zoomed.png');
      console.log('- /tmp/directv-devices-list.png');

    } else {
      console.log('Modal did not appear!');
      await page.screenshot({
        path: `/tmp/directv-no-modal.png`,
        fullPage: true
      });
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureDirectTVEditModal().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
