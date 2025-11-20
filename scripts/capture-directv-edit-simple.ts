import { chromium } from 'playwright';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function captureDirectTVEditSimple() {
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

    // Find all buttons with title "Edit device"
    console.log('Searching for "Edit device" buttons...');
    const editButtons = page.locator('button[title="Edit device"]');
    const editCount = await editButtons.count();
    console.log(`Found ${editCount} edit device buttons`);

    if (editCount > 0) {
      console.log('Clicking first "Edit device" button...');
      await editButtons.first().click();
      await page.waitForTimeout(2500);

      // Check for modal
      const dialog = page.locator('[role="dialog"]');
      const modalVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`Modal visible: ${modalVisible}`);

      if (modalVisible) {
        console.log('SUCCESS! Edit modal opened.');

        // Get form details
        const inputs = page.locator('input');
        const inputCount = await inputs.count();
        const selects = page.locator('select');
        const selectCount = await selects.count();

        console.log(`\nForm contents:`);
        console.log(`- Input fields: ${inputCount}`);
        console.log(`- Select fields: ${selectCount}`);

        // List inputs
        for (let i = 0; i < inputCount; i++) {
          const input = inputs.nth(i);
          const type = await input.getAttribute('type');
          const name = await input.getAttribute('name');
          const placeholder = await input.getAttribute('placeholder');
          console.log(`  Input ${i}: type="${type}", name="${name}", placeholder="${placeholder}"`);
        }

        // Screenshot full modal
        console.log('\nCapturing edit modal screenshot...');
        await page.screenshot({
          path: `/tmp/directv-edit-window.png`,
          fullPage: false
        });

        // Capture zoomed view
        const dialogBox = await dialog.boundingBox();
        if (dialogBox) {
          await page.screenshot({
            path: `/tmp/directv-edit-modal-zoomed.png`,
            clip: {
              x: Math.max(0, dialogBox.x - 20),
              y: Math.max(0, dialogBox.y - 20),
              width: Math.min(1920, dialogBox.width + 40),
              height: Math.min(1080, dialogBox.height + 40)
            }
          });

          console.log('Screenshots saved:');
          console.log('- /tmp/directv-edit-window.png');
          console.log('- /tmp/directv-edit-modal-zoomed.png');
        }

        // Get styling info
        console.log('\nCapturing styling information...');
        const modalStyling = await dialog.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            borderRadius: styles.borderRadius
          };
        });

        console.log(`Modal styling: ${JSON.stringify(modalStyling, null, 2)}`);

        if (inputCount > 0) {
          const inputStyling = await inputs.nth(0).evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              borderColor: styles.borderColor,
              fontSize: styles.fontSize,
              padding: styles.padding
            };
          });

          console.log(`\nFirst input field styling:`);
          console.log(JSON.stringify(inputStyling, null, 2));
        }

      } else {
        console.log('Modal did not appear');
        await page.screenshot({
          path: `/tmp/directv-no-modal-appeared.png`,
          fullPage: true
        });
      }
    } else {
      console.log('No edit device buttons found');
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureDirectTVEditSimple().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
