import { chromium } from 'playwright';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function captureEditWithHover() {
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
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    await directvTab.click();
    await page.waitForTimeout(1500);

    // Get the first device card
    console.log('Finding first device card...');
    const firstDeviceCard = page.locator('[class*="card"], [class*="Card"]').filter({ hasText: 'Direct TV 1' }).first();

    if (await firstDeviceCard.isVisible()) {
      console.log('Found first device card');

      // Hover over the card to see if action buttons appear
      console.log('Hovering over device card...');
      await firstDeviceCard.hover();
      await page.waitForTimeout(500);

      // Screenshot after hover
      await page.screenshot({
        path: `/tmp/directv-card-hover.png`,
        fullPage: false
      });

      // Look for buttons within or near the card
      const cardButtons = firstDeviceCard.locator('button');
      const cardButtonCount = await cardButtons.count();
      console.log(`Buttons within first card: ${cardButtonCount}`);

      for (let i = 0; i < cardButtonCount; i++) {
        const btn = cardButtons.nth(i);
        const title = await btn.getAttribute('title');
        const ariaLabel = await btn.getAttribute('aria-label');
        const innerHTML = await btn.evaluate(el => el.innerHTML.substring(0, 100));

        console.log(`  Button ${i}: title="${title}", aria-label="${ariaLabel}"`);
      }

      // Try clicking on the first button within the card (not the device name button itself)
      const cardBtns = await firstDeviceCard.locator('button').all();
      if (cardBtns.length > 1) {
        // Skip the first button (which is the device main button)
        // Try clicking on buttons after the main device button

        console.log('\nLooking for edit button...');
        for (let i = 1; i < cardBtns.length; i++) {
          const btn = cardBtns[i];
          const title = await btn.getAttribute('title');

          if (title === 'Edit device') {
            console.log(`Found edit button at index ${i}`);
            await btn.click();
            await page.waitForTimeout(1500);

            // Check for modal
            const dialog = page.locator('[role="dialog"]');
            const modalVisible = await dialog.isVisible({ timeout: 2000 }).catch(() => false);

            if (modalVisible) {
              console.log('Modal appeared!');
              await page.screenshot({
                path: `/tmp/directv-edit-window.png`,
                fullPage: false
              });

              // Get form details
              const inputs = page.locator('input');
              const inputCount = await inputs.count();
              console.log(`Found ${inputCount} input fields`);

              // Get dialog bounding box
              const dialogBox = await dialog.boundingBox();
              if (dialogBox) {
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
            }

            break;
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureEditWithHover().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
