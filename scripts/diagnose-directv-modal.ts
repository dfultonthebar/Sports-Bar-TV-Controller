import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function captureDirectVModal() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Setup console and network logging
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('[INFO] Starting DirecTV modal diagnostic...');

    // Navigate to device config
    console.log('[INFO] Navigating to http://localhost:3001/device-config');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Take screenshot of the page before opening modal
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-device-config-loaded.png',
      fullPage: false
    });
    console.log('[SUCCESS] Captured: /tmp/ui-screenshots/01-device-config-loaded.png');

    // Find and click DirecTV device
    console.log('[INFO] Looking for DirecTV device card...');
    const directvCard = page.locator('div:has-text("Direct TV"), button:has-text("Direct TV")').first();

    // Wait for the card to be visible
    const isVisible = await directvCard.isVisible().catch(() => false);

    if (!isVisible) {
      console.log('[WARNING] DirecTV card not found in immediate view. Scrolling...');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      // Try to find any device cards to click
      const deviceCards = page.locator('[data-testid*="device"], .device-card, [class*="device"]');
      const count = await deviceCards.count();
      console.log(`[INFO] Found ${count} potential device cards`);

      if (count > 0) {
        await page.screenshot({
          path: '/tmp/ui-screenshots/02-device-cards-view.png',
          fullPage: true
        });
        console.log('[SUCCESS] Captured: /tmp/ui-screenshots/02-device-cards-view.png');
      }
    }

    // Look for edit button on DirecTV devices
    console.log('[INFO] Searching for DirecTV device and edit button...');
    const devices = page.locator('div').filter({ hasText: /Direct TV|DirectTV/ });
    const deviceCount = await devices.count();
    console.log(`[INFO] Found ${deviceCount} DirecTV device references`);

    if (deviceCount > 0) {
      // Click the first DirecTV device card
      const firstDevice = devices.first();
      await firstDevice.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Try to click the edit/pencil icon
      const editButton = firstDevice.locator('button[aria-label*="edit"], button svg, [data-testid*="edit"]').first();
      const editButtonExists = await editButton.isVisible().catch(() => false);

      if (editButtonExists) {
        console.log('[INFO] Found and clicking edit button...');
        await editButton.click();
      } else {
        console.log('[INFO] Edit button not found. Trying to click device card itself...');
        await firstDevice.click();
      }

      // Wait for modal to appear
      await page.waitForTimeout(1000);

      // Check if modal is open
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]').first();
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        console.log('[SUCCESS] Modal detected and visible');

        // Capture full modal
        await page.screenshot({
          path: '/tmp/ui-screenshots/03-directv-edit-modal-full.png',
          fullPage: false
        });
        console.log('[SUCCESS] Captured: /tmp/ui-screenshots/03-directv-edit-modal-full.png');

        // Extract color information using JavaScript
        console.log('[INFO] Extracting CSS color information...');
        const colorInfo = await page.evaluate(() => {
          const results: any[] = [];

          // Get modal background
          const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"], [class*="Modal"]');
          modals.forEach((modal: any, idx: number) => {
            const computed = window.getComputedStyle(modal);
            results.push({
              element: `modal-${idx}`,
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              classes: modal.className
            });
          });

          // Get helper text elements
          const helperTexts = document.querySelectorAll('[class*="helper"], [class*="description"], .text-sm.text-gray, p:not([class])');
          helperTexts.forEach((el: any, idx: number) => {
            const computed = window.getComputedStyle(el);
            const text = el.textContent?.substring(0, 50) || '';
            results.push({
              element: `helper-text-${idx}`,
              text,
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              classes: el.className
            });
          });

          // Look specifically for input field helper text
          const inputs = document.querySelectorAll('input');
          inputs.forEach((input: any, idx: number) => {
            const parent = input.parentElement;
            const nextElement = input.nextElementSibling;
            if (nextElement) {
              const computed = window.getComputedStyle(nextElement);
              results.push({
                element: `input-helper-${idx}`,
                inputName: input.name || input.id || 'unknown',
                helperText: nextElement.textContent?.substring(0, 50) || '',
                backgroundColor: computed.backgroundColor,
                color: computed.color,
                classes: nextElement.className
              });
            }
          });

          return results;
        });

        console.log('[INFO] CSS Color Information Found:');
        console.log(JSON.stringify(colorInfo, null, 2));

        // Capture closeup of helper text area
        const helperTextElements = page.locator('[class*="helper"], [class*="description"], .text-sm, p');
        const helperCount = await helperTextElements.count();
        console.log(`[INFO] Found ${helperCount} potential helper text elements`);

        if (helperCount > 0) {
          const firstHelper = helperTextElements.first();
          const box = await firstHelper.boundingBox();

          if (box) {
            console.log(`[INFO] First helper text element bounding box:`, box);

            // Capture closeup
            await page.screenshot({
              path: '/tmp/ui-screenshots/04-helper-text-closeup.png',
              clip: {
                x: Math.max(0, box.x - 20),
                y: Math.max(0, box.y - 10),
                width: box.width + 40,
                height: box.height + 20
              }
            });
            console.log('[SUCCESS] Captured: /tmp/ui-screenshots/04-helper-text-closeup.png');
          }
        }

        // Get detailed modal structure
        const modalStructure = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"], .modal');
          if (!modal) return null;

          return {
            tagName: modal.tagName,
            classes: (modal as any).className,
            id: (modal as any).id,
            style: (modal as any).getAttribute('style'),
            backgroundColor: window.getComputedStyle(modal).backgroundColor,
            color: window.getComputedStyle(modal).color,
            children: Array.from(modal.children).map((child: any, idx: number) => ({
              index: idx,
              tagName: child.tagName,
              classes: child.className,
              backgroundColor: window.getComputedStyle(child).backgroundColor,
              textContent: child.textContent?.substring(0, 50)
            }))
          };
        });

        console.log('[INFO] Modal Structure:');
        console.log(JSON.stringify(modalStructure, null, 2));

        // Look specifically at IP Address, Port, and Matrix Input fields
        const fieldInfo = await page.evaluate(() => {
          const results: any = {};

          // Find all labels
          const labels = document.querySelectorAll('label');
          labels.forEach((label: any) => {
            const text = label.textContent;
            if (text?.includes('IP Address') || text?.includes('Port') || text?.includes('Matrix Input')) {
              const parent = label.parentElement?.parentElement || label.parentElement;
              const nextSiblings = parent?.querySelectorAll('p, small, span, div');

              results[text] = {
                labelColor: window.getComputedStyle(label).color,
                labelBackground: window.getComputedStyle(label).backgroundColor,
                nextElements: Array.from(nextSiblings || []).map((el: any) => ({
                  text: el.textContent?.substring(0, 60),
                  color: window.getComputedStyle(el).color,
                  backgroundColor: window.getComputedStyle(el).backgroundColor,
                  classes: el.className
                }))
              };
            }
          });

          return results;
        });

        console.log('[INFO] Field-Specific Color Information:');
        console.log(JSON.stringify(fieldInfo, null, 2));

        // Save detailed report
        const report = {
          timestamp: new Date().toISOString(),
          url: page.url(),
          colorInfo,
          modalStructure,
          fieldInfo
        };

        fs.writeFileSync(
          '/tmp/ui-screenshots/directv-modal-diagnosis.json',
          JSON.stringify(report, null, 2)
        );
        console.log('[SUCCESS] Saved detailed report: /tmp/ui-screenshots/directv-modal-diagnosis.json');

      } else {
        console.log('[WARNING] Modal did not appear. Taking screenshot of current state...');
        await page.screenshot({
          path: '/tmp/ui-screenshots/03-directv-no-modal-found.png',
          fullPage: true
        });
      }
    } else {
      console.log('[WARNING] No DirecTV devices found on page');
      await page.screenshot({
        path: '/tmp/ui-screenshots/03-device-config-full.png',
        fullPage: true
      });
    }

  } catch (error) {
    console.error('[ERROR] Script failed:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('[INFO] Browser closed');
    console.log('[INFO] All console logs:');
    consoleLogs.forEach(log => console.log(log));
  }
}

captureDirectVModal().catch(console.error);
