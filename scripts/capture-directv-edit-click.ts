import { chromium } from 'playwright';

const DEVICE_CONFIG_URL = 'http://localhost:3001/device-config';

async function captureDirectTVEditClick() {
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

    // Find the first Direct TV device card
    const firstDevice = page.locator('button').filter({ hasText: /Direct TV 1/ }).first();
    console.log('Found first device button');

    // Find the edit button within the same card context
    // The edit button should be close to the device button
    const allButtons = page.locator('button');

    // Get index of device button
    const deviceButtonIndex = await allButtons.evaluate((buttons, targetBtn) => {
      const arr = Array.from(buttons);
      for (let i = 0; i < arr.length; i++) {
        if (arr[i].textContent?.includes('Direct TV 1')) {
          return i;
        }
      }
      return -1;
    }, firstDevice);

    console.log(`Device button is at index: ${deviceButtonIndex}`);

    // Edit button should be 2 positions after device button
    // (device button, then subscription button, then edit button)
    const editButtonIndex = deviceButtonIndex + 2;
    console.log(`Trying edit button at index: ${editButtonIndex}`);

    const editButton = allButtons.nth(editButtonIndex);
    const editTitle = await editButton.getAttribute('title');
    console.log(`Edit button title: "${editTitle}"`);

    if (editTitle === 'Edit device') {
      console.log('Confirmed this is the edit button. Clicking...');

      // Click the edit button
      await editButton.click();

      // Wait longer for modal to appear
      await page.waitForTimeout(2000);

      // Check for modal with different selectors
      const dialog = page.locator('[role="dialog"]');
      const dialogVisible = await dialog.isVisible({ timeout: 3000 }).catch(() => false);

      if (!dialogVisible) {
        // Try other modal selectors
        const modalDiv = page.locator('div[class*="modal"], div[class*="Modal"], div[class*="dialog"], div[class*="Dialog"]');
        const modalVisible2 = await modalDiv.first().isVisible({ timeout: 1000 }).catch(() => false);

        console.log(`Dialog with role="dialog": ${dialogVisible}`);
        console.log(`Modal div: ${modalVisible2}`);
      } else {
        console.log('Modal found!');
      }

      // Capture full page to see if anything changed
      await page.screenshot({
        path: `/tmp/directv-after-edit-click.png`,
        fullPage: true
      });

      // Also check for any newly visible elements
      const allText = await page.evaluate(() => {
        return document.body.innerText.substring(0, 500);
      });

      console.log('Page content sample:');
      console.log(allText);

    } else {
      console.log(`Button at index ${editButtonIndex} is not the edit button (title: "${editTitle}")`);

      // Try searching differently
      console.log('\nSearching for all buttons with "Edit device" title...');
      const editButtons = page.locator('button[title="Edit device"]');
      const editCount = await editButtons.count();
      console.log(`Found ${editCount} edit buttons`);

      if (editCount > 0) {
        console.log('Clicking first edit device button...');
        await editButtons.first().click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: `/tmp/directv-after-edit-button-click.png`,
          fullPage: true
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

captureDirectTVEditClick().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
