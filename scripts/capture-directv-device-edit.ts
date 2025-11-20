import { chromium } from 'playwright';
import fs from 'fs';

async function captureDirectVEditModal() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[INFO] Starting DirecTV device edit modal capture...');

    // Navigate to device config
    console.log('[INFO] Navigating to device config page');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click on DirecTV tab
    console.log('[INFO] Clicking DirecTV tab...');
    const directvTab = page.locator('button:has-text("DirecTV")').first();
    await directvTab.click();
    await page.waitForTimeout(1000);

    // Take screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-directv-section.png',
      fullPage: false
    });
    console.log('[SUCCESS] Captured DirecTV section');

    // Find a DirecTV device button to click
    console.log('[INFO] Looking for DirecTV device to click...');
    const deviceButtons = page.locator('button:has-text("Direct TV")');
    const deviceCount = await deviceButtons.count();
    console.log(`[INFO] Found ${deviceCount} DirecTV device buttons`);

    if (deviceCount > 0) {
      // Get the first device button
      const firstDevice = deviceButtons.first();
      const text = await firstDevice.textContent();
      console.log(`[INFO] First device text: "${text}"`);

      // Click on it
      console.log('[INFO] Clicking first DirecTV device...');
      await firstDevice.click();
      await page.waitForTimeout(1500);

      // Take screenshot after click
      await page.screenshot({
        path: '/tmp/ui-screenshots/02-device-clicked.png',
        fullPage: false
      });
      console.log('[SUCCESS] Captured after device click');

      // Check if modal or detail view opened
      const modal = page.locator('[role="dialog"]');
      const modalVisible = await modal.isVisible().catch(() => false);

      console.log(`[INFO] Modal visible: ${modalVisible}`);

      if (modalVisible) {
        console.log('[INFO] Modal found, capturing...');

        // Full modal screenshot
        await page.screenshot({
          path: '/tmp/ui-screenshots/03-directv-edit-modal-full.png',
          fullPage: false
        });
        console.log('[SUCCESS] Captured full modal');

        // Analyze colors
        const colorAnalysis = await page.evaluate(() => {
          const analysis: any = {
            modal: {},
            fields: [],
            allText: []
          };

          // Get modal info
          const modal = document.querySelector('[role="dialog"]');
          if (modal) {
            const computed = window.getComputedStyle(modal);
            analysis.modal = {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              className: (modal as any).className,
              style: (modal as any).getAttribute('style')
            };

            // Get all text elements inside modal
            const textElements = modal.querySelectorAll('*');
            textElements.forEach((el, idx) => {
              const text = el.textContent?.trim();
              if (text && text.length > 0 && text.length < 200 && idx < 50) {
                const computed = window.getComputedStyle(el);
                // Only include if it has meaningful text
                if (el.children.length === 0 || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                  analysis.allText.push({
                    tag: el.tagName,
                    text: text.substring(0, 80),
                    color: computed.color,
                    backgroundColor: computed.backgroundColor,
                    fontSize: computed.fontSize,
                    fontWeight: computed.fontWeight,
                    className: (el as any).className
                  });
                }
              }
            });
          }

          // Get all input-related fields
          const inputs = document.querySelectorAll('input, textarea, select');
          inputs.forEach((input, idx) => {
            const computed = window.getComputedStyle(input);
            const fieldData: any = {
              index: idx,
              type: (input as any).type || input.tagName,
              name: (input as any).name || (input as any).id,
              placeholder: (input as any).placeholder,
              value: (input as any).value?.substring(0, 50),
              color: computed.color,
              backgroundColor: computed.backgroundColor
            };

            // Get label
            const label = document.querySelector(`label[for="${(input as any).id}"]`);
            if (label) {
              const labelComputed = window.getComputedStyle(label);
              fieldData.label = {
                text: label.textContent?.trim(),
                color: labelComputed.color,
                backgroundColor: labelComputed.backgroundColor
              };
            }

            // Get parent to find helper text
            let parent = input.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
              const children = parent.querySelectorAll('p, small, span, div');
              children.forEach((child) => {
                const childText = child.textContent?.trim();
                if (childText && childText.length > 5 && childText.length < 150 &&
                    !childText.includes(fieldData.value)) {
                  const childComputed = window.getComputedStyle(child);
                  if (!fieldData.helpers) fieldData.helpers = [];
                  fieldData.helpers.push({
                    text: childText.substring(0, 80),
                    color: childComputed.color,
                    backgroundColor: childComputed.backgroundColor,
                    fontSize: childComputed.fontSize,
                    classes: (child as any).className
                  });
                }
              });
              parent = parent.parentElement;
              depth++;
            }

            analysis.fields.push(fieldData);
          });

          return analysis;
        });

        console.log('[INFO] Color Analysis:');
        console.log(JSON.stringify(colorAnalysis, null, 2));

        // Save to file
        fs.writeFileSync(
          '/tmp/ui-screenshots/directv-color-analysis.json',
          JSON.stringify(colorAnalysis, null, 2)
        );
        console.log('[SUCCESS] Saved analysis to /tmp/ui-screenshots/directv-color-analysis.json');

        // Capture closeup of helper text if any
        const helpersWithText = colorAnalysis.allText.filter((el: any) =>
          el.text.toLowerCase().includes('address') ||
          el.text.toLowerCase().includes('port') ||
          el.text.toLowerCase().includes('matrix') ||
          el.text.toLowerCase().includes('optional') ||
          el.text.toLowerCase().includes('required')
        );

        if (helpersWithText.length > 0) {
          console.log(`[INFO] Found ${helpersWithText.length} potential helper text elements`);
          console.log('[INFO] Helper text colors:');
          helpersWithText.forEach((helper: any) => {
            console.log(`  - "${helper.text}"`);
            console.log(`    Color: ${helper.color}`);
            console.log(`    Background: ${helper.backgroundColor}`);
            console.log(`    Classes: ${helper.className}`);
          });

          // Try to locate and capture first helper text element
          const helperLocator = page.locator(`text=/address|port|matrix|optional|required/i`).first();
          const helperVisible = await helperLocator.isVisible().catch(() => false);

          if (helperVisible) {
            const box = await helperLocator.boundingBox();
            if (box) {
              await page.screenshot({
                path: '/tmp/ui-screenshots/04-helper-text-closeup.png',
                clip: {
                  x: Math.max(0, box.x - 40),
                  y: Math.max(0, box.y - 15),
                  width: Math.min(box.width + 80, 600),
                  height: box.height + 30
                }
              });
              console.log('[SUCCESS] Captured helper text closeup');
            }
          }
        }

        // Get the modal boundary and capture just the modal
        const modalBox = await modal.boundingBox();
        if (modalBox) {
          console.log(`[INFO] Modal dimensions: ${modalBox.width}x${modalBox.height} at (${modalBox.x}, ${modalBox.y})`);

          await page.screenshot({
            path: '/tmp/ui-screenshots/05-modal-cropped.png',
            clip: {
              x: Math.max(0, modalBox.x - 10),
              y: Math.max(0, modalBox.y - 10),
              width: Math.min(modalBox.width + 20, 1900),
              height: Math.min(modalBox.height + 20, 1070)
            }
          });
          console.log('[SUCCESS] Captured cropped modal view');
        }

      } else {
        console.log('[INFO] No modal found, device may have opened in detail view');
        await page.screenshot({
          path: '/tmp/ui-screenshots/02-device-detail-view.png',
          fullPage: false
        });

        // Look for an edit button in the detail view
        const editButton = page.locator('button:has-text("Edit"), button:has-text("Manage"), [aria-label*="edit"]').first();
        const editVisible = await editButton.isVisible().catch(() => false);

        if (editVisible) {
          console.log('[INFO] Found edit button in detail view, clicking...');
          await editButton.click();
          await page.waitForTimeout(1000);

          await page.screenshot({
            path: '/tmp/ui-screenshots/03-directv-edit-modal-full.png',
            fullPage: false
          });
          console.log('[SUCCESS] Captured modal from detail view');
        }
      }
    } else {
      console.log('[WARNING] No DirecTV devices found');
      await page.screenshot({
        path: '/tmp/ui-screenshots/01-no-devices.png',
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
    console.log('[INFO] Capture complete');
  }
}

captureDirectVEditModal().catch(console.error);
