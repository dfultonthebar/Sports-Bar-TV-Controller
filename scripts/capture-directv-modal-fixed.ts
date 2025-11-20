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
    console.log('[INFO] Starting DirecTV modal diagnostic...');

    // Navigate to device config
    console.log('[INFO] Navigating to device config page');
    await page.goto('http://localhost:3001/device-config', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Take initial screenshot
    await page.screenshot({
      path: '/tmp/ui-screenshots/01-device-config-page.png',
      fullPage: false
    });
    console.log('[SUCCESS] Captured device config page');

    // Click on DirecTV tab/button
    console.log('[INFO] Looking for DirecTV button...');
    const directvButton = page.locator('button:has-text("DirecTV"), [role="tab"]:has-text("DirecTV")').first();
    const isVisible = await directvButton.isVisible().catch(() => false);

    if (isVisible) {
      console.log('[INFO] Found DirecTV button, clicking...');
      await directvButton.click();
      await page.waitForTimeout(1000);

      // Take screenshot after clicking DirecTV
      await page.screenshot({
        path: '/tmp/ui-screenshots/02-directv-section.png',
        fullPage: false
      });
      console.log('[SUCCESS] Captured DirecTV section');
    } else {
      console.log('[WARNING] DirecTV button not found');
    }

    // Look for edit buttons on device cards
    console.log('[INFO] Looking for DirecTV device cards and edit buttons...');
    const editButtons = page.locator('button[aria-label*="edit"], button[title*="edit"], svg[viewBox*="pencil"]').first();
    const editCount = await page.locator('button[aria-label*="edit"]').count();
    console.log(`[INFO] Found ${editCount} edit buttons`);

    // Find all buttons and look for ones near "DirecTV" text
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();
    console.log(`[INFO] Scanning ${buttonCount} buttons for edit functionality...`);

    // Get list of all button texts
    const buttonTexts: string[] = [];
    for (let i = 0; i < Math.min(20, buttonCount); i++) {
      const text = await allButtons.nth(i).textContent();
      buttonTexts.push(text || '');
    }
    console.log('[INFO] Sample button texts:', buttonTexts);

    // Try clicking the first edit-like button
    const editButton = page.locator('button').filter({ hasText: /edit|pencil|configure/i }).first();
    const editExists = await editButton.isVisible().catch(() => false);

    if (editExists) {
      console.log('[INFO] Found edit button, clicking...');
      await editButton.click();
      await page.waitForTimeout(1500);

      // Take screenshot of modal
      await page.screenshot({
        path: '/tmp/ui-screenshots/03-directv-edit-modal-full.png',
        fullPage: false
      });
      console.log('[SUCCESS] Captured edit modal');

      // Look for helper text or description elements
      console.log('[INFO] Analyzing modal structure and colors...');

      // Get detailed color information
      const colorReport = await page.evaluate(() => {
        const report: any = {
          modal: null,
          fields: [],
          helperTexts: []
        };

        // Find the modal
        const modal = document.querySelector('[role="dialog"]');
        if (modal) {
          const computed = window.getComputedStyle(modal);
          report.modal = {
            backgroundColor: computed.backgroundColor,
            color: computed.color,
            classes: (modal as any).className,
            padding: computed.padding,
            borderRadius: computed.borderRadius
          };
        }

        // Find all input fields and their helpers
        const inputs = document.querySelectorAll('input');
        inputs.forEach((input, idx) => {
          const inputComputed = window.getComputedStyle(input);
          const fieldInfo: any = {
            index: idx,
            type: input.type,
            name: input.name,
            placeholder: input.placeholder,
            inputColor: inputComputed.color,
            inputBackground: inputComputed.backgroundColor
          };

          // Look for label
          const label = document.querySelector(`label[for="${input.id}"]`) ||
                       input.previousElementSibling;
          if (label) {
            const labelComputed = window.getComputedStyle(label);
            fieldInfo.label = {
              text: label.textContent,
              color: labelComputed.color,
              background: labelComputed.backgroundColor,
              fontSize: labelComputed.fontSize
            };
          }

          // Look for helper/description text after input
          let helper = input.nextElementSibling;
          let helperCount = 0;
          while (helper && helperCount < 3) {
            const helperText = helper.textContent?.trim();
            if (helperText && helperText.length > 0 && helperText.length < 200) {
              const helperComputed = window.getComputedStyle(helper);
              fieldInfo[`helper${helperCount}`] = {
                text: helperText.substring(0, 100),
                color: helperComputed.color,
                background: helperComputed.backgroundColor,
                fontSize: helperComputed.fontSize,
                tag: helper.tagName,
                classes: (helper as any).className
              };
            }
            helper = helper.nextElementSibling;
            helperCount++;
          }

          report.fields.push(fieldInfo);
        });

        // Find all text that looks like helper text (small gray text)
        const allElements = document.querySelectorAll('p, small, span, div');
        allElements.forEach((el) => {
          const text = el.textContent?.trim();
          if (text && text.length > 10 && text.length < 150) {
            const computed = window.getComputedStyle(el);
            const color = computed.color;
            const bg = computed.backgroundColor;

            // Check if this might be helper text (typically gray-ish)
            if (text.toLowerCase().includes('address') ||
                text.toLowerCase().includes('port') ||
                text.toLowerCase().includes('matrix') ||
                text.toLowerCase().includes('zone') ||
                text.toLowerCase().includes('required') ||
                text.toLowerCase().includes('optional')) {
              report.helperTexts.push({
                text: text.substring(0, 80),
                color,
                background: bg,
                fontSize: computed.fontSize,
                tag: el.tagName,
                classes: (el as any).className
              });
            }
          }
        });

        return report;
      });

      console.log('[INFO] Color Analysis Report:');
      console.log(JSON.stringify(colorReport, null, 2));

      // Save report to file
      fs.writeFileSync(
        '/tmp/ui-screenshots/directv-modal-color-report.json',
        JSON.stringify(colorReport, null, 2)
      );
      console.log('[SUCCESS] Saved color report to /tmp/ui-screenshots/directv-modal-color-report.json');

      // Capture closeup of a helper text element
      const helperElements = page.locator('p:visible, small:visible, [class*="helper"]:visible, [class*="description"]:visible');
      const helperCount = await helperElements.count();
      console.log(`[INFO] Found ${helperCount} potential helper text elements`);

      if (helperCount > 0) {
        const firstHelper = helperElements.first();
        const box = await firstHelper.boundingBox();

        if (box) {
          console.log(`[INFO] Helper text position:`, box);

          // Capture closeup
          await page.screenshot({
            path: '/tmp/ui-screenshots/04-helper-text-closeup.png',
            clip: {
              x: Math.max(0, box.x - 30),
              y: Math.max(0, box.y - 20),
              width: box.width + 60,
              height: box.height + 40
            }
          });
          console.log('[SUCCESS] Captured helper text closeup');
        }
      }

      // Capture the entire modal area for reference
      const modal = page.locator('[role="dialog"]').first();
      const modalBox = await modal.boundingBox();

      if (modalBox) {
        console.log(`[INFO] Modal position:`, modalBox);

        // Capture just the modal with extra padding
        await page.screenshot({
          path: '/tmp/ui-screenshots/05-modal-only.png',
          clip: {
            x: Math.max(0, modalBox.x - 20),
            y: Math.max(0, modalBox.y - 20),
            width: modalBox.width + 40,
            height: modalBox.height + 40
          }
        });
        console.log('[SUCCESS] Captured modal-only view');
      }

    } else {
      console.log('[WARNING] Could not find edit button');

      // List all buttons to debug
      const buttons = page.locator('button');
      const count = await buttons.count();
      console.log(`[INFO] Total buttons on page: ${count}`);

      // Get first 10 button texts and ARIA labels
      for (let i = 0; i < Math.min(10, count); i++) {
        const btn = buttons.nth(i);
        const text = await btn.textContent();
        const ariaLabel = await btn.getAttribute('aria-label');
        console.log(`  Button ${i}: text="${text}" aria-label="${ariaLabel}"`);
      }
    }

  } catch (error) {
    console.error('[ERROR] Script failed:', error);
    await page.screenshot({
      path: '/tmp/ui-screenshots/error-state.png',
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('[INFO] Diagnostic complete');
  }
}

captureDirectVEditModal().catch(console.error);
